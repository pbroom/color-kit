import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { normalizeHue, parse, toCss, toHex, tryParse } from '../src/index.js';
import type { Color } from '../src/index.js';

/** Smallest angular distance between two hues, in degrees. */
function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

describe('parse() CSS Color 4 syntax', () => {
  it.each([
    'red',
    'transparent',
    'rebeccapurple',
    'rgb(100% 0% 0%)',
    'hsl(120 50 50)',
    'hsl(-30 50% 50%)',
    'hsl(0.5turn 50% 50%)',
    'hsl(1rad 50% 50%)',
    'hsl(100grad 50% 50%)',
    'oklch(0.5 0.1 none)',
    'lab(50 20 -30)',
    'lch(50 40 200)',
    'hwb(120 30% 40%)',
    'color(srgb 1 0 0)',
    'color(srgb-linear 1 0 0)',
    'color(display-p3 -0.1 0.5 0.2)',
    'color(rec2020 0.3 0.6 0.1)',
    'color(xyz-d65 0.2 0.3 0.4)',
    'color(xyz-d50 0.2 0.3 0.4)',
    'color(xyz 0.2 0.3 0.4)',
    'color(a98-rgb 0.3 0.6 0.1)',
    'color(prophoto-rgb 0.3 0.6 0.1)',
  ])('parses %s', (input) => {
    expect(tryParse(input)).not.toBeNull();
  });

  it('resolves named colors, case-insensitively', () => {
    expect(toHex(parse('red'))).toBe('#ff0000');
    expect(toHex(parse('RebeccaPurple'))).toBe('#663399');
    expect(toHex(parse('  lightgoldenrodyellow '))).toBe('#fafad2');
    expect(toHex(parse('aqua'))).toBe(toHex(parse('cyan')));
  });

  it('accepts both gray and grey spellings', () => {
    for (const name of [
      'gray',
      'darkgray',
      'darkslategray',
      'dimgray',
      'lightgray',
      'lightslategray',
      'slategray',
    ]) {
      expect(parse(name.replace('gray', 'grey'))).toEqual(parse(name));
    }
  });

  it('parses transparent as fully transparent black', () => {
    expect(parse('transparent')).toEqual({ l: 0, c: 0, h: 0, alpha: 0 });
  });

  it('rejects unknown keywords', () => {
    for (const input of ['currentcolor', 'notacolor', 'red blue', 'grey1']) {
      expect(() => parse(input)).toThrow(/Unable to parse color/);
    }
  });

  it('treats rgb() percentages as fractions of 255', () => {
    expect(toHex(parse('rgb(100% 50% 0%)'))).toBe(
      toHex(parse('rgb(255 127.5 0)')),
    );
    expect(toHex(parse('rgba(100%, 0%, 0%, 50%)'))).toBe('#ff000080');
  });

  it('treats none as 0 and rejects it in legacy comma syntax', () => {
    expect(parse('rgb(none 0 0)')).toEqual(parse('rgb(0 0 0)'));
    expect(parse('oklch(0.5 0.1 none)')).toEqual(parse('oklch(0.5 0.1 0)'));
    expect(parse('rgb(0 0 0 / none)').alpha).toBe(0);
    expect(() => parse('rgb(none, 0, 0)')).toThrow();
  });

  it('validates legacy comma syntax component types', () => {
    // rgb(): all numbers or all percentages; hsl(): percentage s and l.
    for (const input of [
      'rgb(100%, 0, 0)',
      'rgb(255, 0%, 0)',
      'rgba(255, 0, 0%, 0.5)',
      'hsl(0, 100, 50)',
      'hsl(0, 100%, 50)',
      'hsla(0, 100, 50%, 0.5)',
    ]) {
      expect(tryParse(input), input).toBeNull();
    }
    expect(parse('rgb(100%, 0%, 0%)')).toEqual(parse('rgb(255, 0, 0)'));
    expect(parse('rgba(255, 0, 0, 50%)')).toEqual(parse('rgb(255 0 0 / 0.5)'));
    expect(parse('hsl(0deg, 100%, 50%)')).toEqual(parse('hsl(0 100% 50%)'));
    // The modern syntax still allows mixing.
    expect(parse('rgb(100% 0 0)')).toEqual(parse('rgb(255 0 0)'));
    expect(parse('hsl(0 100 50)')).toEqual(parse('hsl(0 100% 50%)'));
  });

  it('rejects comma syntax outside rgb()/hsl()', () => {
    expect(() => parse('lab(50, 20, -30)')).toThrow();
    expect(() => parse('oklch(0.5, 0.1, 30)')).toThrow();
    expect(() => parse('color(srgb, 1, 0, 0)')).toThrow();
  });

  it('rejects units on the wrong components', () => {
    expect(() => parse('hsl(120% 50% 50%)')).toThrow();
    expect(() => parse('rgb(10deg 0 0)')).toThrow();
    expect(() => parse('oklch(0.5 0.1 30deg / 1deg)')).toThrow();
    expect(() => parse('lab(50 20 30turn)')).toThrow();
  });

  it('rejects unknown color() spaces and wrong component counts', () => {
    expect(() => parse('color(cmyk 0 0 0)')).toThrow();
    expect(() => parse('color(constructor 0 0 0)')).toThrow();
    for (const fn of [
      'rgb',
      'rgba',
      'hsl',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
    ]) {
      expect(() => parse(`color(${fn} 1 0 0)`)).toThrow();
      expect(tryParse(`color(${fn} 1 0 0)`)).toBeNull();
    }
    expect(() => parse('color(srgb 1 0)')).toThrow();
    expect(() => parse('color(srgb 1 0 0 0)')).toThrow();
    expect(() => parse('lab(50 20)')).toThrow();
  });

  it('clamps lab/oklab lightness and lch/oklch chroma like CSS', () => {
    expect(parse('oklch(1.2 -0.1 30)')).toMatchObject({ l: 1, c: 0 });
    expect(parse('lab(120 0 0)')).toEqual(parse('lab(100 0 0)'));
    expect(parse('lch(50 -10 30)')).toEqual(parse('lch(50 0 30)'));
  });

  it('hwb() with whiteness + blackness >= 100% is gray', () => {
    const gray = parse('hwb(200 90% 30%)');
    expect(gray.c).toBeLessThan(1e-6);
    expect(toHex(gray)).toBe('#bfbfbf'); // 0.9 / 1.2 = 0.75
  });

  it('rejects values that overflow inside a conversion', () => {
    expect(() => parse('color(srgb 1e300 0 0)')).toThrow(/non-finite/);
    expect(() => parse('lab(50 1e306 0)')).toThrow(/non-finite/);
    expect(() => parse('oklch(0.5 0.1 1e308rad)')).toThrow(/non-finite/);
  });
});

