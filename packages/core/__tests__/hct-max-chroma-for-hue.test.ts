import { Hct as MaterialHct } from '@material/material-color-utilities';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  maxHctChromaForHue,
  maxHctPeakToneForHue,
  type MaxHctChromaForHueMethod,
} from '../src/index.js';

const HCT_TEST_LUT_SIZE = 4096;

function normalizeHueLocal(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function maxChromaAtTone(hue: number, tone: number): number {
  const h = normalizeHueLocal(hue);
  const t = Math.min(Math.max(tone, 0), 100);
  return Math.max(0, MaterialHct.from(h, 200, t).chroma);
}

function bruteForceHuePeak(hue: number): { c: number; t: number } {
  let bestTone = 0;
  let bestChroma = -1;

  for (let tone = 0; tone <= 100; tone += 1) {
    const chroma = maxChromaAtTone(hue, tone);
    if (chroma > bestChroma) {
      bestChroma = chroma;
      bestTone = tone;
    }
  }

  const lo = Math.max(0, bestTone - 1);
  const hi = Math.min(100, bestTone + 1);

  // Independent dense local sampling baseline (not ternary search).
  const localSamples = 240;
  for (let index = 0; index <= localSamples; index += 1) {
    const tone = lo + ((hi - lo) * index) / localSamples;
    const chroma = maxChromaAtTone(hue, tone);
    if (chroma > bestChroma) {
      bestChroma = chroma;
      bestTone = tone;
    }
  }

  return { c: bestChroma, t: bestTone };
}

describe('maxHctChromaForHue()', () => {
  beforeAll(() => {
    // Warm the expensive LUT outside individual test timeouts for slower CI runners.
    maxHctChromaForHue(0, { method: 'lut', lutSize: HCT_TEST_LUT_SIZE });
  }, 15_000);

  it('returns bounded direct-mode hue peaks and wrapper-consistent tones', () => {
    for (const hue of [0, 35, 90, 145, 215, 275, 320]) {
      const peak = maxHctChromaForHue(hue, { method: 'direct' });
      const actualAtTone = maxChromaAtTone(hue, peak.t);
      const toneOnly = maxHctPeakToneForHue(hue, { method: 'direct' });

      expect(peak.t).toBeGreaterThanOrEqual(0);
      expect(peak.t).toBeLessThanOrEqual(100);
      expect(peak.c).toBeGreaterThanOrEqual(0);
      expect(Math.abs(actualAtTone - peak.c)).toBeLessThan(0.000001);
      expect(toneOnly).toBe(peak.t);
    }
  });

  it('tracks a brute-force baseline in direct mode', () => {
    for (const hue of [12, 48, 90, 145, 203, 288, 342]) {
      const direct = maxHctChromaForHue(hue, { method: 'direct' });
      const brute = bruteForceHuePeak(hue);

      expect(Math.abs(direct.t - brute.t)).toBeLessThan(1);
      expect(Math.abs(direct.c - brute.c)).toBeLessThan(1);
    }
  });

  it('returns LUT results close to direct mode for representative hues', () => {
    for (const hue of [0, 27, 73, 145, 199, 251, 319]) {
      const direct = maxHctChromaForHue(hue, { method: 'direct' });
      const lut = maxHctChromaForHue(hue, {
        method: 'lut',
        lutSize: HCT_TEST_LUT_SIZE,
      });

      expect(Math.abs(lut.t - direct.t)).toBeLessThan(0.75);
      expect(Math.abs(lut.c - direct.c)).toBeLessThan(0.75);
    }
  });

  it('normalizes hue input consistently', () => {
    const cases = [
      [0, 360],
      [0, 720],
      [0, -360],
      [145, -215],
    ] as const;

    for (const [aHue, bHue] of cases) {
      const aDirect = maxHctChromaForHue(aHue, { method: 'direct' });
      const bDirect = maxHctChromaForHue(bHue, { method: 'direct' });
      const aLut = maxHctChromaForHue(aHue, {
        method: 'lut',
        lutSize: HCT_TEST_LUT_SIZE,
      });
      const bLut = maxHctChromaForHue(bHue, {
        method: 'lut',
        lutSize: HCT_TEST_LUT_SIZE,
      });

      expect(aDirect).toEqual(bDirect);
      expect(aLut).toEqual(bLut);

      expect(maxHctPeakToneForHue(aHue, { method: 'direct' })).toBe(aDirect.t);
      expect(maxHctPeakToneForHue(bHue, { method: 'direct' })).toBe(bDirect.t);
      expect(
        maxHctPeakToneForHue(aHue, {
          method: 'lut',
          lutSize: HCT_TEST_LUT_SIZE,
        }),
      ).toBe(aLut.t);
      expect(
        maxHctPeakToneForHue(bHue, {
          method: 'lut',
          lutSize: HCT_TEST_LUT_SIZE,
        }),
      ).toBe(bLut.t);
    }
  });

  it('is deterministic for direct and LUT modes after cache warm-up', () => {
    const hue = 145;
    const directA = maxHctChromaForHue(hue, { method: 'direct' });
    const directB = maxHctChromaForHue(hue, { method: 'direct' });

    const lutA = maxHctChromaForHue(hue, {
      method: 'lut',
      lutSize: HCT_TEST_LUT_SIZE,
    });
    const lutB = maxHctChromaForHue(hue, {
      method: 'lut',
      lutSize: HCT_TEST_LUT_SIZE,
    });

    expect(directA).toEqual(directB);
    expect(lutA).toEqual(lutB);
    expect(maxHctPeakToneForHue(hue, { method: 'direct' })).toBe(directA.t);
    expect(
      maxHctPeakToneForHue(hue, {
        method: 'lut',
        lutSize: HCT_TEST_LUT_SIZE,
      }),
    ).toBe(lutA.t);
  });

  it('keeps the tone-only helper exactly aligned with the full peak helper', () => {
    const methods: MaxHctChromaForHueMethod[] = ['direct', 'lut'];
    for (const method of methods) {
      for (const hue of [0, 30, 90, 145, 180, 240, 330]) {
        const options =
          method === 'lut'
            ? ({ method, lutSize: HCT_TEST_LUT_SIZE } as const)
            : ({ method } as const);

        expect(maxHctPeakToneForHue(hue, options)).toBe(
          maxHctChromaForHue(hue, options).t,
        );
      }
    }
  });
});
