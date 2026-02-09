import type { Color, Oklab, Oklch } from '../types.js';
import { degToRad, radToDeg, normalizeHue } from '../utils/index.js';

/** Convert OKLAB to OKLCH */
export function oklabToOklch(lab: Oklab): Oklch {
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = radToDeg(Math.atan2(lab.b, lab.a));
  h = normalizeHue(h);

  // For near-zero chroma, hue is undefined; default to 0
  if (c < 0.0001) {
    h = 0;
  }

  return { l: lab.L, c, h, alpha: lab.alpha };
}

/** Convert OKLCH to OKLAB */
export function oklchToOklab(oklch: Oklch): Oklab {
  const hRad = degToRad(oklch.h);
  return {
    L: oklch.l,
    a: oklch.c * Math.cos(hRad),
    b: oklch.c * Math.sin(hRad),
    alpha: oklch.alpha,
  };
}

/**
 * Convert an OKLCH value to the internal Color representation.
 * Since our internal Color type IS OKLCH, this is essentially a passthrough
 * with normalization.
 */
export function oklchToColor(oklch: Oklch): Color {
  return {
    l: oklch.l,
    c: oklch.c,
    h: normalizeHue(oklch.h),
    alpha: oklch.alpha,
  };
}

/** Convert internal Color to OKLCH (identity with normalization) */
export function colorToOklch(color: Color): Oklch {
  return {
    l: color.l,
    c: color.c,
    h: normalizeHue(color.h),
    alpha: color.alpha,
  };
}
