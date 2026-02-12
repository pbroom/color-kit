import type { Color } from '@color-kit/core';
import { clamp } from '@color-kit/core';

export type ColorSliderChannel = 'l' | 'c' | 'h' | 'alpha';
export type ColorSliderOrientation = 'horizontal' | 'vertical';
export type ColorSliderKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown';

export const COLOR_SLIDER_DEFAULT_RANGES: Record<
  ColorSliderChannel,
  [number, number]
> = {
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
  alpha: [0, 1],
};

const COLOR_SLIDER_LABELS: Record<ColorSliderChannel, string> = {
  l: 'Lightness',
  c: 'Chroma',
  h: 'Hue',
  alpha: 'Opacity',
};

export function resolveColorSliderRange(
  channel: ColorSliderChannel,
  range?: [number, number],
): [number, number] {
  return range ?? COLOR_SLIDER_DEFAULT_RANGES[channel];
}

export function getColorSliderLabel(channel: ColorSliderChannel): string {
  return COLOR_SLIDER_LABELS[channel] ?? channel;
}

export function getColorSliderThumbPosition(
  color: Color,
  channel: ColorSliderChannel,
  range: [number, number],
): number {
  return getColorSliderNormFromValue(color[channel], range);
}

export function getColorSliderNormFromValue(
  value: number,
  range: [number, number],
): number {
  const span = range[1] - range[0];
  if (span === 0) {
    return 0;
  }
  return clamp((value - range[0]) / span, 0, 1);
}

export function colorFromColorSliderPosition(
  color: Color,
  channel: ColorSliderChannel,
  norm: number,
  range: [number, number],
): Color {
  const t = clamp(norm, 0, 1);
  const span = range[1] - range[0];
  const value = span === 0 ? range[0] : range[0] + t * span;

  return {
    ...color,
    [channel]: value,
  };
}

export function normalizeColorSliderPointer(
  orientation: ColorSliderOrientation,
  pointer: number,
  start: number,
  size: number,
): number {
  if (size <= 0) {
    return 0;
  }
  if (orientation === 'horizontal') {
    return clamp((pointer - start) / size, 0, 1);
  }
  return 1 - clamp((pointer - start) / size, 0, 1);
}

export function colorFromColorSliderKey(
  color: Color,
  channel: ColorSliderChannel,
  key: string,
  stepRatio: number,
  range: [number, number],
): Color | null {
  const channelStep = stepRatio * (range[1] - range[0]);

  switch (key as ColorSliderKey) {
    case 'ArrowRight':
    case 'ArrowUp':
      return {
        ...color,
        [channel]: clamp(color[channel] + channelStep, range[0], range[1]),
      };
    case 'ArrowLeft':
    case 'ArrowDown':
      return {
        ...color,
        [channel]: clamp(color[channel] - channelStep, range[0], range[1]),
      };
    default:
      return null;
  }
}
