import type { Color } from '../types.js';
import { hasPowerlessHue, lerp, normalizeHue } from '../utils/index.js';

/**
 * Option-less `interpolate()` / `mix()`: plain OKLCH channel interpolation
 * (straight alpha) with the hue taking the shortest path. An endpoint whose
 * hue is powerless (chroma at or below `ACHROMATIC_CHROMA_THRESHOLD`, or a
 * non-finite hue) borrows the other endpoint's hue, as CSS Color 4 does for
 * missing hues; when both are powerless the hue is `0`. Kept in its own module so callers that only need the
 * default (such as the plane gradient query) do not bundle the
 * interpolation-space engine.
 */
export function interpolateOklchDefault(
  color1: Color,
  color2: Color,
  t: number,
): Color {
  return interpolateOklchDefaultInto(
    { l: 0, c: 0, h: 0, alpha: 1 },
    color1,
    color2,
    t,
  );
}

/**
 * Allocation-free `interpolateOklchDefault()`. `out` may be the same object as
 * either input.
 */
export function interpolateOklchDefaultInto(
  out: Color,
  color1: Color,
  color2: Color,
  t: number,
): Color {
  const powerless1 = hasPowerlessHue(color1);
  const powerless2 = hasPowerlessHue(color2);

  let h: number;
  if (powerless1 && powerless2) {
    h = 0;
  } else if (powerless1) {
    h = color2.h;
  } else if (powerless2) {
    h = color1.h;
  } else {
    // Shortest arc between the normalized hues (CSS `shorter`).
    let h1 = normalizeHue(color1.h);
    let h2 = normalizeHue(color2.h);
    const diff = h2 - h1;
    if (diff > 180) {
      h1 += 360;
    } else if (diff < -180) {
      h2 += 360;
    }
    h = lerp(h1, h2, t);
  }

  const l = lerp(color1.l, color2.l, t);
  const c = lerp(color1.c, color2.c, t);
  const alpha = lerp(color1.alpha, color2.alpha, t);
  out.l = l;
  out.c = c;
  out.h = normalizeHue(h);
  out.alpha = alpha;
  return out;
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
