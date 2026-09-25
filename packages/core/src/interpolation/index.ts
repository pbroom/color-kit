/**
 * Color interpolation in a caller-chosen space, following CSS Color 4
 * `color-mix()` / gradient interpolation semantics.
 *
 * This module backs the optional `options` argument of `mix()`,
 * `interpolate()`, and `generateScale()`. When those functions are called
 * without options they keep their original OKLCH behavior and never reach
 * this code.
 *
 * @see https://www.w3.org/TR/css-color-4/#interpolation
 */

import type { Color, LinearRgb, Oklab } from '../types.js';
import {
  lerp,
  linearToSrgbChannel,
  normalizeHue,
  srgbToLinearChannel,
} from '../utils/index.js';
import { linearRgbToOklab, oklabToLinearRgb } from '../conversion/oklab.js';
import { oklabToOklch, oklchToOklab } from '../conversion/oklch.js';
import {
  linearP3ToLinearSrgb,
  linearSrgbToLinearP3,
} from '../conversion/p3.js';

/**
 * Color space to interpolate in.
 *
 * | Value           | CSS `color-mix(in …)` | Kind                        |
 * | --------------- | --------------------- | --------------------------- |
 * | `'oklch'`       | `oklch`               | polar (hue option applies)  |
 * | `'oklab'`       | `oklab`               | rectangular                 |
 * | `'srgb'`        | `srgb`                | rectangular, gamma-encoded  |
 * | `'linear-srgb'` | `srgb-linear`         | rectangular, linear light   |
 * | `'p3'`          | `display-p3`          | rectangular, gamma-encoded  |
 * | `'linear-p3'`   | `display-p3-linear`   | rectangular, linear light   |
 *
 * The two linear-light spaces are linear transforms of each other, so they
 * produce the same mix (to float precision); both are offered so callers
 * can name the space their renderer works in.
 */
export type InterpolationSpace =
  | 'oklch'
  | 'oklab'
  | 'srgb'
  | 'linear-srgb'
  | 'p3'
  | 'linear-p3';

/**
 * CSS Color 4 hue interpolation method. Only used by polar spaces
 * (`'oklch'`); ignored for rectangular spaces.
 *
 * @see https://www.w3.org/TR/css-color-4/#hue-interpolation
 */
export type HueInterpolationMethod =
  | 'shorter'
  | 'longer'
  | 'increasing'
  | 'decreasing';

/** Options accepted by `mix()`, `interpolate()`, and `generateScale()`. */
export interface InterpolationOptions {
  /**
   * Space to interpolate in.
   * @default 'oklch'
   */
  space?: InterpolationSpace;
  /**
   * Hue interpolation method for polar spaces. Ignored for rectangular
   * spaces.
   * @default 'shorter'
   */
  hue?: HueInterpolationMethod;
  /**
   * Interpolate with premultiplied alpha, as CSS `color-mix()` does.
   * Hue is never premultiplied.
   *
   * Defaults to `true` for rectangular spaces (matching CSS) and `false` for
   * `'oklch'`, so `{ space: 'oklch' }` keeps the straight-alpha channel
   * interpolation of the option-less call. Pass `true` with `'oklch'` for
   * full CSS parity when the endpoints have different alphas.
   */
  premultiplied?: boolean;
}

/**
 * OKLCH chroma at or below which the hue is powerless: the CSS Color 4 OKLCH
 * epsilon (`OKLab_to_OKLCH` in the spec's sample code uses
 * `chroma <= 0.000004`). A powerless endpoint takes the other endpoint's hue.
 * Only the option-driven (CSS) path uses this; the option-less legacy
 * `interpolate()` keeps its own `0.001` cutoff.
 */
export const ACHROMATIC_CHROMA_THRESHOLD = 0.000004;

type Vec3 = [number, number, number];

/** Sign-preserving (extended-range) sRGB / Display P3 transfer functions. */
function encodeChannel(value: number): number {
  return value < 0 ? -linearToSrgbChannel(-value) : linearToSrgbChannel(value);
}

function decodeChannel(value: number): number {
  return value < 0 ? -srgbToLinearChannel(-value) : srgbToLinearChannel(value);
}

function isPowerless(color: Color): boolean {
  return !(color.c > ACHROMATIC_CHROMA_THRESHOLD) || !Number.isFinite(color.h);
}

/**
 * Apply the CSS Color 4 hue fix-up to a pair of hues already normalized to
 * `[0, 360)`.
 */
export function fixupHues(
  h1: number,
  h2: number,
  method: HueInterpolationMethod,
): [number, number] {
  const diff = h2 - h1;
  switch (method) {
    case 'increasing':
      if (diff < 0) h2 += 360;
      break;
    case 'decreasing':
      if (diff > 0) h1 += 360;
      break;
    case 'longer':
      if (diff > 0 && diff < 180) h1 += 360;
      else if (diff > -180 && diff <= 0) h2 += 360;
      break;
    default:
      if (diff > 180) h1 += 360;
      else if (diff < -180) h2 += 360;
  }
  return [h1, h2];
}

function toLinearSrgb(color: Color): LinearRgb {
  return oklabToLinearRgb(oklchToOklab(color));
}

function toSpaceCoords(color: Color, space: InterpolationSpace): Vec3 {
  if (space === 'oklab') {
    const lab = oklchToOklab(color);
    return [lab.L, lab.a, lab.b];
  }
  const linear =
    space === 'p3' || space === 'linear-p3'
      ? linearSrgbToLinearP3(toLinearSrgb(color))
      : toLinearSrgb(color);
  if (space === 'srgb' || space === 'p3') {
    return [
      encodeChannel(linear.r),
      encodeChannel(linear.g),
      encodeChannel(linear.b),
    ];
  }
  return [linear.r, linear.g, linear.b];
}

