import type { Color } from '../types.js';
import { toP3Gamut, toSrgbGamut, type GamutTarget } from '../gamut/index.js';
import type { PlanePoint } from '../geometry/types.js';
import {
  contrastAPCA,
  contrastRatio,
  type ContrastOptions,
} from './metrics.js';
import type {
  ContrastApcaPreset,
  ContrastMetric,
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

/** Lightness edge-probe fractions the contrast-region solver samples. */
export const ADAPTIVE_EDGE_PROBES = [0.02, 0.05] as const;

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
}

export function mapToGamut(color: Color, gamut: GamutTarget): Color {
  return gamut === 'display-p3' ? toP3Gamut(color) : toSrgbGamut(color);
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
    return {
      metric,
      threshold,
      evaluate: (sample, reference) => {
        const lc =
          role === 'sample-background'
            ? contrastAPCA(reference, sample, metricOptions)
            : contrastAPCA(sample, reference, metricOptions);
        if (polarity === 'positive') {
          return lc - threshold;
        }
        if (polarity === 'negative') {
          return -lc - threshold;
        }
        return Math.abs(lc) - threshold;
      },
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
  };
}

export function validateSteps(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 2) {
    throw new Error(`${name} must be an integer >= 2`);
  }
  return value;
}

export function toTracePoint(point: ContrastRegionPoint): PlanePoint {
  return { x: point.l, y: point.c };
}

export function toTracePaths(paths: ContrastRegionPoint[][]): PlanePoint[][] {
  return paths.map((path) => path.map(toTracePoint));
}
