import type { Color } from '@color-kit/core';
import { toCss, toHex } from '@color-kit/core';
import { assertActiveGamut, type GamutTarget } from './color-state.js';

/**
 * Inline style pair for a color swatch. Set both properties: browsers that do
 * not understand `color(display-p3 ...)` drop `background` and keep
 * `backgroundColor`.
 */
export interface ColorDisplayStyles {
  /** sRGB color: hex when opaque, otherwise `rgb(... / alpha)`. */
  backgroundColor: string;
  /** Color to paint: `color(display-p3 ...)` in the P3 gamut, else the sRGB value. */
  background: string;
}

/**
 * Formats a color as sRGB hex (`#rrggbb`, or `#rrggbbaa` when alpha < 1).
 * Out-of-sRGB colors are clipped per channel, not gamut-mapped, so pass a
 * displayed color such as `state.displayed.srgb`.
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { getColorDisplayHex } from 'color-kit/driver';
 *
 * getColorDisplayHex(parse('#3b82f6')); // → '#3b82f6'
 * getColorDisplayHex({ ...parse('#3b82f6'), alpha: 0.5 }); // → '#3b82f680'
 * ```
 */
export function getColorDisplayHex(color: Color): string {
  return toHex(color);
}

/**
 * Builds swatch styles for the active gamut. For `'display-p3'`,
 * `background` is `displayed` as `color(display-p3 ...)` and
 * `backgroundColor` is the `srgbFallback` color; for `'srgb'` both are
 * `displayed` as sRGB. Colors are formatted as given, without gamut
 * mapping, so pass the matching entries of `ColorState.displayed`.
 *
 * @param displayed - Color to paint (`state.displayed.p3` for P3).
 * @param srgbFallback - sRGB color for browsers without P3 support; only
 * used for `'display-p3'`.
 * @param activeGamut - Gamut to render in.
 * @throws {TypeError} When `activeGamut` is not `'srgb'` or `'display-p3'`
 * (for example the removed `'p3'` spelling).
 *
 * @example
 * ```ts
 * import { createColorState, getColorDisplayStyles } from 'color-kit/driver';
 *
 * const state = createColorState({ l: 0.75, c: 0.22, h: 150, alpha: 1 });
 * getColorDisplayStyles(state.displayed.p3, state.displayed.srgb, state.activeGamut);
 * // → { backgroundColor: '#00d061', background: 'color(display-p3 0.3377 0.8108 0.4099)' }
 * ```
 */
export function getColorDisplayStyles(
  displayed: Color,
  srgbFallback: Color,
  activeGamut: GamutTarget,
): ColorDisplayStyles {
  assertActiveGamut(activeGamut, 'getColorDisplayStyles()');
  if (activeGamut === 'display-p3') {
    const p3 = toCss(displayed, 'display-p3');
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
