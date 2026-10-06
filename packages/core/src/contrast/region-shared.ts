import type { Color } from '../types.js';
import { assertGamutTarget } from '../gamut/target.js';
import type { PlanePoint } from '../geometry/types.js';
import {
  apcaContrastOfLuminances,
  apcaScreenLuminance,
  contrastAPCA,
  contrastRatio,
  relativeLuminance,
  type ContrastOptions,
} from './metrics.js';
import type {
  ContrastApcaPreset,
  ContrastMetric,
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

/** Defaults of the contrast-region sampling options. */
export const CONTRAST_REGION_DEFAULTS = {
  initialSamples: 32,
  errorTolerance: 0.0015,
  maxDepth: 6,
  maxChroma: 0.4,
} as const;

/** Largest `initialSamples` used; larger values are clamped. */
export const MAX_INITIAL_SAMPLES = 512;
/** Largest `maxDepth` used; larger values are clamped. */
export const MAX_DEPTH_LIMIT = 12;
/** Smallest `errorTolerance` used; smaller values are clamped. */
export const MIN_ERROR_TOLERANCE = 1e-6;

/** Options of the removed legacy marching-squares engine. */
const LEGACY_OPTIONS = [
  'engine',
  'samplingMode',
  'edgeInterpolation',
  'adaptiveBaseSteps',
  'adaptiveMaxDepth',
];
/** Options of the removed hybrid solver. */
const HYBRID_OPTIONS = [
  'lightnessSteps',
  'chromaSteps',
  'hybridMaxDepth',
  'hybridErrorTolerance',
  'tolerance',
  'maxIterations',
];

/**
 * Options of removed contrast-region solvers. They are rejected rather than
 * ignored, so callers notice the removal.
 */
export const REMOVED_CONTRAST_REGION_OPTIONS = [
  ...LEGACY_OPTIONS,
  ...HYBRID_OPTIONS,
];

/** Throws a `TypeError` naming the first removed option `options` sets. */
export function rejectRemovedContrastOptions(
  options: object,
  caller: string,
): void {
  const bag = options as Record<string, unknown>;
  for (const name of REMOVED_CONTRAST_REGION_OPTIONS) {
    if (bag[name] !== undefined) {
      throw new TypeError(
        `${caller} option "${name}" was removed with the ${LEGACY_OPTIONS.includes(name) ? 'legacy contrast-region engine' : 'hybrid contrast-region solver'}; tune the solver with initialSamples, errorTolerance, and maxDepth`,
      );
    }
  }
}

export interface ResolvedContrastSampling {
  initialSamples: number;
  errorTolerance: number;
  maxDepth: number;
}

/**
 * Validates and clamps the sampling options: `initialSamples` an integer
 * >= 2 (at most 512), `maxDepth` an integer >= 0 (at most 12), and
 * `errorTolerance` a finite number > 0 (at least 1e-6).
 */
export function resolveContrastSampling(
  options: Pick<
    ContrastRegionPathOptions,
    'initialSamples' | 'errorTolerance' | 'maxDepth'
  >,
): ResolvedContrastSampling {
  const {
    initialSamples = CONTRAST_REGION_DEFAULTS.initialSamples,
    errorTolerance = CONTRAST_REGION_DEFAULTS.errorTolerance,
    maxDepth = CONTRAST_REGION_DEFAULTS.maxDepth,
  } = options;
  const check = (valid: boolean, rule: string) => {
    if (!valid) throw new Error(`contrastRegionPaths() ${rule}`);
  };
  check(
    Number.isInteger(initialSamples) && initialSamples >= 2,
    'initialSamples must be an integer >= 2',
  );
  check(
    Number.isInteger(maxDepth) && maxDepth >= 0,
    'maxDepth must be an integer >= 0',
  );
  check(
    Number.isFinite(errorTolerance) && errorTolerance > 0,
    'errorTolerance must be a finite number > 0',
  );
  return {
    initialSamples: Math.min(MAX_INITIAL_SAMPLES, initialSamples),
    errorTolerance: Math.max(MIN_ERROR_TOLERANCE, errorTolerance),
    maxDepth: Math.min(MAX_DEPTH_LIMIT, maxDepth),
  };
}

const APCA_PRESET_THRESHOLDS: Record<ContrastApcaPreset, number> = {
  body: 0.6,
  'large-text': 0.45,
  ui: 0.3,
};

export interface ResolvedContrastCriterion {
  metric: ContrastMetric;
  threshold: number;
  /**
   * Signed margin of `sample` against `reference`: `>= 0` passes. Uses the
   * public metric (`contrastRatio` / `contrastAPCA`) with the region's gamut,
   * so a point inside a region passes the matching check.
   */
  evaluate: (sample: Color, reference: Color) => number;
  /**
   * Displayed luminance of `color` as the metric measures it (WCAG relative
   * luminance or APCA screen luminance) in the region's gamut.
   */
  luminance: (color: Color) => number;
  /**
   * The margin of `evaluate` from the two displayed luminances, by the same
   * arithmetic the public metric uses.
   */
  evaluateLuminance: (sampleY: number, referenceY: number) => number;
}

function resolveContrastThreshold(options: ContrastRegionPathOptions): number {
  if (typeof options.threshold === 'number') {
    return options.threshold;
  }

  switch (options.level ?? 'AA') {
    case 'AAA':
      return 7;
    case 'AA-large':
      return 3;
    case 'AA':
    default:
      return 4.5;
  }
}

export function resolveContrastCriterion(
  options: ContrastRegionPathOptions,
): ResolvedContrastCriterion {
  const metric = options.metric ?? 'wcag';
  assertGamutTarget(options.gamut, 'contrastRegionPaths()');
  const metricOptions: ContrastOptions = { gamut: options.gamut ?? 'srgb' };
  if (metric === 'apca') {
    const preset = options.apcaPreset ?? 'body';
    const threshold =
      typeof options.threshold === 'number'
        ? options.threshold
        : APCA_PRESET_THRESHOLDS[preset];
    if (!Number.isFinite(threshold) || threshold <= 0) {
      throw new Error('contrastRegionPaths() APCA threshold must be > 0');
    }
    const polarity = options.apcaPolarity ?? 'absolute';
    const role = options.apcaRole ?? 'sample-text';
    const margin = (lc: number): number => {
      if (polarity === 'positive') {
        return lc - threshold;
      }
      if (polarity === 'negative') {
        return -lc - threshold;
      }
      return Math.abs(lc) - threshold;
    };
    return {
      metric,
      threshold,
      evaluate: (sample, reference) =>
        margin(
          role === 'sample-background'
            ? contrastAPCA(reference, sample, metricOptions)
            : contrastAPCA(sample, reference, metricOptions),
        ),
      luminance: (color) => apcaScreenLuminance(color, metricOptions),
      evaluateLuminance: (sampleY, referenceY) =>
        margin(
          role === 'sample-background'
            ? apcaContrastOfLuminances(referenceY, sampleY)
            : apcaContrastOfLuminances(sampleY, referenceY),
        ),
    };
  }

  const threshold = resolveContrastThreshold(options);
  if (!Number.isFinite(threshold) || threshold <= 1) {
    throw new Error('contrastRegionPaths() requires threshold > 1');
  }
  return {
    metric,
    threshold,
    evaluate: (sample, reference) =>
      contrastRatio(sample, reference, metricOptions) - threshold,
    luminance: (color) => relativeLuminance(color, metricOptions),
    // `contrastRatio`'s arithmetic, kept inline so it adds nothing to that
    // function's bundle.
    evaluateLuminance: (sampleY, referenceY) =>
      (Math.max(sampleY, referenceY) + 0.05) /
        (Math.min(sampleY, referenceY) + 0.05) -
      threshold,
  };
}

export function toTracePoint(point: ContrastRegionPoint): PlanePoint {
  return { x: point.l, y: point.c };
}

export function toTracePaths(paths: ContrastRegionPoint[][]): PlanePoint[][] {
  return paths.map((path) => path.map(toTracePoint));
}
