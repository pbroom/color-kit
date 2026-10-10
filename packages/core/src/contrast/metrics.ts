import type { Color, LinearRgb } from '../types.js';
import type { GamutTarget } from '../gamut/types.js';
import { assertGamutTarget } from '../gamut/target.js';
import { toLinearSrgbInto } from '../conversion/into.js';
import {
  linearP3ToLinearSrgbInto,
  linearSrgbToLinearP3Into,
} from '../conversion/p3.js';
import {
  clamp,
  linearToSrgbChannel,
  srgbToLinearChannel,
} from '../utils/index.js';

/**
 * Channel precision for contrast metrics.
 *
 * - `'exact'` (default): unrounded channel values, so the result is a
 *   continuous function of the color (and agrees with colorjs.io for
 *   in-gamut colors).
 * - `'8bit'`: quantize the gamma-encoded channels to 8 bits first, the way
 *   hex-based tools (WebAIM, browser devtools) measure. For the sRGB gamut
 *   this reproduces color-kit 0.1 results bit for bit.
 */
export type ContrastPrecision = 'exact' | '8bit';

/** Options shared by `relativeLuminance`, `contrastRatio`, `contrastAPCA`. */
export interface ContrastOptions {
  /**
   * Display gamut the colors are shown in. Channels are clipped to this
   * gamut before luminance is measured, so out-of-gamut colors are measured
   * as the display would render them by clipping. Contrast regions with
   * `gamut: 'display-p3'` use the same setting.
   * @default 'srgb'
   */
  gamut?: GamutTarget;
  /**
   * Channel precision; see `ContrastPrecision`.
   * @default 'exact'
   */
  precision?: ContrastPrecision;
}

// Shared scratch: every metric reads its inputs into DISPLAYED before
// returning a number, so nothing escapes and no call allocates.
const DISPLAYED: LinearRgb = { r: 0, g: 0, b: 0, alpha: 1 };

/**
 * One channel clipped to `[0, 1]` in its own gamut, optionally quantized to
 * 8 bits in gamma-encoded form. Returns linear light, or the gamma-encoded
 * value when `encoded` is set.
 */
function displayChannel(
  linear: number,
  quantize: boolean,
  encoded: boolean,
): number {
  if (!quantize) {
    const clipped = clamp(linear, 0, 1);
    return encoded ? linearToSrgbChannel(clipped) : clipped;
  }
  const byte = Math.round(clamp(linearToSrgbChannel(linear), 0, 1) * 255);
  const value = byte / 255;
  return encoded ? value : srgbToLinearChannel(value);
}

/**
 * The sRGB channels of `color` as displayed in `options.gamut`: clipped to
 * that gamut and (with `precision: '8bit'`) quantized, never otherwise
 * rounded. Writes linear-light sRGB, or gamma-encoded sRGB when `encoded`
 * is set. For `'display-p3'` the values are extended-range sRGB (they may
 * fall outside `[0, 1]`).
 *
 * This is the single display model behind every contrast metric and every
 * contrast region field, so a color inside a region passes the matching
 * check.
 */
function displayedSrgb(
  color: Color,
  options: ContrastOptions | undefined,
  encoded: boolean,
): LinearRgb {
  const quantize = options?.precision === '8bit';
  assertGamutTarget(options?.gamut, 'contrast');
  const out = toLinearSrgbInto(DISPLAYED, color);
  if (options?.gamut === 'display-p3') {
    linearSrgbToLinearP3Into(out, out);
    out.r = displayChannel(out.r, quantize, false);
    out.g = displayChannel(out.g, quantize, false);
    out.b = displayChannel(out.b, quantize, false);
    linearP3ToLinearSrgbInto(out, out);
    if (encoded) {
      out.r = linearToSrgbChannel(out.r);
      out.g = linearToSrgbChannel(out.g);
      out.b = linearToSrgbChannel(out.b);
    }
    return out;
  }
  out.r = displayChannel(out.r, quantize, encoded);
  out.g = displayChannel(out.g, quantize, encoded);
  out.b = displayChannel(out.b, quantize, encoded);
  return out;
}

/**
 * Calculate relative luminance of a color per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * Measured from the unrounded sRGB channels, clipped to the display gamut
 * (`options.gamut`, default sRGB). Pass `{ precision: '8bit' }` to measure
 * the 8-bit hex value instead.
 */
export function relativeLuminance(
  color: Color,
  options?: ContrastOptions,
): number {
  const linear = displayedSrgb(color, options, false);
  return 0.2126 * linear.r + 0.7152 * linear.g + 0.0722 * linear.b;
}

/**
 * Calculate WCAG 2.1 contrast ratio between two colors.
 * Returns a value between 1 and 21.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *
 * See `relativeLuminance()` for how colors are measured and `options`.
 */
