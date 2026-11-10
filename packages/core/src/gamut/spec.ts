import { A98_RGB_GAMMA } from '../conversion/a98-rgb.js';
import {
  LINEAR_A98_RGB_TO_LINEAR_SRGB,
  LINEAR_P3_TO_LINEAR_SRGB,
  LINEAR_REC2020_TO_LINEAR_SRGB,
  LINEAR_SRGB_TO_LINEAR_A98_RGB,
  LINEAR_SRGB_TO_LINEAR_P3,
  LINEAR_SRGB_TO_LINEAR_REC2020,
  LMS_TO_LINEAR_A98_RGB,
  LMS_TO_LINEAR_P3,
  LMS_TO_LINEAR_REC2020,
  LMS_TO_LINEAR_SRGB,
  type Matrix3,
} from '../conversion/matrices.js';
import {
  A98_RGB_LINEAR_MAX,
  A98_RGB_LINEAR_MIN,
  GAMUT_LINEAR_MAX,
  GAMUT_LINEAR_MIN,
  REC2020_LINEAR_MAX,
  REC2020_LINEAR_MIN,
} from './linear-bounds.js';

/**
 * Transfer curve of a {@link Gamut}, as plain numbers (CSS Color 4 / ICC
 * parametric form), mirrored through zero for negative channels.
 *
 * Decoding (gamma-encoded `x` to linear light), for `x >= 0`:
 * `x <= d ? x / c : ((x + b) / a) ** g`.
 *
 * Encoding (linear light `y` to gamma-encoded), for `y >= 0`:
 * `y <= e ? c * y : a * y ** (1 / g) - b`.
 *
 * A curve with no linear segment (a pure power, as Rec. 2020 and Adobe RGB
 * (1998) use) sets
 * `d` and `e` to `-1`, so the power branch always runs.
 */
export interface GamutTransfer {
  /** Exponent of the power segment. */
  readonly g: number;
  /** Scale of the power segment (`1.055` for sRGB). */
  readonly a: number;
  /** Offset of the power segment (`0.055` for sRGB). */
  readonly b: number;
  /** Slope of the linear segment near zero (`12.92` for sRGB). */
  readonly c: number;
  /** Largest encoded value on the linear segment (`0.04045` for sRGB). */
  readonly d: number;
  /** Largest linear-light value on the linear segment (`0.0031308` for sRGB). */
  readonly e: number;
}

/**
 * An RGB gamut, as plain data: the value of every `gamut` option.
 *
 * Import a built-in ({@link srgb}, {@link displayP3}, {@link a98Rgb},
 * {@link rec2020}) or write your own object of this shape; the library treats both the same
 * way, and a bundle only contains the gamuts it imports. A descriptor holds
 * numbers, arrays and a string only, so it survives `structuredClone` and
 * `postMessage`.
 *
 * Gamuts are identified by {@link Gamut.id}, never by object identity: two
 * descriptors with the same `id` share caches and must describe the same
 * gamut. Give a custom gamut an `id` of its own.
 *
 * The built-in gamuts are not strictly nested. sRGB lies inside the others
 * and Adobe RGB (1998) inside Rec. 2020, but Display P3 and Adobe RGB (1998)
 * each hold colors the other lacks (P3 more red, Adobe RGB more green and
 * cyan), and two thin slivers of Display P3 lie outside Rec. 2020: around the P3
 * red primary (`color(display-p3 1 0 0)` is
 * `color(rec2020 0.889 0.277 -0.061)`) and, opposite it, around P3 cyan
 * near white. The largest difference is about 0.002 OKLCH chroma.
 *
 * Membership tolerance also differs per gamut (see `GAMUT_EPSILON`): for
 * very dark colors (OKLCH lightness below about 0.05 for sRGB, 0.15 for
 * Display P3) their tolerance covers more chroma than the Rec. 2020 one, so
 * a boundary reported for them can sit outside the Rec. 2020 boundary there.
 * The same holds for sRGB against Adobe RGB (1998), whose curve has no
 * linear segment either.
 *
 * @example
 * ```ts
 * import { displayP3, maxChromaAt, rec2020, type Gamut } from '@pbroom/color-kit';
 *
 * maxChromaAt(0.6, 250, { gamut: displayP3 }); // → 0.21923828125
 * const wide: Gamut = { ...rec2020, id: 'my-rec2020' };
 * maxChromaAt(0.6, 250, { gamut: wide }); // → 0.24578857421875
 * ```
 */
