import type { PlaneDefinition, PlanePoint, PlaneRegion } from './types.js';
import { colorToPlane, planeToColor, resolvePlaneDefinition } from './plane.js';

function mapRegion(
  region: PlaneRegion,
  fn: (point: PlanePoint) => PlanePoint,
): PlaneRegion {
  return {
    paths: region.paths.map((path) => path.map((point) => fn(point))),
  };
}

/**
 * Returns a copy of a region with every point shifted by `(dx, dy)`.
 *
 * Operates on raw point coordinates, so offsets are in the region's own space
 * (plane-normalized units for query results, where `1` is one full axis
 * span). Points are not clamped to `[0, 1]`. Returns a new region; the input
 * is not mutated.
 *
 * @param region - Region to move.
 * @param dx - Horizontal offset.
 * @param dy - Vertical offset.
 * @returns The translated region.
 * @see {@link scaleRegion}
 * @see {@link rotateRegion}
 * @example
 * ```ts
 * import { translateRegion } from 'color-kit/plane';
 *
 * const square = { paths: [[{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 }]] };
 *
 * translateRegion(square, 0.25, 0.1).paths[0];
 * // → [{ x: 0.25, y: 0.1 }, { x: 0.75, y: 0.1 }, { x: 0.75, y: 0.6 }, { x: 0.25, y: 0.6 }]
 * ```
 */
export function translateRegion(
  region: PlaneRegion,
  dx: number,
  dy: number,
): PlaneRegion {
  return mapRegion(region, (point) => ({
    x: point.x + dx,
    y: point.y + dy,
  }));
}

/**
 * Returns a copy of a region scaled by `(sx, sy)` about `origin`.
 *
 * Operates on raw point coordinates, so offsets are in the region's own space
 * (plane-normalized units for query results, where `1` is one full axis
 * span). Points are not clamped to `[0, 1]`. Returns a new region; the input
 * is not mutated. Negative factors mirror the region across `origin`.
 *
 * @param region - Region to scale.
 * @param sx - Horizontal scale factor.
 * @param sy - Vertical scale factor. Defaults to `sx` (uniform scale).
 * @param origin - Fixed point of the scale. Defaults to the plane centre
 * `{ x: 0.5, y: 0.5 }`.
 * @returns The scaled region.
 * @see {@link translateRegion}
 * @see {@link rotateRegion}
 * @example
 * ```ts
 * import { scaleRegion } from 'color-kit/plane';
 *
 * const full = { paths: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]] };
 *
 * scaleRegion(full, 0.5).paths[0];
 * // → [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }]
 * ```
 */
export function scaleRegion(
  region: PlaneRegion,
  sx: number,
  sy: number = sx,
  origin: PlanePoint = { x: 0.5, y: 0.5 },
): PlaneRegion {
  return mapRegion(region, (point) => ({
    x: origin.x + (point.x - origin.x) * sx,
    y: origin.y + (point.y - origin.y) * sy,
  }));
}

/**
 * Returns a copy of a region rotated by `angleDeg` degrees about `origin`.
 *
 * Operates on raw point coordinates, so offsets are in the region's own space
 * (plane-normalized units for query results, where `1` is one full axis
 * span). Points are not clamped to `[0, 1]`. Returns a new region; the input
 * is not mutated.
 *
 * Positive angles turn from +x toward +y. Plane points have y increasing
 * downward when drawn (as in {@link toSvgPath} output), so positive angles
 * appear clockwise on screen.
 *
 * @param region - Region to rotate.
 * @param angleDeg - Rotation angle in degrees.
 * @param origin - Centre of rotation. Defaults to the plane centre
 * `{ x: 0.5, y: 0.5 }`.
 * @returns The rotated region.
 * @see {@link translateRegion}
 * @see {@link scaleRegion}
 * @example
 * ```ts
 * import { rotateRegion } from 'color-kit/plane';
 *
 * const corner = { paths: [[{ x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0.5, y: 1 }]] };
 *
 * rotateRegion(corner, 90).paths[0];
 * // → [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0.5 }]
 * ```
 */
export function rotateRegion(
  region: PlaneRegion,
  angleDeg: number,
  origin: PlanePoint = { x: 0.5, y: 0.5 },
): PlaneRegion {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return mapRegion(region, (point) => {
    const localX = point.x - origin.x;
    const localY = point.y - origin.y;
    return {
      x: origin.x + localX * cos - localY * sin,
      y: origin.y + localX * sin + localY * cos,
    };
  });
}

/**
 * Re-expresses a region drawn on one plane in the coordinates of another.
 *
 * Each point is converted to a color on the source plane (axis channels from
 * the point, other channels from the source plane's fixed values) and then
 * projected onto the target plane's axes; the target plane's own fixed values
 * are ignored. This keeps the same colors under a different axis range,
 * orientation or channel order. Both steps clamp to the plane viewport, so
 * points outside `[0, 1]` on the source plane are clamped first and colors
 * outside the target ranges land on the target's edge. Paths keep their point
 * count; nothing is resampled, so strongly non-linear mappings (for example
 * between models) only bend the outline at its existing vertices.
 *
 * @param sourcePlaneDefinition - Plane the region's points are expressed in.
 * @param targetPlaneDefinition - Plane to express them in.
 * @param region - Region in source-plane normalized coordinates.
 * @returns The region in target-plane normalized coordinates.
 * @see {@link colorToPlane}
 * @see {@link planeToColor}
 * @example
 * ```ts
 * import { projectRegionBetweenPlanes, type PlaneDefinition } from 'color-kit/plane';
 *
 * const full: PlaneDefinition = { model: 'oklch', fixed: { h: 250 } };
 * // Same plane zoomed to lightness 0.5–1.
 * const zoomed: PlaneDefinition = { model: 'oklch', x: { channel: 'l', range: [0.5, 1] }, fixed: { h: 250 } };
 * const line = { paths: [[{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }, { x: 1, y: 0.5 }]] };
 *
 * projectRegionBetweenPlanes(full, zoomed, line).paths[0];
 * // → [{ x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }] (l = 0.25 clamps to the edge)
 * ```
 */
export function projectRegionBetweenPlanes(
  sourcePlaneDefinition: PlaneDefinition,
  targetPlaneDefinition: PlaneDefinition,
  region: PlaneRegion,
): PlaneRegion {
  const sourcePlane = resolvePlaneDefinition(sourcePlaneDefinition);
  const targetPlane = resolvePlaneDefinition(targetPlaneDefinition);
  return mapRegion(region, (point) => {
    const color = planeToColor(sourcePlane, point);
    return colorToPlane(targetPlane, color);
  });
}
