import type { Color } from '@color-kit/core';
import { clamp } from '@color-kit/core';
import {
  DEFAULT_LARGE_STEP_RATIO,
  getChannelLabel,
  getChannelValueText,
  stepRangeValue,
} from './channel-keys.js';

/**
 * Color channel a slider drives: OKLCH lightness `l` (0..1), chroma `c`
 * (0..~0.4), hue `h` (degrees) or `alpha` (0..1).
 */
export type ColorSliderChannel = 'l' | 'c' | 'h' | 'alpha';
/**
 * Slider track direction. Horizontal tracks run left to right; vertical
 * tracks run bottom to top.
 */
export type ColorSliderOrientation = 'horizontal' | 'vertical';
/** Keyboard keys handled by {@link colorFromColorSliderKey}. */
export type ColorSliderKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End';

/** Options for {@link colorFromColorSliderKey}. */
export interface ColorSliderKeyOptions {
  /**
   * PageUp/PageDown step as a ratio of the range.
   * @defaultValue 0.1
   */
  largeStepRatio?: number;
  /**
   * Wrap around the range ends instead of clamping.
   * @defaultValue true for the hue channel, false otherwise
   */
  wrap?: boolean;
}

/**
 * Default `[start, end]` range per slider channel: `l` `[0, 1]`, `c`
 * `[0, 0.4]`, `h` `[0, 360]`, `alpha` `[0, 1]`.
 *
 * @see {@link resolveColorSliderRange}
 */
export const COLOR_SLIDER_DEFAULT_RANGES: Record<
  ColorSliderChannel,
  [number, number]
> = {
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
  alpha: [0, 1],
};

/**
 * Returns `range` when given, otherwise the channel's entry in
 * {@link COLOR_SLIDER_DEFAULT_RANGES}.
 *
 * @example
 * ```ts
 * import { resolveColorSliderRange } from 'color-kit/driver';
 *
 * resolveColorSliderRange('c'); // → [0, 0.4]
 * resolveColorSliderRange('h', [0, 180]); // → [0, 180]
 * ```
 */
export function resolveColorSliderRange(
  channel: ColorSliderChannel,
  range?: [number, number],
): [number, number] {
  return range ?? COLOR_SLIDER_DEFAULT_RANGES[channel];
}

/**
 * Default accessible label for a slider channel: `'Lightness'`, `'Chroma'`,
 * `'Hue'` or `'Opacity'`.
 *
 * @example
 * ```ts
 * import { getColorSliderLabel } from 'color-kit/driver';
 *
 * getColorSliderLabel('alpha'); // → 'Opacity'
 * ```
 */
export function getColorSliderLabel(channel: ColorSliderChannel): string {
  return getChannelLabel(channel);
}

/**
 * Human-readable `aria-valuetext` for a slider value, e.g. "Hue 213°",
 * "Lightness 60%", "Opacity 50%", "Chroma 0.2". Lightness and alpha are
 * shown as percentages, hue in whole degrees, chroma to three decimals.
 *
 * @example
 * ```ts
 * import { getColorSliderValueText } from 'color-kit/driver';
 *
 * getColorSliderValueText('h', 213.4); // → 'Hue 213°'
 * getColorSliderValueText('c', 0.12345); // → 'Chroma 0.123'
 * ```
 */
export function getColorSliderValueText(
  channel: ColorSliderChannel,
  value: number,
): string {
  return getChannelValueText(channel, value);
}

/**
 * Whether keyboard steps wrap for a channel: `wrap` when given, otherwise
 * `true` for hue only.
 *
 * @example
 * ```ts
 * import { resolveColorSliderWrap } from 'color-kit/driver';
 *
 * resolveColorSliderWrap('h'); // → true
 * resolveColorSliderWrap('l'); // → false
 * resolveColorSliderWrap('h', false); // → false
 * ```
 */
export function resolveColorSliderWrap(
  channel: ColorSliderChannel,
  wrap?: boolean,
): boolean {
  return wrap ?? channel === 'h';
}

/**
 * Normalized thumb position (`[0, 1]`, clamped) of `color[channel]` within
 * `range`; 0 is the range start.
 *
 * @see {@link getColorSliderNormFromValue}
 *
 * @example
 * ```ts
 * import { getColorSliderThumbPosition } from 'color-kit/driver';
 *
 * getColorSliderThumbPosition({ l: 0.6, c: 0.1, h: 250, alpha: 1 }, 'c', [0, 0.4]); // → 0.25
 * ```
 */
export function getColorSliderThumbPosition(
  color: Color,
  channel: ColorSliderChannel,
  range: [number, number],
): number {
  return getColorSliderNormFromValue(color[channel], range);
}

/**
 * Normalizes `value` into `range` as a clamped `[0, 1]` position. Returns 0
 * for a zero-width range. Descending ranges are supported.
 *
 * @example
 * ```ts
 * import { getColorSliderNormFromValue } from 'color-kit/driver';
 *
 * getColorSliderNormFromValue(90, [0, 360]); // → 0.25
 * getColorSliderNormFromValue(500, [0, 360]); // → 1
 * getColorSliderNormFromValue(0.25, [1, 0]); // → 0.75
 * ```
 */
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

/**
 * Returns a copy of `color` with `channel` set from a normalized track
 * position (clamped to `[0, 1]`; 0 = range start). The result is not
 * gamut-mapped.
 *
 * @example
 * ```ts
 * import { colorFromColorSliderPosition } from 'color-kit/driver';
 *
 * colorFromColorSliderPosition({ l: 0.6, c: 0.1, h: 250, alpha: 1 }, 'h', 0.5, [0, 360]);
 * // → { l: 0.6, c: 0.1, h: 180, alpha: 1 }
 * ```
 */
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

/**
 * Converts a pointer coordinate into a clamped `[0, 1]` track position.
 * Horizontal tracks grow left to right; vertical tracks grow bottom to top
 * (the returned value is inverted from the client y axis).
 *
 * @param pointer - Pointer client coordinate: `clientX` for horizontal,
 * `clientY` for vertical.
 * @param start - Track start in client pixels: `rect.left` or `rect.top`.
 * @param size - Track length in pixels: `rect.width` or `rect.height`.
 * @param positionInset - Pixels trimmed from both track ends (e.g. the thumb
 * radius), clamped to `size / 2`. Returns 0 when nothing is left.
 *
 * @example
 * ```ts
 * import { normalizeColorSliderPointer } from 'color-kit/driver';
 *
 * normalizeColorSliderPointer('horizontal', 150, 100, 200); // → 0.25
 * normalizeColorSliderPointer('vertical', 150, 100, 200); // → 0.75
 * normalizeColorSliderPointer('horizontal', 110, 100, 200, 10); // → 0
 * ```
 */
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
 * keys the slider does not handle. Modifier keys are not read: pass a larger
 * `stepRatio` for Shift+Arrow.
 *
 * @param stepRatio - Arrow-key step as a fraction of the range, e.g. `0.01`.
 *
 * @example
 * ```ts
 * import { colorFromColorSliderKey } from 'color-kit/driver';
 *
 * const color = { l: 0.6, c: 0.1, h: 350, alpha: 1 };
 * colorFromColorSliderKey(color, 'h', 'PageUp', 0.01, [0, 360]); // → { l: 0.6, c: 0.1, h: 26, alpha: 1 }
 * colorFromColorSliderKey(color, 'l', 'End', 0.01, [0, 1]); // → { l: 1, c: 0.1, h: 350, alpha: 1 }
 * colorFromColorSliderKey(color, 'l', 'Enter', 0.01, [0, 1]); // → null
 * ```
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
