import { describe, expect, it } from 'vitest';
import type { Color } from '@color-kit/core';
import { inP3Gamut, inSrgbGamut } from '@color-kit/core';
import {
  colorsEqual,
  createColorState,
  getActiveDisplayedColor,
  mapDisplayedColors,
  resolveColorSource,
} from '../src/color-state.js';

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
