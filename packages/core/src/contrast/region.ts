import type { Color } from '../types.js';
import type { InternalPlaneTraceContext } from '../trace/context.js';
import { rejectRemovedContrastOptions } from './region-shared.js';
import { solveContrastRegionPaths } from './region-solver.js';
import type {
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

/**
 * Returns the contour paths, in OKLCH lightness/chroma, that bound the region
 * of colors at a fixed hue meeting the contrast criterion against
 * `reference`.
 *
 * Each side of the region (darker or lighter than the reference) is traced
 * as one luminance level curve along rays from black. Contour pieces start
 * and end exactly where the curve meets the gamut edge (with the
 * `GAMUT_EPSILON` slack of `inSrgbGamut` / `inP3Gamut`), the chroma axis, or
 * `maxChroma`; `initialSamples`, `errorTolerance`, and `maxDepth` only set
 * how finely the curve between those ends is sampled. Every returned point
 * passes `contrastRatio` / `contrastAPCA` with the region's gamut and is in
 * that gamut.
 *
 * A reference with room on both sides typically yields two paths (darker and
 * lighter); paths are sorted by point count, longest first. A non-finite
 * `hue` or a non-positive `maxChroma` returns `[]`.
 *
 * @param reference - Color the samples are measured against.
 * @param hue - OKLCH hue in degrees (wrapped).
 * @param options - Gamut, metric, threshold and sampling options.
 * @param trace - Internal tracing context used by the plane query layer;
 *   omit it.
 * @returns Contour paths of `{ l, c }` points, longest first.
 * @throws {TypeError} When `options.gamut` is not `'srgb'` or `'display-p3'`,
 *   or when an option removed with an earlier solver (such as
 *   `lightnessSteps` or `engine`) is set.
 * @throws {Error} When the threshold is out of range, `initialSamples` is not
 *   an integer >= 2, `maxDepth` is not an integer >= 0, or `errorTolerance`
 *   is not a finite number > 0.
 * @see {@link contrastRegionPath}
 *
 * @example
 * ```ts
 * import { contrastRegionPaths, parse } from 'color-kit';
 *
 * const paths = contrastRegionPaths(parse('#808080'), 250, {
 *   level: 'AA-large',
 * });
 * paths.length; // → 2 (one darker side, one lighter side)
 * paths[0][0]; // → { l: ≈ 0.338, c: 0 }
 * ```
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
 * Returns the longest contour path (most points) of
 * {@link contrastRegionPaths}, or `[]` when the region is empty.
 *
 * Takes the same arguments and throws under the same conditions as
 * {@link contrastRegionPaths}.
 *
 * @param reference - Color the samples are measured against.
 * @param hue - OKLCH hue in degrees (wrapped).
 * @param options - Gamut, metric, threshold and sampling options.
 * @param trace - Internal tracing context used by the plane query layer;
 *   omit it.
 * @returns One contour path of `{ l, c }` points.
 *
 * @example
 * ```ts
 * import { contrastRegionPath, parse } from 'color-kit';
 *
 * const path = contrastRegionPath(parse('#fff'), 250); // AA (4.5:1) vs white
 * path.length; // → 57
 * path[0]; // → { l: ≈ 0.5681, c: 0 }
 * ```
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
