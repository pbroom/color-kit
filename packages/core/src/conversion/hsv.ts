import type { Rgb, Hsv } from '../types.js';
import { normalizeHue } from '../utils/index.js';
import { RGB_GRAY_DELTA } from './hsl.js';

/**
 * Convert sRGB (`0-255`, fractional values allowed) to HSV/HSB (hue in
 * degrees `[0, 360)`, saturation and value `0-100`). Grays get hue and
 * saturation `0`.
 *
 * @param rgb - sRGB color
 * @returns A new {@link Hsv}
 * @see {@link hsvToRgb}
 * @see {@link toHsv}
 *
 * @example
 * ```ts
 * import { rgbToHsv } from 'color-kit';
 *
 * rgbToHsv({ r: 255, g: 0, b: 0, alpha: 1 }); // → { h: 0, s: 100, v: 100, alpha: 1 }
 * ```
 */
export function rgbToHsv(rgb: Rgb): Hsv {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  const gray = !(delta > RGB_GRAY_DELTA);
  let h = 0;
  const s = max === 0 || gray ? 0 : delta / max;
  const v = max;

  if (!gray) {
    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      h = ((b - r) / delta + 2) * 60;
    } else {
      h = ((r - g) / delta + 4) * 60;
    }
  }

  return {
    h: normalizeHue(h),
    s: s * 100,
    v: v * 100,
    alpha: rgb.alpha,
  };
}

/**
 * Convert HSV to unrounded sRGB (0-255 floats). Hue is periodic, so any
 * finite hue (negative or >= 360) is accepted.
 */
export function hsvToRgbUnrounded(hsv: Hsv): Rgb {
  const h = normalizeHue(hsv.h);
  const s = hsv.s / 100;
  const v = hsv.v / 100;

  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r: number, g: number, b: number;

  switch (i) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    default:
      r = v;
      g = p;
      b = q;
      break;
  }

  return {
    r: r * 255,
    g: g * 255,
    b: b * 255,
    alpha: hsv.alpha,
  };
}

/**
 * Convert HSV/HSB (hue in degrees, saturation and value `0-100`) to 8-bit
 * sRGB (`0-255`, each channel rounded to an integer). Any finite hue is
 * accepted and wrapped.
 *
 * @param hsv - HSV color
 * @returns A new {@link Rgb} with integer channels
 * @see {@link rgbToHsv}
 * @see {@link fromHsv}
 *
 * @example
 * ```ts
 * import { hsvToRgb } from 'color-kit';
 *
 * hsvToRgb({ h: 210, s: 50, v: 80, alpha: 1 }); // → { r: 102, g: 153, b: 204, alpha: 1 }
 * ```
 */
export function hsvToRgb(hsv: Hsv): Rgb {
  const rgb = hsvToRgbUnrounded(hsv);
  return {
    r: Math.round(rgb.r),
    g: Math.round(rgb.g),
    b: Math.round(rgb.b),
    alpha: rgb.alpha,
  };
}
