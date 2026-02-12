import type { Color } from '@color-kit/core';
import { parse, toCss } from '@color-kit/core';

export type ColorStringInputFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

export function formatColorStringInputValue(
  color: Color,
  format: ColorStringInputFormat,
): string {
  return toCss(color, format);
}

export function parseColorStringInputValue(value: string): Color | null {
  try {
    return parse(value);
  } catch {
    return null;
  }
}

export function isColorStringInputValueValid(value: string): boolean {
  return parseColorStringInputValue(value) !== null;
}
