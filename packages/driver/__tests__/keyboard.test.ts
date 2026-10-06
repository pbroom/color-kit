import { describe, expect, it } from 'vitest';
import type { Color } from '@color-kit/core';
import {
  colorFromColorAreaKey,
  colorFromColorSliderKey,
  getColorAreaKeyAxis,
  getColorAreaValueText,
  getColorSliderValueText,
  resolveColorAreaAxes,
  resolveColorSliderWrap,
} from '../src/index.js';

const base: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };

describe('colorFromColorSliderKey', () => {
  it('handles arrows, page keys, and Home/End', () => {
    const step = (key: string) =>
      colorFromColorSliderKey(base, 'l', key, 0.01, [0, 1])?.l;

    expect(step('ArrowRight')).toBeCloseTo(0.51, 6);
    expect(step('ArrowUp')).toBeCloseTo(0.51, 6);
    expect(step('ArrowLeft')).toBeCloseTo(0.49, 6);
    expect(step('ArrowDown')).toBeCloseTo(0.49, 6);
    expect(step('PageUp')).toBeCloseTo(0.6, 6);
    expect(step('PageDown')).toBeCloseTo(0.4, 6);
    expect(step('Home')).toBe(0);
    expect(step('End')).toBe(1);
    expect(colorFromColorSliderKey(base, 'l', 'Enter', 0.01, [0, 1])).toBe(
      null,
    );
  });

  it('honors a custom large step', () => {
    const next = colorFromColorSliderKey(base, 'l', 'PageUp', 0.01, [0, 1], {
      largeStepRatio: 0.25,
    });
    expect(next?.l).toBeCloseTo(0.75, 6);
  });

  it('wraps hue by default and clamps when wrap is off', () => {
    const hue = { ...base, h: 359 };
    expect(
      colorFromColorSliderKey(hue, 'h', 'ArrowRight', 0.01, [0, 360])?.h,
    ).toBeCloseTo(2.6, 6);
    expect(
      colorFromColorSliderKey(
        { ...base, h: 0 },
        'h',
        'ArrowLeft',
        0.01,
        [0, 360],
      )?.h,
    ).toBeCloseTo(356.4, 6);
    expect(
      colorFromColorSliderKey(hue, 'h', 'ArrowRight', 0.01, [0, 360], {
        wrap: false,
      })?.h,
    ).toBe(360);
    expect(resolveColorSliderWrap('h')).toBe(true);
    expect(resolveColorSliderWrap('l')).toBe(false);
  });

  it('clamps within descending ranges', () => {
    const next = colorFromColorSliderKey(
      { ...base, l: 0.95 },
      'l',
      'ArrowLeft',
      0.1,
      [1, 0],
    );
    // Moving "back" along a descending range increases the value.
    expect(next?.l).toBe(1);
  });
});

describe('colorFromColorAreaKey', () => {
  const axes = resolveColorAreaAxes({
    x: { channel: 'l', range: [0, 1] },
    y: { channel: 'c', range: [0, 0.4] },
  });

  it('maps keys to axes', () => {
    expect(getColorAreaKeyAxis('Home')).toBe('x');
    expect(getColorAreaKeyAxis('End')).toBe('x');
    expect(getColorAreaKeyAxis('PageUp')).toBe('y');
    expect(getColorAreaKeyAxis('ArrowDown')).toBe('y');
    expect(getColorAreaKeyAxis('Enter')).toBe(null);
  });

  it('handles arrows, page keys, and Home/End', () => {
    const step = (key: string) => colorFromColorAreaKey(base, axes, key, 0.01);

    expect(step('ArrowRight')?.l).toBeCloseTo(0.51, 6);
    expect(step('ArrowUp')?.c).toBeCloseTo(0.204, 6);
    expect(step('PageUp')?.c).toBeCloseTo(0.24, 6);
    expect(step('PageDown')?.c).toBeCloseTo(0.16, 6);
    expect(step('Home')?.l).toBe(0);
    expect(step('End')?.l).toBe(1);
    expect(step('Escape')).toBe(null);
  });

  it('wraps hue axes', () => {
    const hueAxes = resolveColorAreaAxes({
      x: { channel: 'h' },
      y: { channel: 'l' },
    });
    const next = colorFromColorAreaKey(
      { ...base, h: 1 },
      hueAxes,
      'ArrowLeft',
      0.01,
    );
    expect(next?.h).toBeCloseTo(357.4, 6);
    expect(
      colorFromColorAreaKey({ ...base, h: 1 }, hueAxes, 'ArrowLeft', 0.01, {
        wrapHue: false,
      })?.h,
    ).toBe(0);
  });
});

describe('value text', () => {
  it('formats channels with names and units', () => {
    expect(getColorSliderValueText('h', 213.4567)).toBe('Hue 213°');
    expect(getColorSliderValueText('l', 0.6)).toBe('Lightness 60%');
    expect(getColorSliderValueText('l', 0.6234)).toBe('Lightness 62.3%');
    expect(getColorSliderValueText('alpha', 0.5)).toBe('Opacity 50%');
    expect(getColorSliderValueText('c', 0.12345)).toBe('Chroma 0.123');
  });

  it('describes both color area axes', () => {
    const axes = resolveColorAreaAxes();
    expect(getColorAreaValueText({ ...base, l: 0.6 }, axes)).toBe(
      'Lightness 60%, Chroma 0.2',
    );
  });
});
