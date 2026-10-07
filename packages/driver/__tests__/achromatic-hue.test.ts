import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Color } from '@color-kit/core';
import {
  fromHsl,
  fromHsv,
  fromRgb,
  isAchromatic,
  parse,
} from '@color-kit/core';
import {
  createColorState,
  resolveIncomingRequested,
  setColorChannel,
  setColorRequested,
} from '../src/color-state.js';
import { hasExplicitOklchHue } from '../src/color-string-input.js';
import { colorFromColorInputChannelValue } from '../src/color-input.js';
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
