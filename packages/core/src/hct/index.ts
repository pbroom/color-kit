import { Hct as MaterialHct } from '@material/material-color-utilities';
import { clamp, normalizeHue } from '../utils/index.js';

const HCT_MAX_CHROMA_PROBE = 200;
const DEFAULT_HCT_HUE_PEAK_LUT_SIZE = 4096;
const MIN_HCT_HUE_PEAK_LUT_SIZE = 16;
const DIRECT_TONE_COARSE_STEP = 1;
const DIRECT_TONE_REFINE_ITERATIONS = 18;
const DIRECT_TONE_REFINE_EPSILON = 0.0001;

export interface HctHuePeak {
  /** Maximum realized HCT chroma for the requested hue. */
  c: number;
  /** Fractional HCT tone (0-100) where the max chroma occurs. */
  t: number;
}

export type MaxHctChromaForHueMethod = 'lut' | 'direct';

export interface MaxHctChromaForHueOptions {
  /**
   * `lut` uses a cached hue lookup table for maximum throughput across repeated
   * calls. `direct` performs a per-call tone search + local refinement.
   * @default 'lut'
   */
  method?: MaxHctChromaForHueMethod;
  /**
   * Number of evenly spaced hue samples in the cached LUT.
   * Higher values increase warm-up cost and reduce interpolation error.
   * @default 4096
   */
  lutSize?: number;
}

const hctHuePeakLutCache = new Map<string, readonly HctHuePeak[]>();

function clampTone(tone: number): number {
  return clamp(tone, 0, 100);
}

function sanitizeChroma(chroma: number): number {
  if (!Number.isFinite(chroma)) return 0;
  return Math.max(0, chroma);
}

function resolveHctMaxChromaAtToneNormalized(
  normalizedHue: number,
  tone: number,
): number {
  const t = clampTone(tone);
  return sanitizeChroma(
    MaterialHct.from(normalizedHue, HCT_MAX_CHROMA_PROBE, t).chroma,
  );
}

function resolveHctMaxChromaAtTone(hue: number, tone: number): number {
  return resolveHctMaxChromaAtToneNormalized(normalizeHue(hue), tone);
}

export function maxHctChromaAtTone(hue: number, tone: number): number {
  return resolveHctMaxChromaAtTone(hue, tone);
}

function getNormalizedHuePeakLutSize(lutSize?: number): number {
  if (!Number.isFinite(lutSize)) return DEFAULT_HCT_HUE_PEAK_LUT_SIZE;
  const normalized = Math.floor(lutSize ?? DEFAULT_HCT_HUE_PEAK_LUT_SIZE);
  return normalized >= MIN_HCT_HUE_PEAK_LUT_SIZE
    ? normalized
    : DEFAULT_HCT_HUE_PEAK_LUT_SIZE;
}

function resolveHctHuePeakDirect(hue: number): HctHuePeak {
  const normalizedHue = normalizeHue(hue);

  let coarseBestTone = 0;
  let coarseBestChroma = -1;

  for (let tone = 0; tone <= 100; tone += DIRECT_TONE_COARSE_STEP) {
    const chroma = resolveHctMaxChromaAtTone(normalizedHue, tone);
    if (chroma > coarseBestChroma) {
      coarseBestChroma = chroma;
      coarseBestTone = tone;
    }
  }

  if (coarseBestChroma < 0) {
    return { c: 0, t: 0 };
  }

  let lo = clampTone(coarseBestTone - DIRECT_TONE_COARSE_STEP);
  let hi = clampTone(coarseBestTone + DIRECT_TONE_COARSE_STEP);
  let refinedBestTone = coarseBestTone;
  let refinedBestChroma = coarseBestChroma;

  for (let index = 0; index < DIRECT_TONE_REFINE_ITERATIONS; index += 1) {
    const span = hi - lo;
    if (span <= DIRECT_TONE_REFINE_EPSILON) break;

    const left = lo + span / 3;
    const right = hi - span / 3;
    const cLeft = resolveHctMaxChromaAtToneNormalized(normalizedHue, left);
    const cRight = resolveHctMaxChromaAtToneNormalized(normalizedHue, right);

    if (cLeft > refinedBestChroma) {
      refinedBestChroma = cLeft;
      refinedBestTone = left;
    }
    if (cRight > refinedBestChroma) {
      refinedBestChroma = cRight;
      refinedBestTone = right;
    }

    if (cLeft <= cRight) {
      lo = left;
    } else {
      hi = right;
    }
  }

  const midpoint = (lo + hi) / 2;
  const midpointChroma = resolveHctMaxChromaAtToneNormalized(
    normalizedHue,
    midpoint,
  );
  if (midpointChroma > refinedBestChroma) {
    refinedBestChroma = midpointChroma;
    refinedBestTone = midpoint;
  }

  if (refinedBestChroma + 1e-12 < coarseBestChroma) {
    return {
      c: sanitizeChroma(coarseBestChroma),
      t: clampTone(coarseBestTone),
    };
  }

  return {
    c: sanitizeChroma(refinedBestChroma),
    t: clampTone(refinedBestTone),
  };
}

function getHctHuePeakLut(lutSize?: number): readonly HctHuePeak[] {
  const size = getNormalizedHuePeakLutSize(lutSize);
  const key = `hct-hue-peak:${size}`;
  const cached = hctHuePeakLutCache.get(key);
  if (cached) return cached;

  const table: HctHuePeak[] = [];
  for (let index = 0; index < size; index += 1) {
    const hue = (index / size) * 360;
    table.push(resolveHctHuePeakDirect(hue));
  }

  hctHuePeakLutCache.set(key, table);
  return table;
}

function sampleHctHuePeakLut(hue: number, lutSize?: number): HctHuePeak {
  const table = getHctHuePeakLut(lutSize);
  const size = table.length;
  const normalizedHue = normalizeHue(hue);
  const position = (normalizedHue / 360) * size;
  const baseIndex = Math.floor(position) % size;
  const nextIndex = (baseIndex + 1) % size;
  const t = position - Math.floor(position);

  const a = table[baseIndex];
  const b = table[nextIndex];
  return {
    c: sanitizeChroma(a.c + (b.c - a.c) * t),
    t: clampTone(a.t + (b.t - a.t) * t),
  };
}

function resolveHctHuePeak(
  hue: number,
  options: MaxHctChromaForHueOptions = {},
): HctHuePeak {
  const method = options.method ?? 'lut';

  if (method === 'direct') {
    return resolveHctHuePeakDirect(hue);
  }

  if (method === 'lut') {
    return sampleHctHuePeakLut(hue, options.lutSize);
  }

  throw new Error("maxHctChromaForHue() method must be 'lut' or 'direct'");
}

/**
 * Resolve the HCT hue peak: the maximum realized HCT chroma for a hue and the
 * fractional tone where that peak occurs.
 *
 * Uses Material HCT (default viewing conditions), which is based on an sRGB
 * rendering pipeline and may quantize the result through the underlying solver.
 */
export function maxHctChromaForHue(
  hue: number,
  options: MaxHctChromaForHueOptions = {},
): HctHuePeak {
  return resolveHctHuePeak(hue, options);
}

/**
 * Convenience helper for the tone component of `maxHctChromaForHue(...)`.
 *
 * Returns the fractional HCT tone (0-100) at which the maximum realized HCT
 * chroma occurs for the provided hue.
 */
export function maxHctPeakToneForHue(
  hue: number,
  options: MaxHctChromaForHueOptions = {},
): number {
  return maxHctChromaForHue(hue, options).t;
}
