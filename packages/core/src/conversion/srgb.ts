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
 * @example
 * ```ts
 * const linear = { r: 0, g: 0, b: 0, alpha: 1 };
 * srgbToLinearInto(linear, { r: 255, g: 128, b: 0, alpha: 1 });
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

/** Convert sRGB (0-255) to linear RGB (0-1) */
export function srgbToLinear(rgb: Rgb): LinearRgb {
  return srgbToLinearInto({ r: 0, g: 0, b: 0, alpha: 1 }, rgb);
}

/**
 * Convert linear RGB (0-1) to sRGB (0-255, rounded and clamped), writing
 * into `out` (allocation-free). `out` may be the same object as `linear`.
 *
 * @example
 * ```ts
 * const rgb = { r: 0, g: 0, b: 0, alpha: 1 };
 * linearToSrgbInto(rgb, { r: 1, g: 0.2, b: 0, alpha: 1 });
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

/** Convert linear RGB (0-1) to sRGB (0-255) */
export function linearToSrgb(linear: LinearRgb): Rgb {
  return linearToSrgbInto({ r: 0, g: 0, b: 0, alpha: 1 }, linear);
}

/**
 * Convert sRGB (0-255) to hex string. Channels are rounded and clamped to
 * `0-255`; non-finite channels or alpha throw a `RangeError` instead of
 * emitting `NaN` digits.
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
 * `#` is optional) to sRGB. Throws for any other length or non-hex digit.
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
