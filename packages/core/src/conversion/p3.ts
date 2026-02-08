import type { P3, LinearRgb } from '../types.js';
import { clamp } from '../utils/index.js';

/**
 * Convert linear sRGB to linear Display P3.
 * Uses the matrix from CSS Color Level 4 spec.
 */
export function linearSrgbToLinearP3(rgb: LinearRgb): P3 {
  // sRGB linear -> XYZ D65 -> P3 linear
  // Combined matrix:
  return {
    r: 0.8224621724 * rgb.r + 0.1775378276 * rgb.g + 0.0 * rgb.b,
    g: 0.033194198 * rgb.r + 0.966805802 * rgb.g + 0.0 * rgb.b,
    b: 0.0170826307 * rgb.r + 0.0723974407 * rgb.g + 0.9105199286 * rgb.b,
    alpha: rgb.alpha,
  };
}

/**
 * Convert linear Display P3 to linear sRGB.
 */
export function linearP3ToLinearSrgb(p3: P3): LinearRgb {
  return {
    r: 1.2249401764 * p3.r - 0.2249401764 * p3.g + 0.0 * p3.b,
    g: -0.0420569549 * p3.r + 1.0420569549 * p3.g + 0.0 * p3.b,
    b: -0.0196375546 * p3.r - 0.0786360236 * p3.g + 1.0982735782 * p3.b,
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
