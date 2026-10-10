import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  fromHex,
  hexToRgb,
  parse,
  rgbToHex,
  toCss,
  toHex,
  tryParse,
} from '../src/index.js';
import type { Color, CssColorFormat } from '../src/index.js';

function isFiniteColor(color: Color): boolean {
  return (
    Number.isFinite(color.l) &&
    Number.isFinite(color.c) &&
    Number.isFinite(color.h) &&
    Number.isFinite(color.alpha)
  );
}

const CSS_FORMATS: CssColorFormat[] = [
  'hex',
  'rgb',
  'hsl',
  'oklch',
  'oklab',
  'p3',
];

describe('parse() rejects malformed input', () => {
  it.each([
    '#gggggg',
    '#ggg',
    '#12345',
    '#1234567',
    '#',
    '#ff00zz',
    '#ff 00 00',
    '#+12345',
  ])('throws for invalid hex %s', (input) => {
    expect(() => parse(input)).toThrow(/Unable to parse color/);
  });

  it.each([
    'rgb(1.2.3 0 0)',
    'rgb(. 0 0)',
    'rgb(1e 0 0)',
    'rgb(0 0 0 / 1.2.3)',
    'hsl(1..2 50% 50%)',
    'oklch(0.5.1 0.1 30)',
    'oklab(0.5 --0.1 0.1)',
    'color(display-p3 0.1.2 0 0)',
  ])('throws for malformed number in %s', (input) => {
    expect(() => parse(input)).toThrow(/Unable to parse color/);
  });

  it.each([
    'rgb(1e999 0 0)',
    'hsl(1e400 50% 50%)',
    'oklch(1e999 0.1 30)',
    'oklch(0.5 0.1 1e999)',
    'oklab(0.5 -1e999 0)',
    'color(display-p3 1e999 0 0)',
    'rgb(0 0 0 / 1e999)',
  ])('throws for components that overflow to Infinity: %s', (input) => {
    expect(() => parse(input)).toThrow(/non-finite/);
  });

  it.each([
    'oklab(0.5 1e200 0)',
    'oklab(0.5 0 -1e200)',
    'color(display-p3 1e200 0 0)',
    'hsl(0 1e308% 50%)',
  ])(
    'throws when finite components overflow during conversion: %s',
    (input) => {
      expect(() => parse(input)).toThrow(/non-finite/);
      expect(tryParse(input)).toBeNull();
    },
  );

  it.each([
    'NaN',
    'rgb(NaN 0 0)',
    'oklch(0.5 0.1 Infinity)',
    'rgb(0 0 0 / NaN)',
  ])('throws for NaN / Infinity keywords: %s', (input) => {
    expect(() => parse(input)).toThrow(/Unable to parse color/);
  });

  it('throws a TypeError for non-string input', () => {
    expect(() => parse(42 as unknown as string)).toThrow(TypeError);
    expect(() => parse(undefined as unknown as string)).toThrow(TypeError);
  });

  it('still accepts well-formed numbers in every supported syntax', () => {
    expect(toHex(parse('rgb(255 0 0)'))).toBe('#ff0000');
    expect(toHex(parse('rgb(255, 0, 0)'))).toBe('#ff0000');
    expect(toHex(parse('rgb(2.55e2 0 0)'))).toBe('#ff0000');
    expect(toHex(parse('rgb(+255 .0 0.)'))).toBe('#ff0000');
    expect(parse('rgb(255 0 0 / .5)').alpha).toBeCloseTo(0.5, 10);
    expect(parse('oklab(0.5 -0.1 0.1)').l).toBeCloseTo(0.5, 10);
    expect(parse('#ABCDEF')).toEqual(fromHex('#abcdef'));
  });
});

describe('parse() CSS whitespace and parse-time clamping', () => {
  it.each([
    ['rgb(255\n0\n0)', 'rgb(255 0 0)'],
    ['rgb(255,\n0,\r\n0)', 'rgb(255, 0, 0)'],
    ['rgba(\t255 0 0\t/\f0.5)', 'rgba(255 0 0 / 0.5)'],
    ['hsl(\n120\n50%\n50%\n)', 'hsl(120 50% 50%)'],
    ['oklch(0.6\n0.1\n30)', 'oklch(0.6 0.1 30)'],
    ['oklab(0.6\t0.1\t0)', 'oklab(0.6 0.1 0)'],
    ['color(display-p3\n1\n0\n0)', 'color(display-p3 1 0 0)'],
  ])('accepts CSS whitespace between components: %j', (multiline, single) => {
    expect(tryParse(multiline)).not.toBeNull();
    expect(parse(multiline)).toEqual(parse(single));
  });

  it('clamps negative HSL saturation to 0% (gray, not the complement)', () => {
    expect(parse('hsl(0 -100% 50%)')).toEqual(parse('hsl(0 0% 50%)'));
    expect(parse('hsl(0 -100% 50%)').c).toBeLessThan(1e-6);
  });

  it('clamps OKLab/OKLCH lightness and negative OKLCH chroma', () => {
    expect(parse('oklch(1.5 -0.1 30)')).toEqual(parse('oklch(1 0 30)'));
    expect(parse('oklch(-0.2 0.1 30)')).toEqual(parse('oklch(0 0.1 30)'));
    expect(parse('oklab(150% 0 0)')).toEqual(parse('oklab(1 0 0)'));
    expect(parse('oklab(-0.5 0 0)')).toEqual(parse('oklab(0 0 0)'));
  });
});

