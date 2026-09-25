import { toP3Gamut, toSrgbGamut } from '../../gamut/index.js';
import { colorToPlane } from '../mapping.js';
import { requireGamutField } from '../packed-abi.js';
import type { PlaneQuerySpec } from '../query-spec.js';
import { resolvePlaneDefinition } from '../resolve.js';
import type {
  PlaneDefinition,
  PlaneFallbackPointQuery,
  PlaneFallbackPointResult,
} from '../types.js';
import { withFiniteHue } from './shared.js';

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
  const color = withFiniteHue(query.color);
  const mapped =
    query.gamut === 'display-p3' ? toP3Gamut(color) : toSrgbGamut(color);
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
  fixedPointCount: 1,
  pack(result, writer, label) {
    const pathStart = writer.pathCount;
    writer.appendColorPath([result.point], label);
    return {
      kind: 'fallbackPoint',
      pathStart,
      pathCount: 1,
      gamut: result.gamut,
    };
  },
  validateDescriptor(descriptor, label) {
    requireGamutField(descriptor, label);
  },
  unpack: (descriptor, reader) => ({
    kind: 'fallbackPoint',
    gamut: descriptor.gamut,
    point: reader.readColorPath(descriptor.pathStart)[0],
  }),
};
