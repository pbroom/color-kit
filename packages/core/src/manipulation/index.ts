import type { Color } from '../types.js';
import { clamp, normalizeHue, lerp } from '../utils/index.js';
import {
  hasInterpolationOptions,
  interpolateInSpaceInto,
  type InterpolationOptions,
} from '../interpolation/index.js';

/** Increase lightness by a relative amount (0-1) */
export function lighten(color: Color, amount: number): Color {
  return {
    ...color,
    l: clamp(color.l + amount * (1 - color.l), 0, 1),
  };
}

/** Decrease lightness by a relative amount (0-1) */
export function darken(color: Color, amount: number): Color {
  return {
    ...color,
    l: clamp(color.l - amount * color.l, 0, 1),
  };
}

/**
 * Increase chroma by an absolute fraction of the chroma range:
 * adds `amount * 0.4`, clamped to `[0, 0.4]`. Note this is not the
 * relative scaling that `desaturate` applies.
 */
export function saturate(color: Color, amount: number): Color {
  return {
    ...color,
    c: clamp(color.c + amount * 0.4, 0, 0.4),
  };
}

/** Decrease chroma by a relative amount (0-1) */
export function desaturate(color: Color, amount: number): Color {
  return {
    ...color,
    c: clamp(color.c - amount * color.c, 0, 0.4),
  };
}

/** Adjust hue by a number of degrees */
export function adjustHue(color: Color, degrees: number): Color {
  return {
    ...color,
    h: normalizeHue(color.h + degrees),
  };
}

/** Set the alpha/opacity */
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
 * Without `options` this interpolates L, C, hue (shortest path, with no
 * achromatic special-casing) and alpha as plain OKLCH channels, exactly as
 * before `options` existed. Passing `options` switches to CSS Color 4
 * `color-mix()` semantics in the chosen space: powerless (achromatic) hues
 * take the other color's hue, `options.hue` picks the hue arc, and
 * rectangular spaces interpolate with premultiplied alpha. Results are not
 * gamut mapped.
 *
 * @param color1 - First color; returned when `t = 0`
 * @param color2 - Second color; returned when `t = 1`
 * @param t - Mix position (default `0.5`)
 * @param options - Interpolation space, hue method, and alpha handling
 * @param options.space - `'oklch'` (default), `'oklab'`, `'srgb'`,
 *   `'linear-srgb'`, `'p3'`, or `'linear-p3'`
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
 * toHex(mix(red, lime)); // OKLCH midpoint (legacy default)
 * // Physically correct (linear-light) blend, like mixing light:
 * toHex(mix(red, lime, 0.5, { space: 'linear-srgb' })); // '#bcbc00'
 * // Gamma-encoded blend, like color-mix(in srgb, red, lime):
 * mix(red, lime, 0.5, { space: 'srgb' }); // ≈ rgb(127.5 127.5 0)
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
 * including the option-less legacy OKLCH path. `out` may be the same object
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

  // Handle hue interpolation via shortest path
  let h1 = color1.h;
  let h2 = color2.h;
  const diff = h2 - h1;

  if (diff > 180) {
    h1 += 360;
  } else if (diff < -180) {
    h2 += 360;
  }

  const l = lerp(color1.l, color2.l, t);
  const c = lerp(color1.c, color2.c, t);
  const alpha = lerp(color1.alpha, color2.alpha, t);
  out.l = l;
  out.c = c;
  out.h = normalizeHue(lerp(h1, h2, t));
  out.alpha = alpha;
  return out;
}

/** Invert a color (complement lightness and hue) */
export function invert(color: Color): Color {
  return {
    l: 1 - color.l,
    c: color.c,
    h: normalizeHue(color.h + 180),
    alpha: color.alpha,
  };
}

/** Make a color fully grayscale (zero chroma) */
export function grayscale(color: Color): Color {
  return {
    ...color,
    c: 0,
  };
}
