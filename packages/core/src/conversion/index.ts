/**
 * Color conversion module.
 *
 * All conversions flow through the internal Color type (OKLCH).
 * The conversion pipeline is:
 *   Any format -> sRGB -> Linear sRGB -> OKLAB -> OKLCH (Color)
 *   Color (OKLCH) -> OKLAB -> Linear sRGB -> sRGB -> Any format
 */

import { Hct as MaterialHct } from '@material/material-color-utilities';
import type { Color, Rgb, Hsl, Hsv, Hct, Oklab, Oklch, P3 } from '../types.js';
import { round } from '../utils/index.js';
import { withP3Hint } from '../utils/space-hint.js';

import { assertFinite } from './finite.js';
import { rgbToHex, hexToRgb } from './srgb.js';
import { rgbToHsl, hslToRgbUnrounded } from './hsl.js';
import { rgbToHsv, hsvToRgbUnrounded } from './hsv.js';
import { oklabToOklchInto, oklchToOklabInto } from './oklch.js';
import { fromP3Into, fromRgbInto, toP3Into, toRgbInto } from './into.js';
import { toHctUnrounded, toRgbUnrounded } from './unrounded.js';

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

/**
 * Convert a Color to 8-bit sRGB (`0-255` per channel).
 *
 * Out-of-gamut colors are clipped per channel to `[0, 255]` and every channel
 * is rounded to an integer; alpha passes through unchanged. Use
 * {@link toSrgbGamut} first for a perceptual gamut map instead of a clip.
 *
 * @param color - Color to convert
 * @returns A new {@link Rgb} with integer channels
 * @see {@link fromRgb}
 * @see {@link toRgbInto}
 *
 * @example
 * ```ts
 * import { parse, toRgb } from 'color-kit';
 *
 * toRgb(parse('#3b82f6')); // → { r: 59, g: 130, b: 246, alpha: 1 }
 * toRgb(parse('oklch(0.7 0.3 150)')); // → { r: 0, g: 203, b: 0, alpha: 1 } (clipped)
 * ```
 */
export function toRgb(color: Color): Rgb {
  return toRgbInto({ r: 0, g: 0, b: 0, alpha: 1 }, color);
}

/**
 * Convert sRGB (`0-255` per channel, fractional values allowed) to a Color.
 *
 * @param rgb - sRGB color; channels are not clamped
 * @returns A new OKLCH {@link Color}
 * @see {@link toRgb}
 * @see {@link fromRgbInto}
 *
 * @example
 * ```ts
 * import { fromRgb, toCss } from 'color-kit';
 *
 * toCss(fromRgb({ r: 59, g: 130, b: 246, alpha: 1 }), 'oklch');
 * // → 'oklch(0.6231 0.188 259.81)'
 * ```
 */
export function fromRgb(rgb: Rgb): Color {
  return fromRgbInto({ l: 0, c: 0, h: 0, alpha: 1 }, rgb);
}

/**
 * Convert a Color to a lowercase hex string: `#rrggbb`, or `#rrggbbaa` when
 * alpha is below 1.
 *
 * Out-of-gamut colors are clipped per channel like {@link toRgb}.
 *
 * @param color - Color to convert
 * @returns Hex string with a leading `#`
 * @throws {RangeError} When any channel of `color` is not finite
 * @see {@link fromHex}
 * @see {@link toCss}
 *
 * @example
 * ```ts
 * import { parse, toHex } from 'color-kit';
 *
 * toHex(parse('oklch(0.7 0.15 30)')); // → '#ed7665'
 * toHex(parse('rgb(59 130 246 / 0.5)')); // → '#3b82f680'
 * ```
 */
export function toHex(color: Color): string {
  assertFinite('toHex', color.l, color.c, color.h, color.alpha);
  return rgbToHex(toRgb(color));
}

/**
 * Convert a hex string (`#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`; the `#`
 * is optional) to a Color.
 *
 * @param hex - Hex color string
 * @returns A new OKLCH {@link Color}
 * @throws {Error} When `hex` has an invalid length or a non-hex digit
 * @see {@link toHex}
 * @see {@link parse}
 *
 * @example
 * ```ts
 * import { fromHex, toCss } from 'color-kit';
 *
 * toCss(fromHex('#3b82f6'), 'oklch'); // → 'oklch(0.6231 0.188 259.81)'
 * ```
 */
export function fromHex(hex: string): Color {
  return fromRgb(hexToRgb(hex));
}

/**
 * Convert a Color to HSL (hue in degrees, saturation and lightness `0-100`).
 *
 * Computed from the sRGB value clipped to the gamut like {@link toRgb} but
 * not rounded to 8-bit, so channels are fractional. Grays get hue and
 * saturation `0`.
 *
 * @param color - Color to convert
 * @returns A new {@link Hsl}
 * @see {@link fromHsl}
 *
 * @example
 * ```ts
 * import { parse, toHsl } from 'color-kit';
 *
 * toHsl(parse('#3b82f6')); // → ≈ { h: 217.22, s: 91.22, l: 59.8, alpha: 1 }
 * ```
 */
