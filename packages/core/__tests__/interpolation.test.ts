import { describe, expect, it } from 'vitest';
import {
  generateScale,
  inSrgbGamut,
  interpolate,
  mix,
  parse,
  relativeLuminance,
  toHex,
  toRgb,
} from '../src/index.js';
import type { Color, InterpolationSpace } from '../src/index.js';

const red = parse('#ff0000');
const lime = parse('#00ff00');
const blue = parse('#0000ff');
const white = parse('#ffffff');
const black = parse('#000000');

const SPACES: InterpolationSpace[] = [
  'oklch',
  'oklab',
  'srgb',
  'linear-srgb',
  'p3',
  'linear-p3',
];

describe('mix() / interpolate() defaults are unchanged', () => {
  const a: Color = { l: 0.2, c: 0.1, h: 20, alpha: 1 };
  const b: Color = { l: 0.8, c: 0.3, h: 60, alpha: 0.5 };
  const grey: Color = { l: 0.5, c: 0, h: 0, alpha: 1 };

  it('treats undefined and empty options as the legacy call', () => {
    for (const t of [0, 0.3, 0.5, 1]) {
      expect(mix(a, b, t, undefined)).toEqual(mix(a, b, t));
      expect(mix(a, b, t, {})).toEqual(mix(a, b, t));
      expect(interpolate(grey, b, t, {})).toEqual(interpolate(grey, b, t));
    }
    expect(generateScale(a, b, 5, {})).toEqual(generateScale(a, b, 5));
  });

  it('matches { space: "oklch" } for chromatic, straight-alpha inputs', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const legacy = mix(a, b, t);
      const explicit = mix(a, b, t, { space: 'oklch' });
      expect(explicit.l).toBeCloseTo(legacy.l, 12);
      expect(explicit.c).toBeCloseTo(legacy.c, 12);
      expect(explicit.h).toBeCloseTo(legacy.h, 12);
      expect(explicit.alpha).toBeCloseTo(legacy.alpha, 12);
    }
  });
});

describe('interpolation space option', () => {
  it('returns the endpoints (to float precision) at t = 0 and t = 1', () => {
    const a = parse('#3b82f6');
    const b = parse('rgb(239 68 68 / 0.4)');
    for (const space of SPACES) {
      const start = mix(a, b, 0, { space });
      const end = mix(a, b, 1, { space });
      expect(start.l).toBeCloseTo(a.l, 10);
      expect(start.c).toBeCloseTo(a.c, 10);
      expect(start.alpha).toBeCloseTo(a.alpha, 12);
      expect(end.l).toBeCloseTo(b.l, 10);
      expect(end.c).toBeCloseTo(b.c, 10);
      expect(end.alpha).toBeCloseTo(b.alpha, 12);
    }
  });

  it('mixes red and lime per CSS color-mix()', () => {
    // color-mix(in srgb, red, lime) = rgb(127.5 127.5 0); the 8-bit
    // rounding of the .5 tie is decided by float noise.
    const srgb = toRgb(mix(red, lime, 0.5, { space: 'srgb' }));
    expect(Math.abs(srgb.r - 127.5)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(srgb.g - 127.5)).toBeLessThanOrEqual(0.5);
    expect(srgb.b).toBe(0);
    // color-mix(in srgb-linear, red, lime) = linear (0.5, 0.5, 0)
    expect(toHex(mix(red, lime, 0.5, { space: 'linear-srgb' }))).toBe(
      '#bcbc00',
    );
    expect(toHex(mix(red, lime, 0.5, { space: 'linear-p3' }))).toBe('#bcbc00');
  });

  it('linear-light mid-points are brighter than gamma or OKLCH mid-points', () => {
    const luminance = (space: InterpolationSpace) =>
      relativeLuminance(mix(red, lime, 0.5, { space }));
    // Linear light averages luminance: (0.2126 + 0.7152) / 2 (up to the
    // 8-bit quantization relativeLuminance applies).
    expect(luminance('linear-srgb')).toBeCloseTo((0.2126 + 0.7152) / 2, 2);
    expect(luminance('linear-srgb')).toBeGreaterThan(luminance('oklch'));
    expect(luminance('linear-srgb')).toBeGreaterThan(luminance('srgb'));
  });

  it('keeps neutral rectangular RGB mixes neutral and in range', () => {
    for (const space of ['srgb', 'linear-srgb'] as const) {
      for (let i = 0; i <= 10; i += 1) {
        const result = mix(white, black, i / 10, { space });
        // Neutral in, neutral out: chroma stays at float-noise level.
        expect(result.c).toBeLessThan(1e-6);
        expect(result.l).toBeGreaterThanOrEqual(0);
        expect(result.l).toBeLessThanOrEqual(1 + 1e-12);
      }
    }
  });

  it('does not clamp extended-range inputs', () => {
    // A P3-only green is outside sRGB (negative linear-sRGB red channel).
    const p3Green = parse('color(display-p3 0 1 0)');
    const result = mix(p3Green, p3Green, 0.5, { space: 'linear-srgb' });
    expect(result.l).toBeCloseTo(p3Green.l, 10);
    expect(result.c).toBeCloseTo(p3Green.c, 10);
    expect(inSrgbGamut(result)).toBe(false);
  });

  it('extrapolates (t outside [0, 1]) without clamping', () => {
    // linear-sRGB red channel: 1 + (0 - 1) * 1.5 = -0.5
    const result = mix(red, lime, 1.5, { space: 'linear-srgb' });
    expect(inSrgbGamut(result)).toBe(false);
    const back = mix(red, result, 2 / 3, { space: 'linear-srgb' });
    expect(back.l).toBeCloseTo(lime.l, 9);
    expect(back.c).toBeCloseTo(lime.c, 9);
  });

  it('premultiplies alpha in rectangular spaces', () => {
    const transparent: Color = { ...red, alpha: 0 };
    // Fully transparent endpoint contributes no color, like CSS.
    const result = mix(transparent, blue, 0.5, { space: 'oklab' });
    expect(result.alpha).toBeCloseTo(0.5, 12);
    expect(result.l).toBeCloseTo(blue.l, 10);
    expect(result.c).toBeCloseTo(blue.c, 10);
    expect(result.h).toBeCloseTo(blue.h, 8);
    // Opting out restores straight-alpha interpolation.
    const straight = mix(transparent, blue, 0.5, {
      space: 'oklab',
      premultiplied: false,
    });
    expect(straight.l).not.toBeCloseTo(blue.l, 3);
  });

  it('returns transparent endpoints exactly, without losing their color', () => {
    const transparentRed: Color = { ...red, alpha: 0 };
    for (const space of SPACES) {
      expect(mix(transparentRed, blue, 0, { space })).toEqual(transparentRed);
      expect(mix(blue, transparentRed, 1, { space })).toEqual(transparentRed);
      const scale = generateScale(transparentRed, blue, 3, { space });
      expect(scale[0]).toEqual(transparentRed);
      expect(scale[2]).toEqual(blue);
    }
  });

  it('uses straight alpha where the interpolated alpha is 0', () => {
    const transparentRed: Color = { ...red, alpha: 0 };
    const transparentBlue: Color = { ...blue, alpha: 0 };
    for (const space of SPACES) {
      const result = mix(transparentRed, transparentBlue, 0.5, {
        space,
        premultiplied: true,
      });
      const straight = mix(red, blue, 0.5, { space, premultiplied: false });
      expect(result.alpha).toBe(0);
      // Not collapsed to (transparent) black.
      expect(result.l).toBeCloseTo(straight.l, 12);
      expect(result.c).toBeCloseTo(straight.c, 12);
    }
  });
});

