import type { Rgb, LinearRgb } from '../types.js';
import {
  clamp,
  linearToSrgbChannel,
  srgbToLinearChannel,
} from '../utils/index.js';

/** Convert sRGB (0-255) to linear RGB (0-1) */
export function srgbToLinear(rgb: Rgb): LinearRgb {
  return {
    r: srgbToLinearChannel(rgb.r / 255),
    g: srgbToLinearChannel(rgb.g / 255),
    b: srgbToLinearChannel(rgb.b / 255),
    alpha: rgb.alpha,
  };
}

/** Convert linear RGB (0-1) to sRGB (0-255) */
export function linearToSrgb(linear: LinearRgb): Rgb {
  return {
    r: clamp(Math.round(linearToSrgbChannel(linear.r) * 255), 0, 255),
    g: clamp(Math.round(linearToSrgbChannel(linear.g) * 255), 0, 255),
    b: clamp(Math.round(linearToSrgbChannel(linear.b) * 255), 0, 255),
    alpha: linear.alpha,
  };
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
