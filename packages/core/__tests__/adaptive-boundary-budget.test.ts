import { describe, expect, it, vi } from 'vitest';

/**
 * Counts every `maxChromaAt` search (the unit of scheduler work) by wrapping
 * the module export. Calls pass straight through to the real solver.
 */
const searches = vi.hoisted(() => ({ count: 0 }));
vi.mock('../src/gamut/max-chroma.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/gamut/max-chroma.js')>();
  return {
    ...actual,
    maxChromaAt: (...args: Parameters<typeof actual.maxChromaAt>) => {
      searches.count += 1;
      return actual.maxChromaAt(...args);
    },
  };
});

import { chromaBand } from '../src/gamut/chroma-band.js';
import {
  estimateAdaptiveBoundarySearches,
  gamutBoundaryPath,
} from '../src/gamut/boundary-path.js';
import type { GamutTarget } from '../src/gamut/types.js';

const HUES = Array.from({ length: 24 }, (_, index) => index * 15);
const GAMUTS: GamutTarget[] = ['srgb', 'display-p3'];

function meanSearches(run: (hue: number, gamut: GamutTarget) => void): number {
  let total = 0;
  for (const gamut of GAMUTS) {
    for (const hue of HUES) {
      searches.count = 0;
      run(hue, gamut);
      total += searches.count;
    }
  }
  return total / (HUES.length * GAMUTS.length);
}

describe('adaptive boundary work estimate', () => {
  const cases = [
    { adaptiveTolerance: 0.004 },
    {},
    { adaptiveTolerance: 0.00025 },
    { adaptiveTolerance: 0.0000625 },
    { adaptiveTolerance: 1e-9, adaptiveMaxDepth: 1 },
    { adaptiveTolerance: 1e-9, adaptiveMaxDepth: 2 },
  ];

  it.each(cases.map((options) => [JSON.stringify(options), options]))(
    'tracks counted maxChromaAt searches for %s',
    (_label, options) => {
      const estimate = estimateAdaptiveBoundarySearches(options);
      const boundary = meanSearches((hue, gamut) => {
        gamutBoundaryPath(hue, { ...options, gamut, samplingMode: 'adaptive' });
      });
      const band = meanSearches((hue, gamut) => {
        chromaBand(hue, 0.1, { ...options, gamut, samplingMode: 'adaptive' });
      });
      // Probes dominate: the estimate is far above the path's point count
      // and within a small factor of the searches actually run.
      for (const counted of [boundary, band]) {
        expect(estimate).toBeGreaterThan(counted / 1.5);
        expect(estimate).toBeLessThan(counted * 1.5);
      }
    },
  );
});
