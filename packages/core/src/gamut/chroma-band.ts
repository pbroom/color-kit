import type { Color } from '../types.js';
import { clamp, normalizeHue } from '../utils/index.js';
import { gamutBoundaryPath } from './boundary-path.js';
import { maxChromaAt } from './max-chroma.js';
import type {
  ChromaBandOptions,
  GamutBoundaryPoint,
  MaxChromaAtOptions,
} from './types.js';

const DEFAULT_CHROMA_BAND_STEPS = 12;
const DEFAULT_CHROMA_BAND_SELECTED_LIGHTNESS = 0.5;
const CHROMA_BAND_CROSSING_EPSILON = 1e-7;
const CHROMA_BAND_CROSSING_ITERATIONS = 18;

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

  const mode = options.mode ?? 'clamped';
  if (mode !== 'clamped' && mode !== 'proportional') {
    throw new Error("chromaBand() mode must be 'clamped' or 'proportional'");
  }
  const samplingMode = options.samplingMode ?? 'uniform';
  if (samplingMode !== 'uniform' && samplingMode !== 'adaptive') {
    throw new Error(
      "chromaBand() samplingMode must be 'uniform' or 'adaptive'",
    );
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

  if (samplingMode === 'adaptive') {
    const boundary = gamutBoundaryPath(h, {
      ...searchOptions,
      samplingMode: 'adaptive',
      adaptiveTolerance: options.adaptiveTolerance,
      adaptiveMaxDepth: options.adaptiveMaxDepth,
    });
    if (boundary.length === 0) {
      return [];
    }

    const mapBoundaryChroma = (boundaryChroma: number): number =>
      mode === 'proportional'
        ? proportionalRatio * boundaryChroma
        : Math.min(requested, boundaryChroma);

    const maxChromaAtBound = (lightness: number): number =>
      maxChromaAt(lightness, h, searchOptions);

    const resolveCrossingLightness = (
      a: GamutBoundaryPoint,
      b: GamutBoundaryPoint,
    ): number => {
      let lo = a.l;
      let hi = b.l;
      let loDelta = a.c - requested;
      if (lo > hi) {
        lo = b.l;
        hi = a.l;
        loDelta = b.c - requested;
      }
      for (let i = 0; i < CHROMA_BAND_CROSSING_ITERATIONS; i += 1) {
        const mid = (lo + hi) / 2;
        const midDelta = maxChromaAtBound(mid) - requested;
        if (Math.abs(midDelta) <= CHROMA_BAND_CROSSING_EPSILON) {
          return mid;
        }
        const oppositeSigns =
          (loDelta < 0 && midDelta > 0) || (loDelta > 0 && midDelta < 0);
        if (oppositeSigns) {
          hi = mid;
        } else {
          lo = mid;
          loDelta = midDelta;
        }
      }
      return (lo + hi) / 2;
    };

    const adaptiveBand: Color[] = [];
    const append = (lightness: number, chroma: number) => {
      adaptiveBand.push({
        l: lightness,
        c: chroma,
        h,
        alpha,
      });
    };

    append(boundary[0].l, mapBoundaryChroma(boundary[0].c));
    for (let index = 1; index < boundary.length; index += 1) {
      const prev = boundary[index - 1];
      const next = boundary[index];
      if (mode === 'clamped') {
        const prevDelta = prev.c - requested;
        const nextDelta = next.c - requested;
        const crossesRequested =
          (prevDelta < 0 && nextDelta > 0) || (prevDelta > 0 && nextDelta < 0);
        if (crossesRequested) {
          const crossingLightness = resolveCrossingLightness(prev, next);
          append(crossingLightness, requested);
        }
      }
      append(next.l, mapBoundaryChroma(next.c));
    }

    return adaptiveBand;
  }

  const steps = options.steps ?? DEFAULT_CHROMA_BAND_STEPS;
  if (!Number.isInteger(steps) || steps < 2) {
    throw new Error('chromaBand() requires steps >= 2');
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
