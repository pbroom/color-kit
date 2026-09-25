import {
  generateScale,
  inSrgbGamut,
  mix,
  toHex,
  toLinearSrgbArray,
  toOklab,
  type Color,
  type InterpolationOptions,
} from 'color-kit';

export interface DemoRow {
  id: string;
  /** The options argument as written at the call site. */
  label: string;
  /** `undefined` means the option-less call: the legacy OKLCH default. */
  options: InterpolationOptions | undefined;
}

export const DEMO_ROWS: DemoRow[] = [
  { id: 'default', label: '(no options)', options: undefined },
  { id: 'oklch', label: "{ space: 'oklch' }", options: { space: 'oklch' } },
  { id: 'oklab', label: "{ space: 'oklab' }", options: { space: 'oklab' } },
  { id: 'srgb', label: "{ space: 'srgb' }", options: { space: 'srgb' } },
  {
    id: 'linear-srgb',
    label: "{ space: 'linear-srgb' }",
    options: { space: 'linear-srgb' },
  },
  { id: 'p3', label: "{ space: 'p3' }", options: { space: 'p3' } },
];

/** A stepped ramp from `a` to `b`. */
export function mixStrip(
  a: Color,
  b: Color,
  options: InterpolationOptions | undefined,
  steps = 13,
): string[] {
  const scale = options
    ? generateScale(a, b, steps, options)
    : generateScale(a, b, steps); // legacy default, no options
  return scale.map((color) => toHex(color));
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

/** The t = 0.5 mix of `a` and `b`, with its lightness numbers. */
export function midpointStats(
  a: Color,
  b: Color,
  options: InterpolationOptions | undefined,
): MidpointStats {
  const midpoint = options ? mix(a, b, 0.5, options) : mix(a, b); // default
  const [r, g, bl] = toLinearSrgbArray(midpoint, linear);
  return {
    hex: toHex(midpoint),
    oklabL: toOklab(midpoint).L,
    luminanceY: 0.2126 * r + 0.7152 * g + 0.0722 * bl,
    inSrgb: inSrgbGamut(midpoint),
  };
}
