import {
  generateScale,
  inSrgbGamut,
  mix,
  toHex,
  toLinearSrgbArray,
  toOklab,
  type Color,
  type InterpolationSpace,
} from 'color-kit';

export const DEMO_SPACES: InterpolationSpace[] = [
  'oklch',
  'oklab',
  'srgb',
  'linear-srgb',
  'p3',
];

/** A stepped ramp from `a` to `b`, interpolated in `space`. */
export function mixStrip(
  a: Color,
  b: Color,
  space: InterpolationSpace,
  steps = 13,
): string[] {
  return generateScale(a, b, steps, { space }).map((color) => toHex(color));
}

export interface MidpointStats {
  hex: string;
  /** OKLab lightness (perceived lightness). */
  oklabL: number;
  /** Relative luminance Y (linear light, Rec. 709 weights, unclamped). */
  luminanceY: number;
  inSrgb: boolean;
}

// Reused scratch tuple: toLinearSrgbArray writes into it, no allocation.
const linear: [number, number, number] = [0, 0, 0];

/** The t = 0.5 mix of `a` and `b` in `space`, with its lightness numbers. */
export function midpointStats(
  a: Color,
  b: Color,
  space: InterpolationSpace,
): MidpointStats {
  const midpoint = mix(a, b, 0.5, { space });
  const [r, g, bl] = toLinearSrgbArray(midpoint, linear);
  return {
    hex: toHex(midpoint),
    oklabL: toOklab(midpoint).L,
    luminanceY: 0.2126 * r + 0.7152 * g + 0.0722 * bl,
    inSrgb: inSrgbGamut(midpoint),
  };
}
