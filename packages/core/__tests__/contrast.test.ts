import { describe, it, expect } from 'vitest';
import { contrastRatio, meetsAA, meetsAAA, fromHex } from '../src/index.js';

describe('Contrast ratio', () => {
  it('should return 21:1 for black on white', () => {
    const black = fromHex('#000000');
    const white = fromHex('#ffffff');
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
  });

  it('should return 1:1 for same color', () => {
    const red = fromHex('#ff0000');
    expect(contrastRatio(red, red)).toBeCloseTo(1, 0);
  });

  it('should be symmetrical', () => {
    const a = fromHex('#336699');
    const b = fromHex('#ffffff');
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 4);
  });
});

describe('WCAG compliance', () => {
  it('should pass AA for black on white', () => {
    const black = fromHex('#000000');
    const white = fromHex('#ffffff');
    expect(meetsAA(black, white)).toBe(true);
  });

  it('should pass AAA for black on white', () => {
    const black = fromHex('#000000');
    const white = fromHex('#ffffff');
    expect(meetsAAA(black, white)).toBe(true);
  });

  it('should fail AA for low contrast', () => {
    const gray1 = fromHex('#777777');
    const gray2 = fromHex('#888888');
    expect(meetsAA(gray1, gray2)).toBe(false);
  });
});
