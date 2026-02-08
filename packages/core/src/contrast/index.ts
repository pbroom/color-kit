import type { Color } from '../types.js';
import { toRgb } from '../conversion/index.js';
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

/**
 * Calculate APCA (Advanced Perceptual Contrast Algorithm) contrast.
 * Returns a value roughly between -108 and 106.
 * Positive values = light text on dark background.
 * Negative values = dark text on light background.
 *
 * Based on APCA-W3 0.0.98G-4g.
 * https://github.com/Myndex/SAPC-APCA
 */
export function contrastAPCA(textColor: Color, bgColor: Color): number {
  const txtRgb = toRgb(textColor);
  const bgRgb = toRgb(bgColor);

  // Linearize with sRGB TRC
  const txtR = srgbToLinearChannel(txtRgb.r / 255);
  const txtG = srgbToLinearChannel(txtRgb.g / 255);
  const txtB = srgbToLinearChannel(txtRgb.b / 255);

  const bgR = srgbToLinearChannel(bgRgb.r / 255);
  const bgG = srgbToLinearChannel(bgRgb.g / 255);
  const bgB = srgbToLinearChannel(bgRgb.b / 255);

  // APCA luminance coefficients
  const txtY = 0.2126729 * txtR + 0.7151522 * txtG + 0.072175 * txtB;
  const bgY = 0.2126729 * bgR + 0.7151522 * bgG + 0.072175 * bgB;

  // APCA contrast calculation (simplified)
  const normBg = 0.56;
  const normTxt = 0.57;
  const revTxt = 0.62;
  const revBg = 0.65;

  const scale = 1.25;
  const threshold = 0.022;
  const loClip = 0.1;

  // Soft clamp
  const txtYc = txtY > threshold ? txtY : txtY + (threshold - txtY) ** 1.414;
  const bgYc = bgY > threshold ? bgY : bgY + (threshold - bgY) ** 1.414;

  let contrast: number;

  if (bgYc > txtYc) {
    // Dark text on light bg (normal polarity)
    contrast = (bgYc ** normBg - txtYc ** normTxt) * scale;
  } else {
    // Light text on dark bg (reverse polarity)
    contrast = (bgYc ** revBg - txtYc ** revTxt) * scale;
  }

  if (Math.abs(contrast) < loClip) {
    return 0;
  }

  return contrast > 0 ? contrast - loClip : contrast + loClip;
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
