/**
 * Color conversion module.
 *
 * All conversions flow through the internal Color type (OKLCH).
 * The conversion pipeline is:
 *   Any format -> sRGB -> Linear sRGB -> OKLAB -> OKLCH (Color)
 *   Color (OKLCH) -> OKLAB -> Linear sRGB -> sRGB -> Any format
 */

import {
  Hct as MaterialHct,
  argbFromRgb,
} from '@material/material-color-utilities';
import type { Color, Rgb, Hsl, Hsv, Hct, Oklab, Oklch, P3 } from '../types.js';
import { round } from '../utils/index.js';

import { assertFinite } from './finite.js';
import { rgbToHex, hexToRgb } from './srgb.js';
import { rgbToHsl, hslToRgbUnrounded } from './hsl.js';
import { rgbToHsv, hsvToRgbUnrounded } from './hsv.js';
import { oklabToOklchInto, oklchToOklabInto } from './oklch.js';
import { fromP3Into, fromRgbInto, toP3Into, toRgbInto } from './into.js';

// Re-export individual converters for advanced use
export {
  srgbToLinear,
  srgbToLinearInto,
  linearToSrgb,
  linearToSrgbInto,
  rgbToHex,
  hexToRgb,
} from './srgb.js';
export { rgbToHsl, hslToRgb } from './hsl.js';
export { parse, tryParse } from './parse.js';
export { rgbToHsv, hsvToRgb } from './hsv.js';
export {
  linearRgbToOklab,
  linearRgbToOklabInto,
  oklabToLinearRgb,
  oklabToLinearRgbInto,
} from './oklab.js';
export {
  oklabToOklch,
  oklabToOklchInto,
  oklchToOklab,
  oklchToOklabInto,
  oklchToColor,
  colorToOklch,
} from './oklch.js';
export {
  linearSrgbToLinearP3,
  linearSrgbToLinearP3Into,
  linearP3ToLinearSrgb,
  linearP3ToLinearSrgbInto,
  linearP3ToP3,
  linearP3ToP3Into,
  p3ToLinearP3,
  p3ToLinearP3Into,
} from './p3.js';
export {
  fromLinearSrgbInto,
  fromOklabInto,
  fromP3Into,
  fromRgbInto,
  toLinearSrgbInto,
  toOklabInto,
  toP3Into,
  toRgbInto,
} from './into.js';

// ─── High-level conversions: Color (OKLCH) ↔ other formats ─────────

/** Convert a Color to sRGB (0-255) */
export function toRgb(color: Color): Rgb {
  return toRgbInto({ r: 0, g: 0, b: 0, alpha: 1 }, color);
}

/** Convert sRGB (0-255) to a Color */
export function fromRgb(rgb: Rgb): Color {
  return fromRgbInto({ l: 0, c: 0, h: 0, alpha: 1 }, rgb);
}

/**
 * Convert a Color to a hex string. Throws a `RangeError` when any channel is
 * not finite.
 */
export function toHex(color: Color): string {
  assertFinite('toHex', color.l, color.c, color.h, color.alpha);
  return rgbToHex(toRgb(color));
}

/** Convert a hex string to a Color */
export function fromHex(hex: string): Color {
  return fromRgb(hexToRgb(hex));
}

/** Convert a Color to HSL */
export function toHsl(color: Color): Hsl {
  return rgbToHsl(toRgb(color));
}

/**
 * Convert HSL to a Color. The intermediate sRGB value is not quantized to
 * 8-bit, so fractional HSL inputs keep full precision.
 */
export function fromHsl(hsl: Hsl): Color {
  return fromRgb(hslToRgbUnrounded(hsl));
}

/** Convert a Color to HSV */
export function toHsv(color: Color): Hsv {
  return rgbToHsv(toRgb(color));
}

/** Convert a Color to HCT (Material hue/chroma/tone model) */
export function toHct(color: Color): Hct {
  const rgb = toRgb(color);
  const argb = argbFromRgb(rgb.r, rgb.g, rgb.b);
  const hct = MaterialHct.fromInt(argb);
  return {
    h: hct.hue,
    c: hct.chroma,
    t: hct.tone,
    alpha: color.alpha,
  };
}

