import { describe, expect, it } from 'vitest';
import type { Color } from '@color-kit/core';
import {
  inP3Gamut,
  inSrgbGamut,
  toP3Gamut,
  toSrgbGamut,
} from '@color-kit/core';
import {
  colorsEqual,
  createColorState,
  getActiveDisplayedColor,
  mapDisplayedColors,
  resolveColorSource,
  setColorActiveGamut,
  setColorActiveView,
  setColorChannel,
  setColorRequested,
} from '../src/color-state.js';
import { getColorDisplayStyles } from '../src/color-display.js';

const IN_GAMUT: Color = { l: 0.5, c: 0.05, h: 200, alpha: 1 };
// High-chroma green: outside sRGB, inside P3.
const OUT_OF_SRGB: Color = { l: 0.75, c: 0.25, h: 145, alpha: 1 };
// Extreme chroma: outside both gamuts.
const OUT_OF_BOTH: Color = { l: 0.6, c: 0.45, h: 30, alpha: 1 };

describe('mapDisplayedColors', () => {
  it('keeps in-gamut colors unchanged with no out-of-gamut flags', () => {
    const mapped = mapDisplayedColors(IN_GAMUT);

    expect(mapped.outOfGamut).toEqual({ srgb: false, p3: false });
    expect(mapped.srgb).toEqual(IN_GAMUT);
    expect(mapped.p3).toEqual(IN_GAMUT);
  });

  it('flags and maps colors outside sRGB but inside P3', () => {
    expect(inSrgbGamut(OUT_OF_SRGB)).toBe(false);
    expect(inP3Gamut(OUT_OF_SRGB)).toBe(true);

    const mapped = mapDisplayedColors(OUT_OF_SRGB);

    expect(mapped.outOfGamut).toEqual({ srgb: true, p3: false });
    expect(inSrgbGamut(mapped.srgb)).toBe(true);
    // Chroma reduction mapping: lightness and hue preserved.
    expect(mapped.srgb.l).toBeCloseTo(OUT_OF_SRGB.l, 6);
    expect(mapped.srgb.h).toBeCloseTo(OUT_OF_SRGB.h, 6);
    expect(mapped.srgb.c).toBeLessThan(OUT_OF_SRGB.c);
    expect(mapped.p3).toEqual(OUT_OF_SRGB);
  });

  it('maps colors outside both gamuts into each gamut deterministically', () => {
    const first = mapDisplayedColors(OUT_OF_BOTH);
    const second = mapDisplayedColors(OUT_OF_BOTH);

    expect(first.outOfGamut).toEqual({ srgb: true, p3: true });
    expect(inSrgbGamut(first.srgb)).toBe(true);
    expect(inP3Gamut(first.p3)).toBe(true);
    // P3 is the wider gamut, so its mapped chroma should not be lower.
    expect(first.p3.c).toBeGreaterThanOrEqual(first.srgb.c);
    expect(second).toEqual(first);
  });
});

describe('createColorState', () => {
  it('applies defaults: display-p3 gamut, oklch view, programmatic source', () => {
    const state = createColorState(IN_GAMUT);

    expect(state.activeGamut).toBe('display-p3');
    expect(state.activeView).toBe('oklch');
    expect(state.meta.source).toBe('programmatic');
  });

  it('clones requested so later mutation cannot leak into state', () => {
    const requested: Color = { ...IN_GAMUT };
    const state = createColorState(requested);

    requested.l = 0.99;

    expect(state.requested.l).toBe(IN_GAMUT.l);
  });

  it('never clamps requested, even when out of gamut', () => {
    const state = createColorState(OUT_OF_BOTH, { activeGamut: 'srgb' });

    expect(state.requested).toEqual(OUT_OF_BOTH);
    expect(state.meta.outOfGamut).toEqual({ srgb: true, p3: true });
  });
});

describe('getActiveDisplayedColor', () => {
  it('selects the displayed slice matching activeGamut', () => {
    const p3State = createColorState(OUT_OF_SRGB, {
      activeGamut: 'display-p3',
    });
    const srgbState = createColorState(OUT_OF_SRGB, { activeGamut: 'srgb' });

    expect(getActiveDisplayedColor(p3State)).toEqual(p3State.displayed.p3);
    expect(getActiveDisplayedColor(srgbState)).toEqual(
      srgbState.displayed.srgb,
    );
  });
});

describe('resolveColorSource', () => {
  it('prefers an explicit source', () => {
    expect(resolveColorSource('pointer', 'derived')).toBe('derived');
    expect(resolveColorSource('programmatic', 'user')).toBe('user');
  });

  it('derives user for interactive inputs and programmatic otherwise', () => {
    expect(resolveColorSource('pointer')).toBe('user');
    expect(resolveColorSource('keyboard')).toBe('user');
    expect(resolveColorSource('text-input')).toBe('user');
    expect(resolveColorSource('programmatic')).toBe('programmatic');
  });
});

