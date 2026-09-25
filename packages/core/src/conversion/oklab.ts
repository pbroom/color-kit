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
 * Convert linear sRGB to OKLAB.
 * Based on Björn Ottosson's OKLab model, using the CSS Color 4 matrices
 * recalculated in float64 for a consistent D65 reference white.
 * https://bottosson.github.io/posts/oklab/
 */
export function linearRgbToOklab(rgb: LinearRgb): Oklab {
  // Linear sRGB to LMS
  const l = M1R[0] * rgb.r + M1R[1] * rgb.g + M1R[2] * rgb.b;
  const m = M1G[0] * rgb.r + M1G[1] * rgb.g + M1G[2] * rgb.b;
  const s = M1B[0] * rgb.r + M1B[1] * rgb.g + M1B[2] * rgb.b;

  // Cube root (non-linear response)
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: M2L[0] * l_ + M2L[1] * m_ + M2L[2] * s_,
    a: M2A[0] * l_ + M2A[1] * m_ + M2A[2] * s_,
    b: M2B[0] * l_ + M2B[1] * m_ + M2B[2] * s_,
    alpha: rgb.alpha,
  };
}

/**
 * Convert OKLAB to linear sRGB.
 */
export function oklabToLinearRgb(lab: Oklab): LinearRgb {
  // OKLAB to LMS (cube roots)
  const l_ = lab.L + LA * lab.a + LB * lab.b;
  const m_ = lab.L + MA * lab.a + MB * lab.b;
  const s_ = lab.L + SA * lab.a + SB * lab.b;

  // Cube (undo non-linearity)
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS to linear sRGB
  return {
    r: RL[0] * l + RL[1] * m + RL[2] * s,
    g: GL[0] * l + GL[1] * m + GL[2] * s,
    b: BL[0] * l + BL[1] * m + BL[2] * s,
    alpha: lab.alpha,
  };
}
