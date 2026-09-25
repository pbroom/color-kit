import type { P3, LinearRgb } from '../types.js';
import { clamp } from '../utils/index.js';
import {
  LINEAR_P3_TO_LINEAR_SRGB,
  LINEAR_SRGB_TO_LINEAR_P3,
} from './matrices.js';

const [SP3R, SP3G, SP3B] = LINEAR_SRGB_TO_LINEAR_P3;
const [P3SR, P3SG, P3SB] = LINEAR_P3_TO_LINEAR_SRGB;

/**
 * Convert linear sRGB to linear Display P3, writing into `out`
 * (allocation-free). Combined `P3fromXYZ · sRGBtoXYZ` matrix from CSS Color
 * Level 4. `out` may be the same object as `rgb`.
 *
 * @example
 * ```ts
 * const p3 = { r: 0, g: 0, b: 0, alpha: 1 };
 * linearSrgbToLinearP3Into(p3, { r: 1, g: 0, b: 0, alpha: 1 });
 * ```
 */
export function linearSrgbToLinearP3Into(out: P3, rgb: LinearRgb): P3 {
  // Read every input field before writing `out` (see conversion/into.ts).
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;
  const alpha = rgb.alpha;
  out.r = SP3R[0] * r + SP3R[1] * g + SP3R[2] * b;
  out.g = SP3G[0] * r + SP3G[1] * g + SP3G[2] * b;
  out.b = SP3B[0] * r + SP3B[1] * g + SP3B[2] * b;
  out.alpha = alpha;
  return out;
}

/**
 * Convert linear sRGB to linear Display P3.
 * Combined `P3fromXYZ · sRGBtoXYZ` matrix from CSS Color Level 4.
 */
export function linearSrgbToLinearP3(rgb: LinearRgb): P3 {
  return linearSrgbToLinearP3Into({ r: 0, g: 0, b: 0, alpha: 1 }, rgb);
}

/**
 * Convert linear Display P3 to linear sRGB, writing into `out`
 * (allocation-free). `out` may be the same object as `p3`.
 *
 * @example
 * ```ts
 * const linear = { r: 0, g: 0, b: 0, alpha: 1 };
 * linearP3ToLinearSrgbInto(linear, { r: 1, g: 0, b: 0, alpha: 1 });
 * ```
 */
export function linearP3ToLinearSrgbInto(out: LinearRgb, p3: P3): LinearRgb {
  // Read every input field before writing `out` (see conversion/into.ts).
  const r = p3.r;
  const g = p3.g;
  const b = p3.b;
  const alpha = p3.alpha;
  out.r = P3SR[0] * r + P3SR[1] * g + P3SR[2] * b;
  out.g = P3SG[0] * r + P3SG[1] * g + P3SG[2] * b;
  out.b = P3SB[0] * r + P3SB[1] * g + P3SB[2] * b;
  out.alpha = alpha;
  return out;
}

/**
 * Convert linear Display P3 to linear sRGB.
 */
export function linearP3ToLinearSrgb(p3: P3): LinearRgb {
  return linearP3ToLinearSrgbInto({ r: 0, g: 0, b: 0, alpha: 1 }, p3);
}

function p3Gamma(c: number): number {
  const abs = Math.abs(c);
  if (abs <= 0.0031308) {
    return 12.92 * c;
  }
  return (1.055 * Math.pow(abs, 1 / 2.4) - 0.055) * Math.sign(c);
}

function p3Linearize(c: number): number {
  const abs = Math.abs(c);
  if (abs <= 0.04045) {
    return c / 12.92;
  }
  return Math.pow((abs + 0.055) / 1.055, 2.4) * Math.sign(c);
}

/**
 * Apply Display P3 gamma encoding (same as sRGB transfer function), writing
 * the clamped `[0, 1]` channels into `out` (allocation-free). `out` may be the
 * same object as `linear`.
 *
 * @example
 * ```ts
 * const p3 = { r: 0, g: 0, b: 0, alpha: 1 };
 * linearP3ToP3Into(p3, { r: 0.2, g: 0.5, b: 0.8, alpha: 1 });
 * ```
 */
export function linearP3ToP3Into(out: P3, linear: P3): P3 {
  // Read every input field before writing `out` (see conversion/into.ts).
  const r = linear.r;
  const g = linear.g;
  const b = linear.b;
  const alpha = linear.alpha;
  out.r = clamp(p3Gamma(r), 0, 1);
  out.g = clamp(p3Gamma(g), 0, 1);
  out.b = clamp(p3Gamma(b), 0, 1);
  out.alpha = alpha;
  return out;
}

/**
 * Apply Display P3 gamma encoding (same as sRGB transfer function).
 */
export function linearP3ToP3(linear: P3): P3 {
  return linearP3ToP3Into({ r: 0, g: 0, b: 0, alpha: 1 }, linear);
}

/**
 * Remove Display P3 gamma encoding to get linear P3, writing into `out`
 * (allocation-free). `out` may be the same object as `p3`.
 *
 * @example
 * ```ts
 * const linear = { r: 0, g: 0, b: 0, alpha: 1 };
 * p3ToLinearP3Into(linear, { r: 1, g: 0.5, b: 0, alpha: 1 });
 * ```
 */
export function p3ToLinearP3Into(out: P3, p3: P3): P3 {
  // Read every input field before writing `out` (see conversion/into.ts).
  const r = p3.r;
  const g = p3.g;
  const b = p3.b;
  const alpha = p3.alpha;
  out.r = p3Linearize(r);
  out.g = p3Linearize(g);
  out.b = p3Linearize(b);
  out.alpha = alpha;
  return out;
}

/**
 * Remove Display P3 gamma encoding to get linear P3.
 */
export function p3ToLinearP3(p3: P3): P3 {
  return p3ToLinearP3Into({ r: 0, g: 0, b: 0, alpha: 1 }, p3);
}
