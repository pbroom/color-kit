import type { P3, LinearRgb } from '../types.js';
import {
  clamp,
  linearToSrgbChannel,
  srgbToLinearChannel,
} from '../utils/index.js';
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
 * @param out - Object to write the result into
 * @param rgb - Linear-light sRGB color
 * @returns `out`
 * @see {@link linearSrgbToLinearP3}
 *
 * @example
 * ```ts
 * import { linearSrgbToLinearP3Into } from 'color-kit';
 *
 * const p3 = { r: 0, g: 0, b: 0, alpha: 1 };
 * linearSrgbToLinearP3Into(p3, { r: 1, g: 0, b: 0, alpha: 1 });
 * p3.r; // → ≈ 0.8225
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
 * Convert linear-light sRGB to linear-light Display P3 with the combined
 * `P3fromXYZ · sRGBtoXYZ` matrix from CSS Color 4. Unclamped.
 *
 * @param rgb - Linear-light sRGB color
 * @returns A new linear-light {@link P3}
 * @see {@link linearP3ToLinearSrgb}
 * @see {@link linearP3ToP3}
 *
 * @example
 * ```ts
 * import { linearSrgbToLinearP3 } from 'color-kit';
 *
 * linearSrgbToLinearP3({ r: 1, g: 0, b: 0, alpha: 1 });
 * // → ≈ { r: 0.8225, g: 0.0332, b: 0.0171, alpha: 1 }
 * ```
 */
export function linearSrgbToLinearP3(rgb: LinearRgb): P3 {
  return linearSrgbToLinearP3Into({ r: 0, g: 0, b: 0, alpha: 1 }, rgb);
}

/**
 * Convert linear Display P3 to linear sRGB, writing into `out`
 * (allocation-free). `out` may be the same object as `p3`.
 *
 * @param out - Object to write the result into
 * @param p3 - Linear-light Display P3 color
 * @returns `out`
 * @see {@link linearP3ToLinearSrgb}
 *
 * @example
 * ```ts
 * import { linearP3ToLinearSrgbInto } from 'color-kit';
 *
 * const linear = { r: 0, g: 0, b: 0, alpha: 1 };
 * linearP3ToLinearSrgbInto(linear, { r: 1, g: 0, b: 0, alpha: 1 });
 * linear.r; // → ≈ 1.2249 (outside sRGB)
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
 * Convert linear-light Display P3 to linear-light sRGB. Unclamped, so P3
 * colors outside sRGB produce channels outside `[0, 1]`.
 *
 * @param p3 - Linear-light Display P3 color
 * @returns A new {@link LinearRgb}
 * @see {@link linearSrgbToLinearP3}
 * @see {@link p3ToLinearP3}
 *
 * @example
 * ```ts
 * import { linearP3ToLinearSrgb } from 'color-kit';
 *
 * linearP3ToLinearSrgb({ r: 1, g: 0, b: 0, alpha: 1 });
 * // → ≈ { r: 1.2249, g: -0.0421, b: -0.0196, alpha: 1 }
 * ```
 */
export function linearP3ToLinearSrgb(p3: P3): LinearRgb {
  return linearP3ToLinearSrgbInto({ r: 0, g: 0, b: 0, alpha: 1 }, p3);
}

/**
 * Apply Display P3 gamma encoding (same as sRGB transfer function), writing
 * the clamped `[0, 1]` channels into `out` (allocation-free). `out` may be the
 * same object as `linear`.
 *
 * @param out - Object to write the result into
 * @param linear - Linear-light Display P3 color
 * @returns `out`
 * @see {@link linearP3ToP3}
 *
 * @example
 * ```ts
 * import { linearP3ToP3Into } from 'color-kit';
 *
 * const p3 = { r: 0, g: 0, b: 0, alpha: 1 };
 * linearP3ToP3Into(p3, { r: 0.2, g: 0.5, b: 0.8, alpha: 1 });
 * p3.g; // → ≈ 0.7354
 * ```
 */
export function linearP3ToP3Into(out: P3, linear: P3): P3 {
  // Read every input field before writing `out` (see conversion/into.ts).
  const r = linear.r;
  const g = linear.g;
  const b = linear.b;
  const alpha = linear.alpha;
  out.r = clamp(linearToSrgbChannel(r), 0, 1);
  out.g = clamp(linearToSrgbChannel(g), 0, 1);
  out.b = clamp(linearToSrgbChannel(b), 0, 1);
  out.alpha = alpha;
  return out;
}

/**
 * Gamma-encode linear-light Display P3 with the P3 transfer function (the
 * same curve as sRGB). Channels are clamped to `[0, 1]`.
 *
 * @param linear - Linear-light Display P3 color
 * @returns A new gamma-encoded {@link P3}
 * @see {@link p3ToLinearP3}
 * @see {@link linearToSrgbChannel}
 *
 * @example
 * ```ts
 * import { linearP3ToP3 } from 'color-kit';
 *
 * linearP3ToP3({ r: 0.2, g: 0.5, b: 0.8, alpha: 1 });
 * // → ≈ { r: 0.4845, g: 0.7354, b: 0.9063, alpha: 1 }
 * ```
 */
export function linearP3ToP3(linear: P3): P3 {
  return linearP3ToP3Into({ r: 0, g: 0, b: 0, alpha: 1 }, linear);
}

/**
 * Remove Display P3 gamma encoding to get linear P3, writing into `out`
 * (allocation-free). `out` may be the same object as `p3`.
 *
 * @param out - Object to write the result into
 * @param p3 - Gamma-encoded Display P3 color
 * @returns `out`
 * @see {@link p3ToLinearP3}
 *
 * @example
 * ```ts
 * import { p3ToLinearP3Into } from 'color-kit';
 *
 * const linear = { r: 0, g: 0, b: 0, alpha: 1 };
 * p3ToLinearP3Into(linear, { r: 1, g: 0.5, b: 0, alpha: 1 });
 * linear.g; // → ≈ 0.214
 * ```
 */
export function p3ToLinearP3Into(out: P3, p3: P3): P3 {
  // Read every input field before writing `out` (see conversion/into.ts).
  const r = p3.r;
  const g = p3.g;
  const b = p3.b;
  const alpha = p3.alpha;
  out.r = srgbToLinearChannel(r);
  out.g = srgbToLinearChannel(g);
  out.b = srgbToLinearChannel(b);
  out.alpha = alpha;
  return out;
}

/**
 * Linearize gamma-encoded Display P3 with the inverse P3 transfer function
 * (the same curve as sRGB). Unclamped; out-of-range inputs extend the curve.
 *
 * @param p3 - Gamma-encoded Display P3 color
 * @returns A new linear-light {@link P3}
 * @see {@link linearP3ToP3}
 * @see {@link srgbToLinearChannel}
 *
 * @example
 * ```ts
 * import { p3ToLinearP3 } from 'color-kit';
 *
 * p3ToLinearP3({ r: 1, g: 0.5, b: 0, alpha: 1 }); // → ≈ { r: 1, g: 0.214, b: 0, alpha: 1 }
 * ```
 */
export function p3ToLinearP3(p3: P3): P3 {
  return p3ToLinearP3Into({ r: 0, g: 0, b: 0, alpha: 1 }, p3);
}
