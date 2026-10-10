import type { Color } from '../types.js';
import { clamp, normalizeHue } from '../utils/index.js';
import { isInTargetGamut } from './membership.js';
import {
  DEFAULT_MAX_CHROMA,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_TOLERANCE,
  type MaxChromaAtOptions,
} from './types.js';

// Bisection probe, reused across calls so the search allocates nothing.
// `isInTargetGamut` reads every field before touching its own scratch.
const PROBE: Color = { l: 0, c: 0, h: 0, alpha: 1 };

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

  const probe = PROBE;
  probe.l = l;
  probe.c = hi;
  probe.h = h;
  probe.alpha = alpha;

  // If upper bound is already in gamut, caller supplied a hard cap.
  if (isInTargetGamut(probe, gamut)) {
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
    probe.c = mid;
    if (isInTargetGamut(probe, gamut)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return lo;
}
