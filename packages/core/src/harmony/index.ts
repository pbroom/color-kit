import type { Color } from '../types.js';
import { normalizeHue } from '../utils/index.js';

/** Create a new Color with a shifted hue */
function shiftHue(color: Color, degrees: number): Color {
  return {
    ...color,
    h: normalizeHue(color.h + degrees),
  };
}

/**
 * Return the complementary color: the OKLCH hue rotated 180°, with
 * lightness, chroma and alpha unchanged. Not gamut mapped.
 *
 * @param color - Base color
 * @returns A new Color
 * @see {@link splitComplementary}
 * @see {@link adjustHue}
 *
 * @example
 * ```ts
 * import { complementary, parse } from 'color-kit';
 *
 * complementary(parse('oklch(0.7 0.15 30)')); // → { l: 0.7, c: 0.15, h: 210, alpha: 1 }
 * ```
 */
export function complementary(color: Color): Color {
  return shiftHue(color, 180);
}

/**
 * Return analogous colors (neighbors on the OKLCH hue wheel):
 * `[hue - angle, color, hue + angle]`. Only the hue changes, and the
 * results are not gamut mapped.
 *
 * @param color - Base color (returned as the middle entry)
 * @param angle - Hue offset in degrees (default `30`)
 * @returns Three colors
 *
 * @example
 * ```ts
 * import { analogous, parse } from 'color-kit';
 *
 * analogous(parse('oklch(0.7 0.15 30)')).map((c) => c.h); // → [0, 30, 60]
 * ```
 */
export function analogous(color: Color, angle: number = 30): Color[] {
  return [shiftHue(color, -angle), color, shiftHue(color, angle)];
}

/**
 * Return triadic colors (three hues 120° apart on the OKLCH wheel):
 * `[color, hue + 120, hue + 240]`. Only the hue changes, and the results are
 * not gamut mapped.
 *
 * @param color - Base color (returned as the first entry)
 * @returns Three colors
 *
 * @example
 * ```ts
 * import { parse, triadic } from 'color-kit';
 *
 * triadic(parse('oklch(0.7 0.15 30)')).map((c) => c.h); // → [30, 150, 270]
 * ```
 */
export function triadic(color: Color): Color[] {
  return [color, shiftHue(color, 120), shiftHue(color, 240)];
}

/**
 * Return tetradic (square) colors: four hues 90° apart on the OKLCH wheel,
 * `[color, hue + 90, hue + 180, hue + 270]`. Only the hue changes, and the
 * results are not gamut mapped.
 *
 * @param color - Base color (returned as the first entry)
 * @returns Four colors
 *
 * @example
 * ```ts
 * import { parse, tetradic } from 'color-kit';
 *
 * tetradic(parse('oklch(0.7 0.15 30)')).map((c) => c.h); // → [30, 120, 210, 300]
 * ```
 */
export function tetradic(color: Color): Color[] {
  return [
    color,
    shiftHue(color, 90),
    shiftHue(color, 180),
    shiftHue(color, 270),
  ];
}

/**
 * Return split-complementary colors: the base color plus the two hues
 * `angle` degrees either side of its complement,
 * `[color, hue + 180 - angle, hue + 180 + angle]`. Only the hue changes, and
 * the results are not gamut mapped.
 *
 * @param color - Base color (returned as the first entry)
 * @param angle - Offset from the complement in degrees (default `30`)
 * @returns Three colors
 * @see {@link complementary}
 *
 * @example
 * ```ts
 * import { parse, splitComplementary } from 'color-kit';
 *
 * splitComplementary(parse('oklch(0.7 0.15 30)')).map((c) => c.h); // → [30, 180, 240]
 * ```
 */
export function splitComplementary(color: Color, angle: number = 30): Color[] {
  return [color, shiftHue(color, 180 - angle), shiftHue(color, 180 + angle)];
}
