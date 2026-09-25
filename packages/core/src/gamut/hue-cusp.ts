import type { Color } from '../types.js';
import { OKLAB_TO_LMS } from '../conversion/matrices.js';
import { clamp, normalizeHue } from '../utils/index.js';
import { findPositiveCubicRoot, type CubicCoefficients } from './cubic.js';
import { maxChromaAt } from './max-chroma.js';
import {
  getTargetRows,
  isInTargetGamut,
  type TargetRow,
  type TargetRows,
} from './membership.js';
import type { GamutTarget, HueCusp, MaxChromaForHueOptions } from './types.js';

const DEFAULT_HUE_CUSP_LUT_SIZE = 4096;
const HUE_CUSP_CHANNEL_EPSILON = 1e-7;

const OKLAB_LMS_PRIME_COEFFICIENTS = {
  l: { a: OKLAB_TO_LMS[0][1], b: OKLAB_TO_LMS[0][2] },
  m: { a: OKLAB_TO_LMS[1][1], b: OKLAB_TO_LMS[1][2] },
  s: { a: OKLAB_TO_LMS[2][1], b: OKLAB_TO_LMS[2][2] },
} as const;

const hueCuspLutCache = new Map<string, readonly HueCusp[]>();

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
