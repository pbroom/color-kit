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
const DEFAULT_HUE_CUSP_LUT_SIZE = 4096;

const OKLAB_LMS_PRIME_COEFFICIENTS = {
  l: { a: 0.3963377774, b: 0.2158037573 },
  m: { a: -0.1055613458, b: -0.0638541728 },
  s: { a: -0.0894841775, b: -1.291485548 },
} as const;

const OKLAB_TO_LINEAR_SRGB_ROWS = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
] as const;

// Composed matrix: linear-sRGB -> linear-P3 multiplied by OKLab(l,m,s) -> linear-sRGB.
const OKLAB_TO_LINEAR_P3_ROWS = [
  [3.1277700759423896, -2.2571370014989434, 0.12936692555655316],
  [-1.091009052397986, 2.4133317637074136, -0.3223227113094277],
  [-0.026010813144971768, -0.5080413257213188, 1.5340521388662907],
] as const;

const HUE_CUSP_CHANNEL_EPSILON = 1e-7;
const MAX_SATURATION_SEARCH = 16;
const SATURATION_ROOT_ITERATIONS = 24;

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

export interface HueCusp {
  l: number;
  c: number;
}

export type MaxChromaForHueMethod = 'direct' | 'lut';

export interface MaxChromaForHueOptions {
  gamut?: GamutTarget;
  /**
   * `lut` uses a cached hue lookup table with interpolation for maximum
   * throughput across repeated calls. `direct` computes the cusp exactly
   * for the requested hue without a lightness sweep.
   * @default 'lut'
   */
  method?: MaxChromaForHueMethod;
  /**
   * Number of evenly spaced hue samples in the cached LUT.
   * Higher values increase warm-up cost and reduce interpolation error.
   * @default 4096
   */
  lutSize?: number;
}

export interface GamutBoundaryPathOptions extends MaxChromaAtOptions {
  /**
   * Number of equal lightness segments to sample.
   * The returned path has `steps + 1` points.
   */
  steps?: number;
}

export type ChromaBandMode = 'clamped' | 'proportional';

export interface ChromaBandOptions extends MaxChromaAtOptions {
  /**
   * Chroma distribution strategy across the lightness sweep.
   * @default 'clamped'
   */
  mode?: ChromaBandMode;
  /**
   * Number of equal lightness segments to sample.
   * The returned band has `steps + 1` colors.
   */
  steps?: number;
  /**
   * Lightness anchor for proportional mode.
   * Used to resolve the requested/max chroma ratio.
   * @default 0.5
   */
  selectedLightness?: number;
}

const DEFAULT_CHROMA_BAND_STEPS = 12;
const DEFAULT_CHROMA_BAND_SELECTED_LIGHTNESS = 0.5;

type TargetRow = readonly [number, number, number];
type TargetRows = readonly [TargetRow, TargetRow, TargetRow];
type CubicCoefficients = readonly [number, number, number, number];

const hueCuspLutCache = new Map<string, readonly HueCusp[]>();

function isInTargetGamut(color: Color, gamut: GamutTarget): boolean {
  return gamut === 'display-p3' ? inP3Gamut(color) : inSrgbGamut(color);
}

function getTargetRows(gamut: GamutTarget): TargetRows {
  return gamut === 'display-p3'
    ? OKLAB_TO_LINEAR_P3_ROWS
    : OKLAB_TO_LINEAR_SRGB_ROWS;
}

function resolveHueLmsPrimeSlopes(
  hueUnitA: number,
  hueUnitB: number,
): readonly [number, number, number] {
  const uL =
    OKLAB_LMS_PRIME_COEFFICIENTS.l.a * hueUnitA +
    OKLAB_LMS_PRIME_COEFFICIENTS.l.b * hueUnitB;
  const uM =
    OKLAB_LMS_PRIME_COEFFICIENTS.m.a * hueUnitA +
    OKLAB_LMS_PRIME_COEFFICIENTS.m.b * hueUnitB;
  const uS =
    OKLAB_LMS_PRIME_COEFFICIENTS.s.a * hueUnitA +
    OKLAB_LMS_PRIME_COEFFICIENTS.s.b * hueUnitB;
  return [uL, uM, uS];
}

