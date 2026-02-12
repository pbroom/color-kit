import type { Color } from '@color-kit/core';
import { toCss, toHex } from '@color-kit/core';
import type { GamutTarget } from '../color-state.js';

export interface ColorDisplayStyles {
  backgroundColor: string;
  background: string;
}

export function getColorDisplayHex(color: Color): string {
  return toHex(color);
}

export function getColorDisplayStyles(
  displayed: Color,
  srgbFallback: Color,
  activeGamut: GamutTarget,
): ColorDisplayStyles {
  if (activeGamut === 'display-p3') {
    const p3 = toCss(displayed, 'p3');
    const fallbackColor =
      srgbFallback.alpha < 1 ? toCss(srgbFallback, 'rgb') : toHex(srgbFallback);
    return {
      // sRGB fallback for browsers without display-p3 support
      backgroundColor: fallbackColor,
      // Override fallback in P3-capable browsers without layering alpha colors.
      background: p3,
    };
  }

  const srgbColor =
    displayed.alpha < 1 ? toCss(displayed, 'rgb') : toHex(displayed);
  return {
    backgroundColor: srgbColor,
    background: srgbColor,
  };
}
