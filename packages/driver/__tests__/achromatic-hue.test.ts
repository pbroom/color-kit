import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Color } from '@color-kit/core';
import {
  fromHsl,
  fromHsv,
  fromRgb,
  isAchromatic,
  parse,
  toHsl,
} from '@color-kit/core';
import {
  createColorState,
  resolveIncomingRequested,
  setColorChannel,
  setColorRequested,
} from '../src/color-state.js';
import { hasExplicitOklchHue } from '../src/color-string-input.js';
import {
  colorFromColorInputChannelValue,
  colorFromColorInputKey,
  getColorInputChannelValue,
} from '../src/color-input.js';
import {
  createMultiColorModel,
  setMultiColorRequested,
} from '../src/multi-color-state.js';

const BLUE: Color = { l: 0.6, c: 0.15, h: 250, alpha: 1 };

/** Sets a CSS string as the requested color the way the bindings do. */
function setFromCss(previous: Color, css: string): Color {
  return setColorRequested(createColorState(previous), parse(css), 'user', {
    explicitHue: hasExplicitOklchHue(css),
  }).requested;
}

describe('hasExplicitOklchHue', () => {
  it.each([
    ['oklch(0.5 0 200)', true],
    ['OKLCH( 0.5  0  200deg / 50% )', true],
    ['oklch(50% 0 0.5turn)', true],
    ['oklch(0.5 0 none)', false],
    ['oklch(0.5 0 none / 0.5)', false],
    ['oklch(0.5 0)', false],
    ['#808080', false],
    ['gray', false],
    ['rgb(128 128 128)', false],
    ['hsl(200 0% 50%)', false],
    ['hwb(200 50% 50%)', false],
    ['lch(50 0 200)', false],
    ['oklab(0.5 0 0)', false],
    ['color(srgb 0.5 0.5 0.5)', false],
  ])('%s -> %s', (input, expected) => {
    expect(hasExplicitOklchHue(input)).toBe(expected);
  });
});

describe('resolveIncomingRequested', () => {
  it('keeps the previous hue for an implicit achromatic color', () => {
    const gray = parse('#808080');
    expect(gray.h).toBe(0);
    const next = resolveIncomingRequested(BLUE, gray, { explicitHue: false });
    expect(next).toEqual({ ...gray, h: 250 });
  });

  it('returns chromatic and explicit colors unchanged', () => {
    const red = parse('#ff0000');
    expect(resolveIncomingRequested(BLUE, red, { explicitHue: false })).toBe(
      red,
    );
    const explicit = { l: 0.5, c: 0, h: 200, alpha: 1 };
    expect(
      resolveIncomingRequested(BLUE, explicit, { explicitHue: true }),
    ).toBe(explicit);
  });

  it('carries the hue over a non-finite incoming hue even when explicit', () => {
    const next = resolveIncomingRequested(
      BLUE,
      { l: 0.5, c: 0, h: Number.NaN, alpha: 1 },
      { explicitHue: true },
    );
    expect(next.h).toBe(250);
  });
});

