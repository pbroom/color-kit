import type { Color } from '../../types.js';
import { colorToPlane } from '../mapping.js';
import type { PlaneQueryGeometryCount } from '../query-spec.js';
import type { Plane, PlaneBoundaryPoint, PlanePoint } from '../types.js';

/**
 * Converts an `(l, c)` boundary point into normalized plane coordinates.
 *
 * @param resolvedPlane Resolved plane definition with fixed channels.
 * @param hue Hue value to apply while rebuilding the color.
 * @param point Boundary point in lightness/chroma space.
 */
export function toPlaneBoundaryPoint(
  resolvedPlane: Plane,
  hue: number,
  point: { l: number; c: number },
): PlaneBoundaryPoint {
  const color: Color = {
    l: point.l,
    c: point.c,
    h: hue,
    alpha: resolvedPlane.fixed.alpha,
  };
  const planePoint = colorToPlane(resolvedPlane, color);
  return {
    l: point.l,
    c: point.c,
    x: planePoint.x,
    y: planePoint.y,
  };
}

/**
 * Treats a non-finite hue as the achromatic hue `0`.
 *
 * Callers may pass CSS-style "powerless" hues (`NaN`) for grays. Query
 * results carry concrete colors, and the packed ABI requires finite values,
 * so input colors are normalized before they reach a result.
 */
export function withFiniteHue(color: Color): Color {
  return Number.isFinite(color.h) ? color : { ...color, h: 0 };
}

export function countSinglePath(points: PlanePoint[]): PlaneQueryGeometryCount {
  return {
    pathCount: points.length > 0 ? 1 : 0,
    pointCount: points.length,
  };
}

export function countPlanePaths(
  paths: PlanePoint[][],
): PlaneQueryGeometryCount {
  return {
    pathCount: paths.length,
    pointCount: paths.reduce((total, path) => total + path.length, 0),
  };
}
