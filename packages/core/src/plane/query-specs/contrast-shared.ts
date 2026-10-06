import type { ContrastRegionPathOptions } from '../../contrast/types.js';
import type { PlaneContrastQueryOptions } from '../types.js';

/**
 * Picks the contrast solver options out of a plane contrast query. The
 * engine and every engine-specific option are passed through unchanged, so
 * `contrastRegionPaths` validates them (and rejects invalid combinations)
 * exactly as it does for direct calls.
 */
export function toContrastRegionPathOptions(
  query: PlaneContrastQueryOptions,
): ContrastRegionPathOptions {
  return {
    engine: query.engine,
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
    samplingMode: query.samplingMode,
    edgeInterpolation: query.edgeInterpolation,
    adaptiveBaseSteps: query.adaptiveBaseSteps,
    adaptiveMaxDepth: query.adaptiveMaxDepth,
    hybridMaxDepth: query.hybridMaxDepth,
    hybridErrorTolerance: query.hybridErrorTolerance,
  } as ContrastRegionPathOptions;
}

/**
 * Sampling strategy a contrast query runs with: `'hybrid'` for the hybrid
 * engine, or the legacy engine's resolved grid mode.
 */
function contrastSamplingMode(
  query: PlaneContrastQueryOptions,
): 'hybrid' | 'uniform' | 'adaptive' {
  if (query.engine !== 'legacy') {
    return 'hybrid';
  }
  if (query.samplingMode === 'uniform' || query.samplingMode === 'adaptive') {
    return query.samplingMode;
  }
  return query.adaptiveBaseSteps != null || query.adaptiveMaxDepth != null
    ? 'adaptive'
    : 'uniform';
}

/**
 * Scheduler work estimate shared by contrast boundary and region queries.
 */
export function contrastQueryBudget(query: PlaneContrastQueryOptions): number {
  const samplingMode = contrastSamplingMode(query);
  if (samplingMode === 'uniform') {
    const lightness = query.lightnessSteps ?? 64;
    const chroma = query.chromaSteps ?? 64;
    return lightness * chroma;
  }
  if (samplingMode === 'adaptive') {
    const base = Math.max(8, query.adaptiveBaseSteps ?? 16);
    const depth = Math.max(0, query.adaptiveMaxDepth ?? 3);
    const refinementFactor = 1 + depth * 0.85;
    return Math.round(base * base * refinementFactor);
  }
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
  const samplingMode = contrastSamplingMode(query);
  if (metric !== 'apca') {
    return `${metric}:${samplingMode}`;
  }
  return `${metric}:${samplingMode}:${query.apcaPolarity ?? 'absolute'}:${query.apcaRole ?? 'sample-text'}`;
}
