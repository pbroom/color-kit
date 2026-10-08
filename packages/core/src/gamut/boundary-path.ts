import { clamp, normalizeHue, simplifyPolyline } from '../utils/index.js';
import {
  adaptiveMaxErrorProbe,
  buildAxisAnchors,
  MIN_SEGMENT_LENGTH,
} from '../sampling/adaptive1d.js';
import { maxChromaForHue } from './hue-cusp.js';
import { maxChromaAt } from './max-chroma.js';
import { assertGamutTarget } from './target.js';
import {
  DEFAULT_MAX_CHROMA,
  type GamutBoundaryPathOptions,
  type GamutBoundaryPoint,
} from './types.js';

/** Default `steps` of a uniform {@link gamutBoundaryPath}. */
export const DEFAULT_GAMUT_BOUNDARY_STEPS = 100;

/**
 * Samples the OKLCH lightness/chroma gamut boundary at a fixed hue, from
 * black (`l: 0`) to white (`l: 1`).
 *
 * Each point's `c` is {@link maxChromaAt} at that lightness. In `'uniform'`
 * mode (the default) the path has `steps + 1` evenly spaced points; in
 * `'adaptive'` mode points are added around the hue cusp and where the
 * boundary bends. Output is deterministic and usable for SVG/Canvas overlay
 * paths.
 *
 * @param hue - OKLCH hue in degrees.
 * @param options - Gamut, sampling and search options.
 * @returns Boundary points ordered by increasing lightness.
 * @throws {TypeError} When `options.gamut` is not `'srgb'` or `'display-p3'`.
 * @throws {Error} When `steps` is not an integer >= 2 (uniform mode).
 * @see {@link chromaBand}
 *
 * @example
 * ```ts
 * import { gamutBoundaryPath } from 'color-kit';
 *
 * gamutBoundaryPath(250, { steps: 4 });
 * // → [
 * //   { l: 0, c: 0 },
 * //   { l: 0.25, c: 0.070703125 },
 * //   { l: 0.5, c: 0.14150390625 },
 * //   { l: 0.75, c: 0.13369140625 },
 * //   { l: 1, c: 0 },
 * // ]
 * ```
 */
export function gamutBoundaryPath(
  hue: number,
  options: GamutBoundaryPathOptions = {},
): GamutBoundaryPoint[] {
  assertGamutTarget(options.gamut, 'gamutBoundaryPath()');
  const mode = options.samplingMode ?? 'uniform';
  if (mode === 'adaptive') {
    return gamutBoundaryPathAdaptive(hue, options);
  }
  const steps = options.steps ?? DEFAULT_GAMUT_BOUNDARY_STEPS;
  if (!Number.isInteger(steps) || steps < 2) {
    throw new Error('gamutBoundaryPath() requires steps >= 2');
  }

  const path: GamutBoundaryPoint[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const l = index / steps;
    const c = maxChromaAt(l, hue, options);
    path.push({ l, c });
  }
  const tol = options.simplifyTolerance;
  if (tol != null && Number.isFinite(tol) && tol > 0) {
    return simplifyPolyline(path, tol, false);
  }
  return path;
}

const DEFAULT_ADAPTIVE_TOLERANCE = 0.001;
const DEFAULT_ADAPTIVE_MAX_DEPTH = 12;
const ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON = 1e-7;
const ADAPTIVE_EDGE_PROBES = [1 / 128, 1 / 64, 1 / 32, 1 / 16] as const;
/** Anchors an adaptive path starts from: both ends, the cusp, edge probes. */
const ADAPTIVE_ANCHOR_COUNT = 3 + ADAPTIVE_EDGE_PROBES.length * 2;

type AdaptiveSamplingOptions = Pick<
  GamutBoundaryPathOptions,
  'adaptiveTolerance' | 'adaptiveMaxDepth'
>;

function resolveAdaptiveTolerance(options: AdaptiveSamplingOptions): number {
  return Number.isFinite(options.adaptiveTolerance) &&
    options.adaptiveTolerance! > 0
    ? options.adaptiveTolerance!
    : DEFAULT_ADAPTIVE_TOLERANCE;
}

