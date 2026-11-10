import type { LinearRgb } from '../types.js';
import type { Matrix3 } from './matrices.js';

/**
 * Multiply linear-light RGB channels by a 3x3 matrix, writing into `out`
 * (allocation-free). `out` may be the same object as `rgb`.
 *
 * Each channel is evaluated as `m0 * r + m1 * g + m2 * b`. The Display P3
 * conversions (`linearSrgbToLinearP3Into` / `linearP3ToLinearSrgbInto`) are
 * this function with their matrix, so a gamut descriptor carrying the same
 * matrix converts bit-identically.
 */
export function applyMatrix3Into(
  out: LinearRgb,
  matrix: Matrix3,
  rgb: LinearRgb,
): LinearRgb {
  // Read every input field before writing `out` (see conversion/into.ts).
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;
  const alpha = rgb.alpha;
  const [mr, mg, mb] = matrix;
  out.r = mr[0] * r + mr[1] * g + mr[2] * b;
  out.g = mg[0] * r + mg[1] * g + mg[2] * b;
  out.b = mb[0] * r + mb[1] * g + mb[2] * b;
  out.alpha = alpha;
  return out;
}

/**
 * Rec. 2020 transfer function (encoding): linear light to gamma-encoded,
 * for one channel. CSS Color 4 and colorjs.io use the inverse of the
 * ITU-R BT.1886 reference EOTF, a pure `1 / 2.4` power, extended to negative
 * values by mirroring the sign (not the piecewise BT.2020 camera OETF).
 */
export function linearToRec2020Channel(c: number): number {
  return c < 0 ? -Math.pow(-c, 1 / 2.4) : Math.pow(c, 1 / 2.4);
}

/**
 * Inverse Rec. 2020 transfer function (linearization): gamma-encoded to
 * linear light, for one channel. The exact inverse of
 * {@link linearToRec2020Channel}: a sign-mirrored `2.4` power.
 */
export function rec2020ToLinearChannel(c: number): number {
  return c < 0 ? -Math.pow(-c, 2.4) : Math.pow(c, 2.4);
}
