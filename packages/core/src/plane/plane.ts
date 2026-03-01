import type { Color } from '../types.js';
import { clamp, normalizeHue } from '../utils/index.js';
import type {
  PlaneChannel,
  PlaneDefinition,
  PlanePoint,
  ResolvedPlaneAxis,
  ResolvedPlaneDefinition,
} from './types.js';

export const PLANE_DEFAULT_RANGES: Record<PlaneChannel, [number, number]> = {
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
};

function resolvePlaneRange(
  channel: PlaneChannel,
  range?: [number, number],
): [number, number] {
  return range ?? PLANE_DEFAULT_RANGES[channel];
}

function resolvePlaneAxis(axis: {
  channel: PlaneChannel;
  range?: [number, number];
}): ResolvedPlaneAxis {
  return {
    channel: axis.channel,
    range: resolvePlaneRange(axis.channel, axis.range),
  };
}

function resolveFixedColor(
  fixed?: Partial<Pick<Color, 'l' | 'c' | 'h' | 'alpha'>>,
): Pick<Color, 'l' | 'c' | 'h' | 'alpha'> {
  return {
    l: clamp(fixed?.l ?? 0.5, 0, 1),
    c: Math.max(0, fixed?.c ?? 0),
    h: normalizeHue(fixed?.h ?? 0),
    alpha: clamp(fixed?.alpha ?? 1, 0, 1),
  };
}

function validateDistinctAxes(definition: ResolvedPlaneDefinition): void {
  if (definition.x.channel === definition.y.channel) {
    throw new Error(
      'resolvePlaneDefinition() requires distinct channels for x and y axes',
    );
  }
}

function normalizeInRange(value: number, range: [number, number]): number {
  const span = range[1] - range[0];
  if (Math.abs(span) <= Number.EPSILON) return 0;
  return clamp((value - range[0]) / span, 0, 1);
}

function denormalizeInRange(norm: number, range: [number, number]): number {
  return range[0] + clamp(norm, 0, 1) * (range[1] - range[0]);
}

export function resolvePlaneDefinition(
  plane: PlaneDefinition,
): ResolvedPlaneDefinition {
  const resolved: ResolvedPlaneDefinition = {
    model: plane.model ?? 'oklch',
    x: resolvePlaneAxis(plane.x),
    y: resolvePlaneAxis(plane.y),
    fixed: resolveFixedColor(plane.fixed),
  };

  validateDistinctAxes(resolved);
  return resolved;
}

export function planeToColor(
  plane: ResolvedPlaneDefinition,
  point: PlanePoint,
): Color {
  const color: Color = { ...plane.fixed };
  color[plane.x.channel] = denormalizeInRange(point.x, plane.x.range);
  color[plane.y.channel] = denormalizeInRange(point.y, plane.y.range);
  color.h = normalizeHue(color.h);
  return color;
}

export function colorToPlane(
  plane: ResolvedPlaneDefinition,
  color: Color,
): PlanePoint {
  return {
    x: normalizeInRange(color[plane.x.channel], plane.x.range),
    y: normalizeInRange(color[plane.y.channel], plane.y.range),
  };
}

export function usesLightnessAndChroma(
  plane: ResolvedPlaneDefinition,
): boolean {
  return (
    (plane.x.channel === 'l' && plane.y.channel === 'c') ||
    (plane.x.channel === 'c' && plane.y.channel === 'l')
  );
}

export function resolvePlaneHue(
  plane: ResolvedPlaneDefinition,
  hue?: number,
): number {
  return normalizeHue(hue ?? plane.fixed.h);
}