function channelPolynomialForSaturation(
  row: TargetRow,
  slopes: readonly [number, number, number],
): CubicCoefficients {
  const [mL, mM, mS] = row;
  const [uL, uM, uS] = slopes;

  const c0 = mL + mM + mS;
  const c1 = 3 * (mL * uL + mM * uM + mS * uS);
  const c2 = 3 * (mL * uL * uL + mM * uM * uM + mS * uS * uS);
  const c3 = mL * uL * uL * uL + mM * uM * uM * uM + mS * uS * uS * uS;

  return [c0, c1, c2, c3];
}

function evalCubic(coeffs: CubicCoefficients, x: number): number {
  const [c0, c1, c2, c3] = coeffs;
  return ((c3 * x + c2) * x + c1) * x + c0;
}

function evalCubicDerivative(coeffs: CubicCoefficients, x: number): number {
  const [, c1, c2, c3] = coeffs;
  return (3 * c3 * x + 2 * c2) * x + c1;
}

function hasOppositeSigns(a: number, b: number): boolean {
  return (a < 0 && b > 0) || (a > 0 && b < 0);
}

function getCubicDerivativeCriticalPoints(coeffs: CubicCoefficients): number[] {
  const [, c1, c2, c3] = coeffs;
  const a = 3 * c3;
  const b = 2 * c2;
  const c = c1;
  const epsilon = 1e-12;

  if (Math.abs(a) <= epsilon) {
    if (Math.abs(b) <= epsilon) {
      return [];
    }

    return [-c / b];
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < -epsilon) {
    return [];
  }

  if (Math.abs(discriminant) <= epsilon) {
    return [-b / (2 * a)];
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const rootA = (-b - sqrtDiscriminant) / (2 * a);
  const rootB = (-b + sqrtDiscriminant) / (2 * a);
  return rootA < rootB ? [rootA, rootB] : [rootB, rootA];
}

function refinePositiveCubicRootInBracket(
  coeffs: CubicCoefficients,
  loStart: number,
  hiStart: number,
): number {
  let lo = loStart;
  let hi = hiStart;
  let fLo = evalCubic(coeffs, lo);
  const epsilon = 1e-12;

  if (Math.abs(fLo) <= epsilon) return lo;
  if (Math.abs(evalCubic(coeffs, hi)) <= epsilon) return hi;

  let x = (lo + hi) / 2;
  for (let index = 0; index < SATURATION_ROOT_ITERATIONS; index += 1) {
    const fX = evalCubic(coeffs, x);
    if (Math.abs(fX) <= epsilon) {
      return x;
    }

    if (hasOppositeSigns(fLo, fX)) {
      hi = x;
    } else {
      lo = x;
      fLo = fX;
    }

    const derivative = evalCubicDerivative(coeffs, x);
    if (Math.abs(derivative) > epsilon) {
      const next = x - fX / derivative;
      if (next > lo && next < hi) {
        x = next;
        continue;
      }
    }

    x = (lo + hi) / 2;
  }

  return x;
}

function findPositiveCubicRoot(coeffs: CubicCoefficients): number | null {
  const f0 = coeffs[0];
  if (!(f0 > 0)) {
    return 0;
  }

  const bracketPoints = [0];
  for (const point of getCubicDerivativeCriticalPoints(coeffs)) {
    if (point > 0 && point < MAX_SATURATION_SEARCH) {
      bracketPoints.push(point);
    }
  }
  bracketPoints.push(MAX_SATURATION_SEARCH);

  let previous = bracketPoints[0];
  let previousValue = evalCubic(coeffs, previous);
  const zeroEpsilon = 1e-12;

  for (let index = 1; index < bracketPoints.length; index += 1) {
    const current = bracketPoints[index];
    const currentValue = evalCubic(coeffs, current);

    if (previous > 0 && Math.abs(previousValue) <= zeroEpsilon) {
      return previous;
    }

    if (current > 0 && Math.abs(currentValue) <= zeroEpsilon) {
      return current;
    }

    if (hasOppositeSigns(previousValue, currentValue)) {
      const root = refinePositiveCubicRootInBracket(coeffs, previous, current);
      return root >= 0 ? root : 0;
    }

    previous = current;
    previousValue = currentValue;
  }

  return null;
}

function evaluateTargetChannelsAtSaturation(
  rows: TargetRows,
  slopes: readonly [number, number, number],
  saturation: number,
): readonly [number, number, number] {
  const [uL, uM, uS] = slopes;
  const lPrime = 1 + uL * saturation;
  const mPrime = 1 + uM * saturation;
  const sPrime = 1 + uS * saturation;

  const l = lPrime * lPrime * lPrime;
  const m = mPrime * mPrime * mPrime;
  const s = sPrime * sPrime * sPrime;

  const rowR = rows[0];
  const rowG = rows[1];
  const rowB = rows[2];

  return [
    rowR[0] * l + rowR[1] * m + rowR[2] * s,
    rowG[0] * l + rowG[1] * m + rowG[2] * s,
    rowB[0] * l + rowB[1] * m + rowB[2] * s,
  ];
}

function resolveHueCuspDirect(hue: number, gamut: GamutTarget): HueCusp {
  const h = normalizeHue(hue);
  const hueRad = (h * Math.PI) / 180;
  const hueUnitA = Math.cos(hueRad);
  const hueUnitB = Math.sin(hueRad);

  const rows = getTargetRows(gamut);
  const slopes = resolveHueLmsPrimeSlopes(hueUnitA, hueUnitB);

  let bestSaturation = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const coeffs = channelPolynomialForSaturation(row, slopes);
    const root = findPositiveCubicRoot(coeffs);
    if (root === null || root < 0) continue;

    const [r, g, b] = evaluateTargetChannelsAtSaturation(rows, slopes, root);
    const minChannel = Math.min(r, g, b);
    if (minChannel < -HUE_CUSP_CHANNEL_EPSILON) continue;

    if (root < bestSaturation) {
      bestSaturation = root;
    }
  }

  if (!Number.isFinite(bestSaturation)) {
    return resolveHueCuspFallback(h, gamut);
  }

  const [r, g, b] = evaluateTargetChannelsAtSaturation(
    rows,
    slopes,
    bestSaturation,
  );
  const maxChannel = Math.max(r, g, b);
  if (!(maxChannel > 0)) {
    return { l: 0, c: 0 };
  }

  const l = clamp(Math.cbrt(1 / maxChannel), 0, 1);
  const c = Math.max(0, l * bestSaturation);
  return { l, c };
}

