import { describe, expect, it } from 'vitest';
import { parse } from '@color-kit/core';
import {
  areColorAreaAxesDistinct,
  colorFromColorInputChannelValue,
  colorFromColorInputKey,
  colorFromColorDialKey,
  colorFromColorDialPosition,
  colorFromColorAreaKey,
  colorFromColorAreaPosition,
  colorFromColorWheelKey,
  colorFromColorWheelPosition,
  colorFromColorSliderKey,
  colorFromColorSliderPosition,
  colorsEqual,
  getColorSliderNormFromValue,
  getColorAreaContrastRegionPaths,
  getColorAreaGamutBoundaryPoints,
  getColorWheelThumbPosition,
  getColorDialThumbPosition,
  getColorDisplayStyles,
  getContrastBadgeSummary,
  getColorInputChannelValue,
  normalizeColorDialPointer,
  normalizeColorWheelPointer,
  parseColorInputExpression,
  parseColorStringInputValue,
  resolveColorInputDraftValue,
  resolveColorDialAngles,
  resolveColorWheelChromaRange,
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

  it('maps wheel pointer positions into hue/chroma values', () => {
    const base = parse('#3b82f6');
    const next = colorFromColorWheelPosition(base, 1, 0.5, [0, 0.4]);

    expect(next.c).toBeCloseTo(0.4, 6);
    expect(next.h).toBeCloseTo(0, 6);
    expect(next.l).toBeCloseTo(base.l, 6);
    expect(next.alpha).toBeCloseTo(base.alpha, 6);
  });

  it('preserves hue when wheel pointer lands at center', () => {
    const base = {
      l: 0.6,
      c: 0.28,
      h: 287,
      alpha: 1,
    };

    const centered = colorFromColorWheelPosition(base, 0.5, 0.5, [0, 0.4]);
    expect(centered.c).toBeCloseTo(0, 6);
    expect(centered.h).toBeCloseTo(287, 6);
  });

  it('normalizes wheel pointer positions within a circular boundary', () => {
    const normalized = normalizeColorWheelPointer(200, 50, 0, 0, 100, 100);
    expect(normalized.x).toBeCloseTo(1, 6);
    expect(normalized.y).toBeCloseTo(0.5, 6);
  });

  it('updates wheel channels from keyboard input', () => {
    const base = {
      l: 0.5,
      c: 0.2,
      h: 120,
      alpha: 1,
    };

    const hueNext = colorFromColorWheelKey(
      base,
      'ArrowRight',
      2,
      0.01,
      [0, 0.4],
    );
    expect(hueNext?.h).toBeCloseTo(122, 6);
    expect(hueNext?.c).toBeCloseTo(base.c, 6);

    const chromaNext = colorFromColorWheelKey(
      base,
      'ArrowUp',
      2,
      0.1,
      [0, 0.4],
    );
    expect(chromaNext?.c).toBeCloseTo(0.24, 6);
    expect(chromaNext?.h).toBeCloseTo(base.h, 6);
  });

  it('resolves wheel thumb position from hue/chroma state', () => {
    const color = {
      l: 0.5,
      c: 0.2,
      h: 180,
      alpha: 1,
    };
    const thumb = getColorWheelThumbPosition(color, [0, 0.4]);
    expect(thumb.radius).toBeCloseTo(0.5, 6);
    expect(thumb.x).toBeCloseTo(0.25, 6);
    expect(thumb.y).toBeCloseTo(0.5, 6);
  });

  it('falls back to default chroma range for invalid ranges', () => {
    expect(resolveColorWheelChromaRange([1, 0.2])).toEqual([0, 0.4]);
    expect(
      resolveColorWheelChromaRange([NaN, 0.2] as [number, number]),
    ).toEqual([0, 0.4]);
  });

  it('maps dial math for pointer and keyboard updates', () => {
    const base = parse('#22c55e');
    const angles = resolveColorDialAngles(0, 360);

    const positioned = colorFromColorDialPosition(base, 'h', 0.5, [0, 360]);
    expect(positioned.h).toBeCloseTo(180, 6);

    const thumb = getColorDialThumbPosition(positioned, 'h', [0, 360], angles);
    expect(thumb.norm).toBeCloseTo(0.5, 6);
    expect(thumb.angle).toBeCloseTo(180, 6);

    const norm = normalizeColorDialPointer(100, 50, 50, 50, angles);
    expect(norm).toBeCloseTo(0, 6);

    const keyed = colorFromColorDialKey(base, 'h', 'PageUp', 0.1, [0, 360], {
      wrap: true,
    });
    expect(keyed?.h).toBeGreaterThan(base.h);
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

    expect(home?.value).toBeCloseTo(0, 6);
    expect(end?.value).toBeCloseTo(0.4, 6);
  });

  it('parses legacy color-string input values', () => {
    expect(parseColorStringInputValue('#2563eb')).not.toBeNull();
    expect(parseColorStringInputValue('not-a-color')).toBeNull();
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
    expect(srgbStyles.backgroundColor).toMatch(/^rgb\(/);
    expect(srgbStyles.background).toMatch(/^rgb\(/);
  });
});