export function toHsl(color: Color): Hsl {
  return rgbToHsl(toRgbUnrounded(color));
}

/**
 * Convert HSL (hue in degrees, saturation and lightness `0-100`) to a Color.
 *
 * The intermediate sRGB value is not quantized to 8-bit, so fractional HSL
 * inputs keep full precision. Any finite hue is accepted and wrapped.
 *
 * @param hsl - HSL color
 * @returns A new OKLCH {@link Color}
 * @see {@link toHsl}
 *
 * @example
 * ```ts
 * import { fromHsl, toHex } from 'color-kit';
 *
 * toHex(fromHsl({ h: 200, s: 80, l: 40, alpha: 1 })); // → '#1481b8'
 * ```
 */
export function fromHsl(hsl: Hsl): Color {
  return fromRgb(hslToRgbUnrounded(hsl));
}

/**
 * Convert a Color to HSV/HSB (hue in degrees, saturation and value `0-100`).
 *
 * Computed from the sRGB value clipped to the gamut like {@link toRgb} but
 * not rounded to 8-bit, so channels are fractional. Grays get hue and
 * saturation `0`.
 *
 * @param color - Color to convert
 * @returns A new {@link Hsv}
 * @see {@link fromHsv}
 *
 * @example
 * ```ts
 * import { parse, toHsv } from 'color-kit';
 *
 * toHsv(parse('#3b82f6')); // → ≈ { h: 217.22, s: 76.02, v: 96.47, alpha: 1 }
 * ```
 */
export function toHsv(color: Color): Hsv {
  return rgbToHsv(toRgbUnrounded(color));
}

/**
 * Convert a Color to HCT (Material Design hue, chroma, tone).
 *
 * Computed from the sRGB value clipped to the gamut like {@link toRgb} but
 * not rounded to 8-bit, under Material's default viewing conditions. Tone is
 * CIE L* (`0-100`).
 *
 * @param color - Color to convert
 * @returns A new {@link Hct}
 * @see {@link fromHct}
 *
 * @example
 * ```ts
 * import { parse, toHct } from 'color-kit';
 *
 * toHct(parse('#3b82f6')); // → ≈ { h: 266.34, c: 64.16, t: 55.63, alpha: 1 }
 * ```
 */
export function toHct(color: Color): Hct {
  return toHctUnrounded(color);
}

/**
 * Convert HCT (Material Design hue, chroma, tone) to a Color.
 *
 * Uses Material's `Hct.from()` solver, which reduces chroma to fit sRGB at
 * the requested hue and tone and yields an 8-bit sRGB color, so the result
 * is always in the sRGB gamut and quantized to 8-bit.
 *
 * @param hct - HCT color
 * @returns A new OKLCH {@link Color}
 * @see {@link toHct}
 *
 * @example
 * ```ts
 * import { fromHct, toHex } from 'color-kit';
 *
 * toHex(fromHct({ h: 280, c: 40, t: 60, alpha: 1 })); // → '#838cd0'
 * ```
 */
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
 * Convert HSV/HSB (hue in degrees, saturation and value `0-100`) to a Color.
 *
 * The intermediate sRGB value is not quantized to 8-bit, so fractional HSV
 * inputs keep full precision. Any finite hue is accepted and wrapped.
 *
 * @param hsv - HSV color
 * @returns A new OKLCH {@link Color}
 * @see {@link toHsv}
 *
 * @example
 * ```ts
 * import { fromHsv, toHex } from 'color-kit';
 *
 * toHex(fromHsv({ h: 30, s: 100, v: 100, alpha: 1 })); // → '#ff8000'
 * ```
 */
export function fromHsv(hsv: Hsv): Color {
  return fromRgb(hsvToRgbUnrounded(hsv));
}

/**
 * Convert a Color to OKLab (the rectangular form of OKLCH). Exact; no gamut
 * clipping.
 *
 * @param color - Color to convert
 * @returns A new {@link Oklab}
 * @see {@link fromOklab}
 * @see {@link toOklabInto}
 *
 * @example
 * ```ts
 * import { parse, toOklab } from 'color-kit';
 *
 * toOklab(parse('oklch(0.7 0.1 0)')); // → { L: 0.7, a: 0.1, b: 0, alpha: 1 }
 * ```
 */
export function toOklab(color: Color): Oklab {
  return oklchToOklabInto({ L: 0, a: 0, b: 0, alpha: 1 }, color);
}

/**
 * Convert OKLab to a Color. Achromatic results (chroma at or below
 * {@link ACHROMATIC_CHROMA_THRESHOLD}) get hue `0`.
 *
 * @param lab - OKLab color
 * @returns A new OKLCH {@link Color}
 * @see {@link toOklab}
 * @see {@link fromOklabInto}
 *
 * @example
 * ```ts
 * import { fromOklab } from 'color-kit';
 *
 * fromOklab({ L: 0.7, a: 0, b: 0.1, alpha: 1 }); // → { l: 0.7, c: 0.1, h: 90, alpha: 1 }
 * ```
 */