export interface Gamut {
  /**
   * Unique name of the gamut. Caches and special cases key on it, so two
   * different gamuts must not share an id. The built-in ids are the CSS
   * `color()` space names: `'srgb'`, `'display-p3'`, `'a98-rgb'` and
   * `'rec2020'`.
   */
  readonly id: string;
  /**
   * OKLab LMS (cone response, after cubing) -> unclamped linear RGB of this
   * gamut. These rows are the coefficients of every analytic solver: the
   * hue-cusp cubic, the plane gamut-region field and the contrast-region
   * rays.
   */
  readonly lmsToLinear: Matrix3;
  /** Linear sRGB -> linear RGB of this gamut; `null` for sRGB primaries. */
  readonly fromLinearSrgb: Matrix3 | null;
  /** Linear RGB of this gamut -> linear sRGB; `null` for sRGB primaries. */
  readonly toLinearSrgb: Matrix3 | null;
  /**
   * Transfer curve between the gamut's gamma-encoded and linear-light
   * channels. Read where channels are quantized in the gamut's own encoding
   * (contrast metrics with `precision: '8bit'`).
   */
  readonly transfer: GamutTransfer;
  /**
   * Lower linear-light membership bound: the transfer curve's decoding of
   * `-GAMUT_EPSILON`. Precomputed (for the built-ins in `linear-bounds.ts`)
   * so membership tests never evaluate the curve.
   */
  readonly linearMin: number;
  /**
   * Upper linear-light membership bound: the transfer curve's decoding of
   * `1 + GAMUT_EPSILON`.
   */
  readonly linearMax: number;
  /**
   * Default upper chroma bound of searches in this gamut (`maxChromaAt`,
   * boundary paths, contrast regions, full-scope plane bounds). Must exceed
   * the gamut's largest OKLCH chroma: about 0.323 for sRGB, 0.366 for
   * Display P3, 0.395 for Adobe RGB (1998) and 0.468 for Rec. 2020 (the
   * last three at their green primaries).
   */
  readonly maxChroma: number;
}

/**
 * The sRGB transfer curve, shared by {@link srgb} and {@link displayP3}.
 * Evaluates bit for bit like `srgbToLinearChannel` / `linearToSrgbChannel`.
 */
const SRGB_TRANSFER: GamutTransfer = {
  g: 2.4,
  a: 1.055,
  b: 0.055,
  c: 12.92,
  d: 0.04045,
  e: 0.0031308,
};

/**
 * The sRGB gamut: the default of every `gamut` option.
 *
 * @example
 * ```ts
 * import { inGamut, srgb } from '@pbroom/color-kit';
 *
 * inGamut({ l: 0.7, c: 0.1, h: 150, alpha: 1 }, srgb); // → true
 * ```
 */
export const srgb: Gamut = {
  id: 'srgb',
  lmsToLinear: LMS_TO_LINEAR_SRGB,
  fromLinearSrgb: null,
  toLinearSrgb: null,
  transfer: SRGB_TRANSFER,
  linearMin: GAMUT_LINEAR_MIN,
  linearMax: GAMUT_LINEAR_MAX,
  maxChroma: 0.4,
};

/**
 * The Display P3 gamut: its own primaries with the sRGB transfer curve.
 *
 * @example
 * ```ts
 * import { displayP3, maxChromaAt } from '@pbroom/color-kit';
 *
 * maxChromaAt(0.6, 250, { gamut: displayP3 }); // → 0.21923828125
 * ```
 */
export const displayP3: Gamut = {
  id: 'display-p3',
  lmsToLinear: LMS_TO_LINEAR_P3,
  fromLinearSrgb: LINEAR_SRGB_TO_LINEAR_P3,
  toLinearSrgb: LINEAR_P3_TO_LINEAR_SRGB,
  transfer: SRGB_TRANSFER,
  linearMin: GAMUT_LINEAR_MIN,
  linearMax: GAMUT_LINEAR_MAX,
  maxChroma: 0.4,
};

/**
 * The Rec. 2020 gamut (ITU-R BT.2020 primaries, D65) with the CSS Color 4
 * transfer curve, a sign-mirrored 2.4 power.
 *
 * @example
 * ```ts
 * import { maxChromaAt, rec2020 } from '@pbroom/color-kit';
 *
 * maxChromaAt(0.6, 250, { gamut: rec2020 }); // → 0.24578857421875
 * ```
 */
export const rec2020: Gamut = {
  id: 'rec2020',
  lmsToLinear: LMS_TO_LINEAR_REC2020,
  fromLinearSrgb: LINEAR_SRGB_TO_LINEAR_REC2020,
  toLinearSrgb: LINEAR_REC2020_TO_LINEAR_SRGB,
  transfer: { g: 2.4, a: 1, b: 0, c: 1, d: -1, e: -1 },
  linearMin: REC2020_LINEAR_MIN,
  linearMax: REC2020_LINEAR_MAX,
  maxChroma: 0.5,
};

/**
 * The Adobe RGB (1998) gamut (CSS `a98-rgb`): the sRGB red and blue
 * primaries with a more saturated green, D65, and a sign-mirrored
 * `563 / 256` power transfer curve.
 *
 * Its largest OKLCH chroma is 0.3947 (the green primary), so the default
 * `maxChroma` of 0.4, the sRGB and Display P3 one, clears it.
 *
 * @example
 * ```ts
 * import { a98Rgb, maxChromaAt } from '@pbroom/color-kit';
 *
 * maxChromaAt(0.8, 150, { gamut: a98Rgb }); // → 0.367578125
 * ```
 */
export const a98Rgb: Gamut = {
  id: 'a98-rgb',
  lmsToLinear: LMS_TO_LINEAR_A98_RGB,
  fromLinearSrgb: LINEAR_SRGB_TO_LINEAR_A98_RGB,
  toLinearSrgb: LINEAR_A98_RGB_TO_LINEAR_SRGB,
  transfer: { g: A98_RGB_GAMMA, a: 1, b: 0, c: 1, d: -1, e: -1 },
  linearMin: A98_RGB_LINEAR_MIN,
  linearMax: A98_RGB_LINEAR_MAX,
  maxChroma: 0.4,
};
