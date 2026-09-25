import type { Color } from '../types.js';
import { oklchToOklab } from '../conversion/oklch.js';
import { oklabToLinearRgb } from '../conversion/oklab.js';
import { linearSrgbToLinearP3 } from '../conversion/p3.js';
import {
  LMS_TO_LINEAR_P3,
  LMS_TO_LINEAR_SRGB,
} from '../conversion/matrices.js';
import { linearChannelsInGamut } from './linear-bounds.js';
import type { GamutTarget } from './types.js';

const LIGHTNESS_ENDPOINT_EPSILON = 1e-9;

export const OKLAB_TO_LINEAR_SRGB_ROWS = LMS_TO_LINEAR_SRGB;

// Composed matrix: linear-sRGB -> linear-P3 multiplied by OKLab(l,m,s) -> linear-sRGB.
export const OKLAB_TO_LINEAR_P3_ROWS = LMS_TO_LINEAR_P3;

export type TargetRow = readonly [number, number, number];
export type TargetRows = readonly [TargetRow, TargetRow, TargetRow];

function mapLightnessEndpoint(color: Color): Color | null {
  if (color.l <= LIGHTNESS_ENDPOINT_EPSILON) {
    return { ...color, l: 0, c: 0 };
  }

  if (color.l >= 1 - LIGHTNESS_ENDPOINT_EPSILON) {
    return { ...color, l: 1, c: 0 };
  }

  return null;
}

export function isInTargetGamut(color: Color, gamut: GamutTarget): boolean {
  return gamut === 'display-p3' ? inP3Gamut(color) : inSrgbGamut(color);
}

export function getTargetRows(gamut: GamutTarget): TargetRows {
  return gamut === 'display-p3'
    ? OKLAB_TO_LINEAR_P3_ROWS
    : OKLAB_TO_LINEAR_SRGB_ROWS;
}

/**
 * Check if a Color is within the sRGB gamut.
 *
 * Uses unclamped linear sRGB values to avoid the false-positive
 * caused by the clamping in `linearToSrgb` / `toRgb`.
 */
export function inSrgbGamut(color: Color): boolean {
  const lab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linear = oklabToLinearRgb(lab);
  return linearChannelsInGamut(linear.r, linear.g, linear.b);
}

/**
 * Check if a Color is within the Display P3 gamut.
 *
 * Uses unclamped linear P3 values to avoid the false-positive
 * caused by the clamping in `linearP3ToP3` / `toP3`.
 */
export function inP3Gamut(color: Color): boolean {
  const lab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linearSrgb = oklabToLinearRgb(lab);
  const linearP3 = linearSrgbToLinearP3(linearSrgb);
  return linearChannelsInGamut(linearP3.r, linearP3.g, linearP3.b);
}

function strictlyInTargetGamut(color: Color, gamut: GamutTarget): boolean {
  const lab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linear = oklabToLinearRgb(lab);
  const target = gamut === 'display-p3' ? linearSrgbToLinearP3(linear) : linear;
  return (
    target.r >= 0 &&
    target.r <= 1 &&
    target.g >= 0 &&
    target.g <= 1 &&
    target.b >= 0 &&
    target.b <= 1
  );
}

/**
 * Bisect OKLCH chroma (at fixed L and h) down to the target gamut boundary.
 *
 * Candidates are accepted only when *strictly* inside the gamut. The
 * GAMUT_EPSILON slack used by membership checks is meant to absorb float
 * noise on colors that are already in gamut; letting the search settle
 * inside that slack would return out-of-gamut colors, and near black the
 * slack spans a large chroma range.
 */
function reduceChromaToGamut(color: Color, gamut: GamutTarget): Color {
  let lo = 0;
  let hi = color.c;
  const achromatic = { ...color, c: 0 };
  let mapped = strictlyInTargetGamut(achromatic, gamut)
    ? achromatic
    : { ...color };

  const epsilon = 0.0001;
  while (hi - lo > epsilon) {
    const mid = (lo + hi) / 2;
    const test: Color = { ...color, c: mid };
    if (strictlyInTargetGamut(test, gamut)) {
      lo = mid;
      mapped = test;
    } else {
      hi = mid;
    }
  }

  return mapped;
}

/**
 * Map a Color to the sRGB gamut by progressively reducing chroma.
 * Uses a binary search to find the maximum chroma that stays in gamut.
 *
 * This preserves lightness and hue while only reducing saturation,
 * which produces the most visually similar in-gamut color.
 */
export function toSrgbGamut(color: Color): Color {
  const endpoint = mapLightnessEndpoint(color);
  if (endpoint) return endpoint;
  if (inSrgbGamut(color)) return { ...color };
  return reduceChromaToGamut(color, 'srgb');
}

/**
 * Map a Color to the Display P3 gamut by progressively reducing chroma.
 */
export function toP3Gamut(color: Color): Color {
  const endpoint = mapLightnessEndpoint(color);
  if (endpoint) return endpoint;
  if (inP3Gamut(color)) return { ...color };
  return reduceChromaToGamut(color, 'display-p3');
}
