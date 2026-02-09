import { describe, it, expect } from 'vitest';
import {
  inSrgbGamut,
  inP3Gamut,
  toSrgbGamut,
  toP3Gamut,
  toHex,
} from '../src/index.js';
import type { Color } from '../src/index.js';

describe('inSrgbGamut()', () => {
  it('should return true for colors within sRGB', () => {
    // Pure red in OKLCH
    const red: Color = { l: 0.6279, c: 0.2577, h: 29.23, alpha: 1 };
    expect(inSrgbGamut(red)).toBe(true);
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
});

describe('toP3Gamut()', () => {
  it('should reduce chroma for out-of-P3 colors', () => {
    const extreme: Color = { l: 0.5, c: 0.4, h: 145, alpha: 1 };
    expect(inP3Gamut(extreme)).toBe(false);

    const mapped = toP3Gamut(extreme);
    expect(inP3Gamut(mapped)).toBe(true);
    expect(mapped.c).toBeLessThan(extreme.c);
  });
});
