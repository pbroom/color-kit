import type { Color } from '@color-kit/core';
import { clamp, normalizeHue } from '@color-kit/core';

export type ColorDialChannel = 'l' | 'c' | 'h' | 'alpha';
export type ColorDialKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End';

export const COLOR_DIAL_DEFAULT_RANGES: Record<
  ColorDialChannel,
  [number, number]
> = {
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
  alpha: [0, 1],
};

const COLOR_DIAL_LABELS: Record<ColorDialChannel, string> = {
  l: 'Lightness',
  c: 'Chroma',
  h: 'Hue',
  alpha: 'Opacity',
};

const DEFAULT_START_ANGLE = -135;
const DEFAULT_END_ANGLE = 135;

const FULL_CIRCLE_EPSILON = 0.0001;

export interface ResolvedColorDialAngles {
  start: number;
  end: number;
  sweep: number;
  fullCircle: boolean;
}

function shortestAngularDistance(a: number, b: number): number {
  const delta = Math.abs(normalizeHue(a) - normalizeHue(b));
  return Math.min(delta, 360 - delta);
}

function wrapInRange(value: number, range: [number, number]): number {
  const span = range[1] - range[0];
  if (span <= 0) {
    return range[0];
  }
  return ((((value - range[0]) % span) + span) % span) + range[0];
}

export function resolveColorDialRange(
  channel: ColorDialChannel,
  range?: [number, number],
): [number, number] {
  return range ?? COLOR_DIAL_DEFAULT_RANGES[channel];
}

export function resolveColorDialAngles(
  startAngle: number = DEFAULT_START_ANGLE,
  endAngle: number = DEFAULT_END_ANGLE,
): ResolvedColorDialAngles {
  const safeStart = Number.isFinite(startAngle)
    ? startAngle
    : DEFAULT_START_ANGLE;
  const safeEnd = Number.isFinite(endAngle) ? endAngle : DEFAULT_END_ANGLE;

  let sweep = safeEnd - safeStart;
  if (Math.abs(sweep) <= FULL_CIRCLE_EPSILON) {
    sweep = 360;
  }
  while (sweep <= 0) {
    sweep += 360;
  }
  if (sweep > 360) {
    sweep = 360;
  }

  const start = normalizeHue(safeStart);
  const end = normalizeHue(start + sweep);
  const fullCircle = sweep >= 360 - FULL_CIRCLE_EPSILON;

  return {
    start,
    end,
    sweep,
    fullCircle,
  };
}

export function getColorDialLabel(channel: ColorDialChannel): string {
  return COLOR_DIAL_LABELS[channel] ?? channel;
}

export function getColorDialThumbPosition(
  color: Color,
  channel: ColorDialChannel,
  range: [number, number],
  angles: ResolvedColorDialAngles,
): { norm: number; angle: number } {
  const span = range[1] - range[0];
  const norm = span <= 0 ? 0 : clamp((color[channel] - range[0]) / span, 0, 1);
  const angle = normalizeHue(angles.start + norm * angles.sweep);

  return {
    norm,
    angle,
  };
}

export function colorFromColorDialPosition(
  color: Color,
  channel: ColorDialChannel,
  norm: number,
  range: [number, number],
): Color {
  const t = clamp(norm, 0, 1);
  const value = range[0] + t * (range[1] - range[0]);

  return {
    ...color,
    [channel]: value,
  };
}

export function normalizeColorDialPointer(
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
  angles: ResolvedColorDialAngles,
): number {
  const pointerAngle = normalizeHue(
    (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI,
  );
  const delta = normalizeHue(pointerAngle - angles.start);

  if (angles.fullCircle) {
    return clamp(delta / 360, 0, 1);
  }

  if (delta <= angles.sweep) {
    return clamp(delta / angles.sweep, 0, 1);
  }

  const distanceToStart = shortestAngularDistance(pointerAngle, angles.start);
  const distanceToEnd = shortestAngularDistance(pointerAngle, angles.end);
  return distanceToStart <= distanceToEnd ? 0 : 1;
}

export function colorFromColorDialKey(
  color: Color,
  channel: ColorDialChannel,
  key: string,
  stepRatio: number,
  range: [number, number],
  options: { wrap?: boolean } = {},
): Color | null {
  const span = range[1] - range[0];
  const channelStep = Math.abs(stepRatio) * span;

  if (key === 'Home') {
    return { ...color, [channel]: range[0] };
  }
  if (key === 'End') {
    return { ...color, [channel]: range[1] };
  }

  let delta = 0;
  switch (key as ColorDialKey) {
    case 'ArrowRight':
    case 'ArrowUp':
    case 'PageUp':
      delta = channelStep;
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
    case 'PageDown':
      delta = -channelStep;
      break;
    default:
      return null;
  }

  const nextValue = color[channel] + delta;
  const value = options.wrap
    ? wrapInRange(nextValue, range)
    : clamp(nextValue, range[0], range[1]);

  return {
    ...color,
    [channel]: value,
  };
}
