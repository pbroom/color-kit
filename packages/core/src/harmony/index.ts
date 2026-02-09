import type { Color } from '../types.js';
import { normalizeHue } from '../utils/index.js';

/** Create a new Color with a shifted hue */
function shiftHue(color: Color, degrees: number): Color {
  return {
    ...color,
    h: normalizeHue(color.h + degrees),
  };
}

/** Get the complementary color (180 degrees opposite) */
export function complementary(color: Color): Color {
  return shiftHue(color, 180);
}

/**
 * Get analogous colors (adjacent on the color wheel).
 * Returns [color - angle, color, color + angle].
 */
export function analogous(color: Color, angle: number = 30): Color[] {
  return [shiftHue(color, -angle), color, shiftHue(color, angle)];
}

/**
 * Get triadic colors (three equally spaced colors).
 * Returns [color, color + 120, color + 240].
 */
export function triadic(color: Color): Color[] {
  return [color, shiftHue(color, 120), shiftHue(color, 240)];
}

/**
 * Get tetradic/rectangular colors (four colors in two complementary pairs).
 * Returns [color, color + 90, color + 180, color + 270].
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
 * Get split-complementary colors.
 * Returns [color, complement - angle, complement + angle].
 */
export function splitComplementary(color: Color, angle: number = 30): Color[] {
  return [color, shiftHue(color, 180 - angle), shiftHue(color, 180 + angle)];
}
