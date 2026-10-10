/**
 * Shared math utilities for color space conversions.
 */

/**
 * Clamp `value` to the inclusive range `[min, max]`.
 *
 * @param value - Number to clamp
 * @param min - Lower bound
 * @param max - Upper bound
 * @returns `value` limited to `[min, max]`
 *
 * @example
 * ```ts
 * import { clamp } from 'color-kit';
 *
 * clamp(1.2, 0, 1); // → 1
 * clamp(-5, 0, 255); // → 0
 * ```
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Round `value` to `decimals` decimal places with `Math.round` (halves
 * round up). Subject to binary float representation, so `round(1.005, 2)`
 * is `1`.
 *
 * @param value - Number to round
 * @param decimals - Decimal places to keep (default `0`)
 * @returns The rounded number
 *
 * @example
 * ```ts
 * import { round } from 'color-kit';
 *
 * round(0.62308, 3); // → 0.623
 * round(59.6); // → 60
 * ```
 */
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

/**
 * Wrap a hue in degrees into `[0, 360)`. Negative and multi-turn values are
 * accepted.
 *
 * @param hue - Hue in degrees
 * @returns The equivalent hue in `[0, 360)`
 *
 * @example
 * ```ts
 * import { normalizeHue } from 'color-kit';
 *
 * normalizeHue(-30); // → 330
 * normalizeHue(370); // → 10
 * ```
 */
export function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

export { simplifyPolyline, type LcPoint } from './polyline-simplify.js';

/**
 * Linearly interpolate from `a` to `b`. `t = 0` gives `a`, `t = 1` gives
 * `b`; values outside `[0, 1]` extrapolate.
 *
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation position
 * @returns The interpolated value
 *
 * @example
 * ```ts
 * import { lerp } from 'color-kit';
 *
 * lerp(0, 10, 0.25); // → 2.5
 * lerp(0, 10, 1.5); // → 15
 * ```
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (a - b) * -t;
}

/**
 * OKLCH chroma at or below which a color is achromatic and its hue is
 * powerless: the CSS Color 4 OKLCH epsilon (`OKLab_to_OKLCH` in the spec's
 * sample code uses `chroma <= 0.000004`). Every 8-bit and float gray converts
 * with chroma around `1e-15`, while the least chromatic non-gray 8-bit color
 * has chroma around `0.001`, so the cutoff separates the two with margin.
 *
 * Used everywhere color-kit decides whether a hue means anything:
 * OKLab → OKLCH conversion (achromatic results get `h = 0`) and every
 * interpolation path (`mix`, `interpolate`, `generateScale`), where an
 * achromatic endpoint takes the other endpoint's hue.
 */
export const ACHROMATIC_CHROMA_THRESHOLD = 0.000004;

/**
 * True when an OKLCH chroma is at or below
 * {@link ACHROMATIC_CHROMA_THRESHOLD} (or is `NaN`), i.e. the hue is
 * powerless.
 *
 * @param chroma - OKLCH chroma
 * @returns Whether the color is achromatic
 *
 * @example
 * ```ts
 * import { isAchromatic, parse } from 'color-kit';
 *
 * isAchromatic(parse('#808080').c); // → true
 * isAchromatic(parse('#3b82f6').c); // → false
 * ```
 */
export function isAchromatic(chroma: number): boolean {
  return !(chroma > ACHROMATIC_CHROMA_THRESHOLD);
}

/**
 * True when a color's hue carries no information: the color is achromatic
 * or the hue is not a finite number. Interpolation substitutes the other
 * endpoint's hue for a powerless one.
 */
export function hasPowerlessHue(color: { c: number; h: number }): boolean {
  return isAchromatic(color.c) || !Number.isFinite(color.h);
}

/**
 * sRGB / Display P3 transfer function (gamma encoding): linear light to
 * gamma-encoded, for one channel.
 *
 * Extended range, as in CSS Color 4 and colorjs.io: negative inputs are
 * mirrored (`f(-x) = -f(x)`) and values above 1 follow the same curve, so
 * out-of-gamut linear values stay invertible instead of being folded or
 * clipped. In-range `[0, 1]` inputs are unaffected. Callers that need a
 * displayable channel clamp the result themselves.
 *
 * @param c - Linear-light channel value (nominally `0-1`)
 * @returns Gamma-encoded channel value
 * @see {@link srgbToLinearChannel}
 *
 * @example
 * ```ts
 * import { linearToSrgbChannel } from 'color-kit';
 *
 * linearToSrgbChannel(0.5).toFixed(4); // → '0.7354'
 * linearToSrgbChannel(-0.5).toFixed(4); // → '-0.7354'
 * ```
 */
export function linearToSrgbChannel(c: number): number {
  const abs = c < 0 ? -c : c;
  if (abs <= 0.0031308) {
    return 12.92 * c;
  }
  const encoded = 1.055 * Math.pow(abs, 1 / 2.4) - 0.055;
  return c < 0 ? -encoded : encoded;
}

/**
 * Inverse sRGB / Display P3 transfer function (linearization):
 * gamma-encoded to linear light, for one channel. Extended range with the
 * same sign mirroring as {@link linearToSrgbChannel}, of which it is the
 * exact inverse.
 *
 * @param c - Gamma-encoded channel value (nominally `0-1`)
 * @returns Linear-light channel value
 *
 * @example
 * ```ts
 * import { srgbToLinearChannel } from 'color-kit';
 *
 * srgbToLinearChannel(0.5).toFixed(4); // → '0.2140'
 * srgbToLinearChannel(1); // → 1
 * ```
 */
export function srgbToLinearChannel(c: number): number {
  const abs = c < 0 ? -c : c;
  if (abs <= 0.04045) {
    return c / 12.92;
  }
  const linear = Math.pow((abs + 0.055) / 1.055, 2.4);
  return c < 0 ? -linear : linear;
}
