/**
 * CSS Color 4 string parser.
 *
 * The input is split into a function name and its component tokens, and every
 * token is validated against the CSS `<number>` grammar before conversion, so
 * malformed input throws instead of producing `NaN` channels.
 */

import type { Color } from '../types.js';
import type { Matrix3 } from './matrices.js';
import { clamp, normalizeHue, srgbToLinearChannel } from '../utils/index.js';
import { hslToRgbUnrounded } from './hsl.js';
import { fromLinearSrgbInto, fromP3Into, fromRgbInto } from './into.js';
import { namedColorHex } from './named-colors.js';
import { oklabToOklchInto } from './oklch.js';
import { hexToRgb } from './srgb.js';
import {
  fromXyzInto,
  labToXyzD50,
  LINEAR_A98_RGB_TO_XYZ_D65,
  LINEAR_PROPHOTO_RGB_TO_XYZ_D50,
  LINEAR_REC2020_TO_XYZ_D65,
  multiplyMatrix3,
  type Vec3,
} from './xyz.js';

/** CSS `<number>` with an optional `%` or angle unit. */
const TOKEN =
  /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(%|deg|g?rad|turn)?$/;

/** Degrees per angle unit. */
const DEGREES: Record<string, number> = {
  deg: 1,
  grad: 0.9,
  rad: 180 / Math.PI,
  turn: 360,
};

/** Component kind for hues: a number (degrees) or an angle. */
const HUE = 0;

// `[\s\S]*` (not `.*`) so the arguments may span lines: CSS whitespace
// (space, tab, LF, CR, FF) is valid between components.
const FUNCTION = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(([\s\S]*)\)$/;
/** Predefined spaces accepted inside `color()`. */
const COLOR_SPACE =
  /^(srgb|srgb-linear|display-p3|rec2020|a98-rgb|prophoto-rgb|xyz|xyz-d50|xyz-d65)$/;

function fail(input: string, reason = ''): never {
  throw new Error(`Unable to parse color: "${input}"${reason}`);
}

/** Sign-preserving power, the transfer shape of the `color()` RGB spaces. */
function signedPow(value: number, exponent: number): number {
  return Math.sign(value) * Math.abs(value) ** exponent;
}

/**
 * Parse a CSS color string into a Color.
 *
 * Supports CSS Color 4: hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), the
 * 148 named colors and `transparent`, `rgb()` / `rgba()` and `hsl()` /
 * `hsla()` (modern space syntax and legacy comma syntax), `hwb()`, `lab()`,
 * `lch()`, `oklab()`, `oklch()`, and `color()` with `srgb`, `srgb-linear`,
 * `display-p3`, `rec2020`, `a98-rgb`, `prophoto-rgb`, `xyz`, `xyz-d65` and
 * `xyz-d50`. Components accept numbers, percentages, and `none` (a missing
 * component, which CSS treats as `0`; not allowed in legacy comma syntax).
 * Hues accept `deg`, `grad`, `rad` and `turn`, and the result's hue is
 * normalized to `[0, 360)`.
 *
 * Throws an `Error` for anything else, including invalid hex digits or
 * lengths, malformed numbers (`1.2.3`) and values that overflow to
 * `Infinity`, either as written or after conversion; a non-string `input`
 * throws a `TypeError`. Use {@link tryParse} to get `null` instead of an
 * exception.
 */