export function contrastRatio(
  color1: Color,
  color2: Color,
  options?: ContrastOptions,
): number {
  const l1 = relativeLuminance(color1, options);
  const l2 = relativeLuminance(color2, options);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// APCA-W3 0.0.98G-4g constants (https://github.com/Myndex/apca-w3).
const APCA_MAIN_TRC = 2.4;
const APCA_SR_COEFF = 0.2126729;
const APCA_SG_COEFF = 0.7151522;
const APCA_SB_COEFF = 0.072175;
const APCA_NORM_BG = 0.56;
const APCA_NORM_TXT = 0.57;
const APCA_REV_TXT = 0.62;
const APCA_REV_BG = 0.65;
const APCA_BLK_THRS = 0.022;
const APCA_BLK_CLMP = 1.414;
const APCA_SCALE_BOW = 1.14;
const APCA_SCALE_WOB = 1.14;
const APCA_LO_BOW_OFFSET = 0.027;
const APCA_LO_WOB_OFFSET = 0.027;
const APCA_DELTA_Y_MIN = 0.0005;
const APCA_LO_CLIP = 0.1;

/** Sign-preserving `x ** 2.4`, as colorjs.io applies to extended sRGB. */
function apcaChannel(encoded: number): number {
  return encoded < 0
    ? -((-encoded) ** APCA_MAIN_TRC)
    : encoded ** APCA_MAIN_TRC;
}

/**
 * APCA "screen luminance" of the displayed sRGB color. APCA intentionally
 * uses a simple 2.4 power curve here rather than the piecewise sRGB EOTF.
 */
function apcaScreenLuminance(
  color: Color,
  options: ContrastOptions | undefined,
): number {
  const encoded = displayedSrgb(color, options, true);
  return (
    APCA_SR_COEFF * apcaChannel(encoded.r) +
    APCA_SG_COEFF * apcaChannel(encoded.g) +
    APCA_SB_COEFF * apcaChannel(encoded.b)
  );
}

/**
 * Calculate APCA (Advanced Perceptual Contrast Algorithm) contrast.
 * Returns a normalized Lc value roughly between -1.08 and 1.06
 * (multiply by 100 for the conventional APCA Lc scale).
 * Positive values = dark text on light background (normal polarity).
 * Negative values = light text on dark background (reverse polarity).
 *
 * Implements APCA-W3 0.0.98G-4g (`APCAcontrast(sRGBtoY(text), sRGBtoY(bg))`).
 * https://github.com/Myndex/apca-w3
 *
 * Colors are measured from unrounded channels clipped to the display gamut,
 * as in `relativeLuminance()`; the result is continuous in the inputs. Pass
 * `{ precision: '8bit' }` to measure the 8-bit hex values instead.
 */
export function contrastAPCA(
  textColor: Color,
  bgColor: Color,
  options?: ContrastOptions,
): number {
  let txtY = apcaScreenLuminance(textColor, options);
  let bgY = apcaScreenLuminance(bgColor, options);

  // Soft clamp of near-black luminance (flare compensation)
  if (txtY <= APCA_BLK_THRS) {
    txtY += (APCA_BLK_THRS - txtY) ** APCA_BLK_CLMP;
  }
  if (bgY <= APCA_BLK_THRS) {
    bgY += (APCA_BLK_THRS - bgY) ** APCA_BLK_CLMP;
  }

  // Noise gate for (near-)identical luminances
  if (Math.abs(bgY - txtY) < APCA_DELTA_Y_MIN) {
    return 0;
  }

  if (bgY > txtY) {
    // Dark text on light bg (normal polarity)
    const sapc = (bgY ** APCA_NORM_BG - txtY ** APCA_NORM_TXT) * APCA_SCALE_BOW;
    return sapc < APCA_LO_CLIP ? 0 : sapc - APCA_LO_BOW_OFFSET;
  }

  // Light text on dark bg (reverse polarity)
  const sapc = (bgY ** APCA_REV_BG - txtY ** APCA_REV_TXT) * APCA_SCALE_WOB;
  return sapc > -APCA_LO_CLIP ? 0 : sapc + APCA_LO_WOB_OFFSET;
}

/** Check if contrast ratio meets WCAG AA for normal text (>= 4.5:1) */
export function meetsAA(
  color1: Color,
  color2: Color,
  largeText: boolean = false,
  options?: ContrastOptions,
): boolean {
  const ratio = contrastRatio(color1, color2, options);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/** Check if contrast ratio meets WCAG AAA for normal text (>= 7:1) */
export function meetsAAA(
  color1: Color,
  color2: Color,
  largeText: boolean = false,
  options?: ContrastOptions,
): boolean {
  const ratio = contrastRatio(color1, color2, options);
  return largeText ? ratio >= 4.5 : ratio >= 7;
}
