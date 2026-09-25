import { gamutBoundaryPath } from '../../gamut/index.js';
import { planeHue, usesLightnessAndChroma } from '../mapping.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneDefinition,
  PlaneGamutBoundaryQuery,
  PlaneGamutBoundaryResult,
} from '../types.js';
import { countSinglePath, toPlaneBoundaryPoint } from './shared.js';

/**
 * Computes a gamut boundary contour projected into the target plane.
 *
 * Returns an empty point list when the plane is not a lightness/chroma pairing.
 *
 * @param planeDefinition Plane definition used to project the result points.
 * @param query Boundary sampling configuration.
 * @param query.hue Optional hue override; falls back to the plane's hue.
 * @param query.gamut Target gamut used for the boundary calculation.
 * @param query.steps Optional fixed sample count.
 * @param query.simplifyTolerance Optional simplification tolerance.
 * @param query.samplingMode Optional sampling strategy.
 * @param query.adaptiveTolerance Optional adaptive sampling error tolerance.
 * @param query.adaptiveMaxDepth Optional adaptive recursion depth cap.
 */
export function getPlaneGamutBoundary(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGamutBoundaryQuery, 'kind'> = {},
): PlaneGamutBoundaryResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'gamutBoundary',
      gamut: query.gamut ?? 'srgb',
      hue: planeHue(resolvedPlane, query.hue),
      points: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const boundary = gamutBoundaryPath(hue, {
    gamut: query.gamut ?? 'srgb',
    steps: query.steps,
    simplifyTolerance: query.simplifyTolerance,
    samplingMode: query.samplingMode,
    adaptiveTolerance: query.adaptiveTolerance,
    adaptiveMaxDepth: query.adaptiveMaxDepth,
  });

  return {
    kind: 'gamutBoundary',
    gamut: query.gamut ?? 'srgb',
    hue,
    points: boundary.map((point) =>
      toPlaneBoundaryPoint(resolvedPlane, hue, point),
    ),
  };
}

export const gamutBoundarySpec: PlaneQuerySpec<'gamutBoundary'> = {
  kind: 'gamutBoundary',
  run: (plane, query) => getPlaneGamutBoundary(plane, query),
  pointChannels: 'xylc',
  fixedPathCount: 1,
  countGeometry: (result) => countSinglePath(result.points),
  budget: (query) => query.steps ?? 48,
};