describe('hexToRgb()', () => {
  it.each(['gggggg', '#12', '#12345', 'ff00zz', '', '#ff00ff0'])(
    'throws for %j',
    (input) => {
      expect(() => hexToRgb(input)).toThrow(/Invalid hex color/);
    },
  );

  it('accepts all valid lengths with or without #', () => {
    expect(hexToRgb('f00')).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
    expect(hexToRgb('#F00F')).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
    expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
    expect(hexToRgb('#ff0000ff')).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
  });
});

describe('tryParse()', () => {
  it('returns a Color for valid input', () => {
    expect(tryParse('#ff0000')).toEqual(parse('#ff0000'));
  });

  it('returns null for invalid input', () => {
    expect(tryParse('#gggggg')).toBeNull();
    expect(tryParse('rgb(1.2.3 0 0)')).toBeNull();
    expect(tryParse('nope')).toBeNull();
    expect(tryParse(null as unknown as string)).toBeNull();
  });
});

describe('serializers reject non-finite colors', () => {
  const bad: Color[] = [
    { l: Number.NaN, c: 0, h: 0, alpha: 1 },
    { l: 0.5, c: Number.NaN, h: 0, alpha: 1 },
    { l: 0.5, c: 0.1, h: Number.NaN, alpha: 1 },
    { l: 0.5, c: 0.1, h: 30, alpha: Number.NaN },
    { l: Number.POSITIVE_INFINITY, c: 0, h: 0, alpha: 1 },
  ];

  it.each(bad)('toHex throws for %o', (color) => {
    expect(() => toHex(color)).toThrow(RangeError);
  });

  it.each(bad)('toCss throws in every format for %o', (color) => {
    for (const format of CSS_FORMATS) {
      expect(() => toCss(color, format)).toThrow(RangeError);
    }
  });

  it('rgbToHex throws for non-finite channels', () => {
    expect(() => rgbToHex({ r: Number.NaN, g: 0, b: 0, alpha: 1 })).toThrow(
      RangeError,
    );
    expect(() => rgbToHex({ r: 0, g: 0, b: 0, alpha: Number.NaN })).toThrow(
      RangeError,
    );
  });
});

describe('toCss() format validation', () => {
  const color: Color = { l: 0.6, c: 0.1, h: 30, alpha: 1 };

  it('throws a TypeError for unknown formats instead of falling back to hex', () => {
    expect(() => toCss(color, 'lab' as CssColorFormat)).toThrow(TypeError);
    expect(() => toCss(color, 'HEX' as CssColorFormat)).toThrow(TypeError);
    expect(() => toCss(color, '' as CssColorFormat)).toThrow(TypeError);
  });

  it('defaults to hex when the format is omitted', () => {
    expect(toCss(color)).toBe(toHex(color));
  });
});

describe('property: parse never yields non-finite colors', () => {
  // Bias toward strings that look like colors so the parser gets past the
  // function-name dispatch, then mutate them with arbitrary garbage.
  const fragment = fc.oneof(
    fc.constantFrom(
      '#',
      'rgb(',
      'rgba(',
      'hsl(',
      'hsla(',
      'oklch(',
      'oklab(',
      'color(display-p3 ',
      ')',
      ' ',
      ',',
      '/',
      '%',
      '.',
      '-',
      '+',
      'e',
      'e999',
      'deg',
      'NaN',
      'Infinity',
    ),
    fc.double({ noNaN: false }).map(String),
    fc.integer().map(String),
    fc.stringMatching(/^[\da-fA-Fg-z]{0,9}$/),
    fc.string({ maxLength: 6 }),
  );
  const garbage = fc.oneof(
    fc.string(),
    fc.array(fragment, { maxLength: 12 }).map((parts) => parts.join('')),
  );

  it('parse either throws or returns a finite Color', () => {
    fc.assert(
      fc.property(garbage, (input) => {
        let color: Color;
        try {
          color = parse(input);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          return;
        }
        expect(isFiniteColor(color)).toBe(true);
        expect(toHex(color)).toMatch(/^#[\da-f]{6}(?:[\da-f]{2})?$/);
      }),
      { numRuns: 5000 },
    );
  });

  it('tryParse never throws and returns null or a finite Color', () => {
    fc.assert(
      fc.property(fc.oneof(garbage, fc.anything()), (input) => {
        const color = tryParse(input as string);
        if (color !== null) expect(isFiniteColor(color)).toBe(true);
      }),
      { numRuns: 5000 },
    );
  });

  it('valid hex strings always parse and round-trip through toHex', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^#[\da-f]{6}$/), (hex) => {
        expect(toHex(parse(hex))).toBe(hex);
      }),
    );
  });
});
