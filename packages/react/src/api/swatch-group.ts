import type { Color } from '@color-kit/core';

export const SWATCH_COLOR_EQUAL_EPSILON = 0.001;

export function colorsEqual(
  a: Color,
  b: Color,
  epsilon = SWATCH_COLOR_EQUAL_EPSILON,
): boolean {
  return (
    Math.abs(a.l - b.l) < epsilon &&
    Math.abs(a.c - b.c) < epsilon &&
    Math.abs(a.h - b.h) < epsilon &&
    Math.abs(a.alpha - b.alpha) < epsilon
  );
}
