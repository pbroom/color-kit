import type { Color } from '@color-kit/core';
import { parse, toCss, toHex, toSrgbGamut } from '@color-kit/core';

/** Text format a color string input displays. */
export type ColorStringInputFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

/**
 * Formats a color for a text input. `'hex'` first gamut-maps into sRGB
 * (chroma reduction), so an out-of-gamut color shows its mapped hex;
 * `'rgb'`, `'hsl'` and `'oklch'` go through `toCss` without mapping (CSS
 * `rgb()` clips each channel).
 *
 * @throws {TypeError} When `format` is not a supported format, e.g. the
 * removed `'p3'` (the message suggests `'display-p3'`).
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { formatColorStringInputValue } from 'color-kit/driver';
 *
 * const vivid = { l: 0.75, c: 0.22, h: 150, alpha: 1 };
 * formatColorStringInputValue(vivid, 'hex'); // → '#00d061'
 * formatColorStringInputValue(vivid, 'rgb'); // → 'rgb(0 210 90)'
 * formatColorStringInputValue(parse('#3b82f6'), 'oklch'); // → 'oklch(0.6231 0.188 259.81)'
 * ```
 */
export function formatColorStringInputValue(
  color: Color,
  format: ColorStringInputFormat,
): string {
  if (format === 'hex') {
    return toHex(toSrgbGamut(color));
  }

  return toCss(color, format);
}

/**
 * Parses any CSS color string `parse` accepts, returning `null` instead of
 * throwing when it does not parse.
 *
 * @example
 * ```ts
 * import { toHex } from 'color-kit';
 * import { parseColorStringInputValue } from 'color-kit/driver';
 *
 * toHex(parseColorStringInputValue('rebeccapurple')!); // → '#663399'
 * parseColorStringInputValue('#zzz'); // → null
 * ```
 */
export function parseColorStringInputValue(value: string): Color | null {
  try {
    return parse(value);
  } catch {
    return null;
  }
}

/**
 * Whether `value` parses as a color (see {@link parseColorStringInputValue}).
 *
 * @example
 * ```ts
 * import { isColorStringInputValueValid } from 'color-kit/driver';
 *
 * isColorStringInputValueValid('hsl(210 80% 50%)'); // → true
 * isColorStringInputValueValid('blue-ish'); // → false
 * ```
 */
export function isColorStringInputValueValid(value: string): boolean {
  return parseColorStringInputValue(value) !== null;
}

const OKLCH_FUNCTION = /^oklch\(([\s\S]*)\)$/;

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
 * import { hasExplicitOklchHue } from 'color-kit/driver';
 *
 * hasExplicitOklchHue('oklch(0.5 0 200)'); // → true
 * hasExplicitOklchHue('oklch(0.5 0 none)'); // → false
 * hasExplicitOklchHue('#808080'); // → false
 * ```
 */
export function hasExplicitOklchHue(input: string): boolean {
  const match = OKLCH_FUNCTION.exec(input.trim().toLowerCase());
  if (!match) return false;
  const channels = match[1].split('/')[0].trim().split(/\s+/);
  const hue = channels[2];
  return channels.length === 3 && hue !== undefined && hue !== 'none';
}
