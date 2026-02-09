import type { Color } from '@color-kit/core';
import { toCss, toHex } from '@color-kit/core';

export function getColorDisplayHex(color: Color): string {
  return toHex(color);
}

export function getColorDisplayBackground(color: Color, hex?: string): string {
  if (color.alpha < 1) {
    return toCss(color, 'rgb');
  }
  return hex ?? toHex(color);
}
