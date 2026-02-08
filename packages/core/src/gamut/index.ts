import type { Color } from '../types.js';
import { oklchToOklab } from '../conversion/oklch.js';
import { oklabToLinearRgb } from '../conversion/oklab.js';
import { linearSrgbToLinearP3 } from '../conversion/p3.js';

/** Small epsilon to account for floating-point rounding */
const EPSILON = 0.000075;

/**
 * Check if a Color is within the sRGB gamut.
 *
 * Uses unclamped linear sRGB values to avoid the false-positive
 * caused by the clamping in `linearToSrgb` / `toRgb`.
 */
export function inSrgbGamut(color: Color): boolean {
  const lab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linear = oklabToLinearRgb(lab);
  return (
    linear.r >= -EPSILON &&
    linear.r <= 1 + EPSILON &&
    linear.g >= -EPSILON &&
    linear.g <= 1 + EPSILON &&
    linear.b >= -EPSILON &&
    linear.b <= 1 + EPSILON
  );
}

/**
 * Check if a Color is within the Display P3 gamut.
 *
 * Uses unclamped linear P3 values to avoid the false-positive
 * caused by the clamping in `linearP3ToP3` / `toP3`.
 */
export function inP3Gamut(color: Color): boolean {
  const lab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linearSrgb = oklabToLinearRgb(lab);
  const linearP3 = linearSrgbToLinearP3(linearSrgb);
  return (
    linearP3.r >= -EPSILON &&
    linearP3.r <= 1 + EPSILON &&
    linearP3.g >= -EPSILON &&
    linearP3.g <= 1 + EPSILON &&
    linearP3.b >= -EPSILON &&
    linearP3.b <= 1 + EPSILON
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
