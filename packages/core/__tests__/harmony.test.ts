import { describe, it, expect } from 'vitest';
import {
  complementary,
  analogous,
  triadic,
  tetradic,
  splitComplementary,
} from '../src/index.js';
import type { Color } from '../src/index.js';

const red: Color = { l: 0.6, c: 0.25, h: 0, alpha: 1 };

describe('complementary()', () => {
  it('should shift hue by 180 degrees', () => {
    const result = complementary(red);
    expect(result.h).toBeCloseTo(180, 1);
    expect(result.l).toBe(red.l);
    expect(result.c).toBe(red.c);
  });
});

describe('analogous()', () => {
  it('should return 3 colors', () => {
    const result = analogous(red);
    expect(result).toHaveLength(3);
  });

  it('should use default 30 degree spread', () => {
    const result = analogous(red);
    expect(result[0].h).toBeCloseTo(330, 1);
    expect(result[1].h).toBeCloseTo(0, 1);
    expect(result[2].h).toBeCloseTo(30, 1);
  });
});

describe('triadic()', () => {
  it('should return 3 colors equally spaced', () => {
    const result = triadic(red);
    expect(result).toHaveLength(3);
    expect(result[0].h).toBeCloseTo(0, 1);
    expect(result[1].h).toBeCloseTo(120, 1);
    expect(result[2].h).toBeCloseTo(240, 1);
  });
});

describe('tetradic()', () => {
  it('should return 4 colors equally spaced', () => {
    const result = tetradic(red);
    expect(result).toHaveLength(4);
    expect(result[0].h).toBeCloseTo(0, 1);
    expect(result[1].h).toBeCloseTo(90, 1);
    expect(result[2].h).toBeCloseTo(180, 1);
    expect(result[3].h).toBeCloseTo(270, 1);
  });
});

describe('splitComplementary()', () => {
  it('should return 3 colors', () => {
    const result = splitComplementary(red);
    expect(result).toHaveLength(3);
    expect(result[0].h).toBeCloseTo(0, 1);
    expect(result[1].h).toBeCloseTo(150, 1);
    expect(result[2].h).toBeCloseTo(210, 1);
  });
});