function getNormalizedHueCuspLutSize(lutSize?: number): number {
  if (!Number.isFinite(lutSize)) return DEFAULT_HUE_CUSP_LUT_SIZE;
  const normalized = Math.floor(lutSize ?? DEFAULT_HUE_CUSP_LUT_SIZE);
  return normalized >= 16 ? normalized : DEFAULT_HUE_CUSP_LUT_SIZE;
}

function getHueCuspLut(
  gamut: GamutTarget,
  lutSize?: number,
): readonly HueCusp[] {
  const size = getNormalizedHueCuspLutSize(lutSize);
  const cacheKey = `${gamut}:${size}`;
  const cached = hueCuspLutCache.get(cacheKey);
  if (cached) return cached;

  const table: HueCusp[] = [];
  for (let index = 0; index < size; index += 1) {
    const hue = (index / size) * 360;
    table.push(resolveHueCuspDirect(hue, gamut));
  }

  hueCuspLutCache.set(cacheKey, table);
  return table;
}

function sampleHueCuspLut(
  hue: number,
  gamut: GamutTarget,
  lutSize?: number,
): HueCusp {
  const table = getHueCuspLut(gamut, lutSize);
  const size = table.length;
  const h = normalizeHue(hue);
  const position = (h / 360) * size;
  const index = Math.floor(position) % size;
  const t = position - Math.floor(position);
  const nextIndex = (index + 1) % size;

  const a = table[index];
  const b = table[nextIndex];
  const interpolated = {
    l: a.l + (b.l - a.l) * t,
    c: a.c + (b.c - a.c) * t,
  };

  const candidate: Color = {
    l: interpolated.l,
    c: interpolated.c,
    h,
    alpha: 1,
  };

  // The cusp curve changes branch near sRGB blue; linear interpolation across
  // those samples can overshoot out of gamut. Fall back only for that rare case.
  if (!isInTargetGamut(candidate, gamut)) {
    return resolveHueCuspDirect(h, gamut);
  }

  return interpolated;
}

/**
 * Resolve the hue cusp: the lightness/chroma point with maximum in-gamut
 * chroma for a fixed hue.
 *
 * This avoids scanning lightness values and supports a cached LUT mode for
 * very high-throughput repeated queries (e.g. interactive wheels/overlays).
 */
