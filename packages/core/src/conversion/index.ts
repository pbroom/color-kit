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
import { round, clamp } from '../utils/index.js';

import { srgbToLinear, linearToSrgb, rgbToHex, hexToRgb } from './srgb.js';
import { rgbToHsl, hslToRgb } from './hsl.js';
import { rgbToHsv, hsvToRgb } from './hsv.js';
import { linearRgbToOklab, oklabToLinearRgb } from './oklab.js';
import { oklabToOklch, oklchToOklab } from './oklch.js';
import {
  linearSrgbToLinearP3,
  linearP3ToLinearSrgb,
  linearP3ToP3,
  p3ToLinearP3,
} from './p3.js';

// Re-export individual converters for advanced use
export { srgbToLinear, linearToSrgb, rgbToHex, hexToRgb } from './srgb.js';
export { rgbToHsl, hslToRgb } from './hsl.js';
export { rgbToHsv, hsvToRgb } from './hsv.js';
export { linearRgbToOklab, oklabToLinearRgb } from './oklab.js';
export {
  oklabToOklch,
  oklchToOklab,
  oklchToColor,
  colorToOklch,
} from './oklch.js';
export {
  linearSrgbToLinearP3,
  linearP3ToLinearSrgb,
  linearP3ToP3,
  p3ToLinearP3,
} from './p3.js';

// ─── High-level conversions: Color (OKLCH) ↔ other formats ─────────

/** Convert a Color to sRGB (0-255) */
export function toRgb(color: Color): Rgb {
  const lab: Oklab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linear = oklabToLinearRgb(lab);
  return linearToSrgb(linear);
}

/** Convert sRGB (0-255) to a Color */
export function fromRgb(rgb: Rgb): Color {
  const linear = srgbToLinear(rgb);
  const lab = linearRgbToOklab(linear);
  const oklch = oklabToOklch(lab);
  return { l: oklch.l, c: oklch.c, h: oklch.h, alpha: oklch.alpha };
}

/** Convert a Color to a hex string */
export function toHex(color: Color): string {
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

/** Convert HSL to a Color */
export function fromHsl(hsl: Hsl): Color {
  return fromRgb(hslToRgb(hsl));
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

/** Convert HSV to a Color */
export function fromHsv(hsv: Hsv): Color {
  return fromRgb(hsvToRgb(hsv));
}

/** Convert a Color to OKLAB */
export function toOklab(color: Color): Oklab {
  return oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
}

/** Convert OKLAB to a Color */
export function fromOklab(lab: Oklab): Color {
  const oklch = oklabToOklch(lab);
  return { l: oklch.l, c: oklch.c, h: oklch.h, alpha: oklch.alpha };
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
  const lab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linearSrgb = oklabToLinearRgb(lab);
  const linearP3 = linearSrgbToLinearP3(linearSrgb);
  return linearP3ToP3(linearP3);
}

/** Convert Display P3 to a Color */
export function fromP3(p3: P3): Color {
  const linearP3 = p3ToLinearP3(p3);
  const linearSrgb = linearP3ToLinearSrgb(linearP3);
  const lab = linearRgbToOklab(linearSrgb);
  const oklch = oklabToOklch(lab);
  return { l: oklch.l, c: oklch.c, h: oklch.h, alpha: oklch.alpha };
}

/** Convert a Color to a CSS color string in the given format */
export function toCss(color: Color, format: string = 'hex'): string {
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
      return toHex(color);
  }
}

// ─── CSS color string parser ────────────────────────────────────────

/**
 * Parse any CSS color string into a Color.
 * Supports: hex, rgb(), hsl(), oklch(), oklab(), color(display-p3 ...)
 */
export function parse(input: string): Color {
  const str = input.trim().toLowerCase();

  // Hex
  if (str.startsWith('#')) {
    return fromHex(str);
  }

  // rgb() / rgba()
  const rgbMatch = str.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/,
  );
  if (rgbMatch) {
    const alpha = rgbMatch[4]
      ? rgbMatch[4].endsWith('%')
        ? parseFloat(rgbMatch[4]) / 100
        : parseFloat(rgbMatch[4])
      : 1;
    return fromRgb({
      r: clamp(parseFloat(rgbMatch[1]), 0, 255),
      g: clamp(parseFloat(rgbMatch[2]), 0, 255),
      b: clamp(parseFloat(rgbMatch[3]), 0, 255),
      alpha: clamp(alpha, 0, 1),
    });
  }

  // hsl() / hsla()
  const hslMatch = str.match(
    /^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/,
  );
  if (hslMatch) {
    const alpha = hslMatch[4]
      ? hslMatch[4].endsWith('%')
        ? parseFloat(hslMatch[4]) / 100
        : parseFloat(hslMatch[4])
      : 1;
    return fromHsl({
      h: parseFloat(hslMatch[1]),
      s: parseFloat(hslMatch[2]),
      l: parseFloat(hslMatch[3]),
      alpha: clamp(alpha, 0, 1),
    });
  }

  // oklch()
  const oklchMatch = str.match(
    /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/,
  );
  if (oklchMatch) {
    const l = oklchMatch[1].endsWith('%')
      ? parseFloat(oklchMatch[1]) / 100
      : parseFloat(oklchMatch[1]);
    const c = oklchMatch[2].endsWith('%')
      ? (parseFloat(oklchMatch[2]) / 100) * 0.4
      : parseFloat(oklchMatch[2]);
    const h = parseFloat(oklchMatch[3]);
    const alpha = oklchMatch[4]
      ? oklchMatch[4].endsWith('%')
        ? parseFloat(oklchMatch[4]) / 100
        : parseFloat(oklchMatch[4])
      : 1;
    return { l, c, h, alpha: clamp(alpha, 0, 1) };
  }

  // oklab()
  const oklabMatch = str.match(
    /^oklab\(\s*([\d.]+%?)\s+([-\d.]+%?)\s+([-\d.]+%?)(?:\s*\/\s*([\d.]+%?))?\s*\)$/,
  );
  if (oklabMatch) {
    const L = oklabMatch[1].endsWith('%')
      ? parseFloat(oklabMatch[1]) / 100
      : parseFloat(oklabMatch[1]);
    const a = oklabMatch[2].endsWith('%')
      ? (parseFloat(oklabMatch[2]) / 100) * 0.4
      : parseFloat(oklabMatch[2]);
    const b = oklabMatch[3].endsWith('%')
      ? (parseFloat(oklabMatch[3]) / 100) * 0.4
      : parseFloat(oklabMatch[3]);
    const alpha = oklabMatch[4]
      ? oklabMatch[4].endsWith('%')
        ? parseFloat(oklabMatch[4]) / 100
        : parseFloat(oklabMatch[4])
      : 1;
    return fromOklab({ L, a, b, alpha: clamp(alpha, 0, 1) });
  }

  // color(display-p3 ...)
  const p3Match = str.match(
    /^color\(\s*display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/,
  );
  if (p3Match) {
    const alpha = p3Match[4]
      ? p3Match[4].endsWith('%')
        ? parseFloat(p3Match[4]) / 100
        : parseFloat(p3Match[4])
      : 1;
    return fromP3({
      r: parseFloat(p3Match[1]),
      g: parseFloat(p3Match[2]),
      b: parseFloat(p3Match[3]),
      alpha: clamp(alpha, 0, 1),
    });
  }

  throw new Error(`Unable to parse color: "${input}"`);
}
