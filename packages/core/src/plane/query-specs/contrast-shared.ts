import { REMOVED_CONTRAST_REGION_OPTIONS } from '../../contrast/region.js';
import type { ContrastRegionPathOptions } from '../../contrast/types.js';
import type { PlaneContrastQueryOptions } from '../types.js';

/**
 * Picks the contrast solver options out of a plane contrast query. Options
 * removed with the legacy engine are forwarded unchanged, so
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
    lightnessSteps: query.lightnessSteps,
    chromaSteps: query.chromaSteps,
    maxChroma: query.maxChroma,
    tolerance: query.tolerance,
    maxIterations: query.maxIterations,
    alpha: query.alpha,
    simplifyTolerance: query.simplifyTolerance,
    hybridMaxDepth: query.hybridMaxDepth,
    hybridErrorTolerance: query.hybridErrorTolerance,
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
 * Scheduler work estimate shared by contrast boundary and region queries.
 */
export function contrastQueryBudget(query: PlaneContrastQueryOptions): number {
  const lightness = query.lightnessSteps ?? 72;
  const chromaBrackets = query.chromaSteps ?? 96;
  const depth = Math.max(0, query.hybridMaxDepth ?? 7);
  const errorTolerance =
    query.hybridErrorTolerance != null && query.hybridErrorTolerance > 0
      ? query.hybridErrorTolerance
      : 0.0015;
  const precisionFactor = Math.min(3.2, Math.max(1, 0.0015 / errorTolerance));
  const metricFactor = query.metric === 'apca' ? 1.12 : 1;
  return Math.round(
    lightness *
      Math.sqrt(chromaBrackets) *
      (1 + depth * 0.24) *
      precisionFactor *
      metricFactor,
  );
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
