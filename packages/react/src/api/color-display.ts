import type { Color } from '@color-kit/core';
import { toCss, toHex } from '@color-kit/core';
import type { GamutTarget } from '../color-state.js';

export interface ColorDisplayStyles {
  backgroundColor: string;
  backgroundImage?: string;
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
    return {
      // sRGB fallback for browsers without display-p3 support
      backgroundColor:
        srgbFallback.alpha < 1
          ? toCss(srgbFallback, 'rgb')
          : toHex(srgbFallback),
      backgroundImage: `linear-gradient(${p3}, ${p3})`,
    };
  }

  return {
    backgroundColor:
      displayed.alpha < 1 ? toCss(displayed, 'rgb') : toHex(displayed),
  };
}
