import { describe, it, expect } from 'vitest';
import { generateScale, lightnessScale, interpolate } from '../src/index.js';
import type { Color } from '../src/index.js';

const red: Color = { l: 0.6, c: 0.25, h: 30, alpha: 1 };
const blue: Color = { l: 0.5, c: 0.2, h: 250, alpha: 1 };

describe('interpolate()', () => {
  it('should return color1 at t=0', () => {
    const result = interpolate(red, blue, 0);
    expect(result.l).toBeCloseTo(red.l, 4);
    expect(result.c).toBeCloseTo(red.c, 4);
  });

  it('should return color2 at t=1', () => {
    const result = interpolate(red, blue, 1);
    expect(result.l).toBeCloseTo(blue.l, 4);
    expect(result.c).toBeCloseTo(blue.c, 4);
  });

  it('should return midpoint at t=0.5', () => {
    const result = interpolate(red, blue, 0.5);
    expect(result.l).toBeCloseTo(0.55, 2);
  });
});

describe('generateScale()', () => {
  it('should return correct number of steps', () => {
    const scale = generateScale(red, blue, 5);
    expect(scale).toHaveLength(5);
  });

  it('should start with from and end with to', () => {
    const scale = generateScale(red, blue, 3);
    expect(scale[0].l).toBeCloseTo(red.l, 4);
    expect(scale[2].l).toBeCloseTo(blue.l, 4);
  });

  it('should throw for steps < 2', () => {
    expect(() => generateScale(red, blue, 1)).toThrow();
  });
});

describe('lightnessScale()', () => {
  it('should return correct number of steps', () => {
    const scale = lightnessScale(red, 5);
    expect(scale).toHaveLength(5);
  });

  it('should preserve hue and chroma', () => {
    const scale = lightnessScale(red, 5);
    for (const color of scale) {
      expect(color.c).toBe(red.c);
      expect(color.h).toBe(red.h);
    }
  });

  it('should span the lightness range', () => {
    const scale = lightnessScale(red, 11);
    expect(scale[0].l).toBeCloseTo(0.05, 2);
    expect(scale[10].l).toBeCloseTo(0.95, 2);
  });

  it('should throw for steps < 2', () => {
    expect(() => lightnessScale(red, 1)).toThrow('at least 2 steps');
  });

  it('should throw for steps = 0', () => {
    expect(() => lightnessScale(red, 0)).toThrow();
  });
});
