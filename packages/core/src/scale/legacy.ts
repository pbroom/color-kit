import type { Color } from '../types.js';
import { normalizeHue, lerp } from '../utils/index.js';

/**
 * Option-less `interpolate()`: plain OKLCH channel interpolation with the hue
 * taking the shortest path; endpoints with chroma below `0.001` borrow the
 * other endpoint's hue. Kept in its own module so callers that only need the
 * default (such as the plane gradient query) do not bundle the
 * interpolation-space engine.
 */
export function interpolateOklchDefault(
  color1: Color,
  color2: Color,
  t: number,
): Color {
  // Handle hue interpolation via shortest path
  let h1 = color1.h;
  let h2 = color2.h;
  const diff = h2 - h1;

  if (diff > 180) {
    h1 += 360;
  } else if (diff < -180) {
    h2 += 360;
  }

  // If either color has near-zero chroma, use the other's hue
  const achromatic1 = color1.c < 0.001;
  const achromatic2 = color2.c < 0.001;

  let h: number;
  if (achromatic1 && achromatic2) {
    h = 0;
  } else if (achromatic1) {
    h = h2;
  } else if (achromatic2) {
    h = h1;
  } else {
    h = lerp(h1, h2, t);
  }

  return {
    l: lerp(color1.l, color2.l, t),
    c: lerp(color1.c, color2.c, t),
    h: normalizeHue(h),
    alpha: lerp(color1.alpha, color2.alpha, t),
  };
}

/** Evenly sample `interpolateAt` from t = 0 to t = 1 inclusive. */
export function sampleScale(
  steps: number,
  interpolateAt: (t: number) => Color,
): Color[] {
  if (steps < 2) {
    throw new Error('Scale must have at least 2 steps');
  }

  const colors: Color[] = [];
  for (let i = 0; i < steps; i++) {
    colors.push(interpolateAt(i / (steps - 1)));
  }
  return colors;
}

/** Option-less `generateScale()`, built on `interpolateOklchDefault`. */
export function generateOklchDefaultScale(
  from: Color,
  to: Color,
  steps: number,
): Color[] {
  return sampleScale(steps, (t) => interpolateOklchDefault(from, to, t));
}