export function fromOklab(lab: Oklab): Color {
  return oklabToOklchInto({ l: 0, c: 0, h: 0, alpha: 1 }, lab);
}

/**
 * Copy a Color into a new {@link Oklch} object. Color already is OKLCH, so
 * channels are copied unchanged (the hue is not normalized).
 *
 * @param color - Color to copy
 * @returns A new {@link Oklch} with the same channels
 * @see {@link fromOklch}
 * @see {@link colorToOklch}
 *
 * @example
 * ```ts
 * import { parse, toOklch } from 'color-kit';
 *
 * toOklch(parse('oklch(0.7 0.15 30)')); // → { l: 0.7, c: 0.15, h: 30, alpha: 1 }
 * ```
 */
export function toOklch(color: Color): Oklch {
  return { l: color.l, c: color.c, h: color.h, alpha: color.alpha };
}

/**
 * Copy an {@link Oklch} value into a new Color. Channels are copied
 * unchanged (the hue is not normalized).
 *
 * @param oklch - OKLCH color
 * @returns A new {@link Color} with the same channels
 * @see {@link toOklch}
 * @see {@link oklchToColor}
 *
 * @example
 * ```ts
 * import { fromOklch, toHex } from 'color-kit';
 *
 * toHex(fromOklch({ l: 0.7, c: 0.15, h: 30, alpha: 1 })); // → '#ed7665'
 * ```
 */
export function fromOklch(oklch: Oklch): Color {
  return { l: oklch.l, c: oklch.c, h: oklch.h, alpha: oklch.alpha };
}

/**
 * Convert a Color to gamma-encoded Display P3 (`0-1` per channel).
 *
 * Channels outside the P3 gamut are clipped to `[0, 1]`; values are not
 * rounded. Use {@link toP3Gamut} first for a perceptual gamut map instead of
 * a clip.
 *
 * @param color - Color to convert
 * @returns A new {@link P3}
 * @see {@link fromP3}
 * @see {@link toP3Into}
 *
 * @example
 * ```ts
 * import { parse, toP3 } from 'color-kit';
 *
 * toP3(parse('#ff0000')); // → ≈ { r: 0.9175, g: 0.2003, b: 0.1386, alpha: 1 }
 * ```
 */
export function toP3(color: Color): P3 {
  return toP3Into({ r: 0, g: 0, b: 0, alpha: 1 }, color);
}

/**
 * Convert gamma-encoded Display P3 (`0-1` per channel) to a Color. Colors
 * outside sRGB keep their full chroma.
 *
 * @param p3 - Display P3 color; channels are not clamped
 * @returns A new OKLCH {@link Color}
 * @see {@link toP3}
 * @see {@link fromP3Into}
 *
 * @example
 * ```ts
 * import { fromP3, inSrgbGamut, toCss } from 'color-kit';
 *
 * const red = fromP3({ r: 1, g: 0, b: 0, alpha: 1 });
 * toCss(red, 'oklch'); // → 'oklch(0.6486 0.2995 28.96)'
 * inSrgbGamut(red); // → false
 * ```
 */
export function fromP3(p3: P3): Color {
  return fromP3Into({ l: 0, c: 0, h: 0, alpha: 1 }, p3);
}

/**
 * Output formats accepted by {@link toCss}. `'display-p3'` serializes as
 * `color(display-p3 r g b)`.
 */
export type CssColorFormat =
  | 'hex'
  | 'rgb'
  | 'hsl'
  | 'oklch'
  | 'oklab'
  | 'display-p3';

/**
 * Serialize a Color as a CSS color string in the given format.
 *
 * `'hex'` and `'rgb'` clip to sRGB and round to 8-bit like {@link toRgb};
 * `'hsl'` clips to sRGB (1 decimal); `'display-p3'` clips to P3 (4
 * decimals); `'oklch'` and `'oklab'` are exact (4 decimals, hue 2). An alpha
 * below 1 is appended as `/ alpha` (3 decimals), or as the `aa` byte for hex.
 *
 * @param color - Color to serialize
 * @param format - Output format
 * @returns CSS color string
 * @throws {TypeError} When `format` is not a {@link CssColorFormat} (the
 *   message points `'p3'` at `'display-p3'`)
 * @throws {RangeError} When any channel of `color` is not finite
 * @see {@link parse}
 * @see {@link toHex}
 *
 * @example
 * ```ts
 * import { parse, toCss } from 'color-kit';
 *
 * const blue = parse('#3b82f6');
 * toCss(blue); // → '#3b82f6'
 * toCss(blue, 'oklch'); // → 'oklch(0.6231 0.188 259.81)'
 * toCss(blue, 'display-p3'); // → 'color(display-p3 0.3047 0.5035 0.9338)'
 * ```
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
    case 'display-p3': {
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
        withP3Hint(
          `toCss: unknown format "${String(format)}" (expected hex, rgb, hsl, oklch, oklab or display-p3)`,
          format,
        ),
      );
  }
}
