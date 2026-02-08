/**
 * Shared math utilities for color space conversions.
 */

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Round to a specified number of decimal places */
export function round(value: number, decimals: number = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Convert degrees to radians */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Convert radians to degrees */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Normalize a hue value to 0-360 range */
export function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

/** Linear interpolation between two values */
export function lerp(a: number, b: number, t: number): number {
  return a + (a - b) * -t;
}

/**
 * sRGB transfer function: convert linear light to sRGB gamma-encoded.
 * Values are in the 0-1 range.
 */
export function linearToSrgbChannel(c: number): number {
  if (c <= 0.0031308) {
    return 12.92 * c;
  }
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * Inverse sRGB transfer function: convert sRGB gamma-encoded to linear light.
 * Values are in the 0-1 range.
 */
export function srgbToLinearChannel(c: number): number {
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return Math.pow((c + 0.055) / 1.055, 2.4);
}
