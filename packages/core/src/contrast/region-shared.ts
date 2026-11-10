import type { Color } from '../types.js';
import type { Gamut } from '../gamut/spec.js';
import { assertGamut } from '../gamut/target.js';
import type { PlanePoint } from '../geometry/types.js';
import { linearToSrgbChannel } from '../utils/index.js';
import {
  apcaContrastOfLuminances,
  apcaLuminanceOfEncoded,
  apcaScreenLuminance,
  contrastAPCA,
  contrastRatio,
  relativeLuminance,
  wcagLuminanceOfLinear,
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

/**
 * Sampling options as the contrast-region solver runs them, with defaults
 * filled in and limits applied; returned by
 * {@link clampContrastRegionSampling}.
 */
export interface ContrastRegionSampling {
  /** Initial samples per region side, at most 512. */
  initialSamples: number;
  /** Midpoint-to-chord split threshold in l/c units, at least 1e-6. */
  errorTolerance: number;
  /** Maximum halvings of an initial sample interval, at most 12. */
  maxDepth: number;
}

/**
 * Returns the effective sampling {@link contrastRegionPaths} runs with:
 * defaults filled in (`32`, `0.0015`, `6`), `initialSamples` capped at 512,
 * `maxDepth` at 12, and `errorTolerance` raised to at least 1e-6.
 *
 * It does not validate; values the solver rejects (such as
 * `initialSamples: 1`) are returned unchanged. Use it to show the effective
 * fidelity of a contrast overlay or to key a cache.
 *
 * @param options - The `initialSamples`, `errorTolerance` and `maxDepth`
 *   fields of {@link ContrastRegionPathOptions}; other fields are ignored.
 * @returns A new {@link ContrastRegionSampling} object.
 *
 * @example
 * ```ts
 * import { clampContrastRegionSampling } from '@pbroom/color-kit';
 *
 * clampContrastRegionSampling({ initialSamples: 1000, errorTolerance: 0 });
 * // → { initialSamples: 512, errorTolerance: 0.000001, maxDepth: 6 }
 * ```
 */
export function clampContrastRegionSampling(
  options: Pick<
    ContrastRegionPathOptions,
    'initialSamples' | 'errorTolerance' | 'maxDepth'
  >,
): ContrastRegionSampling {
  const {
    initialSamples = CONTRAST_REGION_DEFAULTS.initialSamples,
    errorTolerance = CONTRAST_REGION_DEFAULTS.errorTolerance,
    maxDepth = CONTRAST_REGION_DEFAULTS.maxDepth,
  } = options;
  return {
    initialSamples: Math.min(MAX_INITIAL_SAMPLES, initialSamples),
    errorTolerance: Math.max(MIN_ERROR_TOLERANCE, errorTolerance),
    maxDepth: Math.min(MAX_DEPTH_LIMIT, maxDepth),
  };
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
): ContrastRegionSampling {
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
  return clampContrastRegionSampling({
    initialSamples,
    errorTolerance,
    maxDepth,
  });
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
  /**
   * The contrast of `sample` against `reference` as the public metric
   * reports it: `contrastRatio` for WCAG, signed `contrastAPCA` (with
   * `apcaRole` applied) for APCA. `evaluate` is its margin.
   */
  measure: (sample: Color, reference: Color) => number;
  /** `measure` from the two displayed luminances. */
  measureLuminance: (sampleY: number, referenceY: number) => number;
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

function clip(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Displayed luminance of target-gamut linear channels, measured as the
 * public metric measures it: channels clipped to [0, 1] in the target gamut,
 * converted back to (extended-range) linear sRGB, then WCAG relative
 * luminance or APCA screen luminance of the result. The one display model
 * of the contrast-region solver, for every gamut descriptor.
 */
export function createDisplayLuminance(
  spec: Gamut,
  metric: ContrastMetric,
): (r: number, g: number, b: number) => number {
  const toSrgb = spec.toLinearSrgb;
  return (r, g, b) => {
    let lr = clip(r);
    let lg = clip(g);
    let lb = clip(b);
    if (toSrgb) {
      const pr = lr;
      const pg = lg;
      const pb = lb;
      lr = toSrgb[0][0] * pr + toSrgb[0][1] * pg + toSrgb[0][2] * pb;
      lg = toSrgb[1][0] * pr + toSrgb[1][1] * pg + toSrgb[1][2] * pb;
      lb = toSrgb[2][0] * pr + toSrgb[2][1] * pg + toSrgb[2][2] * pb;
    }
    return metric === 'apca'
      ? apcaLuminanceOfEncoded(
          linearToSrgbChannel(lr),
          linearToSrgbChannel(lg),
          linearToSrgbChannel(lb),
        )
      : wcagLuminanceOfLinear(lr, lg, lb);
  };
}

/**
 * The contrast criterion of `options`: metric, threshold and margin, measured
 * with the public metrics (`contrastRatio` / `contrastAPCA`) in
 * `options.gamut`, whatever descriptor that is. Validates the gamut.
 */
export function resolveContrastCriterion(
  options: ContrastRegionPathOptions,
  caller = 'contrastRegionPaths()',
): ResolvedContrastCriterion {
  assertGamut(options.gamut, caller);
  const metric = options.metric ?? 'wcag';
  const metricOptions: ContrastOptions = { gamut: options.gamut };
  if (metric === 'apca') {
    const preset = options.apcaPreset ?? 'body';
    const threshold =
      typeof options.threshold === 'number'
        ? options.threshold
        : APCA_PRESET_THRESHOLDS[preset];
    if (!Number.isFinite(threshold) || threshold <= 0) {
      throw new Error(`${caller} APCA threshold must be > 0`);
    }
    const polarity = options.apcaPolarity ?? 'absolute';
    const sampleIsBackground = options.apcaRole === 'sample-background';
    const margin = (lc: number): number => {
      if (polarity === 'positive') {
        return lc - threshold;
      }
      if (polarity === 'negative') {
        return -lc - threshold;
      }
      return Math.abs(lc) - threshold;
    };
    const measure = (sample: Color, reference: Color): number =>
      sampleIsBackground
        ? contrastAPCA(reference, sample, metricOptions)
        : contrastAPCA(sample, reference, metricOptions);
    const measureLuminance = (sampleY: number, referenceY: number): number =>
      sampleIsBackground
        ? apcaContrastOfLuminances(referenceY, sampleY)
        : apcaContrastOfLuminances(sampleY, referenceY);
    return {
      metric,
      threshold,
      measure,
      measureLuminance,
      evaluate: (sample, reference) => margin(measure(sample, reference)),
      luminance: (color) => apcaScreenLuminance(color, metricOptions),
      evaluateLuminance: (sampleY, referenceY) =>
        margin(measureLuminance(sampleY, referenceY)),
    };
  }

  const threshold = resolveContrastThreshold(options);
  if (!Number.isFinite(threshold) || threshold <= 1) {
    throw new Error(`${caller} requires threshold > 1`);
  }
  // `contrastRatio`'s arithmetic, kept inline so it adds nothing to that
  // function's bundle.
  const measureLuminance = (sampleY: number, referenceY: number): number =>
    (Math.max(sampleY, referenceY) + 0.05) /
    (Math.min(sampleY, referenceY) + 0.05);
  return {
    metric,
    threshold,
    measure: (sample, reference) =>
      contrastRatio(sample, reference, metricOptions),
    measureLuminance,
    evaluate: (sample, reference) =>
      contrastRatio(sample, reference, metricOptions) - threshold,
    luminance: (color) => relativeLuminance(color, metricOptions),
    evaluateLuminance: (sampleY, referenceY) =>
      measureLuminance(sampleY, referenceY) - threshold,
  };
}

export function toTracePoint(point: ContrastRegionPoint): PlanePoint {
  return { x: point.l, y: point.c };
}

export function toTracePaths(paths: ContrastRegionPoint[][]): PlanePoint[][] {
  return paths.map((path) => path.map(toTracePoint));
}
