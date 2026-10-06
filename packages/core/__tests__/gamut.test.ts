import { describe, it, expect } from 'vitest';
import {
  inSrgbGamut,
  inP3Gamut,
  maxChromaAt,
  toSrgbGamut,
  toSrgbGamutInto,
  toP3Gamut,
  toP3GamutInto,
  toHex,
} from '../src/index.js';
import type { Color } from '../src/index.js';

describe('inSrgbGamut()', () => {
  it('should return true for colors within sRGB', () => {
    // Pure red in OKLCH. Note the 4-decimal rounding oklch(0.6279 0.2577
    // 29.23) is *not* in sRGB: its green channel encodes to -6.4e-4, beyond
    // the 7.5e-5 encoded-channel epsilon used by CSS Color 4 / colorjs.io.
    const red: Color = { l: 0.627955, c: 0.257683, h: 29.2339, alpha: 1 };
    expect(inSrgbGamut(red)).toBe(true);
    expect(inSrgbGamut({ l: 0.6279, c: 0.2577, h: 29.23, alpha: 1 })).toBe(
      false,
    );
  });

  it('should return true for black', () => {
    const black: Color = { l: 0, c: 0, h: 0, alpha: 1 };
    expect(inSrgbGamut(black)).toBe(true);
  });

  it('should return true for white', () => {
    const white: Color = { l: 1, c: 0, h: 0, alpha: 1 };
    expect(inSrgbGamut(white)).toBe(true);
  });

  it('should return false for out-of-gamut colors', () => {
    // Very high chroma green — outside sRGB
    const outOfGamut: Color = { l: 0.85, c: 0.4, h: 145, alpha: 1 };
    expect(inSrgbGamut(outOfGamut)).toBe(false);
  });

  it('should return false for extreme chroma at any hue', () => {
    const extreme: Color = { l: 0.5, c: 0.35, h: 270, alpha: 1 };
    expect(inSrgbGamut(extreme)).toBe(false);
  });
});

describe('inP3Gamut()', () => {
  it('should return true for colors within sRGB (subset of P3)', () => {
    const red: Color = { l: 0.6279, c: 0.2577, h: 29.23, alpha: 1 };
    expect(inP3Gamut(red)).toBe(true);
  });

  it('should return false for extreme out-of-gamut colors', () => {
    const extreme: Color = { l: 0.5, c: 0.4, h: 145, alpha: 1 };
    expect(inP3Gamut(extreme)).toBe(false);
  });
});

