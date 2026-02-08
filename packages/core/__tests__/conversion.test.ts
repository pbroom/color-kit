import { describe, it, expect } from 'vitest';
import {
  parse,
  toHex,
  toRgb,
  toHsl,
  toOklch,
  toOklab,
  toP3,
  toCss,
  fromRgb,
  fromHex,
  fromHsl,
  fromHsv,
  hexToRgb,
  rgbToHex,
} from '../src/index.js';
import type { Color, Rgb } from '../src/index.js';

describe('Hex conversion', () => {
  it('should parse 6-digit hex', () => {
    const rgb = hexToRgb('#ff0000');
    expect(rgb).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
  });

  it('should parse 3-digit hex', () => {
    const rgb = hexToRgb('#f00');
    expect(rgb).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
  });

  it('should parse 8-digit hex with alpha', () => {
    const rgb = hexToRgb('#ff000080');
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
    expect(rgb.alpha).toBeCloseTo(0.502, 1);
  });

  it('should convert RGB to hex', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0, alpha: 1 })).toBe('#ff0000');
    expect(rgbToHex({ r: 0, g: 128, b: 255, alpha: 1 })).toBe('#0080ff');
  });

  it('should include alpha in hex when alpha < 1', () => {
    const hex = rgbToHex({ r: 255, g: 0, b: 0, alpha: 0.5 });
    expect(hex).toBe('#ff000080');
  });
});

describe('Color roundtrip', () => {
  const testColors: Array<{ name: string; hex: string }> = [
    { name: 'red', hex: '#ff0000' },
    { name: 'green', hex: '#00ff00' },
    { name: 'blue', hex: '#0000ff' },
    { name: 'white', hex: '#ffffff' },
    { name: 'black', hex: '#000000' },
    { name: 'coral', hex: '#ff7f50' },
    { name: 'medium gray', hex: '#808080' },
  ];

  for (const { name, hex } of testColors) {
    it(`should roundtrip ${name} through OKLCH`, () => {
      const color = fromHex(hex);
      const result = toHex(color);
      expect(result).toBe(hex);
    });
  }
});

describe('parse()', () => {
  it('should parse hex colors', () => {
    const color = parse('#ff6600');
    const hex = toHex(color);
    expect(hex).toBe('#ff6600');
  });

  it('should parse rgb() colors', () => {
    const color = parse('rgb(255 102 0)');
    const rgb = toRgb(color);
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(102);
    expect(rgb.b).toBe(0);
  });

  it('should parse hsl() colors', () => {
    const color = parse('hsl(0 100% 50%)');
    const hex = toHex(color);
    expect(hex).toBe('#ff0000');
  });

  it('should parse oklch() colors', () => {
    const color = parse('oklch(0.7 0.15 30)');
    expect(color.l).toBeCloseTo(0.7, 4);
    expect(color.c).toBeCloseTo(0.15, 4);
    expect(color.h).toBeCloseTo(30, 1);
  });

  it('should parse rgb with alpha', () => {
    const color = parse('rgb(255 0 0 / 0.5)');
    expect(color.alpha).toBeCloseTo(0.5, 2);
  });

  it('should throw on invalid input', () => {
    expect(() => parse('not-a-color')).toThrow();
  });
});

describe('toCss()', () => {
  it('should output hex by default', () => {
    const color = fromHex('#ff6600');
    expect(toCss(color)).toBe('#ff6600');
  });

  it('should output rgb format', () => {
    const color = fromHex('#ff0000');
    const css = toCss(color, 'rgb');
    expect(css).toBe('rgb(255 0 0)');
  });

  it('should output oklch format', () => {
    const color: Color = { l: 0.7, c: 0.15, h: 30, alpha: 1 };
    const css = toCss(color, 'oklch');
    expect(css).toMatch(/^oklch\(/);
  });
});

describe('HSL conversion', () => {
  it('should convert red correctly', () => {
    const color = fromHex('#ff0000');
    const hsl = toHsl(color);
    expect(hsl.h).toBeCloseTo(0, 0);
    expect(hsl.s).toBeCloseTo(100, 0);
    expect(hsl.l).toBeCloseTo(50, 0);
  });

  it('should roundtrip through HSL', () => {
    const original = fromHex('#3388cc');
    const hsl = toHsl(original);
    const restored = fromHsl(hsl);
    const hex = toHex(restored);
    expect(hex).toBe('#3388cc');
  });
});
