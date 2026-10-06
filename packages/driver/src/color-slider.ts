import type { Color } from '@color-kit/core';
import { clamp } from '@color-kit/core';
import {
  DEFAULT_LARGE_STEP_RATIO,
  getChannelLabel,
  getChannelValueText,
  stepRangeValue,
} from './channel-keys.js';

export type ColorSliderChannel = 'l' | 'c' | 'h' | 'alpha';
export type ColorSliderOrientation = 'horizontal' | 'vertical';
export type ColorSliderKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End';

export interface ColorSliderKeyOptions {
  /**
   * PageUp/PageDown step as a ratio of the range.
   * @default 0.1
   */
  largeStepRatio?: number;
  /**
   * Wrap around the range ends instead of clamping.
   * @default true for the hue channel, false otherwise
   */
  wrap?: boolean;
}

export const COLOR_SLIDER_DEFAULT_RANGES: Record<
  ColorSliderChannel,
  [number, number]
> = {
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
  alpha: [0, 1],
};

export function resolveColorSliderRange(
  channel: ColorSliderChannel,
  range?: [number, number],
): [number, number] {
  return range ?? COLOR_SLIDER_DEFAULT_RANGES[channel];
}

export function getColorSliderLabel(channel: ColorSliderChannel): string {
  return getChannelLabel(channel);
}

/**
 * Human-readable `aria-valuetext` for a slider value, e.g. "Hue 213°",
 * "Lightness 60%", "Opacity 50%", "Chroma 0.2".
 */
export function getColorSliderValueText(
  channel: ColorSliderChannel,
  value: number,
): string {
  return getChannelValueText(channel, value);
}

/** Whether keyboard steps wrap for a channel by default (hue only). */
export function resolveColorSliderWrap(
  channel: ColorSliderChannel,
  wrap?: boolean,
): boolean {
  return wrap ?? channel === 'h';
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
  positionInset = 0,
): number {
  const inset = clamp(positionInset, 0, size / 2);
  const trackStart = start + inset;
  const trackSize = size - inset * 2;

  if (trackSize <= 0) {
    return 0;
  }
  if (orientation === 'horizontal') {
    return clamp((pointer - trackStart) / trackSize, 0, 1);
  }
  return 1 - clamp((pointer - trackStart) / trackSize, 0, 1);
}

/**
 * Keyboard model for a 1D color slider:
 * - Arrow Right/Up and Left/Down step by `stepRatio` of the range.
 * - PageUp/PageDown step by `largeStepRatio` of the range.
 * - Home/End jump to the range start/end.
 *
 * Steps wrap for hue (by default) and clamp otherwise. Returns `null` for
 * keys the slider does not handle.
 */
export function colorFromColorSliderKey(
  color: Color,
  channel: ColorSliderChannel,
  key: string,
  stepRatio: number,
  range: [number, number],
  options: ColorSliderKeyOptions = {},
): Color | null {
  const span = range[1] - range[0];
  const largeStepRatio = options.largeStepRatio ?? DEFAULT_LARGE_STEP_RATIO;
  const wrap = resolveColorSliderWrap(channel, options.wrap);
  const value = color[channel];

  let next: number;
  switch (key as ColorSliderKey) {
    case 'ArrowRight':
    case 'ArrowUp':
      next = stepRangeValue(value, stepRatio * span, range, wrap);
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      next = stepRangeValue(value, -stepRatio * span, range, wrap);
      break;
    case 'PageUp':
      next = stepRangeValue(value, largeStepRatio * span, range, wrap);
      break;
    case 'PageDown':
      next = stepRangeValue(value, -largeStepRatio * span, range, wrap);
      break;
    case 'Home':
      next = range[0];
      break;
    case 'End':
      next = range[1];
      break;
    default:
      return null;
  }

  return {
    ...color,
    [channel]: next,
  };
}
