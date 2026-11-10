import { a98RgbToLinearChannel } from '../conversion/a98-rgb.js';
import { rec2020ToLinearChannel } from '../conversion/rec2020.js';
import { srgbToLinearChannel } from '../utils/index.js';
import { GAMUT_EPSILON } from './constants.js';

/*
 * Linear-light bounds of the gamut membership test, per transfer function.
 *
 * The membership rule is the CSS Color 4 / colorjs.io one: a color is in an
 * RGB gamut when each of its *gamma-encoded* channels is within
 * `[0 - GAMUT_EPSILON, 1 + GAMUT_EPSILON]` (colorjs.io `inGamut()`, default
 * epsilon 0.000075, tests the coordinates of the encoded space). color-kit
 * tests unclamped linear-light channels instead, so the encoded bounds are
 * pushed through each space's own inverse transfer function once, here:
 *
 *   linear min = linearize(-GAMUT_EPSILON)
 *   linear max = linearize(1 + GAMUT_EPSILON)
 *
 * The transfer functions are monotonic, so the linear test accepts exactly
 * the colors the encoded test accepts. A new gamut target adds its pair of
 * bounds here from its own transfer function; nothing else may re-derive
 * them.
 */

/**
 * Lower linear-light channel bound of the gamut membership test:
 * `-GAMUT_EPSILON / 12.92` (≈ -5.805e-6), the linear value of an encoded
 * channel at `-GAMUT_EPSILON`.
 *
 * Together with {@link GAMUT_LINEAR_MAX} these are the linear-light bounds
 * equivalent to allowing {@link GAMUT_EPSILON} of slack on the gamma-encoded
 * channels (the CSS Color 4 / colorjs.io convention). Both sRGB and Display
 * P3 share the sRGB transfer function, so the same bounds serve both gamuts.
 * Rec. 2020 has its own transfer function and its own bounds
 * (`REC2020_LINEAR_MIN` / `REC2020_LINEAR_MAX` in this module).
 *
 * Applying the epsilon directly in linear light (as earlier versions did)
 * is far too permissive near black: -7.5e-5 linear is -9.7e-4 encoded, which
 * let e.g. `oklch(0.028 0.066 131)` pass as in gamut when the true boundary
 * chroma is ~0.008.
 *
 * Every gamut membership test on unclamped linear channels (`inSrgbGamut`,
 * `inP3Gamut`, the plane gamut-region field) must use these bounds so the
 * APIs classify boundary colors identically.
 *
 * @see {@link isLinearRgbInGamut}
 */
export const GAMUT_LINEAR_MIN = -GAMUT_EPSILON / 12.92;
/**
 * Upper linear-light channel bound of the gamut membership test:
 * `linearize(1 + GAMUT_EPSILON)` (≈ 1.0001706), the sRGB transfer function
 * applied to an encoded channel of `1 + GAMUT_EPSILON`.
 *
 * Unclamped linear sRGB or linear Display P3 channels up to this value count
 * as in gamut in {@link inSrgbGamut}, {@link inP3Gamut} and
 * {@link isLinearRgbInGamut}; see {@link GAMUT_LINEAR_MIN} for the lower
 * bound and why the slack is applied in encoded rather than linear space.
 */
export const GAMUT_LINEAR_MAX = /* @__PURE__ */ srgbToLinearChannel(
  1 + GAMUT_EPSILON,
);

