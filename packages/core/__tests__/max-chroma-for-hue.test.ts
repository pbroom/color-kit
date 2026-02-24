import { describe, expect, it } from 'vitest';
import {
  inP3Gamut,
  inSrgbGamut,
  maxChromaAt,
  maxChromaForHue,
} from '../src/index.js';

function bruteForceHueCusp(
  hue: number,
  gamut: 'srgb' | 'display-p3',
): { l: number; c: number } {
  const coarseSteps = 256;
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
  let lo = Math.max(0, bestLightness - step);
  let hi = Math.min(1, bestLightness + step);

  for (let index = 0; index < 18; index += 1) {
    const span = hi - lo;
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

  const l = (lo + hi) / 2;
  const c = maxChromaAt(l, hue, { gamut });
  return c >= bestChroma ? { l, c } : { l: bestLightness, c: bestChroma };
}

describe('maxChromaForHue()', () => {
  it('returns in-gamut cusp points and matches maxChromaAt at the returned lightness', () => {
    for (const hue of [0, 35, 90, 145, 215, 275, 320]) {
      const cusp = maxChromaForHue(hue, { gamut: 'srgb', method: 'direct' });
      const boundary = maxChromaAt(cusp.l, hue, { gamut: 'srgb' });

      expect(cusp.l).toBeGreaterThanOrEqual(0);
      expect(cusp.l).toBeLessThanOrEqual(1);
      expect(cusp.c).toBeGreaterThan(0);
      expect(cusp.c).toBeLessThan(0.4);
      expect(Math.abs(boundary - cusp.c)).toBeLessThan(0.0015);
      expect(inSrgbGamut({ l: cusp.l, c: cusp.c, h: hue, alpha: 1 })).toBe(
        true,
      );
    }
  });

  it('tracks brute-force peak search closely for sRGB and Display-P3', () => {
    for (const gamut of ['srgb', 'display-p3'] as const) {
      for (const hue of [18, 72, 145, 203, 288, 342]) {
        const direct = maxChromaForHue(hue, { gamut, method: 'direct' });
        const brute = bruteForceHueCusp(hue, gamut);

        expect(Math.abs(direct.l - brute.l)).toBeLessThan(0.01);
        expect(Math.abs(direct.c - brute.c)).toBeLessThan(0.002);
      }
    }
  });

  it('returns wider or equal hue cusps for Display-P3 than sRGB', () => {
    for (const hue of [0, 45, 90, 145, 180, 240, 300]) {
      const srgb = maxChromaForHue(hue, { gamut: 'srgb', method: 'direct' });
      const p3 = maxChromaForHue(hue, {
        gamut: 'display-p3',
        method: 'direct',
      });

      expect(p3.c).toBeGreaterThanOrEqual(srgb.c - 0.0005);
      expect(inP3Gamut({ l: p3.l, c: p3.c, h: hue, alpha: 1 })).toBe(true);
    }
  });

  it('supports cached LUT interpolation for high-throughput queries', () => {
    const direct = maxChromaForHue(145, { gamut: 'srgb', method: 'direct' });
    const lut = maxChromaForHue(-215, {
      gamut: 'srgb',
      method: 'lut',
      lutSize: 4096,
    });
    const normalizedDirect = maxChromaForHue(145, {
      gamut: 'srgb',
      method: 'direct',
    });
    const lutRepeat = maxChromaForHue(145, {
      gamut: 'srgb',
      method: 'lut',
      lutSize: 4096,
    });

    expect(direct).toEqual(normalizedDirect);
    expect(Math.abs(lutRepeat.l - direct.l)).toBeLessThan(0.0025);
    expect(Math.abs(lutRepeat.c - direct.c)).toBeLessThan(0.0015);
    expect(Math.abs(lut.l - direct.l)).toBeLessThan(0.0025);
    expect(Math.abs(lut.c - direct.c)).toBeLessThan(0.0015);
  });

  it('keeps LUT interpolation in gamut across the sRGB blue cusp branch crossover', () => {
    for (let hue = 264.03; hue <= 264.1; hue += 0.01) {
      const lut = maxChromaForHue(hue, {
        gamut: 'srgb',
        method: 'lut',
        lutSize: 4096,
      });
      const boundary = maxChromaAt(lut.l, hue, { gamut: 'srgb' });

      expect(inSrgbGamut({ l: lut.l, c: lut.c, h: hue, alpha: 1 })).toBe(true);
      expect(lut.c).toBeLessThanOrEqual(boundary + 0.0005);
    }
  });

  it('does not miss the first cubic boundary root near the sRGB blue cusp', () => {
    const hue = 264.05;
    const direct = maxChromaForHue(hue, { gamut: 'srgb', method: 'direct' });

    expect(Math.abs(direct.l - 0.4899233835688325)).toBeLessThan(0.0002);
    expect(Math.abs(direct.c - 0.28770887901836667)).toBeLessThan(0.0002);
  });
});
