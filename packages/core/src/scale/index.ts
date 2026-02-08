import type { Color } from '../types.js';
import { normalizeHue, lerp } from '../utils/index.js';

/**
 * Interpolate between two Colors in OKLCH space.
 * t = 0 returns color1, t = 1 returns color2.
 *
 * Hue interpolation takes the shortest path around the wheel.
 */
export function interpolate(color1: Color, color2: Color, t: number): Color {
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

/**
 * Generate a color scale (array of colors) between two endpoints.
 * The scale includes both endpoints.
 *
 * @param from - Starting color
 * @param to - Ending color
 * @param steps - Number of colors in the scale (minimum 2)
 */
export function generateScale(from: Color, to: Color, steps: number): Color[] {
  if (steps < 2) {
    throw new Error('Scale must have at least 2 steps');
  }

  const colors: Color[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    colors.push(interpolate(from, to, t));
  }
  return colors;
}

/**
 * Generate a lightness scale for a given hue/chroma.
 * Creates a scale from dark to light while preserving hue and chroma.
 *
 * @param color - Base color (hue and chroma are preserved)
 * @param steps - Number of stops in the scale
 * @param range - Lightness range [min, max], defaults to [0.05, 0.95]
 */
export function lightnessScale(
  color: Color,
  steps: number = 11,
  range: [number, number] = [0.05, 0.95],
): Color[] {
  const [minL, maxL] = range;
  const colors: Color[] = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    colors.push({
      l: lerp(minL, maxL, t),
      c: color.c,
      h: color.h,
      alpha: color.alpha,
    });
  }

  return colors;
}