describe('colorsEqual', () => {
  it('compares exactly by default', () => {
    expect(colorsEqual(IN_GAMUT, { ...IN_GAMUT })).toBe(true);
    expect(colorsEqual(IN_GAMUT, { ...IN_GAMUT, h: 200.0001 })).toBe(false);
  });

  it('honors an epsilon tolerance across all channels', () => {
    expect(colorsEqual(IN_GAMUT, { ...IN_GAMUT, h: 200.0001 }, 0.001)).toBe(
      true,
    );
    expect(colorsEqual(IN_GAMUT, { ...IN_GAMUT, alpha: 0.998 }, 0.001)).toBe(
      false,
    );
  });
});

describe('gamutMapMethod', () => {
  it('records the mapping method in state meta', () => {
    expect(createColorState(OUT_OF_BOTH).meta.gamutMapMethod).toBe(
      'chroma-reduction',
    );
    expect(
      createColorState(OUT_OF_BOTH, { gamutMapMethod: 'css' }).meta
        .gamutMapMethod,
    ).toBe('css');
  });

  it('defaults to chroma reduction and forwards an explicit method', () => {
    expect(mapDisplayedColors(OUT_OF_BOTH)).toEqual(
      mapDisplayedColors(OUT_OF_BOTH, { gamutMapMethod: 'chroma-reduction' }),
    );

    const css = mapDisplayedColors(OUT_OF_BOTH, { gamutMapMethod: 'css' });
    expect(css.srgb).toEqual(toSrgbGamut(OUT_OF_BOTH, { method: 'css' }));
    expect(css.p3).toEqual(toP3Gamut(OUT_OF_BOTH, { method: 'css' }));
    expect(css.outOfGamut).toEqual({ srgb: true, p3: true });

    const state = createColorState(OUT_OF_BOTH, { gamutMapMethod: 'css' });
    expect(state.displayed).toEqual({ srgb: css.srgb, p3: css.p3 });
  });
});

