import type { Color, Oklab } from '../types.js';
import { oklchToOklabInto } from '../conversion/oklch.js';
import { ciede2000, toLabD50 } from './ciede2000.js';

const LAB_A: Oklab = { L: 0, a: 0, b: 0, alpha: 1 };
const LAB_B: Oklab = { L: 0, a: 0, b: 0, alpha: 1 };

/**
 * Returns the OKLab color difference (ΔEOK) between two colors: the
 * Euclidean distance between them in OKLab, as CSS Color 4 defines it.
 *
 * Symmetric in its arguments, and 0 for the same color. Alpha is ignored.
 * There is no scaling factor: OKLab lightness runs 0-1, so black to white is
 * 1 and a just-noticeable difference is about 0.02 (the threshold CSS gamut
 * mapping uses). Colors are not clamped to any gamut, and the hue of a
 * zero-chroma color has no effect. Allocation-free.
 *
 * @param color1 - First color (order does not matter).
 * @param color2 - Second color.
 * @returns ΔEOK, `>= 0`.
 * @see https://www.w3.org/TR/css-color-4/#color-difference-OK
 * @see {@link deltaE2000}
 *
 * @example
 * ```ts
 * import { deltaEOK, parse } from '@pbroom/color-kit';
 *
 * deltaEOK(parse('#000'), parse('#fff')); // → ≈ 1
 * deltaEOK(parse('#3b82f6'), parse('#2563eb')); // → ≈ 0.0823
 * ```
 */
export function deltaEOK(color1: Color, color2: Color): number {
  const lab1 = oklchToOklabInto(LAB_A, color1);
  const lab2 = oklchToOklabInto(LAB_B, color2);
  return Math.hypot(lab1.L - lab2.L, lab1.a - lab2.a, lab1.b - lab2.b);
}

/**
 * Returns the CIEDE2000 color difference (ΔE00) between two colors.
 *
 * Computed in CIE Lab with the D50 white point (the CSS Color 4 `lab()`
 * space, as colorjs.io does), with the parametric factors kL = kC = kH = 1.
 * Black to white is 100 and a just-noticeable difference is about 1.
 *
 * Symmetric in its arguments, and 0 for the same color. Alpha is ignored.
 * Colors are converted unrounded and are not clamped to any gamut, so
 * wide-gamut colors compare by their real coordinates. A gray is compared
 * as an exact neutral, so its hue has no effect. CIEDE2000 is not
 * continuous: the result can jump when the two hues are close to opposite.
 * Use {@link deltaEOK} when you need a smooth distance.
 *
 * @param color1 - First color (order does not matter).
 * @param color2 - Second color.
 * @returns ΔE00, `>= 0`.
 * @see https://www.w3.org/TR/css-color-4/#color-difference-2000
 * @see {@link deltaEOK}
 *
 * @example
 * ```ts
 * import { deltaE2000, parse } from '@pbroom/color-kit';
 *
 * deltaE2000(parse('#000'), parse('#fff')); // → ≈ 100
 * deltaE2000(parse('#3b82f6'), parse('#2563eb')); // → ≈ 10.91
 * ```
 */
export function deltaE2000(color1: Color, color2: Color): number {
  const [L1, a1, b1] = toLabD50(color1);
  const [L2, a2, b2] = toLabD50(color2);
  return ciede2000(L1, a1, b1, L2, a2, b2);
}