function fromSpaceCoords(
  coords: Vec3,
  alpha: number,
  space: InterpolationSpace,
): Color {
  let lab: Oklab;
  if (space === 'oklab') {
    lab = { L: coords[0], a: coords[1], b: coords[2], alpha };
  } else {
    let [r, g, b] = coords;
    if (space === 'srgb' || space === 'p3') {
      r = decodeChannel(r);
      g = decodeChannel(g);
      b = decodeChannel(b);
    }
    let linear: LinearRgb = { r, g, b, alpha };
    if (space === 'p3' || space === 'linear-p3') {
      linear = linearP3ToLinearSrgb(linear);
    }
    lab = linearRgbToOklab(linear);
  }
  const { l, c, h } = oklabToOklch(lab);
  return { l, c, h, alpha };
}

function inUnitRange(value: number): boolean {
  return value >= 0 && value <= 1;
}

function mixPolar(
  color1: Color,
  color2: Color,
  t: number,
  hue: HueInterpolationMethod,
  premultiplied: boolean,
): Color {
  const powerless1 = isPowerless(color1);
  const powerless2 = isPowerless(color2);

  // A powerless (achromatic) hue takes the other endpoint's hue, so the hue
  // stays constant along the mix. As in colorjs.io, no arc is added in that
  // case, so `'longer'` does not turn a grey-to-color mix into a full sweep.
  let h: number;
  if (powerless1 && powerless2) {
    h = 0;
  } else if (powerless1) {
    h = normalizeHue(color2.h);
  } else if (powerless2) {
    h = normalizeHue(color1.h);
  } else {
    const [h1, h2] = fixupHues(
      normalizeHue(color1.h),
      normalizeHue(color2.h),
      hue,
    );
    h = normalizeHue(lerp(h1, h2, t));
  }

  const alpha = lerp(color1.alpha, color2.alpha, t);
  if (!premultiplied) {
    return {
      l: lerp(color1.l, color2.l, t),
      c: lerp(color1.c, color2.c, t),
      h,
      alpha,
    };
  }

  const a1 = color1.alpha;
  const a2 = color2.alpha;
  const scale = alpha === 0 ? 1 : 1 / alpha;
  return {
    l: lerp(color1.l * a1, color2.l * a2, t) * scale,
    c: lerp(color1.c * a1, color2.c * a2, t) * scale,
    h,
    alpha,
  };
}

function mixRectangular(
  color1: Color,
  color2: Color,
  t: number,
  space: InterpolationSpace,
  premultiplied: boolean,
): Color {
  const p = toSpaceCoords(color1, space);
  const q = toSpaceCoords(color2, space);
  const a1 = premultiplied ? color1.alpha : 1;
  const a2 = premultiplied ? color2.alpha : 1;
  const alpha = lerp(color1.alpha, color2.alpha, t);
  const scale = !premultiplied || alpha === 0 ? 1 : 1 / alpha;
  // Only a true in-between mix (0 <= t <= 1) is a convex combination.
  const clampNoise = space !== 'oklab' && t >= 0 && t <= 1;

  const out: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i += 1) {
    let value = lerp(p[i] * a1, q[i] * a2, t) * scale;
    // Rectangular RGB interpolation of two in-range channels is a convex
    // combination, so the exact result is in range; clamp only to remove
    // float noise. Out-of-range (extended) inputs are left unclamped.
    if (clampNoise && inUnitRange(p[i]) && inUnitRange(q[i])) {
      value = Math.min(Math.max(value, 0), 1);
    }
    out[i] = value;
  }
  return fromSpaceCoords(out, alpha, space);
}

/**
 * Interpolate two colors in the given space with CSS Color 4 semantics.
 * `t = 0` returns (a round trip of) `color1`, `t = 1` returns `color2`;
 * values outside `[0, 1]` extrapolate.
 *
 * Results are not gamut mapped. Interpolating two in-gamut colors in
 * `'srgb'` / `'linear-srgb'` stays inside sRGB, and in `'p3'` / `'linear-p3'`
 * stays inside Display P3. Extended-range (out-of-gamut) inputs keep their
 * negative or >1 channel values through the mix, so the result can also be
 * out of gamut; OKLCH and OKLab mixes of in-gamut colors can leave the gamut
 * too. Use `toSrgbGamut()` / `toP3Gamut()` when a displayable color is needed.
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * // Physically correct (linear-light) 50/50 blend of red and lime.
 * interpolateInSpace(parse('#f00'), parse('#0f0'), 0.5, {
 *   space: 'linear-srgb',
 * });
 * ```
 */
export function interpolateInSpace(
  color1: Color,
  color2: Color,
  t: number,
  options: InterpolationOptions = {},
): Color {
  const space = options.space ?? 'oklch';
  if (space === 'oklch') {
    return mixPolar(
      color1,
      color2,
      t,
      options.hue ?? 'shorter',
      options.premultiplied ?? false,
    );
  }
  return mixRectangular(
    color1,
    color2,
    t,
    space,
    options.premultiplied ?? true,
  );
}

/** True when an options object requests anything beyond the legacy default. */
export function hasInterpolationOptions(
  options: InterpolationOptions | undefined,
): options is InterpolationOptions {
  return (
    options !== undefined &&
    (options.space !== undefined ||
      options.hue !== undefined ||
      options.premultiplied !== undefined)
  );
}
