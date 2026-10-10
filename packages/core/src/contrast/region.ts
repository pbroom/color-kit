import type { Color } from '../types.js';
import type { InternalPlaneTraceContext } from '../trace/context.js';
import { rejectRemovedContrastOptions } from './region-shared.js';
import { solveContrastRegionPaths } from './region-solver.js';
import type {
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

/**
 * Generate contour paths for the region that meets/exceeds
 * the configured contrast criterion at a fixed hue.
 *
 * Each side of the region (darker or lighter than the reference) is traced
 * as one luminance level curve along rays from black. Contour pieces start
 * and end exactly where the curve meets the gamut edge (with the
 * `GAMUT_EPSILON` slack of `inSrgbGamut` / `inP3Gamut`), the chroma axis, or
 * `maxChroma`; `initialSamples`, `errorTolerance`, and `maxDepth` only set
 * how finely the curve between those ends is sampled. Every returned point
 * passes `contrastRatio` / `contrastAPCA` with the region's gamut and is in
 * that gamut.
 */
export function contrastRegionPaths(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
  trace?: InternalPlaneTraceContext | null,
): ContrastRegionPoint[][] {
  rejectRemovedContrastOptions(options, 'contrastRegionPaths()');
  return solveContrastRegionPaths(reference, hue, options, trace);
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
