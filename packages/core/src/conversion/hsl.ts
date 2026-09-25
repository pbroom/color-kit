import type { Rgb, Hsl } from '../types.js';
import { normalizeHue } from '../utils/index.js';

/** Convert sRGB (0-255) to HSL */
export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

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
    l: l * 100,
    alpha: rgb.alpha,
  };
}

/**
 * Convert HSL to unrounded sRGB (0-255 floats). Hue is periodic, so any
 * finite hue (negative or >= 360) is accepted.
 */
export function hslToRgbUnrounded(hsl: Hsl): Rgb {
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    const val = l * 255;
    return { r: val, g: val, b: val, alpha: hsl.alpha };
  }

  const hueToRgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = normalizeHue(hsl.h) / 360;

  return {
    r: hueToRgb(p, q, hNorm + 1 / 3) * 255,
    g: hueToRgb(p, q, hNorm) * 255,
    b: hueToRgb(p, q, hNorm - 1 / 3) * 255,
    alpha: hsl.alpha,
  };
}

/** Convert HSL to sRGB (0-255, rounded to 8-bit channels) */
export function hslToRgb(hsl: Hsl): Rgb {
  const rgb = hslToRgbUnrounded(hsl);
  return {
    r: Math.round(rgb.r),
    g: Math.round(rgb.g),
    b: Math.round(rgb.b),
    alpha: rgb.alpha,
  };
}
