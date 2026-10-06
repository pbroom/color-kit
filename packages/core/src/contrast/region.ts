import type { Color } from '../types.js';
import type { InternalPlaneTraceContext } from '../trace/context.js';
import { contrastRegionPathsHybrid } from './region-hybrid.js';
import { contrastRegionPathsLegacy } from './region-legacy.js';
import { validateSteps } from './region-shared.js';
import type {
  ContrastRegionHybridOptions,
  ContrastRegionLegacyOptions,
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

/** Options only the legacy marching-squares engine understands. */
const LEGACY_ONLY_OPTIONS = [
  'samplingMode',
  'edgeInterpolation',
  'adaptiveBaseSteps',
  'adaptiveMaxDepth',
] as const;

/** Options only the hybrid root-tracing engine understands. */
const HYBRID_ONLY_OPTIONS = ['hybridMaxDepth', 'hybridErrorTolerance'] as const;

function rejectOptions(
  bag: Record<string, unknown>,
  names: readonly string[],
  message: (name: string) => string,
): void {
  for (const name of names) {
    if (bag[name] !== undefined) {
      throw new TypeError(message(name));
    }
  }
}

/**
 * Checks the engine selection and rejects options that belong to the other
 * engine, so an option is never silently ignored and the engine never
 * switches implicitly. Returns the legacy options with `samplingMode`
 * resolved, or `null` for the hybrid engine.
 */
function resolveEngineOptions(
  options: ContrastRegionPathOptions,
): ContrastRegionLegacyOptions | null {
  const bag = options as Record<string, unknown>;
  const engine = bag.engine ?? 'hybrid';
  if (engine === 'hybrid') {
    rejectOptions(
      bag,
      LEGACY_ONLY_OPTIONS,
      (name) =>
        `contrastRegionPaths() option "${name}" requires engine: 'legacy' (the default hybrid engine is tuned with lightnessSteps, chromaSteps, hybridMaxDepth, and hybridErrorTolerance)`,
    );
    return null;
  }
  if (engine !== 'legacy') {
    throw new TypeError(
      "contrastRegionPaths() engine must be 'hybrid' or 'legacy'",
    );
  }
  rejectOptions(
    bag,
    HYBRID_ONLY_OPTIONS,
    (name) =>
      `contrastRegionPaths() option "${name}" only applies to the hybrid engine; remove it or drop engine: 'legacy'`,
  );
  const legacy = options as ContrastRegionLegacyOptions;
  if (
    legacy.samplingMode != null &&
    legacy.samplingMode !== 'uniform' &&
    legacy.samplingMode !== 'adaptive'
  ) {
    throw new TypeError(
      "contrastRegionPaths() samplingMode must be 'uniform' or 'adaptive' (engine: 'legacy')",
    );
  }
  if (
    legacy.edgeInterpolation != null &&
    legacy.edgeInterpolation !== 'linear' &&
    legacy.edgeInterpolation !== 'midpoint'
  ) {
    throw new TypeError(
      "contrastRegionPaths() edgeInterpolation must be 'linear' or 'midpoint'",
    );
  }
  const samplingMode =
    legacy.samplingMode ??
    (legacy.adaptiveBaseSteps != null || legacy.adaptiveMaxDepth != null
      ? 'adaptive'
      : 'uniform');
  return { ...legacy, samplingMode };
}

/**
 * Generate contour paths for the region that meets/exceeds
 * the configured contrast criterion at a fixed hue.
 *
 * Uses the hybrid root-tracing engine unless `engine: 'legacy'` selects the
 * marching-squares engine. The engines never switch implicitly: when the
 * hybrid engine cannot fully resolve a field it returns its best-effort
 * paths and records `degradedReason` in the query trace summary.
 */
export function contrastRegionPaths(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
  trace?: InternalPlaneTraceContext | null,
): ContrastRegionPoint[][] {
  const legacyOptions = resolveEngineOptions(options);
  if (options.lightnessSteps != null) {
    validateSteps(
      'contrastRegionPaths() lightnessSteps',
      options.lightnessSteps,
    );
  }
  if (options.chromaSteps != null) {
    validateSteps('contrastRegionPaths() chromaSteps', options.chromaSteps);
  }

  if (legacyOptions) {
    return contrastRegionPathsLegacy(reference, hue, legacyOptions, trace);
  }
  return contrastRegionPathsHybrid(
    reference,
    hue,
    options as ContrastRegionHybridOptions,
    trace,
  );
}

/**
 * Convenience helper that returns the largest detected contour path.
 */
export function contrastRegionPath(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
  trace?: InternalPlaneTraceContext | null,
): ContrastRegionPoint[] {
  const paths = contrastRegionPaths(reference, hue, options, trace);
  return paths[0] ?? [];
}
