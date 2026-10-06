/**
 * Unrounded sRGB-based conversions for `toHsl` / `toHsv` / `toHct`.
 *
 * These clip to the sRGB gamut like `toRgb()` but skip its 8-bit rounding,
 * so fractional colors keep full precision. 8-bit inputs land within float
 * noise (~1e-12) of the old byte-based results.
 */
import {
  Cam16,
  ViewingConditions,
  lstarFromY,
} from '@material/material-color-utilities';
import type { Color, Hct, LinearRgb, Rgb } from '../types.js';
import { clamp, linearToSrgbChannel } from '../utils/index.js';
import { toLinearSrgbInto } from './into.js';

const LINEAR: LinearRgb = { r: 0, g: 0, b: 0, alpha: 1 };

/**
 * sRGB (0-255) of `color`, clipped to the gamut like `toRgb()` but not
 * rounded to integers.
 */
export function toRgbUnrounded(color: Color): Rgb {
  const linear = toLinearSrgbInto(LINEAR, color);
  return {
    r: clamp(linearToSrgbChannel(linear.r), 0, 1) * 255,
    g: clamp(linearToSrgbChannel(linear.g), 0, 1) * 255,
    b: clamp(linearToSrgbChannel(linear.b), 0, 1) * 255,
    alpha: color.alpha,
  };
}

/**
 * HCT of `color` from its unrounded, sRGB-clipped value. Same math as
 * Material's `Hct.fromInt()` (its sRGB -> XYZ matrix, default viewing
 * conditions, `lstarFromY` tone) without first quantizing to an ARGB int.
 */
export function toHctUnrounded(color: Color): Hct {
  const linear = toLinearSrgbInto(LINEAR, color);
  // Material works in linear channels scaled to 0-100.
  const r = clamp(linear.r, 0, 1) * 100;
  const g = clamp(linear.g, 0, 1) * 100;
  const b = clamp(linear.b, 0, 1) * 100;
  const x = 0.41233895 * r + 0.35762064 * g + 0.18051042 * b;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = 0.01932141 * r + 0.11916382 * g + 0.95034478 * b;
  const cam = Cam16.fromXyzInViewingConditions(
    x,
    y,
    z,
    ViewingConditions.DEFAULT,
  );
  return {
    h: cam.hue,
    c: cam.chroma,
    t: lstarFromY(y),
    alpha: color.alpha,
  };
}
