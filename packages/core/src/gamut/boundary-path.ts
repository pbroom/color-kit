import { clamp, normalizeHue, simplifyPolyline } from '../utils/index.js';
import {
  adaptiveMaxErrorProbe,
  buildAxisAnchors,
  MIN_SEGMENT_LENGTH,
} from '../sampling/adaptive1d.js';
import { maxChromaForHue } from './hue-cusp.js';
import { maxChromaAt } from './max-chroma.js';
import {
  DEFAULT_MAX_CHROMA,
  type GamutBoundaryPathOptions,
  type GamutBoundaryPoint,
} from './types.js';

/**
 * Sample the lightness/chroma gamut boundary for a fixed hue.
 *
 * Returns deterministic points usable for SVG/Canvas overlay paths.
 */
export function gamutBoundaryPath(
  hue: number,
  options: GamutBoundaryPathOptions = {},
): GamutBoundaryPoint[] {
  const mode = options.samplingMode ?? 'uniform';
  if (mode === 'adaptive') {
    return gamutBoundaryPathAdaptive(hue, options);
  }
  const steps = options.steps ?? 100;
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

function gamutBoundaryPathAdaptive(
  hue: number,
  options: GamutBoundaryPathOptions,
): GamutBoundaryPoint[] {
  const normalizedHue = normalizeHue(hue);
  const gamut = options.gamut ?? 'srgb';
  const tol =
    Number.isFinite(options.adaptiveTolerance) && options.adaptiveTolerance! > 0
      ? options.adaptiveTolerance!
      : DEFAULT_ADAPTIVE_TOLERANCE;
  const maxDepth =
    Number.isInteger(options.adaptiveMaxDepth) && options.adaptiveMaxDepth! > 0
      ? Math.min(20, Math.max(1, options.adaptiveMaxDepth!))
      : DEFAULT_ADAPTIVE_MAX_DEPTH;

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
