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
 * Projects a normalized point on the plane back into a color value.
 *
 * @param resolvedPlane Fully-resolved plane descriptor.
 * @param point Normalized plane point (`x`, `y` in `[0..1]`).
 * @returns A color with plane channels denormalized into channel ranges.
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
 * Projects a color value into normalized plane coordinates.
 *
 * @param resolvedPlane Fully-resolved plane descriptor.
 * @param color Color to project.
 * @returns A normalized plane point (`x`, `y` in `[0..1]`).
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
 * Returns whether a plane's two axes are exactly the lightness/chroma pair.
 *
 * @param resolvedPlane Fully-resolved plane descriptor.
 * @returns `true` when axes are `l/c` or `c/l`; otherwise `false`.
 */
export function usesLightnessAndChroma(resolvedPlane: Plane): boolean {
  return (
    resolvedPlane.model === 'oklch' &&
    ((resolvedPlane.x.channel === 'l' && resolvedPlane.y.channel === 'c') ||
      (resolvedPlane.x.channel === 'c' && resolvedPlane.y.channel === 'l'))
  );
}

/**
 * Resolves the effective hue angle for a plane query.
 *
 * Resolution order: explicit `hue` override -> fixed plane hue -> model color
 * hue derived from fixed channels.
 *
 * @param resolvedPlane Fully-resolved plane descriptor.
 * @param hue Optional explicit hue override.
 * @returns Normalized hue in `[0, 360)`.
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