function resolveAdaptiveMaxDepth(options: AdaptiveSamplingOptions): number {
  return Number.isInteger(options.adaptiveMaxDepth) &&
    options.adaptiveMaxDepth! > 0
    ? Math.min(20, Math.max(1, options.adaptiveMaxDepth!))
    : DEFAULT_ADAPTIVE_MAX_DEPTH;
}

/**
 * Estimated point count of an `'adaptive'` {@link gamutBoundaryPath}, for
 * scheduler work budgets. Calibrated on sRGB and Display P3 paths at 24
 * hues: about 17 points at the default tolerance, with the refined points
 * growing roughly as `(defaultTolerance / tolerance) ** 0.75` (13 points at
 * 4x coarser, 28 and 59 at 4x and 16x finer), and never more than
 * `maxDepth` subdivisions allow.
 */
export function estimateAdaptiveBoundaryPointCount(
  options: AdaptiveSamplingOptions,
): number {
  const tol = resolveAdaptiveTolerance(options);
  const maxDepth = resolveAdaptiveMaxDepth(options);
  const refined = 6 * (DEFAULT_ADAPTIVE_TOLERANCE / tol) ** 0.75;
  const maxRefined = (ADAPTIVE_ANCHOR_COUNT - 1) * (2 ** maxDepth - 1);
  return Math.round(ADAPTIVE_ANCHOR_COUNT + Math.min(refined, maxRefined));
}

function gamutBoundaryPathAdaptive(
  hue: number,
  options: GamutBoundaryPathOptions,
): GamutBoundaryPoint[] {
  const normalizedHue = normalizeHue(hue);
  const gamut = options.gamut ?? 'srgb';
  const tol = resolveAdaptiveTolerance(options);
  const maxDepth = resolveAdaptiveMaxDepth(options);

  const maxChromaAtBound = (l: number): number =>
    maxChromaAt(l, normalizedHue, options);
  const maxChromaBound = Math.max(0, options.maxChroma ?? DEFAULT_MAX_CHROMA);
  const cusp = maxChromaForHue(normalizedHue, {
    gamut,
    method: 'direct',
  });
  const cuspLightness = clamp(cusp.l, 0, 1);
  const cuspPoint: GamutBoundaryPoint = {
    l: cuspLightness,
    c: Math.min(Math.max(0, maxChromaAtBound(cuspLightness)), maxChromaBound),
  };
  const anchorLightnesses = buildAxisAnchors({
    min: 0,
    max: 1,
    epsilon: ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON,
    extraAnchors: [cuspPoint.l],
    edgeProbes: ADAPTIVE_EDGE_PROBES,
  });
  const anchorPoints = anchorLightnesses.map((lightness) => {
    if (
      Math.abs(lightness - cuspPoint.l) <= ADAPTIVE_LIGHTNESS_DEDUPE_EPSILON
    ) {
      return cuspPoint;
    }
    return {
      l: lightness,
      c: maxChromaAtBound(lightness),
    };
  });

  const recurse = (
    a: GamutBoundaryPoint,
    b: GamutBoundaryPoint,
    depth: number,
  ): GamutBoundaryPoint[] => {
    const spanL = Math.abs(b.l - a.l);
    if (spanL <= MIN_SEGMENT_LENGTH || depth >= maxDepth) {
      return [b];
    }
    const { probe, error: err } = adaptiveMaxErrorProbe(a, b, maxChromaAtBound);
    const leftSpan = Math.abs(probe.l - a.l);
    const rightSpan = Math.abs(b.l - probe.l);
    if (leftSpan <= MIN_SEGMENT_LENGTH || rightSpan <= MIN_SEGMENT_LENGTH) {
      return [b];
    }
    if (err <= tol) {
      return [b];
    }
    const left = recurse(a, probe, depth + 1);
    const right = recurse(probe, b, depth + 1);
    return [...left, ...right];
  };

  const points = [anchorPoints[0]];
  for (let index = 0; index < anchorPoints.length - 1; index += 1) {
    points.push(...recurse(anchorPoints[index], anchorPoints[index + 1], 0));
  }
  const simplifyTol = options.simplifyTolerance;
  if (simplifyTol != null && Number.isFinite(simplifyTol) && simplifyTol > 0) {
    return simplifyPolyline(points, simplifyTol, false);
  }
  return points;
}
