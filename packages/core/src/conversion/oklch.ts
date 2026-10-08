import type { Color, Oklab, Oklch } from '../types.js';
import {
  degToRad,
  isAchromatic,
  normalizeHue,
  radToDeg,
} from '../utils/index.js';

/**
 * Convert OKLAB to OKLCH, writing into `out` (allocation-free). Achromatic
 * results (chroma at or below {@link ACHROMATIC_CHROMA_THRESHOLD}) get hue
 * `0`.
 *
 * @param out - Object to write the result into
 * @param lab - OKLab color
 * @returns `out`
 * @see {@link oklabToOklch}
 *
 * @example
 * ```ts
 * import { oklabToOklchInto } from 'color-kit';
 *
 * const lch = { l: 0, c: 0, h: 0, alpha: 1 };
 * oklabToOklchInto(lch, { L: 0.7, a: 0, b: 0.1, alpha: 1 });
 * lch; // → { l: 0.7, c: 0.1, h: 90, alpha: 1 }
 * ```
 */
export function oklabToOklchInto(out: Oklch, lab: Oklab): Oklch {
  // Read every input field before writing `out` (see conversion/into.ts).
  const L = lab.L;
  const a = lab.a;
  const b = lab.b;
  const alpha = lab.alpha;

  const c = Math.sqrt(a * a + b * b);
  // At or below ACHROMATIC_CHROMA_THRESHOLD the hue is powerless: atan2 of
  // float residue (grays convert with chroma ~1e-15) is noise, so report the
  // canonical achromatic hue 0. Chroma is left as computed.
  const h = isAchromatic(c) ? 0 : normalizeHue(radToDeg(Math.atan2(b, a)));

  out.l = L;
  out.c = c;
  out.h = h;
  out.alpha = alpha;
  return out;
}

/**
 * Convert OKLab to OKLCH. Achromatic results (chroma at or below
 * {@link ACHROMATIC_CHROMA_THRESHOLD}) get hue `0`; other hues are
 * normalized to `[0, 360)`.
 *
 * @param lab - OKLab color
 * @returns A new {@link Oklch}
 * @see {@link oklchToOklab}
 * @see {@link oklabToOklchInto}
 *
 * @example
 * ```ts
 * import { oklabToOklch } from 'color-kit';
 *
 * oklabToOklch({ L: 0.7, a: -0.1, b: 0, alpha: 1 }); // → { l: 0.7, c: 0.1, h: 180, alpha: 1 }
 * ```
 */
export function oklabToOklch(lab: Oklab): Oklch {
  return oklabToOklchInto({ l: 0, c: 0, h: 0, alpha: 1 }, lab);
}

/**
 * Convert OKLCH to OKLAB, writing into `out` (allocation-free).
 *
 * @param out - Object to write the result into
 * @param oklch - OKLCH color (hue in degrees, any finite value)
 * @returns `out`
 * @see {@link oklchToOklab}
 *
 * @example
 * ```ts
 * import { oklchToOklabInto } from 'color-kit';
 *
 * const lab = { L: 0, a: 0, b: 0, alpha: 1 };
 * oklchToOklabInto(lab, { l: 0.7, c: 0.1, h: 0, alpha: 1 });
 * lab; // → { L: 0.7, a: 0.1, b: 0, alpha: 1 }
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

/**
 * Convert OKLCH to OKLab (`a = c·cos h`, `b = c·sin h`).
 *
 * @param oklch - OKLCH color (hue in degrees, any finite value)
 * @returns A new {@link Oklab}
 * @see {@link oklabToOklch}
 * @see {@link oklchToOklabInto}
 *
 * @example
 * ```ts
 * import { oklchToOklab } from 'color-kit';
 *
 * oklchToOklab({ l: 0.7, c: 0.1, h: 0, alpha: 1 }); // → { L: 0.7, a: 0.1, b: 0, alpha: 1 }
 * ```
 */
export function oklchToOklab(oklch: Oklch): Oklab {
  return oklchToOklabInto({ L: 0, a: 0, b: 0, alpha: 1 }, oklch);
}

/**
 * Convert an {@link Oklch} value to a Color, normalizing the hue to
 * `[0, 360)`. Color is itself OKLCH, so the other channels are copied
 * unchanged.
 *
 * @param oklch - OKLCH color
 * @returns A new {@link Color}
 * @see {@link colorToOklch}
 * @see {@link fromOklch}
 *
 * @example
 * ```ts
 * import { oklchToColor } from 'color-kit';
 *
 * oklchToColor({ l: 0.7, c: 0.1, h: -30, alpha: 1 }); // → { l: 0.7, c: 0.1, h: 330, alpha: 1 }
 * ```
 */
export function oklchToColor(oklch: Oklch): Color {
  return {
    l: oklch.l,
    c: oklch.c,
    h: normalizeHue(oklch.h),
    alpha: oklch.alpha,
  };
}

/**
 * Convert a Color to an {@link Oklch} value, normalizing the hue to
 * `[0, 360)`. The other channels are copied unchanged.
 *
 * @param color - Color to convert
 * @returns A new {@link Oklch}
 * @see {@link oklchToColor}
 * @see {@link toOklch}
 *
 * @example
 * ```ts
 * import { colorToOklch } from 'color-kit';
 *
 * colorToOklch({ l: 0.7, c: 0.1, h: 400, alpha: 1 }); // → { l: 0.7, c: 0.1, h: 40, alpha: 1 }
 * ```
 */
export function colorToOklch(color: Color): Oklch {
  return {
    l: color.l,
    c: color.c,
    h: normalizeHue(color.h),
    alpha: color.alpha,
  };
}