describe('setColorRequested with achromatic input', () => {
  it.each([
    ['hex', parse('#808080')],
    ['rgb()', parse('rgb(128 128 128)')],
    ['rgb object', fromRgb({ r: 128, g: 128, b: 128, alpha: 1 })],
    ['hsl()', parse('hsl(120 0% 50%)')],
    ['hsl object', fromHsl({ h: 120, s: 0, l: 50, alpha: 1 })],
    ['hsv object', fromHsv({ h: 300, s: 0, v: 50, alpha: 1 })],
    ['black', parse('#000')],
    ['white', parse('#fff')],
    ['rgb(0 0 0)', parse('rgb(0 0 0)')],
  ])('keeps the previous hue for %s', (_label, incoming) => {
    const next = setColorRequested(createColorState(BLUE), incoming, 'user', {
      explicitHue: false,
    });
    expect(next.requested).toEqual({ ...incoming, h: 250 });
    expect(next.meta.source).toBe('user');
  });

  it('takes the hue of a chromatic input', () => {
    const red = parse('#ff0000');
    expect(setFromCss(BLUE, '#ff0000').h).toBe(red.h);
  });

  it('keeps an explicit oklch hue and carries over `none`', () => {
    expect(setFromCss(BLUE, 'oklch(0.5 0 200)')).toEqual({
      l: 0.5,
      c: 0,
      h: 200,
      alpha: 1,
    });
    expect(setFromCss(BLUE, 'oklch(0.5 0 none)')).toEqual({
      l: 0.5,
      c: 0,
      h: 250,
      alpha: 1,
    });
  });

  it('carries the hue for black and white strings', () => {
    expect(setFromCss(BLUE, '#000').h).toBe(250);
    expect(setFromCss(BLUE, '#fff').h).toBe(250);
    expect(setFromCss(BLUE, 'rgb(0 0 0)').h).toBe(250);
  });

  it('preserves alpha as converted', () => {
    const next = setFromCss(BLUE, '#80808080');
    expect(next.alpha).toBeCloseTo(128 / 255, 10);
    expect(next.h).toBe(250);
  });

  it('defaults to an explicit hue, keeping the existing behaviour', () => {
    const gray = { l: 0.5, c: 0, h: 0, alpha: 1 };
    expect(
      setColorRequested(createColorState(BLUE), gray, 'user').requested,
    ).toEqual(gray);
  });

  it('is a no-op when only the converted hue differed', () => {
    const state = createColorState({ ...parse('#808080'), h: 250 });
    expect(
      setColorRequested(state, parse('#808080'), 'programmatic', {
        explicitHue: false,
      }),
    ).toBe(state);
  });

  it('resumes the carried hue when chroma rises again', () => {
    const gray = setColorRequested(
      createColorState(BLUE),
      parse('#808080'),
      'user',
      { explicitHue: false },
    );
    expect(setColorChannel(gray, 'c', 0.1, 'user').requested.h).toBe(250);
  });

  it('keeps next.h === previous.h for any achromatic RGB input', () => {
    const channel = fc.double({ min: 0, max: 255, noNaN: true });
    fc.assert(
      fc.property(
        fc.record({
          l: fc.double({ min: 0, max: 1, noNaN: true }),
          c: fc.double({ min: 0, max: 0.4, noNaN: true }),
          h: fc.double({ min: 0, max: 360, noNaN: true, maxExcluded: true }),
          alpha: fc.double({ min: 0, max: 1, noNaN: true }),
        }),
        channel,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (previous, value, alpha) => {
          const incoming = fromRgb({ r: value, g: value, b: value, alpha });
          expect(isAchromatic(incoming.c)).toBe(true);
          const next = setColorRequested(
            createColorState(previous),
            incoming,
            'user',
            { explicitHue: false },
          ).requested;
          expect(next.h).toBe(previous.h);
          expect(next.l).toBe(incoming.l);
          expect(next.c).toBe(incoming.c);
          expect(next.alpha).toBe(incoming.alpha);
        },
      ),
    );
  });
});

describe('setMultiColorRequested with achromatic input', () => {
  it('keeps the entry hue unless the hue is explicit', () => {
    const model = createMultiColorModel({ colors: { base: BLUE } });
    const gray = parse('#808080');
    expect(
      setMultiColorRequested(model, 'base', gray, 'user', {
        explicitHue: false,
      }).entries.base?.requested.h,
    ).toBe(250);
    expect(
      setMultiColorRequested(model, 'base', gray, 'user').entries.base
        ?.requested.h,
    ).toBe(0);
  });
});

describe('colorFromColorInputChannelValue with achromatic results', () => {
  it('keeps the hue when an RGB edit lands on a gray', () => {
    const start = parse('#808090');
    const next = colorFromColorInputChannelValue(start, 'rgb', 'b', 128);
    expect(isAchromatic(next.c)).toBe(true);
    expect(next.h).toBe(start.h);
  });

  it('keeps the hue when HSL saturation drops to 0', () => {
    const next = colorFromColorInputChannelValue(BLUE, 'hsl', 's', 0);
    expect(isAchromatic(next.c)).toBe(true);
    expect(next.h).toBe(250);
  });
});

