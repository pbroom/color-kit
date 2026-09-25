import type { P3, LinearRgb } from '../types.js';
import { clamp } from '../utils/index.js';
import {
  LINEAR_P3_TO_LINEAR_SRGB,
  LINEAR_SRGB_TO_LINEAR_P3,
} from './matrices.js';

const [SP3R, SP3G, SP3B] = LINEAR_SRGB_TO_LINEAR_P3;
const [P3SR, P3SG, P3SB] = LINEAR_P3_TO_LINEAR_SRGB;

/**
 * Convert linear sRGB to linear Display P3.
 * Combined `P3fromXYZ · sRGBtoXYZ` matrix from CSS Color Level 4.
 */
export function linearSrgbToLinearP3(rgb: LinearRgb): P3 {
  return {
    r: SP3R[0] * rgb.r + SP3R[1] * rgb.g + SP3R[2] * rgb.b,
    g: SP3G[0] * rgb.r + SP3G[1] * rgb.g + SP3G[2] * rgb.b,
    b: SP3B[0] * rgb.r + SP3B[1] * rgb.g + SP3B[2] * rgb.b,
    alpha: rgb.alpha,
  };
}

/**
 * Convert linear Display P3 to linear sRGB.
 */
export function linearP3ToLinearSrgb(p3: P3): LinearRgb {
  return {
    r: P3SR[0] * p3.r + P3SR[1] * p3.g + P3SR[2] * p3.b,
    g: P3SG[0] * p3.r + P3SG[1] * p3.g + P3SG[2] * p3.b,
    b: P3SB[0] * p3.r + P3SB[1] * p3.g + P3SB[2] * p3.b,
    alpha: p3.alpha,
  };
}

/**
 * Apply Display P3 gamma encoding (same as sRGB transfer function).
 */
export function linearP3ToP3(linear: P3): P3 {
  const gamma = (c: number) => {
    const abs = Math.abs(c);
    if (abs <= 0.0031308) {
      return 12.92 * c;
    }
    return (1.055 * Math.pow(abs, 1 / 2.4) - 0.055) * Math.sign(c);
  };

  return {
    r: clamp(gamma(linear.r), 0, 1),
    g: clamp(gamma(linear.g), 0, 1),
    b: clamp(gamma(linear.b), 0, 1),
    alpha: linear.alpha,
  };
}

/**
 * Remove Display P3 gamma encoding to get linear P3.
 */
export function p3ToLinearP3(p3: P3): P3 {
  const linearize = (c: number) => {
    const abs = Math.abs(c);
    if (abs <= 0.04045) {
      return c / 12.92;
    }
    return Math.pow((abs + 0.055) / 1.055, 2.4) * Math.sign(c);
  };

  return {
    r: linearize(p3.r),
    g: linearize(p3.g),
    b: linearize(p3.b),
    alpha: p3.alpha,
  };
}