/** Convert HCT (Material hue/chroma/tone model) to a Color */
export function fromHct(hct: Hct): Color {
  const argb = MaterialHct.from(hct.h, hct.c, hct.t).toInt();
  const rgb: Rgb = {
    r: (argb >>> 16) & 0xff,
    g: (argb >>> 8) & 0xff,
    b: argb & 0xff,
    alpha: hct.alpha,
  };
  const color = fromRgb(rgb);
  return {
    ...color,
    alpha: hct.alpha,
  };
}

/**
 * Convert HSV to a Color. The intermediate sRGB value is not quantized to
 * 8-bit, so fractional HSV inputs keep full precision.
 */
export function fromHsv(hsv: Hsv): Color {
  return fromRgb(hsvToRgbUnrounded(hsv));
}

/** Convert a Color to OKLAB */
export function toOklab(color: Color): Oklab {
  return oklchToOklabInto({ L: 0, a: 0, b: 0, alpha: 1 }, color);
}

/** Convert OKLAB to a Color */
export function fromOklab(lab: Oklab): Color {
  return oklabToOklchInto({ l: 0, c: 0, h: 0, alpha: 1 }, lab);
}

/** Convert a Color to OKLCH (identity, but returns a new object) */
export function toOklch(color: Color): Oklch {
  return { l: color.l, c: color.c, h: color.h, alpha: color.alpha };
}

/** Convert OKLCH to a Color (identity, but returns a new object) */
export function fromOklch(oklch: Oklch): Color {
  return { l: oklch.l, c: oklch.c, h: oklch.h, alpha: oklch.alpha };
}

/** Convert a Color to Display P3 */
export function toP3(color: Color): P3 {
  return toP3Into({ r: 0, g: 0, b: 0, alpha: 1 }, color);
}

/** Convert Display P3 to a Color */
export function fromP3(p3: P3): Color {
  return fromP3Into({ l: 0, c: 0, h: 0, alpha: 1 }, p3);
}

/** Output formats accepted by {@link toCss}. */
export type CssColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch' | 'oklab' | 'p3';

/**
 * Convert a Color to a CSS color string in the given format (default
 * `'hex'`). Throws a `TypeError` for an unknown format and a `RangeError`
 * when any channel of `color` is not finite.
 */
export function toCss(color: Color, format: CssColorFormat = 'hex'): string {
  assertFinite('toCss', color.l, color.c, color.h, color.alpha);
  switch (format) {
    case 'hex':
      return toHex(color);
    case 'rgb': {
      const rgb = toRgb(color);
      return rgb.alpha < 1
        ? `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${round(rgb.alpha, 3)})`
        : `rgb(${rgb.r} ${rgb.g} ${rgb.b})`;
    }
    case 'hsl': {
      const hsl = toHsl(color);
      return hsl.alpha < 1
        ? `hsl(${round(hsl.h, 1)} ${round(hsl.s, 1)}% ${round(
            hsl.l,
            1,
          )}% / ${round(hsl.alpha, 3)})`
        : `hsl(${round(hsl.h, 1)} ${round(hsl.s, 1)}% ${round(hsl.l, 1)}%)`;
    }
    case 'oklch': {
      return color.alpha < 1
        ? `oklch(${round(color.l, 4)} ${round(color.c, 4)} ${round(
            color.h,
            2,
          )} / ${round(color.alpha, 3)})`
        : `oklch(${round(color.l, 4)} ${round(color.c, 4)} ${round(
            color.h,
            2,
          )})`;
    }
    case 'oklab': {
      const lab = toOklab(color);
      return lab.alpha < 1
        ? `oklab(${round(lab.L, 4)} ${round(lab.a, 4)} ${round(
            lab.b,
            4,
          )} / ${round(lab.alpha, 3)})`
        : `oklab(${round(lab.L, 4)} ${round(lab.a, 4)} ${round(lab.b, 4)})`;
    }
    case 'p3': {
      const p3 = toP3(color);
      return p3.alpha < 1
        ? `color(display-p3 ${round(p3.r, 4)} ${round(p3.g, 4)} ${round(
            p3.b,
            4,
          )} / ${round(p3.alpha, 3)})`
        : `color(display-p3 ${round(p3.r, 4)} ${round(p3.g, 4)} ${round(
            p3.b,
            4,
          )})`;
    }
    default:
      throw new TypeError(
        `toCss: unknown format "${String(format)}" (expected hex, rgb, hsl, oklch, oklab or p3)`,
      );
  }
}
