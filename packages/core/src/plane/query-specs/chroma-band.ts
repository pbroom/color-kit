import { chromaBand } from '../../gamut/index.js';
import { planeHue, usesLightnessAndChroma } from '../mapping.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneChromaBandQuery,
  PlaneChromaBandResult,
  PlaneDefinition,
} from '../types.js';
import { countSinglePath, toPlaneBoundaryPoint } from './shared.js';

/**
 * Samples a chroma band and projects the resulting points into the target plane.
 *
 * Returns an empty point list when the plane is not a lightness/chroma pairing.
 *
 * @param planeDefinition Plane definition used to project the result points.
 * @param query Chroma-band sampling configuration.
 * @param query.hue Optional hue override; falls back to the plane's hue.
 * @param query.requestedChroma Desired chroma target for the band.
 * @param query.selectedLightness Optional selected lightness anchor.
 * @param query.mode Chroma-band sampling mode.
 * @param query.steps Optional fixed sample count.
 * @param query.gamut Optional gamut clamp for band search.
 */
export function getPlaneChromaBand(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneChromaBandQuery, 'kind'> = {},
): PlaneChromaBandResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'chromaBand',
      hue: planeHue(resolvedPlane, query.hue),
      points: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const selectedLightness =
    query.selectedLightness ?? resolvedPlane.fixed.l ?? 0.5;
  const requestedChroma = query.requestedChroma ?? resolvedPlane.fixed.c ?? 0;
  const band = chromaBand(hue, requestedChroma, {
    gamut: query.gamut,
    mode: query.mode,
    steps: query.steps,
    samplingMode: query.samplingMode,
    adaptiveTolerance: query.adaptiveTolerance,
    adaptiveMaxDepth: query.adaptiveMaxDepth,
    selectedLightness,
    maxChroma: query.maxChroma,
    tolerance: query.tolerance,
    maxIterations: query.maxIterations,
    alpha: query.alpha ?? resolvedPlane.fixed.alpha,
  });

  return {
    kind: 'chromaBand',
    hue,
    points: band.map((color) =>
      toPlaneBoundaryPoint(resolvedPlane, hue, { l: color.l, c: color.c }),
    ),
  };
}

export const chromaBandSpec: PlaneQuerySpec<'chromaBand'> = {
  kind: 'chromaBand',
  run: (plane, query) => getPlaneChromaBand(plane, query),
  pointChannels: 'xylc',
  fixedPathCount: 1,
  countGeometry: (result) => countSinglePath(result.points),
  budget: (query) => query.steps ?? 48,
};
