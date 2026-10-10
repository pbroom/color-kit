import type { Color } from '../types.js';
import { clamp, normalizeHue } from '../utils/index.js';
import { isInTargetGamut } from './membership.js';
import { assertGamutTarget } from './target.js';
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
 * Returns the maximum in-gamut OKLCH chroma at a given lightness and hue.
 *
 * This is the geometry primitive used by gamut boundary overlays and
 * model-accurate hue/chroma gradient generation. It bisects chroma between 0
 * and `options.maxChroma` and returns the in-gamut end of the final interval,
 * so the true boundary can sit up to `options.tolerance` higher. Lightness is
 * clamped to `[0, 1]` (0 and 1 return `0`), hue is wrapped, and when
 * `maxChroma` itself is in gamut it is returned as a cap. Allocation-free.
 *
 * @param lightness - OKLCH lightness, 0-1.
 * @param hue - OKLCH hue in degrees.
 * @param options - Target gamut and search settings.
 * @returns Chroma in `[0, options.maxChroma]`.
 * @throws {TypeError} When `options.gamut` is not `'srgb'` or `'display-p3'`.
 * @see {@link maxChromaForHue}
 * @see {@link gamutBoundaryPath}
 *
 * @example
 * ```ts
 * import { maxChromaAt } from 'color-kit';
 *
 * maxChromaAt(0.6, 250); // → 0.16982421875
 * maxChromaAt(0.6, 250, { gamut: 'display-p3' }); // → 0.21923828125
 * ```
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
  assertGamutTarget(gamut, 'maxChromaAt()');

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
