import { describe, expect, it } from 'vitest';
import { parse } from '@color-kit/core';
import {
  areColorAreaAxesDistinct,
  colorFromColorInputChannelValue,
  colorFromColorInputKey,
  colorFromColorAreaKey,
  colorFromColorAreaPosition,
  colorFromColorSliderKey,
  colorFromColorSliderPosition,
  getColorSliderNormFromValue,
  getColorAreaChromaBandPoints,
  getColorAreaContrastRegionPaths,
  getColorAreaFallbackPoint,
  getColorAreaGamutBoundaryPoints,
  getColorAreaThumbPosition,
  getColorInputChannelValue,
  parseColorInputExpression,
  parseColorStringInputValue,
  resolveColorInputDraftValue,
  resolveColorAreaAxes,
} from '../src/api/index.js';

describe('Color API helpers', () => {
  it('maps color area pointer positions into channel values', () => {
    const base = parse('#3b82f6');
    const axes = resolveColorAreaAxes({
      x: { channel: 'c', range: [0, 0.4] },
      y: { channel: 'l', range: [0, 1] },
    });

    const next = colorFromColorAreaPosition(base, axes, 0.5, 0.25);

    expect(next.c).toBeCloseTo(0.2, 6);
    expect(next.l).toBeCloseTo(0.75, 6);
  });

  it('returns normalized color area gamut boundary points for l/c areas', () => {
    const axes = resolveColorAreaAxes({
      x: { channel: 'c', range: [0, 0.4] },
      y: { channel: 'l', range: [0, 1] },
    });
    const boundary = getColorAreaGamutBoundaryPoints(145, axes, {
      gamut: 'srgb',
      steps: 8,
    });

    expect(boundary).toHaveLength(9);
    expect(boundary[0].x).toBeCloseTo(0, 6);
    expect(boundary[0].y).toBeCloseTo(1, 6);
    expect(boundary[8].x).toBeCloseTo(0, 6);
    expect(boundary[8].y).toBeCloseTo(0, 6);

    for (const point of boundary) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  });

  it('returns an empty boundary when the color area is not l/c based', () => {
    const axes = resolveColorAreaAxes({
      x: { channel: 'h', range: [0, 360] },
      y: { channel: 'l', range: [0, 1] },
    });
    const boundary = getColorAreaGamutBoundaryPoints(145, axes, { steps: 8 });
    expect(boundary).toEqual([]);
  });

  it('returns normalized contrast-region paths for l/c areas', () => {
    const axes = resolveColorAreaAxes({
      x: { channel: 'c', range: [0, 0.4] },
      y: { channel: 'l', range: [0, 1] },
    });
    const paths = getColorAreaContrastRegionPaths(parse('#ffffff'), 220, axes, {
      level: 'AA',
      lightnessSteps: 16,
      chromaSteps: 16,
    });

    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.length).toBeGreaterThan(1);
      for (const point of path) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('returns no contrast-region paths for non l/c color areas', () => {
    const axes = resolveColorAreaAxes({
      x: { channel: 'h', range: [0, 360] },
      y: { channel: 'l', range: [0, 1] },
    });
    const paths = getColorAreaContrastRegionPaths(parse('#ffffff'), 220, axes, {
      level: 'AA',
      lightnessSteps: 12,
      chromaSteps: 12,
    });

    expect(paths).toEqual([]);
  });

  it('returns normalized area-driven boundary, region, band, and fallback data', () => {
    const requested = parse('#3b82f6');
    const axes = resolveColorAreaAxes({
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.4] },
    });
    const thumb = getColorAreaThumbPosition(requested, axes);
    expect(thumb.x).toBeGreaterThanOrEqual(0);
    expect(thumb.x).toBeLessThanOrEqual(1);
    expect(thumb.y).toBeGreaterThanOrEqual(0);
    expect(thumb.y).toBeLessThanOrEqual(1);

    const boundary = getColorAreaGamutBoundaryPoints(requested.h, axes, {
      gamut: 'srgb',
      steps: 8,
    });
    expect(boundary.length).toBeGreaterThan(0);

    const regions = getColorAreaContrastRegionPaths(
      parse('#ffffff'),
      requested.h,
      axes,
      {
        threshold: 4.5,
        lightnessSteps: 16,
        chromaSteps: 16,
      },
    );
    expect(regions.length).toBeGreaterThan(0);

    const band = getColorAreaChromaBandPoints(requested, requested.h, axes, {
      mode: 'clamped',
      steps: 8,
    });
    expect(band).toHaveLength(9);

    const fallback = getColorAreaFallbackPoint(axes, {
      color: requested,
      gamut: 'srgb',
    });
    expect(fallback.x).toBeGreaterThanOrEqual(0);
    expect(fallback.x).toBeLessThanOrEqual(1);
    expect(fallback.y).toBeGreaterThanOrEqual(0);
    expect(fallback.y).toBeLessThanOrEqual(1);
  });

  it('updates color area channels from keyboard input', () => {
    const base = { l: 0.5, c: 0.2, h: 120, alpha: 1 };
    const axes = resolveColorAreaAxes({
      x: { channel: 'c', range: [0, 0.4] },
      y: { channel: 'l', range: [0, 1] },
    });

    const next = colorFromColorAreaKey(base, axes, 'ArrowRight', 0.1);

    expect(next?.c).toBeCloseTo(0.24, 6);
  });

  it('detects whether color area axes are distinct', () => {
    expect(
      areColorAreaAxesDistinct({
        x: { channel: 'c', range: [0, 0.4] },
        y: { channel: 'l', range: [0, 1] },
      }),
    ).toBe(true);
    expect(
      areColorAreaAxesDistinct({
        x: { channel: 'l', range: [0, 1] },
        y: { channel: 'l', range: [0, 1] },
      }),
    ).toBe(false);
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

  it('normalizes slider values into channel coordinates', () => {
    const norm = getColorSliderNormFromValue(0.2, [0, 0.4]);
    expect(norm).toBeCloseTo(0.5, 6);
  });

  it('maps channel values for color input models', () => {
    const base = parse('#2563eb');
    const rgbBlue = getColorInputChannelValue(base, 'rgb', 'b');
    expect(rgbBlue).toBeGreaterThan(200);

    const fromRgb = colorFromColorInputChannelValue(base, 'rgb', 'r', 10);
    expect(getColorInputChannelValue(fromRgb, 'rgb', 'r')).toBeCloseTo(10, 3);

    const hslSat = getColorInputChannelValue(base, 'hsl', 's');
    expect(hslSat).toBeGreaterThan(60);

    const fromHsl = colorFromColorInputChannelValue(base, 'hsl', 'h', 180);
    expect(getColorInputChannelValue(fromHsl, 'hsl', 'h')).toBeCloseTo(180, 1);
  });

  it('parses color input expressions with relative math and precedence', () => {
    expect(
      parseColorInputExpression('10 + 5 * 2', {
        currentValue: 0,
        range: [0, 100],
        allowExpressions: true,
      }),
    ).toBeCloseTo(20, 6);

    expect(
      parseColorInputExpression('+10', {
        currentValue: 25,
        range: [0, 100],
        allowExpressions: true,
      }),
    ).toBeCloseTo(35, 6);

    expect(
      parseColorInputExpression('50%', {
        currentValue: 25,
        range: [0, 200],
        allowExpressions: true,
      }),
    ).toBeCloseTo(100, 6);
  });

  it('resolves color input draft values with clamping and wrapping', () => {
    expect(
      resolveColorInputDraftValue('500', {
        currentValue: 0,
        range: [0, 255],
        wrap: false,
        allowExpressions: true,
      }),
    ).toBe(255);

    expect(
      resolveColorInputDraftValue('370', {
        currentValue: 0,
        range: [0, 360],
        wrap: true,
        allowExpressions: true,
      }),
    ).toBeCloseTo(10, 6);
  });

  it('handles keyboard-derived color input updates including Home/End', () => {
    const base = parse('#2563eb');
    const stepped = colorFromColorInputKey(base, 'oklch', 'h', 'ArrowUp', {
      step: 5,
      range: [0, 360],
      wrap: true,
    });
    expect(stepped?.value).toBeGreaterThan(0);

    const home = colorFromColorInputKey(base, 'oklch', 'c', 'Home', {
      step: 0.01,
      range: [0, 0.4],
      wrap: false,
    });
    const end = colorFromColorInputKey(base, 'oklch', 'c', 'End', {
      step: 0.01,
      range: [0, 0.4],
      wrap: false,
    });
    const hueHome = colorFromColorInputKey(base, 'oklch', 'h', 'Home', {
      step: 1,
      range: [0, 360],
      wrap: true,
    });
    const hueEnd = colorFromColorInputKey(base, 'oklch', 'h', 'End', {
      step: 1,
      range: [0, 360],
      wrap: true,
    });

    expect(home?.value).toBeCloseTo(0, 6);
    expect(end?.value).toBeCloseTo(0.4, 6);
    expect(hueHome?.value).toBeCloseTo(0, 6);
    expect(hueEnd?.value).toBeCloseTo(360, 6);
  });

  it('parses legacy color-string input values', () => {
    expect(parseColorStringInputValue('#2563eb')).not.toBeNull();
    expect(parseColorStringInputValue('not-a-color')).toBeNull();
  });
});
