import type { Color } from '../types.js';
import type { InternalPlaneTraceContext } from '../trace/context.js';
import { contrastRegionPathsHybrid } from './region-hybrid.js';
import { validateSteps } from './region-shared.js';
import type {
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

/**
 * Options that belonged to the removed legacy marching-squares engine. They
 * are rejected rather than ignored, so callers notice the removal.
 */
export const REMOVED_CONTRAST_REGION_OPTIONS = [
  'engine',
  'samplingMode',
  'edgeInterpolation',
  'adaptiveBaseSteps',
  'adaptiveMaxDepth',
] as const;

function rejectRemovedOptions(options: ContrastRegionPathOptions): void {
  const bag = options as Record<string, unknown>;
  for (const name of REMOVED_CONTRAST_REGION_OPTIONS) {
    if (bag[name] !== undefined) {
      throw new TypeError(
        `contrastRegionPaths() option "${name}" was removed with the legacy contrast-region engine; tune the solver with lightnessSteps, chromaSteps, hybridMaxDepth, and hybridErrorTolerance`,
      );
    }
  }
}

/**
 * Generate contour paths for the region that meets/exceeds
 * the configured contrast criterion at a fixed hue.
 *
 * Traces chroma roots of the contrast field at adaptively refined lightness
 * samples and joins them into paths. When the solver cannot fully resolve a
 * field it returns its best-effort paths and records `degradedReason` in the
 * query trace summary.
 */
export function contrastRegionPaths(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
  trace?: InternalPlaneTraceContext | null,
): ContrastRegionPoint[][] {
  rejectRemovedOptions(options);
  if (options.lightnessSteps != null) {
    validateSteps(
      'contrastRegionPaths() lightnessSteps',
      options.lightnessSteps,
    );
  }
  if (options.chromaSteps != null) {
    validateSteps('contrastRegionPaths() chromaSteps', options.chromaSteps);
  }
  return contrastRegionPathsHybrid(reference, hue, options, trace);
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