/** Absolute angular distance between two hues, in degrees. */
function hueDistance(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

describe('HSL ColorInput edits of a gray with a stored hue', () => {
  const gray = colorFromColorInputChannelValue(BLUE, 'hsl', 's', 0);

  it('resumes the stored hue when saturation rises again, not red', () => {
    expect(isAchromatic(gray.c)).toBe(true);
    expect(gray.h).toBe(250);

    const next = colorFromColorInputChannelValue(gray, 'hsl', 's', 50);
    expect(isAchromatic(next.c)).toBe(false);
    expect(toHsl(next).s).toBeCloseTo(50, 6);
    expect(hueDistance(next.h, 250)).toBeLessThan(2);
    // Measured: the solver lands within 0.001°.
    expect(hueDistance(next.h, 250)).toBeLessThan(0.001);
  });

  it('lands on the stored hue for any hue, lightness and saturation', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 0.95, noNaN: true }),
        fc.double({ min: 0, max: 359.99, noNaN: true }),
        fc.double({ min: 0.5, max: 100, noNaN: true }),
        (l, h, s) => {
          const start: Color = { l, c: 0, h, alpha: 1 };
          const next = colorFromColorInputChannelValue(start, 'hsl', 's', s);
          if (isAchromatic(next.c)) return;
          expect(hueDistance(next.h, h)).toBeLessThan(0.01);
        },
      ),
    );
  });

  it('reads the HSL hue of the stored hue instead of 0', () => {
    const hue = getColorInputChannelValue(gray, 'hsl', 'h');
    expect(hue).not.toBe(0);
    // HSL hue 211 is the low-saturation sRGB direction of OKLCH hue 250.
    expect(hue).toBeCloseTo(211.17, 1);
    expect(getColorInputChannelValue(gray, 'hsl', 's')).toBe(0);
  });

  it('steps saturation up from a gray on the stored hue', () => {
    const stepped = colorFromColorInputKey(gray, 'hsl', 's', 'ArrowUp', {
      step: 1,
      range: [0, 100],
    });
    expect(stepped?.value).toBe(1);
    expect(stepped && hueDistance(stepped.color.h, 250)).toBeLessThan(0.01);
  });

  it('uses a typed HSL hue and keeps the color gray', () => {
    const next = colorFromColorInputChannelValue(gray, 'hsl', 'h', 120);
    expect(isAchromatic(next.c)).toBe(true);
    expect(next.l).toBeCloseTo(gray.l, 9);
    expect(getColorInputChannelValue(next, 'hsl', 'h')).toBeCloseTo(120, 3);
    // The stored OKLCH hue is a green, which raising saturation resumes.
    // (Saturation follows the OKLCH hue, so the HSL hue at 50% drifts a few
    // degrees from 120, the way OKLCH hue lines curve through sRGB.)
    expect(hueDistance(next.h, 145.5)).toBeLessThan(0.1);
    const raised = colorFromColorInputChannelValue(next, 'hsl', 's', 1);
    expect(hueDistance(raised.h, next.h)).toBeLessThan(0.01);
    expect(hueDistance(toHsl(raised).h, 120)).toBeLessThan(0.01);
    const vivid = colorFromColorInputChannelValue(next, 'hsl', 's', 50);
    expect(hueDistance(vivid.h, next.h)).toBeLessThan(0.01);
  });

  it('keeps the stored hue for lightness and alpha edits', () => {
    const lighter = colorFromColorInputChannelValue(gray, 'hsl', 'l', 80);
    expect(isAchromatic(lighter.c)).toBe(true);
    expect(lighter.h).toBe(250);
    const faded = colorFromColorInputChannelValue(gray, 'hsl', 'alpha', 0.5);
    expect(faded).toMatchObject({ h: 250, alpha: 0.5 });
  });

  it('keeps black and white achromatic with their stored hue', () => {
    for (const l of [0, 1]) {
      const start: Color = { l, c: 0, h: 250, alpha: 1 };
      expect(getColorInputChannelValue(start, 'hsl', 'h')).not.toBe(0);
      const next = colorFromColorInputChannelValue(start, 'hsl', 's', 50);
      expect(isAchromatic(next.c)).toBe(true);
      expect(next.h).toBe(250);
    }
  });

  it('leaves chromatic HSL edits unchanged', () => {
    const hsl = toHsl(BLUE);
    expect(colorFromColorInputChannelValue(BLUE, 'hsl', 's', 20)).toEqual(
      fromHsl({ ...hsl, s: 20 }),
    );
    expect(getColorInputChannelValue(BLUE, 'hsl', 'h')).toBe(hsl.h);
  });
});
