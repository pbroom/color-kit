import type { Color } from '../types.js';
import { clamp, normalizeHue } from '../utils/index.js';
import { isFiniteNumber, planeModelSpec, readChannel } from './model-specs.js';
import type { Plane, PlaneModelColor, PlanePoint } from './types.js';

/**
 * Converts a channel value into normalized plane space [0..1].
 */
function normalizeInRange(value: number, range: [number, number]): number {
  const span = range[1] - range[0];
  if (Math.abs(span) <= Number.EPSILON) return 0;
  return clamp((value - range[0]) / span, 0, 1);
}

function normalizeInRangeUnclamped(
  value: number,
  range: [number, number],
): number {
  const span = range[1] - range[0];
  if (Math.abs(span) <= Number.EPSILON) return 0;
  return (value - range[0]) / span;
}

/**
 * Converts a normalized plane value [0..1] back into channel space.
 */
function denormalizeInRange(norm: number, range: [number, number]): number {
  return range[0] + clamp(norm, 0, 1) * (range[1] - range[0]);
}

function denormalizeInRangeUnclamped(
  norm: number,
  range: [number, number],
): number {
  return range[0] + norm * (range[1] - range[0]);
}

export function planeToModelColor(
  resolvedPlane: Plane,
  point: PlanePoint,
  options: { clampToViewport?: boolean } = {},
): PlaneModelColor {
  const denormalize =
    options.clampToViewport === false
      ? denormalizeInRangeUnclamped
      : denormalizeInRange;
  return {
    ...resolvedPlane.fixed,
    [resolvedPlane.x.channel]: denormalize(point.x, resolvedPlane.x.range),
    [resolvedPlane.y.channel]: denormalize(point.y, resolvedPlane.y.range),
    alpha: resolvedPlane.fixed.alpha,
  };
}

export function modelColorToPlane(
  resolvedPlane: Plane,
  modelColor: PlaneModelColor,
  options: { clampToViewport?: boolean } = {},
): PlanePoint {
  const normalize =
    options.clampToViewport === false
      ? normalizeInRangeUnclamped
      : normalizeInRange;
  const xValue = readChannel(
    modelColor,
    resolvedPlane.x.channel,
    readChannel(resolvedPlane.fixed, resolvedPlane.x.channel, 0),
  );
  const yValue = readChannel(
    modelColor,
    resolvedPlane.y.channel,
    readChannel(resolvedPlane.fixed, resolvedPlane.y.channel, 0),
  );
  return {
    x: normalize(xValue, resolvedPlane.x.range),
    y: normalize(yValue, resolvedPlane.y.range),
  };
}

/**
 * Converts a normalized plane point into the color it represents.
 *
 * `x` and `y` are clamped to `[0, 1]` and mapped linearly onto the plane's
 * axis ranges; every other channel comes from `resolvedPlane.fixed`. The
 * result is an OKLCH {@link Color} and is not gamut-mapped.
 *
 * @param resolvedPlane - Plane from {@link definePlane}.
 * @param point - Normalized plane point (`x`, `y` in `[0, 1]`).
 * @returns A new color for that point.
 * @see {@link colorToPlane} for the inverse.
 * @see {@link colorAtPlanePoint} to pass an unresolved definition.
 *
 * @example
 * ```ts
 * import { toHex } from 'color-kit';
 * import { definePlane, planeToColor } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } }); // x: l, y: c in [0.4, 0]
 * const color = planeToColor(plane, { x: 0.6, y: 0.75 });
 * // → { l: 0.6, c: ≈ 0.1, h: 264, alpha: 1 }
 * toHex(color); // → '#617fbc'
 * ```
 */
export function planeToColor(resolvedPlane: Plane, point: PlanePoint): Color {
  const modelSpec = planeModelSpec(resolvedPlane.model);
  return modelSpec.toColor(planeToModelColor(resolvedPlane, point));
}

export function planeToColorUnclamped(
  resolvedPlane: Plane,
  point: PlanePoint,
): Color {
  const modelSpec = planeModelSpec(resolvedPlane.model);
  return modelSpec.toColor(
    planeToModelColor(resolvedPlane, point, { clampToViewport: false }),
  );
}

