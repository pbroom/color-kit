import type { Color } from '../types.js';
import { toRgb } from '../conversion/index.js';
import { oklabToLinearRgb } from '../conversion/oklab.js';
import { oklchToOklab } from '../conversion/oklch.js';
import { srgbToLinearChannel } from '../utils/index.js';

/**
 * Calculate relative luminance of a color per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(color: Color): number {
  const rgb = toRgb(color);
  const r = srgbToLinearChannel(rgb.r / 255);
  const g = srgbToLinearChannel(rgb.g / 255);
  const b = srgbToLinearChannel(rgb.b / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate WCAG 2.1 contrast ratio between two colors.
 * Returns a value between 1 and 21.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(color1: Color, color2: Color): number {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
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

/**
 * APCA "screen luminance" of an 8-bit sRGB color. APCA intentionally uses a
 * simple 2.4 power curve here rather than the piecewise sRGB EOTF.
 */
function apcaScreenLuminance(color: Color): number {
  const rgb = toRgb(color);
  return (
    APCA_SR_COEFF * (rgb.r / 255) ** APCA_MAIN_TRC +
    APCA_SG_COEFF * (rgb.g / 255) ** APCA_MAIN_TRC +
    APCA_SB_COEFF * (rgb.b / 255) ** APCA_MAIN_TRC
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
 */
export function contrastAPCA(textColor: Color, bgColor: Color): number {
  let txtY = apcaScreenLuminance(textColor);
  let bgY = apcaScreenLuminance(bgColor);

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
): boolean {
  const ratio = contrastRatio(color1, color2);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/** Check if contrast ratio meets WCAG AAA for normal text (>= 7:1) */
export function meetsAAA(
  color1: Color,
  color2: Color,
  largeText: boolean = false,
): boolean {
  const ratio = contrastRatio(color1, color2);
  return largeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Relative luminance from unclamped linear channels.
 *
 * This keeps P3-only colors accurate instead of implicitly clipping
 * through an sRGB conversion path.
 */
export function relativeLuminanceUnclamped(color: Color): number {
  const lab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linear = oklabToLinearRgb(lab);
  return 0.2126 * linear.r + 0.7152 * linear.g + 0.0722 * linear.b;
}

export function contrastRatioUnclamped(color1: Color, color2: Color): number {
  const l1 = relativeLuminanceUnclamped(color1);
  const l2 = relativeLuminanceUnclamped(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