describe('single-color reducers', () => {
  const base = createColorState(OUT_OF_SRGB, { source: 'programmatic' });

  it('setColorRequested re-derives displayed colors and keeps the display context', () => {
    const start = setColorActiveView(
      setColorActiveGamut(base, 'srgb', 'programmatic'),
      'hex',
      'programmatic',
    );
    const next = setColorRequested(start, OUT_OF_BOTH, 'user');

    expect(next).not.toBe(start);
    expect(next.requested).toEqual(OUT_OF_BOTH);
    expect(next.meta).toEqual({
      source: 'user',
      outOfGamut: { srgb: true, p3: true },
      gamutMapMethod: 'chroma-reduction',
    });
    expect(next.activeGamut).toBe('srgb');
    expect(next.activeView).toBe('hex');
    expect(inSrgbGamut(next.displayed.srgb)).toBe(true);
  });

  it('setColorRequested is a no-op only for an equal color and source', () => {
    expect(setColorRequested(base, { ...OUT_OF_SRGB }, 'programmatic')).toBe(
      base,
    );
    const resourced = setColorRequested(base, { ...OUT_OF_SRGB }, 'user');
    expect(resourced).not.toBe(base);
    expect(resourced.meta.source).toBe('user');
  });

  it('setColorChannel updates one channel and no-ops on an equal value', () => {
    const next = setColorChannel(base, 'c', 0.05, 'user');

    expect(next.requested).toEqual({ ...OUT_OF_SRGB, c: 0.05 });
    expect(next.meta.outOfGamut).toEqual({ srgb: false, p3: false });
    expect(next.meta.source).toBe('user');
    // Equal channel value wins over a different source.
    expect(setColorChannel(base, 'c', OUT_OF_SRGB.c, 'user')).toBe(base);
  });

  it('setColorActiveGamut/View switch context without touching colors', () => {
    const gamut = setColorActiveGamut(base, 'srgb', 'user');
    expect(gamut.activeGamut).toBe('srgb');
    expect(gamut.requested).toBe(base.requested);
    expect(gamut.displayed).toBe(base.displayed);
    expect(gamut.meta.source).toBe('user');
    expect(gamut.meta.outOfGamut).toBe(base.meta.outOfGamut);

    const view = setColorActiveView(base, 'hsl', 'derived');
    expect(view.activeView).toBe('hsl');
    expect(view.requested).toBe(base.requested);
    expect(view.meta.source).toBe('derived');
  });

  it('setColorRequested/Channel forward gamutMapMethod', () => {
    const css = { gamutMapMethod: 'css' } as const;
    const requested = setColorRequested(base, OUT_OF_BOTH, 'user', css);
    expect(requested.displayed).toEqual({
      srgb: toSrgbGamut(OUT_OF_BOTH, { method: 'css' }),
      p3: toP3Gamut(OUT_OF_BOTH, { method: 'css' }),
    });

    const channel = setColorChannel(base, 'c', OUT_OF_BOTH.c, 'user', css);
    const expected = { ...OUT_OF_SRGB, c: OUT_OF_BOTH.c };
    expect(channel.displayed).toEqual({
      srgb: toSrgbGamut(expected, { method: 'css' }),
      p3: toP3Gamut(expected, { method: 'css' }),
    });
  });

  it('setColorRequested/Channel apply a method override to an unchanged color', () => {
    const css = { gamutMapMethod: 'css' } as const;
    const byColor = setColorRequested(
      base,
      { ...base.requested },
      base.meta.source,
      css,
    );
    expect(byColor).not.toBe(base);
    expect(byColor.meta.gamutMapMethod).toBe('css');
    expect(byColor.displayed).toEqual(
      createColorState(base.requested, css).displayed,
    );

    const byChannel = setColorChannel(base, 'c', base.requested.c, 'user', css);
    expect(byChannel.meta.gamutMapMethod).toBe('css');
    expect(byChannel.displayed).toEqual(
      createColorState(base.requested, css).displayed,
    );

    // Passing the stored method is still a no-op.
    expect(
      setColorRequested(byColor, { ...byColor.requested }, 'programmatic', css),
    ).toBe(byColor);
    expect(
      setColorChannel(byColor, 'c', byColor.requested.c, 'user', css),
    ).toBe(byColor);
  });

  it('setColorRequested/Channel keep the stored gamutMapMethod', () => {
    // 'css' must survive later updates instead of reverting to the default.
    const vivid: Color = { l: 0.7, c: 0.35, h: 150, alpha: 1 };
    const start = createColorState(vivid, { gamutMapMethod: 'css' });
    expect(start.displayed.srgb.c).toBeCloseTo(0.2104, 3);

    const alpha = setColorChannel(start, 'alpha', 0.9, 'user');
    expect(alpha.meta.gamutMapMethod).toBe('css');
    expect(alpha.displayed.srgb).toEqual(
      toSrgbGamut({ ...vivid, alpha: 0.9 }, { method: 'css' }),
    );
    expect(alpha.displayed.srgb.c).toBeCloseTo(0.2104, 3);

    const requested = setColorRequested(alpha, OUT_OF_BOTH, 'user');
    expect(requested.meta.gamutMapMethod).toBe('css');
    expect(requested.displayed.p3).toEqual(
      toP3Gamut(OUT_OF_BOTH, { method: 'css' }),
    );

    // Gamut/view switches keep it; an explicit option overrides it.
    expect(
      setColorActiveView(
        setColorActiveGamut(alpha, 'srgb', 'user'),
        'hex',
        'user',
      ).meta.gamutMapMethod,
    ).toBe('css');
    const overridden = setColorChannel(alpha, 'alpha', 0.8, 'user', {
      gamutMapMethod: 'chroma-reduction',
    });
    expect(overridden.meta.gamutMapMethod).toBe('chroma-reduction');
    expect(overridden.displayed.srgb).toEqual(
      toSrgbGamut({ ...vivid, alpha: 0.8 }),
    );
  });

  it('setColorActiveGamut/View no-op only when value and source match', () => {
    expect(setColorActiveGamut(base, 'display-p3', 'programmatic')).toBe(base);
    expect(setColorActiveView(base, 'oklch', 'programmatic')).toBe(base);
    expect(setColorActiveGamut(base, 'display-p3', 'user')).not.toBe(base);
    expect(setColorActiveView(base, 'oklch', 'user')).not.toBe(base);
  });
});

describe('gamut validation', () => {
  const unknownGamuts: unknown[] = ['p3', 'rec2020', '', null];

  it('rejects unknown active gamuts in createColorState', () => {
    for (const gamut of unknownGamuts) {
      expect(() =>
        createColorState(IN_GAMUT, { activeGamut: gamut as 'srgb' }),
      ).toThrow(TypeError);
    }
    expect(() =>
      createColorState(IN_GAMUT, { activeGamut: 'p3' as 'srgb' }),
    ).toThrow(/createColorState\(\): unknown gamut "p3".*use 'display-p3'/);
    expect(createColorState(IN_GAMUT).activeGamut).toBe('display-p3');
    expect(
      createColorState(IN_GAMUT, { activeGamut: 'srgb' }).activeGamut,
    ).toBe('srgb');
  });

  it('rejects unknown and missing gamuts in setColorActiveGamut', () => {
    const base = createColorState(IN_GAMUT);
    for (const gamut of [...unknownGamuts, undefined]) {
      expect(() => setColorActiveGamut(base, gamut as 'srgb', 'user')).toThrow(
        TypeError,
      );
    }
    expect(() => setColorActiveGamut(base, 'p3' as 'srgb', 'user')).toThrow(
      "use 'display-p3'",
    );
  });

  it('rejects unknown gamuts in getColorDisplayStyles', () => {
    expect(() =>
      getColorDisplayStyles(IN_GAMUT, IN_GAMUT, 'p3' as 'srgb'),
    ).toThrow(TypeError);
    expect(
      getColorDisplayStyles(IN_GAMUT, IN_GAMUT, 'srgb').background,
    ).toMatch(/^#/);
  });
});