/**
 * Projects a color onto a plane, returning its normalized coordinates.
 *
 * The color is converted into the plane's model, then each axis channel is
 * normalized against its range and clamped to `[0, 1]`, so colors outside
 * the plane window land on its edge. Channels not on an axis are ignored.
 *
 * @param resolvedPlane - Plane from {@link definePlane}.
 * @param color - Color to project.
 * @returns A new normalized point (`x`, `y` in `[0, 1]`).
 * @see {@link planeToColor} for the inverse.
 *
 * @example
 * ```ts
 * import { colorToPlane, definePlane } from 'color-kit/plane';
 *
 * const plane = definePlane({ fixed: { h: 264 } }); // x: l, y: c in [0.4, 0]
 * colorToPlane(plane, { l: 0.6, c: 0.1, h: 264, alpha: 1 });
 * // → { x: 0.6, y: ≈ 0.75 }
 * colorToPlane(plane, { l: 1.2, c: 0.5, h: 264, alpha: 1 }); // → { x: 1, y: 0 }
 * ```
 */
export function colorToPlane(resolvedPlane: Plane, color: Color): PlanePoint {
  const modelSpec = planeModelSpec(resolvedPlane.model);
  const modelColor = modelSpec.fromColor(color);
  return modelColorToPlane(resolvedPlane, modelColor);
}

export function colorToPlaneUnclamped(
  resolvedPlane: Plane,
  color: Color,
): PlanePoint {
  const modelSpec = planeModelSpec(resolvedPlane.model);
  const modelColor = modelSpec.fromColor(color);
  return modelColorToPlane(resolvedPlane, modelColor, {
    clampToViewport: false,
  });
}

/**
 * Returns whether a plane is an OKLCH lightness × chroma plane (axes `l`/`c`
 * in either order).
 *
 * The gamut-boundary, contrast and chroma-band queries only produce geometry
 * on such planes; on any other plane they return empty point/path lists.
 *
 * @param resolvedPlane - Plane from {@link definePlane}.
 * @returns `true` for an OKLCH plane with axes `l/c` or `c/l`; otherwise
 * `false`.
 *
 * @example
 * ```ts
 * import { definePlane, usesLightnessAndChroma } from 'color-kit/plane';
 *
 * usesLightnessAndChroma(definePlane({ fixed: { h: 264 } })); // → true
 * usesLightnessAndChroma(
 *   definePlane({ x: { channel: 'h' }, y: { channel: 'c' } }),
 * ); // → false
 * ```
 */
export function usesLightnessAndChroma(resolvedPlane: Plane): boolean {
  return (
    resolvedPlane.model === 'oklch' &&
    ((resolvedPlane.x.channel === 'l' && resolvedPlane.y.channel === 'c') ||
      (resolvedPlane.x.channel === 'c' && resolvedPlane.y.channel === 'l'))
  );
}

/**
 * Resolves the hue angle a plane query runs at.
 *
 * Resolution order: the explicit `hue` override, then the plane's fixed `h`
 * channel, then the OKLCH hue of the color made from the plane's fixed
 * channels. Note that the fixed `h` is in the plane model's own hue space, so
 * for `hsl`, `hsv` and `hct` planes it is that model's hue rather than an
 * OKLCH hue.
 *
 * @param resolvedPlane - Plane from {@link definePlane}.
 * @param hue - Optional explicit hue override in degrees; ignored unless
 * finite.
 * @returns Hue in degrees, wrapped into `[0, 360)`.
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { definePlane, definePlaneFromColor, planeHue } from 'color-kit/plane';
 *
 * planeHue(definePlane({ fixed: { h: 264 } })); // → 264
 * planeHue(definePlane({ fixed: { h: 264 } }), -30); // → 330
 * planeHue(definePlaneFromColor(parse('#7c3aed'), { model: 'rgb' }));
 * // → ≈ 293.0 (OKLCH hue of the fixed color)
 * ```
 */
export function planeHue(resolvedPlane: Plane, hue?: number): number {
  if (isFiniteNumber(hue)) {
    return normalizeHue(hue);
  }
  const fixedHue = resolvedPlane.fixed.h;
  if (isFiniteNumber(fixedHue)) {
    return normalizeHue(fixedHue);
  }
  return normalizeHue(
    planeModelSpec(resolvedPlane.model).toColor(resolvedPlane.fixed).h,
  );
}
