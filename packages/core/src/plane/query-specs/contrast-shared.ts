import {
  CONTRAST_REGION_DEFAULTS,
  MAX_DEPTH_LIMIT,
  MAX_INITIAL_SAMPLES,
  REMOVED_CONTRAST_REGION_OPTIONS,
} from '../../contrast/region-shared.js';
import type { ContrastRegionPathOptions } from '../../contrast/types.js';
import type { PlaneContrastQueryOptions } from '../types.js';

/**
 * Picks the contrast solver options out of a plane contrast query. Options
 * removed with earlier solvers are forwarded unchanged, so
 * `contrastRegionPaths` rejects them exactly as it does for direct calls.
 */
export function toContrastRegionPathOptions(
  query: PlaneContrastQueryOptions,
): ContrastRegionPathOptions {
  const options: ContrastRegionPathOptions = {
    gamut: query.gamut,
    metric: query.metric,
    level: query.level,
    threshold: query.threshold,
    apcaPreset: query.apcaPreset,
    apcaPolarity: query.apcaPolarity,
    apcaRole: query.apcaRole,
    maxChroma: query.maxChroma,
    alpha: query.alpha,
    simplifyTolerance: query.simplifyTolerance,
    initialSamples: query.initialSamples,
    errorTolerance: query.errorTolerance,
    maxDepth: query.maxDepth,
  };
  const source = query as unknown as Record<string, unknown>;
  const target = options as Record<string, unknown>;
  for (const name of REMOVED_CONTRAST_REGION_OPTIONS) {
    if (source[name] !== undefined) {
      target[name] = source[name];
    }
  }
  return options;
}

/**
 * Scheduler work estimate shared by contrast boundary and region queries:
 * roughly the contour points traced, from the sampling options (invalid
 * values fall back to the defaults; the query itself rejects them).
 */
export function contrastQueryBudget(query: PlaneContrastQueryOptions): number {
  const samples =
    Number.isInteger(query.initialSamples) && query.initialSamples! >= 2
      ? Math.min(MAX_INITIAL_SAMPLES, query.initialSamples!)
      : CONTRAST_REGION_DEFAULTS.initialSamples;
  const depth =
    Number.isInteger(query.maxDepth) && query.maxDepth! >= 0
      ? Math.min(MAX_DEPTH_LIMIT, query.maxDepth!)
      : CONTRAST_REGION_DEFAULTS.maxDepth;
  const errorTolerance =
    Number.isFinite(query.errorTolerance) && query.errorTolerance! > 0
      ? query.errorTolerance!
      : CONTRAST_REGION_DEFAULTS.errorTolerance;
  // Refinement stops at `depth` or at `errorTolerance`, whichever comes
  // first; a contour's sag shrinks with the square of the interval, so each
  // halving of the tolerance costs about sqrt(2) times the points.
  const precisionFactor = Math.min(
    2 ** (depth / 2),
    Math.max(
      1,
      Math.sqrt(CONTRAST_REGION_DEFAULTS.errorTolerance / errorTolerance),
    ),
  );
  const metricFactor = query.metric === 'apca' ? 1.5 : 1;
  // Fixed cost: the gamut-edge event scan (about 300 evaluations per side).
  return Math.round(64 + samples * 2 * precisionFactor * metricFactor);
}

/**
 * Scheduler telemetry signature shared by contrast boundary and region queries.
 */
export function contrastTelemetrySignature(
  query: PlaneContrastQueryOptions,
): string {
  const metric = query.metric ?? 'wcag';
  if (metric !== 'apca') {
    return metric;
  }
  return `${metric}:${query.apcaPolarity ?? 'absolute'}:${query.apcaRole ?? 'sample-text'}`;
}
