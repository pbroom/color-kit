import type { Color, Oklab, Oklch } from '../types.js';
import { degToRad, radToDeg, normalizeHue } from '../utils/index.js';

/**
 * Convert OKLAB to OKLCH, writing into `out` (allocation-free).
 *
 * @example
 * ```ts
 * const lch = { l: 0, c: 0, h: 0, alpha: 1 };
 * oklabToOklchInto(lch, { L: 0.7, a: 0.1, b: 0.1, alpha: 1 });
 * ```
 */
export function oklabToOklchInto(out: Oklch, lab: Oklab): Oklch {
  // Read every input field before writing `out` (see conversion/into.ts).
  const L = lab.L;
  const a = lab.a;
  const b = lab.b;
  const alpha = lab.alpha;

  const c = Math.sqrt(a * a + b * b);
  let h = radToDeg(Math.atan2(b, a));
  h = normalizeHue(h);

  // For near-zero chroma, hue is undefined; default to 0
  if (c < 0.0001) {
    h = 0;
  }

  out.l = L;
  out.c = c;
  out.h = h;
  out.alpha = alpha;
  return out;
}

/** Convert OKLAB to OKLCH */
export function oklabToOklch(lab: Oklab): Oklch {
  return oklabToOklchInto({ l: 0, c: 0, h: 0, alpha: 1 }, lab);
}

/**
 * Convert OKLCH to OKLAB, writing into `out` (allocation-free).
 *
 * @example
 * ```ts
 * const lab = { L: 0, a: 0, b: 0, alpha: 1 };
 * oklchToOklabInto(lab, { l: 0.7, c: 0.15, h: 30, alpha: 1 });
 * ```
 */
export function oklchToOklabInto(out: Oklab, oklch: Oklch): Oklab {
  // Read every input field before writing `out` (see conversion/into.ts).
  const l = oklch.l;
  const c = oklch.c;
  const h = oklch.h;
  const alpha = oklch.alpha;

  const hRad = degToRad(h);
  out.L = l;
  out.a = c * Math.cos(hRad);
  out.b = c * Math.sin(hRad);
  out.alpha = alpha;
  return out;
}

/** Convert OKLCH to OKLAB */
export function oklchToOklab(oklch: Oklch): Oklab {
  return oklchToOklabInto({ L: 0, a: 0, b: 0, alpha: 1 }, oklch);
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