/**
 * Lower linear-light bound of Rec. 2020 membership: `-(GAMUT_EPSILON ** 2.4)`
 * (≈ -1.26e-10).
 *
 * Rec. 2020 does not share the sRGB transfer function. CSS Color 4 and
 * colorjs.io (0.6+) define `rec2020` with the ITU-R BT.1886 reference EOTF,
 * a pure 2.4 power mirrored through zero, and colorjs.io's `inGamut()`
 * allows {@link GAMUT_EPSILON} on those encoded channels. The same encoded
 * slack is therefore much tighter in linear light near black than for sRGB
 * (which has a linear toe: `-GAMUT_EPSILON / 12.92` ≈ -5.8e-6), and slightly
 * wider near white. It still covers float noise, which is ~1e-15 for a
 * Rec. 2020 primary round-tripped through OKLab.
 *
 * Reusing {@link GAMUT_LINEAR_MIN} here would accept colors up to 0.0065
 * outside the encoded cube (`5.8e-6 ** (1 / 2.4)`), about 87 times the
 * reference slack.
 */
export const REC2020_LINEAR_MIN = /* @__PURE__ */ decodedLowerBound(
  rec2020ToLinearChannel,
);
/**
 * Upper linear-light bound of Rec. 2020 membership:
 * `(1 + GAMUT_EPSILON) ** 2.4` (≈ 1.00018). See {@link REC2020_LINEAR_MIN}.
 */
export const REC2020_LINEAR_MAX = /* @__PURE__ */ decodedUpperBound(
  rec2020ToLinearChannel,
);

/**
 * The encoded tolerance bounds pushed through a transfer function. The
 * per-gamut bounds call these with the decoder alone: bundlers drop an
 * unused `@__PURE__` call only when its arguments are side-effect free, and
 * esbuild does not treat arithmetic on an imported binding
 * (`-GAMUT_EPSILON`) as such, so that arithmetic happens in here.
 */
function decodedLowerBound(decode: (encoded: number) => number): number {
  return decode(-GAMUT_EPSILON);
}
function decodedUpperBound(decode: (encoded: number) => number): number {
  return decode(1 + GAMUT_EPSILON);
}

/**
 * Lower linear-light bound of Adobe RGB (1998) membership:
 * `-(GAMUT_EPSILON ** (563 / 256))` (≈ -8.48e-10).
 *
 * CSS Color 4 and colorjs.io define `a98-rgb` with a pure `563 / 256` power
 * mirrored through zero, and colorjs.io's `inGamut()` allows
 * {@link GAMUT_EPSILON} on those encoded channels. Like the Rec. 2020 curve
 * it has no linear toe, so the tolerance is far tighter in linear light near
 * zero than the sRGB one (see {@link REC2020_LINEAR_MIN}).
 */
export const A98_RGB_LINEAR_MIN = /* @__PURE__ */ decodedLowerBound(
  a98RgbToLinearChannel,
);
/**
 * Upper linear-light bound of Adobe RGB (1998) membership:
 * `(1 + GAMUT_EPSILON) ** (563 / 256)` (≈ 1.000165). See
 * {@link A98_RGB_LINEAR_MIN}.
 */
export const A98_RGB_LINEAR_MAX = /* @__PURE__ */ decodedUpperBound(
  a98RgbToLinearChannel,
);

/**
 * Signed distance (in linear light) from unclamped linear RGB channels to the
 * nearest gamut bound. Non-negative exactly when the channels are in gamut.
 * `min` / `max` default to the sRGB / Display P3 bounds; pass a gamut's own
 * bounds for any other transfer function.
 */
export function linearChannelGamutMargin(
  r: number,
  g: number,
  b: number,
  min: number = GAMUT_LINEAR_MIN,
  max: number = GAMUT_LINEAR_MAX,
): number {
  return Math.min(r - min, g - min, b - min, max - r, max - g, max - b);
}

/**
 * Whether unclamped linear RGB channels fall within the gamut bounds.
 * `min` / `max` default to the sRGB / Display P3 bounds; pass a gamut's own
 * bounds for any other transfer function.
 */
export function linearChannelsInGamut(
  r: number,
  g: number,
  b: number,
  min: number = GAMUT_LINEAR_MIN,
  max: number = GAMUT_LINEAR_MAX,
): boolean {
  return r >= min && r <= max && g >= min && g <= max && b >= min && b <= max;
}
