import { toP3Gamut, toSrgbGamut } from '../../gamut/index.js';
import { colorToPlane } from '../mapping.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneDefinition,
  PlaneFallbackPointQuery,
  PlaneFallbackPointResult,
} from '../types.js';

/**
 * Maps a color into the requested gamut and returns its projected plane point.
 *
 * @param planeDefinition Plane definition used to project the mapped color.
 * @param query Fallback mapping input.
 * @param query.color Input color to map into gamut.
 * @param query.gamut Target gamut (`srgb` or `display-p3`).
 */
export function getPlaneFallbackPoint(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneFallbackPointQuery, 'kind'>,
): PlaneFallbackPointResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  const mapped =
    query.gamut === 'display-p3'
      ? toP3Gamut(query.color)
      : toSrgbGamut(query.color);
  const point = colorToPlane(resolvedPlane, mapped);

  return {
    kind: 'fallbackPoint',
    gamut: query.gamut,
    point: {
      x: point.x,
      y: point.y,
      color: mapped,
    },
  };
}

export const fallbackPointSpec: PlaneQuerySpec<'fallbackPoint'> = {
  kind: 'fallbackPoint',
  run: (plane, query) => getPlaneFallbackPoint(plane, query),
  pointChannels: 'xycolor',
  fixedPathCount: 1,
  countGeometry: () => ({ pathCount: 1, pointCount: 1 }),
  budget: () => 1,
};
