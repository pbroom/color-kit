import type { Color } from '@color-kit/core';
import { parse, toCss, toHex, toSrgbGamut } from '@color-kit/core';

export type ColorStringInputFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

export function formatColorStringInputValue(
  color: Color,
  format: ColorStringInputFormat,
): string {
  if (format === 'hex') {
    return toHex(toSrgbGamut(color));
  }

  return toCss(color, format);
}

export function parseColorStringInputValue(value: string): Color | null {
  try {
    return parse(value);
  } catch {
    return null;
  }
}

export function isColorStringInputValueValid(value: string): boolean {
  return parseColorStringInputValue(value) !== null;
}

const OKLCH_FUNCTION = /^oklch\((.*)\)$/;

/**
 * True when `input` is an `oklch()` string whose hue component is stated
 * (anything but `none`), i.e. the parsed color carries an OKLCH hue of its
 * own. Every other syntax returns `false`: hex, named colors, `rgb()`,
 * `oklab()` and `color()` have no hue, and the hues of `hsl()`, `hwb()` and
 * `lch()` live in other hue spaces that say nothing about the OKLCH hue of an
 * achromatic color.
 *
 * Only the syntax is checked; parse the string to validate it. Use the result
 * as the `explicitHue` option of the requested-color setters so an
 * achromatic input keeps the previous hue unless it states one.
 *
 * @example
 * ```ts
 * hasExplicitOklchHue('oklch(0.5 0 200)'); // true
 * hasExplicitOklchHue('oklch(0.5 0 none)'); // false
 * hasExplicitOklchHue('#808080'); // false
 * ```
 */
export function hasExplicitOklchHue(input: string): boolean {
  const match = OKLCH_FUNCTION.exec(input.trim().toLowerCase());
  if (!match) return false;
  const channels = match[1].split('/')[0].trim().split(/\s+/);
  const hue = channels[2];
  return channels.length === 3 && hue !== undefined && hue !== 'none';
}