describe('toSrgbGamut()', () => {
  it('should return the same color if already in gamut', () => {
    const inGamut: Color = { l: 0.5, c: 0.05, h: 200, alpha: 1 };
    expect(inSrgbGamut(inGamut)).toBe(true);
    const result = toSrgbGamut(inGamut);
    expect(result.c).toBeCloseTo(inGamut.c, 4);
    expect(result.l).toBe(inGamut.l);
    expect(result.h).toBe(inGamut.h);
  });

  it('should reduce chroma for out-of-gamut colors', () => {
    const outOfGamut: Color = { l: 0.85, c: 0.4, h: 145, alpha: 1 };
    expect(inSrgbGamut(outOfGamut)).toBe(false);

    const mapped = toSrgbGamut(outOfGamut);
    expect(inSrgbGamut(mapped)).toBe(true);
    expect(mapped.c).toBeLessThan(outOfGamut.c);
    expect(mapped.l).toBe(outOfGamut.l);
    expect(mapped.h).toBe(outOfGamut.h);
  });

  it('should produce a valid hex color after mapping', () => {
    const outOfGamut: Color = { l: 0.7, c: 0.35, h: 150, alpha: 1 };
    const mapped = toSrgbGamut(outOfGamut);
    const hex = toHex(mapped);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('should map chromatic endpoint colors to true black and white', () => {
    const chromaticBlack: Color = { l: 0, c: 0.211, h: 28, alpha: 1 };
    const chromaticWhite: Color = { l: 1, c: 0.211, h: 28, alpha: 1 };

    expect(toHex(toSrgbGamut(chromaticBlack))).toBe('#000000');
    expect(toHex(toSrgbGamut(chromaticWhite))).toBe('#ffffff');
  });
});

describe('toP3Gamut()', () => {
  it('should reduce chroma for out-of-P3 colors', () => {
    const extreme: Color = { l: 0.5, c: 0.4, h: 145, alpha: 1 };
    expect(inP3Gamut(extreme)).toBe(false);

    const mapped = toP3Gamut(extreme);
    expect(inP3Gamut(mapped)).toBe(true);
    expect(mapped.c).toBeLessThan(extreme.c);
  });

  it('should reduce chromatic endpoint colors to achromatic endpoints', () => {
    const chromaticBlack: Color = { l: 0, c: 0.211, h: 28, alpha: 1 };
    const chromaticWhite: Color = { l: 1, c: 0.211, h: 28, alpha: 1 };

    expect(toP3Gamut(chromaticBlack).c).toBe(0);
    expect(toP3Gamut(chromaticWhite).c).toBe(0);
  });
});

describe('gamut mapping method option', () => {
  const vivid: Color = { l: 0.7, c: 0.35, h: 150, alpha: 0.8 };

  it('defaults to chroma reduction at fixed L and h', () => {
    const mapped = toSrgbGamut(vivid);
    expect(mapped).toEqual(toSrgbGamut(vivid, { method: 'chroma-reduction' }));
    expect(mapped).toEqual(toSrgbGamut(vivid, {}));
    expect(mapped.l).toBe(vivid.l);
    expect(mapped.h).toBe(vivid.h);
    expect(mapped.c).toBeCloseTo(0.193, 3);
  });

  it('css keeps more chroma, like CSS Color 4 / colorjs.io', () => {
    const mapped = toSrgbGamut(vivid, { method: 'css' });
    expect(inSrgbGamut(mapped)).toBe(true);
    expect(mapped.c).toBeCloseTo(0.21, 2);
    expect(mapped.c).toBeGreaterThan(toSrgbGamut(vivid).c);
    expect(mapped.alpha).toBe(vivid.alpha);
    // Small L / h drift, bounded by the clip JND.
    expect(Math.abs(mapped.l - vivid.l)).toBeLessThan(0.02);
    expect(Math.abs(mapped.h - vivid.h)).toBeLessThan(3);

    const p3 = toP3Gamut({ ...vivid, c: 0.4 }, { method: 'css' });
    expect(inP3Gamut(p3)).toBe(true);
  });

  it('returns in-gamut colors and lightness endpoints unchanged with css', () => {
    const inGamut: Color = { l: 0.6, c: 0.1, h: 40, alpha: 1 };
    expect(toSrgbGamut(inGamut, { method: 'css' })).toEqual(inGamut);
    expect(toP3Gamut(inGamut, { method: 'css' })).toEqual(inGamut);
    const white: Color = { l: 1, c: 0.2, h: 40, alpha: 1 };
    expect(toSrgbGamut(white, { method: 'css' })).toEqual({
      l: 1,
      c: 0,
      h: 40,
      alpha: 1,
    });
  });

  it('Into variants match and may alias their input', () => {
    for (const method of ['chroma-reduction', 'css'] as const) {
      const expected = toSrgbGamut(vivid, { method });
      const inPlace = { ...vivid };
      expect(toSrgbGamutInto(inPlace, inPlace, { method })).toEqual(expected);
      const p3 = { ...vivid, c: 0.4 };
      expect(
        toP3GamutInto({ l: 0, c: 0, h: 0, alpha: 1 }, p3, { method }),
      ).toEqual(toP3Gamut(p3, { method }));
    }
  });

  it('still works as an Array.prototype.map callback', () => {
    const colors = [vivid, { ...vivid, h: 30 }];
    expect(colors.map(toSrgbGamut)).toEqual(
      colors.map((color) => toSrgbGamut(color)),
    );
  });
});

describe('maxChromaAt()', () => {
  it('agrees with the membership test across repeated calls', () => {
    for (let i = 0; i < 50; i += 1) {
      const l = 0.05 + (i / 50) * 0.9;
      const h = (i * 37) % 360;
      const c = maxChromaAt(l, h);
      expect(inSrgbGamut({ l, c, h, alpha: 1 })).toBe(true);
      expect(inSrgbGamut({ l, c: c + 2e-4, h, alpha: 1 })).toBe(false);
    }
  });
});
