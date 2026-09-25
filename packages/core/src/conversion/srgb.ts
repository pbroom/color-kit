import type { Rgb, LinearRgb } from '../types.js';
import {
  clamp,
  linearToSrgbChannel,
  srgbToLinearChannel,
} from '../utils/index.js';

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

/** Convert sRGB (0-255) to hex string */
export function rgbToHex(rgb: Rgb): string {
  const r = clamp(Math.round(rgb.r), 0, 255).toString(16).padStart(2, '0');
  const g = clamp(Math.round(rgb.g), 0, 255).toString(16).padStart(2, '0');
  const b = clamp(Math.round(rgb.b), 0, 255).toString(16).padStart(2, '0');

  if (rgb.alpha < 1) {
    const a = clamp(Math.round(rgb.alpha * 255), 0, 255)
      .toString(16)
      .padStart(2, '0');
    return `#${r}${g}${b}${a}`;
  }

  return `#${r}${g}${b}`;
}

/** Parse a hex string to sRGB */
export function hexToRgb(hex: string): Rgb {
  const cleaned = hex.replace(/^#/, '');

  let r: number, g: number, b: number, a: number;

  if (cleaned.length === 3 || cleaned.length === 4) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
    a = cleaned.length === 4 ? parseInt(cleaned[3] + cleaned[3], 16) / 255 : 1;
  } else if (cleaned.length === 6 || cleaned.length === 8) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
    a = cleaned.length === 8 ? parseInt(cleaned.slice(6, 8), 16) / 255 : 1;
  } else {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return { r, g, b, alpha: a };
}
