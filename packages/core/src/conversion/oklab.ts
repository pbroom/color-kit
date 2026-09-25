import type { Oklab, LinearRgb } from '../types.js';
import {
  LINEAR_SRGB_TO_LMS,
  LMS_TO_LINEAR_SRGB,
  LMS_TO_OKLAB,
  OKLAB_TO_LMS,
} from './matrices.js';

const [M1R, M1G, M1B] = LINEAR_SRGB_TO_LMS;
const [M2L, M2A, M2B] = LMS_TO_OKLAB;
// OKLAB_TO_LMS has an all-ones first column, so only the a/b terms are needed.
const [[, LA, LB], [, MA, MB], [, SA, SB]] = OKLAB_TO_LMS;
const [RL, GL, BL] = LMS_TO_LINEAR_SRGB;

/**
 * Convert linear sRGB to OKLAB, writing into `out` (allocation-free).
 * Based on Björn Ottosson's OKLab model, using the CSS Color 4 matrices
 * recalculated in float64 for a consistent D65 reference white.
 * https://bottosson.github.io/posts/oklab/
 *
 * @example
 * ```ts
 * const lab = { L: 0, a: 0, b: 0, alpha: 1 };
 * linearRgbToOklabInto(lab, { r: 1, g: 0, b: 0, alpha: 1 });
 * ```
 */
export function linearRgbToOklabInto(out: Oklab, rgb: LinearRgb): Oklab {
  // Read every input field before writing `out` (see conversion/into.ts).
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;
  const alpha = rgb.alpha;

  // Linear sRGB to LMS
  const l = M1R[0] * r + M1R[1] * g + M1R[2] * b;
  const m = M1G[0] * r + M1G[1] * g + M1G[2] * b;
  const s = M1B[0] * r + M1B[1] * g + M1B[2] * b;

  // Cube root (non-linear response)
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  out.L = M2L[0] * l_ + M2L[1] * m_ + M2L[2] * s_;
  out.a = M2A[0] * l_ + M2A[1] * m_ + M2A[2] * s_;
  out.b = M2B[0] * l_ + M2B[1] * m_ + M2B[2] * s_;
  out.alpha = alpha;
  return out;
}

/**
 * Convert linear sRGB to OKLAB.
 * Based on Björn Ottosson's OKLab model, using the CSS Color 4 matrices
 * recalculated in float64 for a consistent D65 reference white.
 * https://bottosson.github.io/posts/oklab/
 */
export function linearRgbToOklab(rgb: LinearRgb): Oklab {
  return linearRgbToOklabInto({ L: 0, a: 0, b: 0, alpha: 1 }, rgb);
}

/**
 * Convert OKLAB to linear sRGB, writing into `out` (allocation-free). The
 * result is unclamped, so out-of-gamut colors keep channels outside `[0, 1]`.
 *
 * @example
 * ```ts
 * const linear = { r: 0, g: 0, b: 0, alpha: 1 };
 * oklabToLinearRgbInto(linear, { L: 0.7, a: 0.1, b: 0.1, alpha: 1 });
 * ```
 */
export function oklabToLinearRgbInto(out: LinearRgb, lab: Oklab): LinearRgb {
  // Read every input field before writing `out` (see conversion/into.ts).
  const L = lab.L;
  const a = lab.a;
  const b = lab.b;
  const alpha = lab.alpha;

  // OKLAB to LMS (cube roots)
  const l_ = L + LA * a + LB * b;
  const m_ = L + MA * a + MB * b;
  const s_ = L + SA * a + SB * b;

  // Cube (undo non-linearity)
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS to linear sRGB
  out.r = RL[0] * l + RL[1] * m + RL[2] * s;
  out.g = GL[0] * l + GL[1] * m + GL[2] * s;
  out.b = BL[0] * l + BL[1] * m + BL[2] * s;
  out.alpha = alpha;
  return out;
}

/**
 * Convert OKLAB to linear sRGB.
 */
export function oklabToLinearRgb(lab: Oklab): LinearRgb {
  return oklabToLinearRgbInto({ r: 0, g: 0, b: 0, alpha: 1 }, lab);
}
