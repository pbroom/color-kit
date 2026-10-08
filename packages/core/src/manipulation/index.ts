import type { Color } from '../types.js';
import { clamp, normalizeHue } from '../utils/index.js';
import {
  hasInterpolationOptions,
  interpolateInSpaceInto,
  type InterpolationOptions,
} from '../interpolation/index.js';
import { interpolateOklchDefaultInto } from '../scale/legacy.js';

/**
 * Lighten a color by moving its OKLCH lightness toward white by a fraction
 * of the remaining distance: `l + amount * (1 - l)`, clamped to `[0, 1]`.
 * Chroma, hue and alpha are unchanged, and the result is not gamut mapped.
 *
 * @param color - Color to lighten
 * @param amount - Fraction of the distance to white (`0-1`)
 * @returns A new Color
 * @see {@link darken}
 *
 * @example
 * ```ts
 * import { lighten, parse } from 'color-kit';
 *
 * lighten(parse('oklch(0.6 0.1 250)'), 0.5); // → { l: 0.8, c: 0.1, h: 250, alpha: 1 }
 * ```
 */
export function lighten(color: Color, amount: number): Color {
  return {
    ...color,
    l: clamp(color.l + amount * (1 - color.l), 0, 1),
  };
}

/**
 * Darken a color by scaling its OKLCH lightness toward black:
 * `l * (1 - amount)`, clamped to `[0, 1]`. Chroma, hue and alpha are
 * unchanged, and the result is not gamut mapped.
 *
 * @param color - Color to darken
 * @param amount - Fraction of the lightness to remove (`0-1`)
 * @returns A new Color
 * @see {@link lighten}
 *
 * @example
 * ```ts
 * import { darken, parse } from 'color-kit';
 *
 * darken(parse('oklch(0.6 0.1 250)'), 0.5); // → { l: 0.3, c: 0.1, h: 250, alpha: 1 }
 * ```
 */
export function darken(color: Color, amount: number): Color {
  return {
    ...color,
    l: clamp(color.l - amount * color.l, 0, 1),
  };
}

/**
 * OKLCH chroma span that {@link saturate} scales `amount` by: the default
 * chroma range of OKLCH planes and sliders (`0-0.4`), which covers Display
 * P3 (peak ≈ 0.37). It is a step size, not a cap.
 */
const SATURATE_CHROMA_SPAN = 0.4;

/**
 * Increase chroma by an absolute fraction of the OKLCH chroma range:
 * adds `amount * 0.4`, clamped below at `0`. Note this is not the relative
 * scaling that {@link desaturate} applies. Like {@link lighten}, only the
 * channel's own domain is enforced: chroma has no upper bound, so wide-gamut
 * colors (Display P3, Rec. 2020) keep or gain chroma beyond `0.4`. The
 * result is not gamut mapped; pass it to `toSrgbGamut` or `toP3Gamut` to
 * fit a display.
 *
 * @param color - Color to saturate
 * @param amount - Fraction of the `0-0.4` chroma range to add (negative
 * values remove chroma)
 * @returns A new Color
 * @see {@link desaturate}
 *
 * @example
 * ```ts
 * import { parse, saturate } from 'color-kit';
 *
 * saturate(parse('oklch(0.7 0.1 250)'), 0.25); // → { l: 0.7, c: 0.2, h: 250, alpha: 1 }
 * saturate(parse('oklch(0.85 0.36 145)'), 0.25).c; // → ≈ 0.46 (not capped at 0.4)
 * ```
 */
export function saturate(color: Color, amount: number): Color {
  return {
    ...color,
    c: Math.max(0, color.c + amount * SATURATE_CHROMA_SPAN),
  };
}

/**
 * Decrease chroma by a relative amount: `c * (1 - amount)`, clamped below at
 * `0`. There is no upper cap, so `amount = 0` returns the input chroma
 * unchanged even for wide-gamut colors above `0.4`. Lightness, hue and
 * alpha are unchanged.
 *
 * @param color - Color to desaturate
 * @param amount - Fraction of the chroma to remove (`0-1`)
 * @returns A new Color
 * @see {@link saturate}
 * @see {@link grayscale}
 *
 * @example
 * ```ts
 * import { desaturate, parse } from 'color-kit';
 *
 * desaturate(parse('oklch(0.7 0.2 250)'), 0.5); // → { l: 0.7, c: 0.1, h: 250, alpha: 1 }
 * ```
 */
export function desaturate(color: Color, amount: number): Color {
  return {
    ...color,
    c: Math.max(0, color.c - amount * color.c),
  };
}

/**
 * Rotate the OKLCH hue by `degrees` (positive or negative), wrapping into
 * `[0, 360)`. Lightness, chroma and alpha are unchanged.
 *
 * @param color - Color to rotate
 * @param degrees - Hue offset in degrees
 * @returns A new Color
 * @see {@link complementary}
 *
 * @example
 * ```ts
 * import { adjustHue, parse } from 'color-kit';
 *
 * adjustHue(parse('oklch(0.7 0.1 300)'), 90); // → { l: 0.7, c: 0.1, h: 30, alpha: 1 }
 * ```
 */
export function adjustHue(color: Color, degrees: number): Color {
  return {
    ...color,
    h: normalizeHue(color.h + degrees),
  };
}

/**
 * Return a copy of `color` with its alpha set to `alpha`, clamped to
 * `[0, 1]`.
 *
 * @param color - Color to copy
 * @param alpha - New opacity (`0` transparent to `1` opaque)
 * @returns A new Color
 *
 * @example
 * ```ts
 * import { parse, setAlpha, toCss } from 'color-kit';
 *
 * toCss(setAlpha(parse('#3b82f6'), 0.5), 'rgb'); // → 'rgb(59 130 246 / 0.5)'
 * ```
 */
