import { describe, expect, it } from 'vitest';
import { inP3Gamut, inSrgbGamut, maxChromaAt } from '../src/index.js';

describe('maxChromaAt()', () => {
  it('returns zero at lightness extremes', () => {
    expect(maxChromaAt(0, 120)).toBe(0);
    expect(maxChromaAt(1, 120)).toBe(0);
  });

  it('resolves an in-gamut boundary chroma for sRGB', () => {
    const l = 0.85;
    const h = 145;
    const c = maxChromaAt(l, h, { gamut: 'srgb' });

    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(0.399);
    expect(inSrgbGamut({ l, c, h, alpha: 1 })).toBe(true);
    expect(inSrgbGamut({ l, c: c + 0.01, h, alpha: 1 })).toBe(false);
  });

  it('returns wider or equal bounds for Display-P3 compared with sRGB', () => {
    const l = 0.7;
    const h = 145;
    const srgb = maxChromaAt(l, h, { gamut: 'srgb' });
    const p3 = maxChromaAt(l, h, { gamut: 'display-p3' });

    expect(p3).toBeGreaterThanOrEqual(srgb);
    expect(inP3Gamut({ l, c: p3, h, alpha: 1 })).toBe(true);
  });

  it('is deterministic and respects custom bounds', () => {
    const first = maxChromaAt(0.62, 215, {
      gamut: 'display-p3',
      tolerance: 0.00001,
      maxIterations: 40,
    });
    const second = maxChromaAt(0.62, 215, {
      gamut: 'display-p3',
      tolerance: 0.00001,
      maxIterations: 40,
    });
    const capped = maxChromaAt(0.62, 215, {
      gamut: 'display-p3',
      maxChroma: 0.05,
    });

    expect(first).toBe(second);
    expect(capped).toBeLessThanOrEqual(0.05);
  });

  it('runs at least one iteration for fractional maxIterations', () => {
    const l = 0.85;
    const h = 145;
    const c = maxChromaAt(l, h, {
      gamut: 'srgb',
      maxIterations: 0.5,
    });

    expect(c).toBeGreaterThan(0);
    expect(inSrgbGamut({ l, c, h, alpha: 1 })).toBe(true);
  });
});
