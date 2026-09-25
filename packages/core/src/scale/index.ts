import type { Color } from '../types.js';
import { lerp } from '../utils/index.js';
import {
  hasInterpolationOptions,
  interpolateInSpace,
  type InterpolationOptions,
} from '../interpolation/index.js';
import {
  generateOklchDefaultScale,
  interpolateOklchDefault,
  sampleScale,
} from './legacy.js';

/**
 * Interpolate between two Colors.
 * t = 0 returns color1, t = 1 returns color2.
 *
 * Without `options` this interpolates OKLCH channels with the hue taking the
 * shortest path around the wheel (endpoints with chroma below `0.001` borrow
 * the other endpoint's hue), exactly as before `options` existed. Passing
 * `options` switches to CSS Color 4 interpolation in the chosen space; see
 * `mix()` for the option details.
 *
 * @param color1 - Start color
 * @param color2 - End color
 * @param t - Interpolation position; values outside `[0, 1]` extrapolate
 * @param options - Interpolation space, hue method, and alpha handling
 * @param options.space - `'oklch'` (default), `'oklab'`, `'srgb'`,
 *   `'linear-srgb'`, `'p3'`, or `'linear-p3'`
 * @param options.hue - Hue arc for polar spaces (default `'shorter'`)
 * @param options.premultiplied - Premultiply alpha (default `true` for
 *   rectangular spaces, `false` for `'oklch'`)
 *
 * @example
 * ```ts
 * import { interpolate, parse } from 'color-kit';
 *
 * const a = parse('#3b82f6');
 * const b = parse('#ef4444');
 * interpolate(a, b, 0.25);
 * interpolate(a, b, 0.25, { space: 'oklch', hue: 'longer' });
 * ```
 */
export function interpolate(
  color1: Color,
  color2: Color,
  t: number,
  options?: InterpolationOptions,
): Color {
  if (hasInterpolationOptions(options)) {
    return interpolateInSpace(color1, color2, t, options);
  }

  return interpolateOklchDefault(color1, color2, t);
}

/**
 * Generate a color scale (array of colors) between two endpoints.
 * The scale includes both endpoints.
 *
 * @param from - Starting color
 * @param to - Ending color
 * @param steps - Number of colors in the scale (minimum 2)
 * @param options - Interpolation options forwarded to `interpolate()`
 *
 * @example
 * ```ts
 * import { generateScale, parse } from 'color-kit';
 *
 * generateScale(parse('#0f172a'), parse('#f8fafc'), 7);
 * generateScale(parse('#f00'), parse('#00f'), 5, { space: 'linear-srgb' });
 * ```
 */
export function generateScale(
  from: Color,
  to: Color,
  steps: number,
  options?: InterpolationOptions,
): Color[] {
  if (!hasInterpolationOptions(options)) {
    return generateOklchDefaultScale(from, to, steps);
  }
  return sampleScale(steps, (t) => interpolateInSpace(from, to, t, options));
}

/**
 * Generate a lightness scale for a given hue/chroma.
 * Creates a scale from dark to light while preserving hue and chroma.
 *
 * @param color - Base color (hue and chroma are preserved)
 * @param steps - Number of stops in the scale
 * @param range - Lightness range [min, max], defaults to [0.05, 0.95]
 */
export function lightnessScale(
  color: Color,
  steps: number = 11,
  range: [number, number] = [0.05, 0.95],
): Color[] {
  if (steps < 2) {
    throw new Error('Lightness scale must have at least 2 steps');
  }

  const [minL, maxL] = range;
  const colors: Color[] = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    colors.push({
      l: lerp(minL, maxL, t),
      c: color.c,
      h: color.h,
      alpha: color.alpha,
    });
  }

  return colors;
}
