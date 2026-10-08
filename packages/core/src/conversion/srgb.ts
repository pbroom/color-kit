import type { Rgb, LinearRgb } from '../types.js';
import {
  clamp,
  linearToSrgbChannel,
  srgbToLinearChannel,
} from '../utils/index.js';
import { assertFinite } from './finite.js';

/**
 * Convert sRGB (0-255) to linear RGB (0-1), writing into `out`
 * (allocation-free). `out` may be the same object as `rgb`.
 *
 * @param out - Object to write the result into
 * @param rgb - sRGB color (`0-255`; not clamped)
 * @returns `out`
 * @see {@link srgbToLinear}
 *
 * @example
 * ```ts
 * import { srgbToLinearInto } from 'color-kit';
 *
 * const linear = { r: 0, g: 0, b: 0, alpha: 1 };
 * srgbToLinearInto(linear, { r: 255, g: 128, b: 0, alpha: 1 });
 * linear.g; // → ≈ 0.2159
 * ```
 */
export function srgbToLinearInto(out: LinearRgb, rgb: Rgb): LinearRgb {
  // Read every input field before writing `out` (see conversion/into.ts).
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;
  const alpha = rgb.alpha;
  out.r = srgbToLinearChannel(r / 255);
  out.g = srgbToLinearChannel(g / 255);
  out.b = srgbToLinearChannel(b / 255);
  out.alpha = alpha;
  return out;
}

/**
 * Convert sRGB (`0-255`) to linear-light RGB (`0-1`) with the sRGB transfer
 * function. Inputs are not clamped; out-of-range values extend the curve.
 *
 * @param rgb - sRGB color
 * @returns A new {@link LinearRgb}
 * @see {@link linearToSrgb}
 * @see {@link srgbToLinearChannel}
 *
 * @example
 * ```ts
 * import { srgbToLinear } from 'color-kit';
 *
 * srgbToLinear({ r: 255, g: 128, b: 0, alpha: 1 });
 * // → ≈ { r: 1, g: 0.2159, b: 0, alpha: 1 }
 * ```
 */
export function srgbToLinear(rgb: Rgb): LinearRgb {
  return srgbToLinearInto({ r: 0, g: 0, b: 0, alpha: 1 }, rgb);
}

/**
 * Convert linear RGB (0-1) to sRGB (0-255, rounded and clamped), writing
 * into `out` (allocation-free). `out` may be the same object as `linear`.
 *
 * @param out - Object to write the result into
 * @param linear - Linear-light RGB color
 * @returns `out`
 * @see {@link linearToSrgb}
 *
 * @example
 * ```ts
 * import { linearToSrgbInto } from 'color-kit';
 *
 * const rgb = { r: 0, g: 0, b: 0, alpha: 1 };
 * linearToSrgbInto(rgb, { r: 1, g: 0.2, b: 0, alpha: 1 });
 * rgb; // → { r: 255, g: 124, b: 0, alpha: 1 }
 * ```
 */
export function linearToSrgbInto(out: Rgb, linear: LinearRgb): Rgb {
  // Read every input field before writing `out` (see conversion/into.ts).
  const r = linear.r;
  const g = linear.g;
  const b = linear.b;
  const alpha = linear.alpha;
  out.r = clamp(Math.round(linearToSrgbChannel(r) * 255), 0, 255);
  out.g = clamp(Math.round(linearToSrgbChannel(g) * 255), 0, 255);
  out.b = clamp(Math.round(linearToSrgbChannel(b) * 255), 0, 255);
  out.alpha = alpha;
  return out;
}

/**
 * Convert linear-light RGB (`0-1`) to 8-bit sRGB (`0-255`) with the sRGB
 * transfer function. Each channel is rounded to an integer and clipped to
 * `[0, 255]`.
 *
 * @param linear - Linear-light RGB color
 * @returns A new {@link Rgb} with integer channels
 * @see {@link srgbToLinear}
 * @see {@link linearToSrgbChannel}
 *
 * @example
 * ```ts
 * import { linearToSrgb } from 'color-kit';
 *
 * linearToSrgb({ r: 1, g: 0.2, b: 0, alpha: 1 }); // → { r: 255, g: 124, b: 0, alpha: 1 }
 * linearToSrgb({ r: 1.2, g: 0.5, b: -0.1, alpha: 1 }); // → { r: 255, g: 188, b: 0, alpha: 1 }
 * ```
 */
export function linearToSrgb(linear: LinearRgb): Rgb {
  return linearToSrgbInto({ r: 0, g: 0, b: 0, alpha: 1 }, linear);
}

/**
 * Convert sRGB (`0-255`) to a lowercase hex string: `#rrggbb`, or
 * `#rrggbbaa` when alpha is below 1. Channels are rounded and clamped to
 * `0-255`.
 *
 * @param rgb - sRGB color; fractional and out-of-range channels are allowed
 * @returns Hex string with a leading `#`
 * @throws {RangeError} When any channel or alpha is not finite
 * @see {@link hexToRgb}
 * @see {@link toHex}
 *
 * @example
 * ```ts
 * import { rgbToHex } from 'color-kit';
 *
 * rgbToHex({ r: 59, g: 130, b: 246, alpha: 1 }); // → '#3b82f6'
 * rgbToHex({ r: 59, g: 130, b: 246, alpha: 0.5 }); // → '#3b82f680'
 * rgbToHex({ r: 300, g: -5, b: 127.6, alpha: 1 }); // → '#ff0080'
 * ```
 */
export function rgbToHex(rgb: Rgb): string {
  const { r, g, b, alpha } = rgb;
  assertFinite('rgbToHex', r, g, b, alpha);
  const byte = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}${alpha < 1 ? byte(alpha * 255) : ''}`;
}

const HEX_PATTERN = /^#?(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

/**
 * Parse a hex string (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`; the leading
 * `#` is optional) to 8-bit sRGB. Alpha is returned as `0-1`.
 *
 * @param hex - Hex color string
 * @returns A new {@link Rgb}
 * @throws {Error} When `hex` has any other length or a non-hex digit
 * @see {@link rgbToHex}
 * @see {@link fromHex}
 *
 * @example
 * ```ts
 * import { hexToRgb } from 'color-kit';
 *
 * hexToRgb('#3b82f6'); // → { r: 59, g: 130, b: 246, alpha: 1 }
 * hexToRgb('f008'); // → ≈ { r: 255, g: 0, b: 0, alpha: 0.5333 }
 * ```
 */
export function hexToRgb(hex: string): Rgb {
  if (!HEX_PATTERN.test(hex)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  let digits = hex.replace('#', '');
  // Expand the short forms: `abc` -> `aabbcc`, `abcd` -> `aabbccdd`.
  if (digits.length < 5) digits = digits.replace(/./g, '$&$&');
  const byte = (i: number) => parseInt(digits.slice(i, i + 2), 16);
  return {
    r: byte(0),
    g: byte(2),
    b: byte(4),
    alpha: digits.length > 6 ? byte(6) / 255 : 1,
  };
}