export function setAlpha(color: Color, alpha: number): Color {
  return {
    ...color,
    alpha: clamp(alpha, 0, 1),
  };
}

/**
 * Mix two colors together.
 * t = 0 returns color1, t = 1 returns color2.
 * Default t = 0.5 (equal mix).
 *
 * Without `options` this interpolates L, C, hue (shortest path) and alpha
 * as plain OKLCH channels, exactly like option-less `interpolate()`. In
 * every mode a powerless (achromatic) hue — chroma at or below
 * `ACHROMATIC_CHROMA_THRESHOLD` — takes the other color's hue, so mixing
 * white into blue stays blue. Without `options` that includes `t = 0` and
 * `t = 1`: an achromatic endpoint comes back with its own L, C and alpha but
 * the other color's hue (CSS Color 4 missing-hue semantics), keeping the hue
 * continuous in `t`, whereas `{ space: 'oklch' }` returns exact endpoints.
 * Passing `options` switches to CSS Color 4
 * `color-mix()` semantics in the chosen space: `options.hue` picks the hue
 * arc, and rectangular spaces interpolate with premultiplied alpha. Results
 * are not gamut mapped.
 *
 * @param color1 - First color; returned when `t = 0`
 * @param color2 - Second color; returned when `t = 1`
 * @param t - Mix position (default `0.5`)
 * @param options - Interpolation space, hue method, and alpha handling
 * @param options.space - `'oklch'` (default), `'oklab'`, `'srgb'`,
 *   `'linear-srgb'`, `'display-p3'`, or `'linear-p3'`
 * @param options.hue - Hue arc for polar spaces: `'shorter'` (default),
 *   `'longer'`, `'increasing'`, or `'decreasing'`
 * @param options.premultiplied - Premultiply alpha (default `true` for
 *   rectangular spaces, `false` for `'oklch'`)
 *
 * @example
 * ```ts
 * import { mix, parse, toHex } from 'color-kit';
 *
 * const red = parse('#ff0000');
 * const lime = parse('#00ff00');
 * toHex(mix(red, lime)); // → '#f99500' (OKLCH midpoint, legacy default)
 * // Physically correct (linear-light) blend, like mixing light:
 * toHex(mix(red, lime, 0.5, { space: 'linear-srgb' })); // → '#bcbc00'
 * // Gamma-encoded blend, like color-mix(in srgb, red, lime):
 * toHex(mix(red, lime, 0.5, { space: 'srgb' })); // → '#7f8000'
 * ```
 */
export function mix(
  color1: Color,
  color2: Color,
  t: number = 0.5,
  options?: InterpolationOptions,
): Color {
  return mixInto({ l: 0, c: 0, h: 0, alpha: 1 }, color1, color2, t, options);
}

/**
 * Allocation-free `mix()`: writes the mix of `color1` and `color2` into `out`
 * and returns it. Same semantics and bit-identical results as `mix()`,
 * including the option-less OKLCH path. `out` may be the same object
 * as either input, so `mixInto(a, a, b, t)` blends `b` into `a` in place.
 *
 * @param out - Color to write the result into
 * @param color1 - First color; returned when `t = 0`
 * @param color2 - Second color; returned when `t = 1`
 * @param t - Mix position (default `0.5`)
 * @param options - Interpolation space, hue method, and alpha handling (see
 *   `mix()`)
 *
 * @example
 * ```ts
 * import { mixInto, parse } from 'color-kit';
 *
 * const red = parse('#ff0000');
 * const lime = parse('#00ff00');
 * const out = { l: 0, c: 0, h: 0, alpha: 1 };
 * for (let i = 0; i <= 100; i++) {
 *   mixInto(out, red, lime, i / 100, { space: 'linear-srgb' });
 *   // ...use out without allocating per step
 * }
 * ```
 */
export function mixInto(
  out: Color,
  color1: Color,
  color2: Color,
  t: number = 0.5,
  options?: InterpolationOptions,
): Color {
  if (hasInterpolationOptions(options)) {
    return interpolateInSpaceInto(out, color1, color2, t, options);
  }

  return interpolateOklchDefaultInto(out, color1, color2, t);
}

/**
 * Invert a color in OKLCH: lightness becomes `1 - l` and the hue rotates
 * 180°, while chroma and alpha are kept. This is a perceptual inversion,
 * not an sRGB channel inversion, and the result is not gamut mapped.
 *
 * @param color - Color to invert
 * @returns A new Color
 * @see {@link complementary}
 *
 * @example
 * ```ts
 * import { invert, parse } from 'color-kit';
 *
 * invert(parse('oklch(0.3 0.1 30)')); // → { l: 0.7, c: 0.1, h: 210, alpha: 1 }
 * ```
 */
export function invert(color: Color): Color {
  return {
    l: 1 - color.l,
    c: color.c,
    h: normalizeHue(color.h + 180),
    alpha: color.alpha,
  };
}

/**
 * Remove all chroma (`c = 0`), keeping OKLCH lightness, hue and alpha, so
 * the gray has the same perceived lightness as the input.
 *
 * @param color - Color to desaturate fully
 * @returns A new Color
 * @see {@link desaturate}
 *
 * @example
 * ```ts
 * import { grayscale, parse, toHex } from 'color-kit';
 *
 * toHex(grayscale(parse('oklch(0.7 0.15 30)'))); // → '#9e9e9e'
 * ```
 */
export function grayscale(color: Color): Color {
  return {
    ...color,
    c: 0,
  };
}
