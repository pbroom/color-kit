import { describe, expect, it } from 'vitest';
import { parse } from '@color-kit/core';
import {
  colorFromColorAreaKey,
  colorFromColorAreaPosition,
  colorFromColorSliderKey,
  colorFromColorSliderPosition,
  colorsEqual,
  getColorDisplayStyles,
  getContrastBadgeSummary,
  isColorInputValueValid,
  parseColorInputValue,
} from '../src/api/index.js';

describe('Color API helpers', () => {
  it('maps color area pointer positions into channel values', () => {
    const base = parse('#3b82f6');

    const next = colorFromColorAreaPosition(
      base,
      { x: 'c', y: 'l' },
      0.5,
      0.25,
      [0, 0.4],
      [0, 1],
    );

    expect(next.c).toBeCloseTo(0.2, 6);
    expect(next.l).toBeCloseTo(0.75, 6);
  });

  it('updates color area channels from keyboard input', () => {
    const base = { l: 0.5, c: 0.2, h: 120, alpha: 1 };

    const next = colorFromColorAreaKey(
      base,
      { x: 'c', y: 'l' },
      'ArrowRight',
      0.1,
      [0, 0.4],
      [0, 1],
    );

    expect(next?.c).toBeCloseTo(0.24, 6);
  });

  it('maps slider math for pointer and keyboard updates', () => {
    const base = parse('#22c55e');

    const positioned = colorFromColorSliderPosition(base, 'alpha', 0.4, [0, 1]);
    expect(positioned.alpha).toBeCloseTo(0.4, 6);

    const keyed = colorFromColorSliderKey(
      positioned,
      'alpha',
      'ArrowUp',
      0.1,
      [0, 1],
    );
    expect(keyed?.alpha).toBeCloseTo(0.5, 6);
  });

  it('parses and validates color input values', () => {
    expect(isColorInputValueValid('#2563eb')).toBe(true);
    expect(parseColorInputValue('not-a-color')).toBeNull();
  });

  it('builds contrast summaries with pass/fail metadata', () => {
    const summary = getContrastBadgeSummary(
      parse('#111827'),
      parse('#f8fafc'),
      'AA',
    );

    expect(summary.ratio).toBeGreaterThan(4.5);
    expect(summary.passes).toBe(true);
    expect(summary.ratioText.endsWith(':1')).toBe(true);
  });

  it('compares swatches using epsilon tolerance', () => {
    const a = { l: 0.6, c: 0.2, h: 200, alpha: 1 };
    const b = { l: 0.6004, c: 0.2003, h: 200.0002, alpha: 1 };

    expect(colorsEqual(a, b)).toBe(true);
  });

  it('builds deterministic display styles with p3 fallback', () => {
    const translucent = parse('rgba(59, 130, 246, 0.5)');
    const p3Styles = getColorDisplayStyles(
      translucent,
      translucent,
      'display-p3',
    );
    const srgbStyles = getColorDisplayStyles(translucent, translucent, 'srgb');

    expect(p3Styles.backgroundColor).toMatch(/^rgb\(/);
    expect(p3Styles.background).toMatch(/^color\(display-p3 /);
    expect(p3Styles.backgroundImage).toBeUndefined();
    expect(srgbStyles.backgroundColor).toMatch(/^rgb\(/);
    expect(srgbStyles.background).toBeUndefined();
    expect(srgbStyles.backgroundImage).toBeUndefined();
  });
});
