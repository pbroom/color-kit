import type { Color } from '@color-kit/core';
import { parse, toCss } from '@color-kit/core';

export type ColorInputFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

export function formatColorInputValue(
  color: Color,
  format: ColorInputFormat,
): string {
  return toCss(color, format);
}

export function parseColorInputValue(value: string): Color | null {
  try {
    return parse(value);
  } catch {
    return null;
  }
}

export function isColorInputValueValid(value: string): boolean {
  return parseColorInputValue(value) !== null;
}
