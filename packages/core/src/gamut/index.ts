import type { Color } from '../types.js';
import { toRgb, toP3 } from '../conversion/index.js';

/**
 * Check if a Color is within the sRGB gamut.
 * A color is in gamut when all RGB channels are within 0-255.
 */
export function inSrgbGamut(color: Color): boolean {
  const rgb = toRgb(color);
  return (
    rgb.r >= 0 &&
    rgb.r <= 255 &&
    rgb.g >= 0 &&
    rgb.g <= 255 &&
    rgb.b >= 0 &&
    rgb.b <= 255
  );
}

/**
 * Check if a Color is within the Display P3 gamut.
 */
export function inP3Gamut(color: Color): boolean {
  const p3 = toP3(color);
  return (
    p3.r >= 0 && p3.r <= 1 && p3.g >= 0 && p3.g <= 1 && p3.b >= 0 && p3.b <= 1
  );
}

/**
 * Map a Color to the sRGB gamut by progressively reducing chroma.
 * Uses a binary search to find the maximum chroma that stays in gamut.
 *
 * This preserves lightness and hue while only reducing saturation,
 * which produces the most visually similar in-gamut color.
 */
export function toSrgbGamut(color: Color): Color {
  if (inSrgbGamut(color)) return { ...color };

  let lo = 0;
  let hi = color.c;
  let mapped = { ...color };

  // Binary search for max chroma in gamut (within epsilon)
  const epsilon = 0.0001;
  while (hi - lo > epsilon) {
    const mid = (lo + hi) / 2;
    const test: Color = { ...color, c: mid };
    if (inSrgbGamut(test)) {
      lo = mid;
      mapped = test;
    } else {
      hi = mid;
    }
  }

  return mapped;
}

/**
 * Map a Color to the Display P3 gamut by progressively reducing chroma.
 */
export function toP3Gamut(color: Color): Color {
  if (inP3Gamut(color)) return { ...color };

  let lo = 0;
  let hi = color.c;
  let mapped = { ...color };

  const epsilon = 0.0001;
  while (hi - lo > epsilon) {
    const mid = (lo + hi) / 2;
    const test: Color = { ...color, c: mid };
    if (inP3Gamut(test)) {
      lo = mid;
      mapped = test;
    } else {
      hi = mid;
    }
  }

  return mapped;
}