export function parse(input: string): Color {
  const str = input.trim().toLowerCase();
  const out: Color = { l: 0, c: 0, h: 0, alpha: 1 };

  const named = namedColorHex(str);
  if (named || str[0] === '#') {
    try {
      return fromRgbInto(out, hexToRgb(named ?? str));
    } catch {
      fail(input);
    }
  }

  const fn = FUNCTION.exec(str);
  if (!fn) fail(input);
  const name = fn[1];
  const body = fn[2].trim();
  const legacy = body.includes(',');

  let parts: string[];
  let alphaToken: string | undefined;
  if (legacy) {
    // Legacy comma syntax: `rgb(r, g, b[, a])`, `hsl(h, s, l[, a])`.
    if (!/^(rgb|hsl)/.test(name)) fail(input);
    parts = body.split(',').map((part) => part.trim());
    if (parts.length === 4) alphaToken = parts.pop();
  } else {
    const slash = body.split('/');
    if (slash.length > 2) fail(input);
    parts = slash[0].trim().split(/\s+/);
    if (slash.length === 2) alphaToken = slash[1].trim();
  }
  const space = name === 'color' ? parts.shift() : name;
  // Only predefined spaces are valid in `color()`; without this check
  // `color(rgb 1 0 0)` would dispatch to the top-level `rgb()` handler.
  if (name === 'color' && !COLOR_SPACE.test(space ?? '')) fail(input);
  if (parts.length !== 3) fail(input);
  if (legacy) {
    // Legacy comma syntax is stricter than the modern one: rgb() channels
    // are all numbers or all percentages, and hsl() saturation and lightness
    // are percentages.
    const [p0, p1, p2] = parts.map((part) => part.endsWith('%'));
    if (name[0] === 'r' ? p0 !== p1 || p1 !== p2 : !(p1 && p2)) fail(input);
  }

  /**
   * Parse one component. `kind` is the value `100%` maps to, or `HUE` for a
   * hue (number of degrees or an angle). Throws for malformed numbers, units
   * the component does not accept, `none` in legacy syntax, and values that
   * overflow to `Infinity`.
   */
  const component = (token: string | undefined, kind: number): number => {
    if (token === 'none' && !legacy) return 0;
    const match = token ? TOKEN.exec(token) : null;
    if (!match) fail(input);
    const unit = match[2];
    let value = +match[1];
    if (unit === '%') {
      if (kind === HUE) fail(input);
      value = (value / 100) * kind;
    } else if (unit) {
      if (kind !== HUE) fail(input);
      value *= DEGREES[unit];
    }
    if (!Number.isFinite(value)) fail(input, ' (non-finite component)');
    return value;
  };

  const alpha =
    alphaToken === undefined ? 1 : clamp(component(alphaToken, 1), 0, 1);
  out.alpha = alpha;
  const [x, y, z] = parts;

  switch (space) {
    case 'rgb':
    case 'rgba':
      fromRgbInto(out, {
        r: clamp(component(x, 255), 0, 255),
        g: clamp(component(y, 255), 0, 255),
        b: clamp(component(z, 255), 0, 255),
        alpha,
      });
      break;
    case 'hsl':
    case 'hsla':
      fromRgbInto(
        out,
        hslToRgbUnrounded({
          h: component(x, HUE),
          // CSS Color 4 clamps negative saturation to 0% at parse time.
          s: Math.max(0, component(y, 100)),
          l: component(z, 100),
          alpha,
        }),
      );
      break;
    case 'hwb': {
      // CSS Color 4 hwbToRgb: scale the pure hue by (1 - w - b), then add w;
      // when w + b >= 1 the result is the gray w / (w + b).
      const pure = hslToRgbUnrounded({
        h: component(x, HUE),
        s: 100,
        l: 50,
        alpha,
      });
      const white = component(y, 100) / 100;
      const black = component(z, 100) / 100;
      const sum = white + black;
      const mix = (channel: number) =>
        sum >= 1 ? (white / sum) * 255 : channel * (1 - sum) + white * 255;
      fromRgbInto(out, {
        r: mix(pure.r),
        g: mix(pure.g),
        b: mix(pure.b),
        alpha,
      });
      break;
    }
    case 'lab':
    case 'lch': {
      // CSS clamps lightness to [0, 100] and chroma to >= 0 at parse time.
      const L = clamp(component(x, 100), 0, 100);
      let a: number;
      let b: number;
      if (space === 'lab') {
        a = component(y, 125);
        b = component(z, 125);
      } else {
        const C = Math.max(0, component(y, 150));
        const H = (component(z, HUE) * Math.PI) / 180;
        a = C * Math.cos(H);
        b = C * Math.sin(H);
      }
      fromXyzInto(out, labToXyzD50(L, a, b), true);
      break;
    }
    case 'oklab':
      oklabToOklchInto(out, {
        L: clamp(component(x, 1), 0, 1),
        a: component(y, 0.4),
        b: component(z, 0.4),
        alpha,
      });
      break;
    case 'oklch':
      out.l = clamp(component(x, 1), 0, 1);
      out.c = Math.max(0, component(y, 0.4));
      out.h = component(z, HUE);
      break;
    default: {
      // color(<space> c1 c2 c3): numbers or percentages (100% = 1).
      const v: Vec3 = [component(x, 1), component(y, 1), component(z, 1)];
      const rgb = { r: v[0], g: v[1], b: v[2], alpha };
      const xyz = (toXyz: Matrix3, linearize: (c: number) => number) =>
        multiplyMatrix3(toXyz, v.map(linearize) as Vec3);
      switch (space) {
        case 'srgb':
          // Sign-extended sRGB transfer function (CSS Color 4).
          rgb.r = srgbToLinearChannel(rgb.r);
          rgb.g = srgbToLinearChannel(rgb.g);
          rgb.b = srgbToLinearChannel(rgb.b);
          fromLinearSrgbInto(out, rgb);
          break;
        case 'srgb-linear':
          fromLinearSrgbInto(out, rgb);
          break;
        case 'display-p3':
          fromP3Into(out, rgb);
          break;
        case 'rec2020':
          // BT.1886 reference EOTF (pure 2.4 gamma), as in CSS Color 4.
          fromXyzInto(
            out,
            xyz(LINEAR_REC2020_TO_XYZ_D65, (c) => signedPow(c, 2.4)),
            false,
          );
          break;
        case 'a98-rgb':
          fromXyzInto(
            out,
            xyz(LINEAR_A98_RGB_TO_XYZ_D65, (c) => signedPow(c, 563 / 256)),
            false,
          );
          break;
        case 'prophoto-rgb':
          fromXyzInto(
            out,
            xyz(LINEAR_PROPHOTO_RGB_TO_XYZ_D50, (c) =>
              Math.abs(c) < 16 / 512 ? c / 16 : signedPow(c, 1.8),
            ),
            true,
          );
          break;
        case 'xyz':
        case 'xyz-d65':
        case 'xyz-d50':
          fromXyzInto(out, v, space === 'xyz-d50');
          break;
        default:
          fail(input);
      }
    }
  }

  out.h = normalizeHue(out.h);
  // Finite components can still overflow inside a conversion (for example
  // `color(srgb 1e300 0 0)`), so check the result too. `h >= 0` rejects NaN.
  if (!(Number.isFinite(out.l) && Number.isFinite(out.c) && out.h >= 0)) {
    fail(input, ' (non-finite component)');
  }
  return out;
}

/**
 * Like {@link parse}, but returns `null` instead of throwing when `input` is
 * not a supported, well-formed CSS color. Never throws.
 *
 * @example
 * ```ts
 * tryParse('#3b82f6'); // Color
 * tryParse('#gggggg'); // null
 * ```
 */
export function tryParse(input: string): Color | null {
  try {
    return parse(input);
  } catch {
    return null;
  }
}
