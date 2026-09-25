import type { Color } from '../types.js';
import { clamp, normalizeHue } from '../utils/index.js';
import { isInTargetGamut } from './membership.js';
import {
  DEFAULT_MAX_CHROMA,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_TOLERANCE,
  type MaxChromaAtOptions,
} from './types.js';

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