export function maxChromaForHue(
  hue: number,
  options: MaxChromaForHueOptions = {},
): HueCusp {
  const gamut = options.gamut ?? 'srgb';
  const method = options.method ?? 'lut';

  if (method === 'direct') {
    return resolveHueCuspDirect(hue, gamut);
  }

  if (method === 'lut') {
    return sampleHueCuspLut(hue, gamut, options.lutSize);
  }

  throw new Error("maxChromaForHue() method must be 'direct' or 'lut'");
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
  const iterations =
    Number.isFinite(maxIterations) && maxIterations > 0
      ? Math.max(1, Math.floor(maxIterations))
      : DEFAULT_MAX_ITERATIONS;

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

function resolveHueCuspFallback(hue: number, gamut: GamutTarget): HueCusp {
  // Rare fallback: coarse scan + local refinement using the existing boundary primitive.
  const coarseSteps = 96;
  let bestLightness = 0;
  let bestChroma = 0;

  for (let index = 0; index <= coarseSteps; index += 1) {
    const l = index / coarseSteps;
    const c = maxChromaAt(l, hue, { gamut });
    if (c > bestChroma) {
      bestChroma = c;
      bestLightness = l;
    }
  }

  const step = 1 / coarseSteps;
  let lo = clamp(bestLightness - step, 0, 1);
  let hi = clamp(bestLightness + step, 0, 1);

  for (let index = 0; index < 18; index += 1) {
    const span = hi - lo;
    if (span <= 1e-6) break;
    const left = lo + span / 3;
    const right = hi - span / 3;
    const cLeft = maxChromaAt(left, hue, { gamut });
    const cRight = maxChromaAt(right, hue, { gamut });
    if (cLeft <= cRight) {
      lo = left;
      if (cRight > bestChroma) {
        bestChroma = cRight;
        bestLightness = right;
      }
    } else {
      hi = right;
      if (cLeft > bestChroma) {
        bestChroma = cLeft;
        bestLightness = left;
      }
    }
  }

  const refinedLightness = (lo + hi) / 2;
  const refinedChroma = maxChromaAt(refinedLightness, hue, { gamut });
  if (refinedChroma >= bestChroma) {
    return { l: refinedLightness, c: refinedChroma };
  }

  return { l: bestLightness, c: bestChroma };
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
 * Generate a tonal strip for a fixed hue and requested chroma.
 *
 * `clamped`: use requested chroma where available, otherwise clamp to boundary.
 * `proportional`: scale by a fixed requested/max ratio across all lightness steps.
 */
export function chromaBand(
  hue: number,
  requestedChroma: number,
  options: ChromaBandOptions = {},
): Color[] {
  if (!Number.isFinite(requestedChroma)) {
    throw new Error('chromaBand() requires a finite requestedChroma');
  }

  const steps = options.steps ?? DEFAULT_CHROMA_BAND_STEPS;
  if (!Number.isInteger(steps) || steps < 2) {
    throw new Error('chromaBand() requires steps >= 2');
  }

  const mode = options.mode ?? 'clamped';
  if (mode !== 'clamped' && mode !== 'proportional') {
    throw new Error("chromaBand() mode must be 'clamped' or 'proportional'");
  }

  const gamut = options.gamut ?? 'srgb';
  const alpha = options.alpha ?? 1;
  const h = normalizeHue(hue);
  const requested = Math.max(0, requestedChroma);
  const selectedLightness = clamp(
    options.selectedLightness ?? DEFAULT_CHROMA_BAND_SELECTED_LIGHTNESS,
    0,
    1,
  );

  const searchOptions: MaxChromaAtOptions = {
    gamut,
    tolerance: options.tolerance,
    maxIterations: options.maxIterations,
    maxChroma: options.maxChroma,
    alpha,
  };

  let proportionalRatio = 1;
  if (mode === 'proportional') {
    const selectedMax = maxChromaAt(selectedLightness, h, searchOptions);
    proportionalRatio =
      selectedMax <= 0 ? 0 : clamp(requested / selectedMax, 0, 1);
  }

  const band: Color[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const l = index / steps;
    const maxInGamut = maxChromaAt(l, h, searchOptions);
    const c =
      mode === 'proportional'
        ? proportionalRatio * maxInGamut
        : Math.min(requested, maxInGamut);

    band.push({
      l,
      c,
      h,
      alpha,
    });
  }

  return band;
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
