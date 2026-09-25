import {
  isLinearRgbInGamut,
  linearSrgbToLinearP3,
  oklabToLinearRgb,
  oklchToOklab,
  type GamutTarget,
} from '@color-kit/core';

export interface LinearSrgb {
  r: number;
  g: number;
  b: number;
}

const GAMUT_ITERS = 14;

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function transferLinearToSrgbChannel(value: number): number {
  const absValue = Math.abs(value);
  const srgb =
    absValue <= 0.0031308
      ? 12.92 * absValue
      : 1.055 * Math.pow(absValue, 1 / 2.4) - 0.055;
  return clamp01(Math.sign(value) * srgb);
}

/**
 * OKLCH -> linear sRGB using core's full-precision OKLab matrices.
 */
export function oklchToLinearSrgb(
  lightness: number,
  chroma: number,
  hue: number,
): LinearSrgb {
  return oklabToLinearRgb(
    oklchToOklab({ l: lightness, c: chroma, h: hue, alpha: 1 }),
  );
}

/** Same membership rule (and epsilon) as core `inSrgbGamut`. */
export function inSrgbLinear(linearSrgb: LinearSrgb): boolean {
  return isLinearRgbInGamut(linearSrgb.r, linearSrgb.g, linearSrgb.b);
}

/** Same membership rule (and epsilon) as core `inP3Gamut`. */
export function inP3Linear(linearSrgb: LinearSrgb): boolean {
  const linearP3 = linearSrgbToLinearP3({ ...linearSrgb, alpha: 1 });
  return isLinearRgbInGamut(linearP3.r, linearP3.g, linearP3.b);
}

function inTargetGamut(linearSrgb: LinearSrgb, gamut: GamutTarget): boolean {
  return gamut === 'display-p3'
    ? inP3Linear(linearSrgb)
    : inSrgbLinear(linearSrgb);
}

export function mapToGamutLinear(
  lightness: number,
  chroma: number,
  hue: number,
  gamut: GamutTarget,
): LinearSrgb {
  const rawLinear = oklchToLinearSrgb(lightness, chroma, hue);
  if (inTargetGamut(rawLinear, gamut)) {
    return rawLinear;
  }

  let lo = 0;
  let hi = Math.max(chroma, 0);
  let mapped = 0;

  for (let index = 0; index < GAMUT_ITERS; index += 1) {
    const mid = (lo + hi) * 0.5;
    const testLinear = oklchToLinearSrgb(lightness, mid, hue);
    if (inTargetGamut(testLinear, gamut)) {
      lo = mid;
      mapped = mid;
    } else {
      hi = mid;
    }
  }

  return oklchToLinearSrgb(lightness, mapped, hue);
}