describe('hue normalization', () => {
  it('normalizes parsed hues to [0, 360)', () => {
    expect(parse('oklch(0.6 0.1 360)').h).toBe(0);
    expect(parse('oklch(0.6 0.1 -90)').h).toBe(270);
    expect(parse('oklch(0.6 0.1 720.5)').h).toBeCloseTo(0.5, 10);
    expect(parse('oklch(0.6 0.1 1.5turn)').h).toBeCloseTo(180, 10);
  });

  const unitScale = { '': 1, deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };
  const unit = fc.constantFrom(
    ...(Object.keys(unitScale) as (keyof typeof unitScale)[]),
  );

  it('property: oklch hue in any unit lands in [0, 360) at the right angle', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        unit,
        (value, u) => {
          const h = parse(`oklch(0.6 0.1 ${value}${u})`).h;
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThan(360);
          const expected = normalizeHue(value * unitScale[u]);
          // Allow float error relative to the magnitude being reduced.
          const tolerance = 1e-9 * Math.max(1, Math.abs(value * unitScale[u]));
          expect(hueDelta(h, expected)).toBeLessThanOrEqual(tolerance);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('property: hsl/hwb/lch hues always land in [0, 360)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('hsl(H 60% 50%)', 'hwb(H 10% 20%)', 'lch(60 40 H)'),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        unit,
        (template, value, u) => {
          const h = parse(template.replace('H', `${value}${u}`)).h;
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThan(360);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('property: toCss(oklch) -> parse round-trips with a normalized hue', () => {
    const color = fc.record({
      l: fc.double({ min: 0, max: 1, noNaN: true }),
      c: fc.double({ min: 0.01, max: 0.4, noNaN: true }),
      h: fc.double({ min: -1080, max: 1080, noNaN: true }),
      alpha: fc.double({ min: 0, max: 1, noNaN: true }),
    });
    fc.assert(
      fc.property(color, (input: Color) => {
        const back = parse(toCss(input, 'oklch'));
        expect(back.h).toBeGreaterThanOrEqual(0);
        expect(back.h).toBeLessThan(360);
        // toCss rounds L and C to 4 decimals, h to 2, alpha to 3.
        expect(Math.abs(back.l - input.l)).toBeLessThanOrEqual(5e-5 + 1e-12);
        expect(Math.abs(back.c - input.c)).toBeLessThanOrEqual(5e-5 + 1e-12);
        expect(hueDelta(back.h, input.h)).toBeLessThanOrEqual(0.005 + 1e-9);
        expect(Math.abs(back.alpha - input.alpha)).toBeLessThanOrEqual(
          5e-4 + 1e-12,
        );
      }),
      { numRuns: 2000 },
    );
  });
});