describe('hue interpolation methods (oklch)', () => {
  const at = (h: number): Color => ({ l: 0.6, c: 0.15, h, alpha: 1 });

  it.each([
    ['shorter', 350, 10, 0],
    ['shorter', 10, 350, 0],
    ['longer', 350, 10, 180],
    ['longer', 10, 350, 180],
    ['longer', 40, 40, 220],
    ['increasing', 350, 10, 0],
    ['increasing', 10, 350, 180],
    ['decreasing', 350, 10, 180],
    ['decreasing', 10, 350, 0],
  ] as const)('%s: %d -> %d midpoint is %d', (hue, h1, h2, expected) => {
    const result = mix(at(h1), at(h2), 0.5, { space: 'oklch', hue });
    const delta = Math.abs(result.h - expected) % 360;
    expect(Math.min(delta, 360 - delta)).toBeLessThan(1e-9);
  });

  it('treats an achromatic hue as powerless (takes the other hue)', () => {
    const grey: Color = { l: 0.5, c: 0, h: 250, alpha: 1 };
    const result = mix(grey, at(30), 0.5, { space: 'oklch' });
    expect(result.h).toBeCloseTo(30, 10);
    const bothGrey = mix(grey, { ...grey, h: 90 }, 0.5, { space: 'oklch' });
    expect(bothGrey.h).toBe(0);
    // Tiny but non-zero chroma above the CSS epsilon (0.000004) keeps its hue,
    // e.g. oklch(0.5 0.00005 0).
    const faint: Color = { l: 0.5, c: 0.00005, h: 0, alpha: 1 };
    expect(mix(faint, at(90), 0.5, { space: 'oklch' }).h).toBeCloseTo(45, 9);
    const belowEpsilon: Color = { l: 0.5, c: 0.000004, h: 0, alpha: 1 };
    expect(mix(belowEpsilon, at(90), 0.5, { space: 'oklch' }).h).toBeCloseTo(
      90,
      9,
    );
    // No arc is added for a powerless endpoint, even with 'longer'.
    for (const t of [0.25, 0.5, 0.75]) {
      const longer = mix(grey, at(30), t, { space: 'oklch', hue: 'longer' });
      expect(longer.h).toBeCloseTo(30, 10);
    }
  });

  it('interpolate() and generateScale() forward the options', () => {
    const scale = generateScale(at(0), at(90), 4, {
      space: 'oklch',
      hue: 'longer',
    });
    expect(scale.map((color) => Math.round(color.h))).toEqual([
      0, 270, 180, 90,
    ]);
    const direct = interpolate(at(0), at(90), 1 / 3, {
      space: 'oklch',
      hue: 'longer',
    });
    expect(direct.h).toBeCloseTo(270, 9);
  });
});
