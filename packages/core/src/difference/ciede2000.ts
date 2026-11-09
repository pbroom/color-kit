/**
 * CIEDE2000 on CIE Lab coordinates, and the Color -> CIE Lab (D50) step that
 * feeds it. Internal: the public entry is `deltaE2000()` in `./index.ts`.
 */

import type { Color, LinearRgb } from '../types.js';
import { toLinearSrgbInto } from '../conversion/into.js';
import {
  LINEAR_SRGB_TO_XYZ_D65,
  multiplyMatrix3,
  XYZ_D65_TO_XYZ_D50,
  xyzD50ToLab,
} from '../conversion/xyz.js';
import type { Vec3 } from '../conversion/xyz.js';
import { isAchromatic } from '../utils/index.js';

const LINEAR: LinearRgb = { r: 0, g: 0, b: 0, alpha: 1 };

const POW_25_7 = 25 ** 7;
const DEG = Math.PI / 180;

/**
 * CIE Lab (D50; L 0-100) of `color`, as CSS Color 4 `lab()` defines it:
 * unclamped linear sRGB -> XYZ (D65) -> Bradford -> XYZ (D50) -> Lab.
 *
 * An achromatic color (`isAchromatic`, the library-wide rule) gets an exactly
 * neutral Lab. Its a and b would otherwise hold float noise that differs by
 * JavaScript engine version, and CIEDE2000 takes the square root of the
 * chroma product and reads a hue from that noise, which moves a
 * gray-versus-saturated difference by up to ~5e-6 and bypasses the formula's
 * rule for neutrals.
 */
export function toLabD50(color: Color): Vec3 {
  const { r, g, b } = toLinearSrgbInto(LINEAR, color);
  const lab = xyzD50ToLab(
    multiplyMatrix3(
      XYZ_D65_TO_XYZ_D50,
      multiplyMatrix3(LINEAR_SRGB_TO_XYZ_D65, [r, g, b]),
    ),
  );
  if (isAchromatic(color.c)) {
    lab[1] = 0;
    lab[2] = 0;
  }
  return lab;
}

/** Hue angle of (a′, b) in degrees, `[0, 360)`; 0 for a true neutral. */
function hueDegrees(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const h = Math.atan2(b, a) / DEG;
  return h < 0 ? h + 360 : h;
}

/**
 * CIEDE2000 color difference between two CIE Lab colors, with the parametric
 * factors kL = kC = kH = 1.
 *
 * Follows Sharma, Wu & Dalal, "The CIEDE2000 Color-Difference Formula:
 * Implementation Notes, Supplementary Test Data, and Mathematical
 * Observations" (Color Research & Application 30(1), 2005), including its
 * rules for the hue difference and mean hue when either chroma is zero.
 */
export function ciede2000(
  L1: number,
  a1: number,
  b1: number,
  L2: number,
  a2: number,
  b2: number,
): number {
  // a-axis rescaling from the mean chroma.
  const meanC7 = ((Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(meanC7 / (meanC7 + POW_25_7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hp1 = hueDegrees(ap1, b1);
  const hp2 = hueDegrees(ap2, b2);

  // Hue difference and mean hue. Both are defined to ignore the hue of a
  // neutral: the difference is 0 and the mean is the sum (the other hue).
  const hueDiff = hp2 - hp1;
  const hueSum = hp1 + hp2;
  let dh = 0;
  let meanH = hueSum;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hueDiff) <= 180) {
      dh = hueDiff;
      meanH = hueSum / 2;
    } else {
      dh = hueDiff > 180 ? hueDiff - 360 : hueDiff + 360;
      meanH = hueSum < 360 ? (hueSum + 360) / 2 : (hueSum - 360) / 2;
    }
  }

  const dL = L2 - L1;
  const dC = Cp2 - Cp1;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * DEG) / 2);

  const meanL = (L1 + L2) / 2;
  const meanCp = (Cp1 + Cp2) / 2;
  const T =
    1 -
    0.17 * Math.cos((meanH - 30) * DEG) +
    0.24 * Math.cos(2 * meanH * DEG) +
    0.32 * Math.cos((3 * meanH + 6) * DEG) -
    0.2 * Math.cos((4 * meanH - 63) * DEG);
  const lSq = (meanL - 50) ** 2;
  const SL = 1 + (0.015 * lSq) / Math.sqrt(20 + lSq);
  const SC = 1 + 0.045 * meanCp;
  const SH = 1 + 0.015 * meanCp * T;

  // Rotation term for the blue region (hue around 275°).
  const dTheta = 30 * Math.exp(-(((meanH - 275) / 25) ** 2));
  const meanCp7 = meanCp ** 7;
  const RT =
    -Math.sin(2 * dTheta * DEG) * 2 * Math.sqrt(meanCp7 / (meanCp7 + POW_25_7));

  const l = dL / SL;
  const c = dC / SC;
  const h = dH / SH;
  return Math.sqrt(l * l + c * c + h * h + RT * c * h);
}
