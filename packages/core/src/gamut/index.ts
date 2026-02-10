import type { Color } from '../types.js';
import { oklchToOklab } from '../conversion/oklch.js';
import { oklabToLinearRgb } from '../conversion/oklab.js';
import { linearSrgbToLinearP3 } from '../conversion/p3.js';
import { clamp, normalizeHue } from '../utils/index.js';

/** Small epsilon to account for floating-point rounding */
const EPSILON = 0.000075;
const DEFAULT_MAX_CHROMA = 0.4;
const DEFAULT_TOLERANCE = 0.0001;
const DEFAULT_MAX_ITERATIONS = 30;

export type GamutTarget = 'srgb' | 'display-p3';

export interface MaxChromaAtOptions {
  gamut?: GamutTarget;
  /**
   * Absolute precision for binary search stop condition.
   * Lower values increase precision and work per call.
   */
  tolerance?: number;
  /**
   * Hard cap for binary search iterations.
   */
  maxIterations?: number;
  /**
   * Upper chroma search bound.
   */
  maxChroma?: number;
  /**
   * Alpha channel used while sampling.
   */
  alpha?: number;
}

export interface GamutBoundaryPoint {
  l: number;
  c: number;
}

export interface GamutBoundaryPathOptions extends MaxChromaAtOptions {
  /**
   * Number of equal lightness segments to sample.
   * The returned path has `steps + 1` points.
   */
  steps?: number;
}

function isInTargetGamut(color: Color, gamut: GamutTarget): boolean {
  return gamut === 'display-p3' ? inP3Gamut(color) : inSrgbGamut(color);
}

/**
 * Resolve the maximum in-gamut chroma for a specific lightness + hue.
 *
 * This is the geometry primitive used by gamut boundary overlays and
 * model-accurate hue/chroma gradient generation.
 */
export function maxChromaAt(
  lightness: number,
  hue: number,
  options: MaxChromaAtOptions = {},
): number {
  const {
    gamut = 'srgb',
    tolerance = DEFAULT_TOLERANCE,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    maxChroma = DEFAULT_MAX_CHROMA,
    alpha = 1,
  } = options;

  const l = clamp(lightness, 0, 1);
  if (l <= 0 || l >= 1) return 0;

  const h = normalizeHue(hue);
  const hiStart = Math.max(0, maxChroma);
  if (hiStart === 0) return 0;

  let lo = 0;
  let hi = hiStart;

  // If upper bound is already in gamut, caller supplied a hard cap.
  const hiColor: Color = { l, c: hi, h, alpha };
  if (isInTargetGamut(hiColor, gamut)) {
    return hi;
  }

  const minTolerance = tolerance > 0 ? tolerance : DEFAULT_TOLERANCE;
  const iterations = maxIterations > 0 ? Math.floor(maxIterations) : 1;

  for (let index = 0; index < iterations; index += 1) {
    if (hi - lo <= minTolerance) break;
    const mid = (lo + hi) / 2;
    const test: Color = { l, c: mid, h, alpha };
    if (isInTargetGamut(test, gamut)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return lo;
}

/**
 * Sample the lightness/chroma gamut boundary for a fixed hue.
 *
 * Returns deterministic points usable for SVG/Canvas overlay paths.
 */
export function gamutBoundaryPath(
  hue: number,
  options: GamutBoundaryPathOptions = {},
): GamutBoundaryPoint[] {
  const steps = options.steps ?? 100;
  if (!Number.isInteger(steps) || steps < 2) {
    throw new Error('gamutBoundaryPath() requires steps >= 2');
  }

  const path: GamutBoundaryPoint[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const l = index / steps;
    const c = maxChromaAt(l, hue, options);
    path.push({ l, c });
  }
  return path;
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
  return (
    linear.r >= -EPSILON &&
    linear.r <= 1 + EPSILON &&
    linear.g >= -EPSILON &&
    linear.g <= 1 + EPSILON &&
    linear.b >= -EPSILON &&
    linear.b <= 1 + EPSILON
  );
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
  return (
    linearP3.r >= -EPSILON &&
    linearP3.r <= 1 + EPSILON &&
    linearP3.g >= -EPSILON &&
    linearP3.g <= 1 + EPSILON &&
    linearP3.b >= -EPSILON &&
    linearP3.b <= 1 + EPSILON
  );
}

/**
 * Map a Color to the sRGB gamut by progressively reducing chroma.
 * Uses a binary search to find the maximum chroma that stays in gamut.
 *
 * This preserves lightness and hue while only reducing saturation,
 * which produces the most visually similar in-gamut color.
 */
export function toSrgbGamut(color: Color): Color {
  if (inSrgbGamut(color)) return { ...color };

  let lo = 0;
  let hi = color.c;
  let mapped = { ...color };

  // Binary search for max chroma in gamut (within epsilon)
  const epsilon = 0.0001;
  while (hi - lo > epsilon) {
    const mid = (lo + hi) / 2;
    const test: Color = { ...color, c: mid };
    if (inSrgbGamut(test)) {
      lo = mid;
      mapped = test;
    } else {
      hi = mid;
    }
  }

  return mapped;
}

/**
 * Map a Color to the Display P3 gamut by progressively reducing chroma.
 */
export function toP3Gamut(color: Color): Color {
  if (inP3Gamut(color)) return { ...color };

  let lo = 0;
  let hi = color.c;
  let mapped = { ...color };

  const epsilon = 0.0001;
  while (hi - lo > epsilon) {
    const mid = (lo + hi) / 2;
    const test: Color = { ...color, c: mid };
    if (inP3Gamut(test)) {
      lo = mid;
      mapped = test;
    } else {
      hi = mid;
    }
  }

  return mapped;
}
