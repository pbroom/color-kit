import { mapToGamutSpecInto } from '../../gamut/membership.js';
import { srgb } from '../../gamut/spec.js';
import { assertGamut } from '../../gamut/target.js';
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
 * Gamut-maps a color into the target gamut and returns where the mapped color
 * lands on the plane.
 *
 * Uses the default mapping of {@link toSrgbGamut} / {@link toP3Gamut}
 * (OKLCH chroma reduction). Useful for marking the in-gamut
 * fallback of an out-of-gamut selection. A non-finite (powerless) hue on the
 * input is treated as `0`. The point is clamped to the plane window.
 *
 * @param planeDefinition - Plane to project onto; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - The `color` to map and the target `gamut`.
 * @returns A new result with the gamut and the plane point, including the
 * mapped color.
 * @throws {TypeError} When `gamut` is not a `Gamut` descriptor.
 * @see {@link sense} for the fluent form.
 *
 * @example
 * ```ts
 * import { parse, toHex } from '@pbroom/color-kit';
 * import {
 *   definePlane,
 *   getPlaneFallbackPoint,
 *   srgb,
 * } from '@pbroom/color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } });
 * const { point } = getPlaneFallbackPoint(plane, {
 *   color: parse('oklch(0.7 0.3 264)'),
 *   gamut: srgb,
 * });
 * point.x; // → 0.7
 * point.y.toFixed(3); // → '0.609'
 * toHex(point.color); // → '#6c9aff'
 * ```
 */
export function getPlaneFallbackPoint(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneFallbackPointQuery, 'kind'>,
): PlaneFallbackPointResult {
  assertGamut(query.gamut, 'fallbackPoint()');
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  const color = withFiniteHue(query.color);
  const gamut = query.gamut ?? srgb;
  const mapped = mapToGamutSpecInto({ ...color }, color, gamut);
  const point = colorToPlane(resolvedPlane, mapped);

  return {
    kind: 'fallbackPoint',
    gamut,
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
