import type { GamutTarget } from '@color-kit/core';

export interface LinearSrgb {
  r: number;
  g: number;
  b: number;
}

export const GAMUT_EPSILON = 0.000075;
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

export function oklchToLinearSrgb(
  lightness: number,
  chroma: number,
  hue: number,
): LinearSrgb {
  const hueRad = (((hue % 360) + 360) % 360) * (Math.PI / 180);
  const a = chroma * Math.cos(hueRad);
  const b = chroma * Math.sin(hueRad);

  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;

  const l = lPrime * lPrime * lPrime;
  const m = mPrime * mPrime * mPrime;
  const s = sPrime * sPrime * sPrime;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function linearSrgbToLinearP3(linearSrgb: LinearSrgb): LinearSrgb {
  return {
    r: 0.8224621724 * linearSrgb.r + 0.1775378276 * linearSrgb.g,
    g: 0.033194198 * linearSrgb.r + 0.966805802 * linearSrgb.g,
    b:
      0.0170826307 * linearSrgb.r +
      0.0723974407 * linearSrgb.g +
      0.9105199286 * linearSrgb.b,
  };
}

export function inSrgbLinear(linearSrgb: LinearSrgb): boolean {
  return (
    linearSrgb.r >= -GAMUT_EPSILON &&
    linearSrgb.r <= 1 + GAMUT_EPSILON &&
    linearSrgb.g >= -GAMUT_EPSILON &&
    linearSrgb.g <= 1 + GAMUT_EPSILON &&
    linearSrgb.b >= -GAMUT_EPSILON &&
    linearSrgb.b <= 1 + GAMUT_EPSILON
  );
}

export function inP3Linear(linearSrgb: LinearSrgb): boolean {
  const linearP3 = linearSrgbToLinearP3(linearSrgb);
  return (
    linearP3.r >= -GAMUT_EPSILON &&
    linearP3.r <= 1 + GAMUT_EPSILON &&
    linearP3.g >= -GAMUT_EPSILON &&
    linearP3.g <= 1 + GAMUT_EPSILON &&
    linearP3.b >= -GAMUT_EPSILON &&
    linearP3.b <= 1 + GAMUT_EPSILON
  );
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
