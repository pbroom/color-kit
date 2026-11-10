import { describe, expect, it } from 'vitest';
import { displayP3, maxChromaAt, parse, srgb } from '@color-kit/core';
import {
  assertDisplayGamut,
  displayGamutDescriptor,
  type DisplayGamut,
  areColorAreaAxesDistinct,
  COLOR_CHANNEL_DEFAULT_RANGES,
  colorFromColorChannelValue,
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
  formatColorStringInputValue,
  formatColorChannelValue,
  getChangedColorChannel,
  getColorChannelLabel,
  getColorChannelValue,
  normalizeColorChannelValue,
  parseColorStringInputValue,
  normalizeColorSliderPointer,
  resolveColorAreaAxes,
  resolveColorChannelRange,
  resolveColorChannelSteps,
  resolveColorChannelWrap,
} from '../src/index.js';

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
      initialSamples: 16,
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
      initialSamples: 12,
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
        initialSamples: 16,
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

  it('keeps color area geometry to display gamuts', () => {
    // Core takes any gamut descriptor; the driver's dual-state model names
    // its two display gamuts, sRGB and Display P3, by string.
    const axes = resolveColorAreaAxes({
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.4] },
    });
    const color = parse('#3b82f6');
    const options = { gamut: 'rec2020' as DisplayGamut };
    const hint = "unknown gamut \"rec2020\"; use 'srgb' or 'display-p3'";

    expect(() => getColorAreaGamutBoundaryPoints(250, axes, options)).toThrow(
      new TypeError(`gamutBoundary(): ${hint}`),
    );
    expect(() =>
      getColorAreaContrastRegionPaths(color, 250, axes, options),
    ).toThrow(new TypeError(`contrastRegion(): ${hint}`));
    expect(() =>
      getColorAreaChromaBandPoints(color, 250, axes, options),
    ).toThrow(new TypeError(`chromaBand(): ${hint}`));
    expect(
      getColorAreaGamutBoundaryPoints(250, axes, { gamut: 'display-p3' })
        .length,
    ).toBeGreaterThan(10);
  });

  it('maps display gamut names to core gamut descriptors', () => {
    expect(displayGamutDescriptor('srgb')).toBe(srgb);
    expect(displayGamutDescriptor('display-p3')).toBe(displayP3);
    expect(displayGamutDescriptor(undefined)).toBe(srgb);
    expect(() => assertDisplayGamut('display-p3', 'f()')).not.toThrow();
    expect(() => assertDisplayGamut(undefined, 'f()')).not.toThrow();
    expect(() => assertDisplayGamut('p3', 'f()')).toThrow(
      new TypeError("f(): unknown gamut \"p3\"; use 'srgb' or 'display-p3'"),
    );
    // The driver keeps the string vocabulary: a core descriptor is rejected.
    expect(() => assertDisplayGamut(displayP3, 'f()')).toThrow(
      new TypeError(
        "f(): unknown gamut \"display-p3\"; use 'srgb' or 'display-p3'",
      ),
    );
  });

  it('traces color area geometry in the named display gamut', () => {
    const axes = resolveColorAreaAxes({
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.4] },
    });
    for (const gamut of ['srgb', 'display-p3'] as const) {
      const points = getColorAreaGamutBoundaryPoints(250, axes, {
        gamut,
        steps: 10,
      });
      const mid = points[5];
      expect(mid.c).toBe(
        maxChromaAt(mid.l, 250, { gamut: displayGamutDescriptor(gamut) }),
      );
    }
  });

  it('rejects unknown gamuts in the color area fallback point', () => {
    const axes = resolveColorAreaAxes({
      x: { channel: 'c', range: [0, 0.4] },
      y: { channel: 'l', range: [0, 1] },
    });
    const color = parse('#3b82f6');
    const fallback = (gamut: unknown) =>
      getColorAreaFallbackPoint(axes, {
        color,
        gamut: gamut as DisplayGamut,
      });

    expect(() => fallback('p3')).toThrow(TypeError);
    expect(() => fallback('p3')).toThrow("or 'display-p3'");
    expect(() => fallback('rec2020')).toThrow(TypeError);
    expect(() => fallback('rec2020')).toThrow(/unknown gamut "rec2020"/);
    expect(() => fallback(null)).toThrow(TypeError);
    expect(() => fallback('')).toThrow(TypeError);
    expect(() => fallback(undefined)).toThrow(TypeError);
    expect(() => fallback(undefined)).toThrow(/gamut is required/);
    expect(fallback('srgb').gamut).toBe('srgb');
    expect(fallback('display-p3').gamut).toBe('display-p3');
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

  it('normalizes slider pointers against the thumb-center track span', () => {
    expect(normalizeColorSliderPointer('horizontal', 68, 10, 116)).toBeCloseTo(
      0.5,
      6,
    );
    expect(normalizeColorSliderPointer('horizontal', 18, 10, 116, 8)).toBe(0);
    expect(
      normalizeColorSliderPointer('horizontal', 68, 10, 116, 8),
    ).toBeCloseTo(0.5, 6);
    expect(
      normalizeColorSliderPointer('vertical', 118, 10, 116, 8),
    ).toBeCloseTo(0, 6);
  });

  it('reads and writes channel values per color model', () => {
    const base = parse('#2563eb');
    const rgbBlue = getColorChannelValue(base, 'rgb', 'b');
    expect(rgbBlue).toBeGreaterThan(200);

    const fromRgb = colorFromColorChannelValue(base, 'rgb', 'r', 10);
    expect(getColorChannelValue(fromRgb, 'rgb', 'r')).toBeCloseTo(10, 3);

    const hslSat = getColorChannelValue(base, 'hsl', 's');
    expect(hslSat).toBeGreaterThan(60);

    const fromHsl = colorFromColorChannelValue(base, 'hsl', 'h', 180);
    expect(getColorChannelValue(fromHsl, 'hsl', 'h')).toBeCloseTo(180, 1);
  });

  it('resolves default and explicit channel ranges', () => {
    expect(resolveColorChannelRange('rgb', 'r')).toEqual([0, 255]);
    expect(resolveColorChannelRange('hsl', 's')).toEqual([0, 100]);
    expect(resolveColorChannelRange('oklch', 'c')).toBe(
      COLOR_CHANNEL_DEFAULT_RANGES.oklch.c,
    );
    expect(resolveColorChannelRange('oklch', 'c', [0, 0.5])).toEqual([0, 0.5]);
    expect(() =>
      // @ts-expect-error 'r' is not an HSL channel.
      resolveColorChannelRange('hsl', 'r'),
    ).toThrow('Invalid color channel "r" for "hsl" model.');
  });

  it('wraps hue channels by default', () => {
    expect(resolveColorChannelWrap('oklch', 'h')).toBe(true);
    expect(resolveColorChannelWrap('hsl', 'h')).toBe(true);
    expect(resolveColorChannelWrap('hsl', 'l')).toBe(false);
    expect(resolveColorChannelWrap('rgb', 'r')).toBe(false);
    expect(resolveColorChannelWrap('oklch', 'h', false)).toBe(false);
    expect(resolveColorChannelWrap('rgb', 'r', true)).toBe(true);
  });

  it('resolves channel steps, ignoring unusable overrides', () => {
    expect(resolveColorChannelSteps('oklch', 'h')).toEqual({
      step: 1,
      fineStep: 0.1,
      coarseStep: 10,
      pageStep: 45,
    });
    expect(
      resolveColorChannelSteps('rgb', 'r', {
        step: 5,
        fineStep: 0,
        coarseStep: Number.NaN,
        pageStep: -1,
      }),
    ).toEqual({ step: 5, fineStep: 0.1, coarseStep: 10, pageStep: 25 });
  });

  it('labels channels per model', () => {
    expect(getColorChannelLabel('oklch', 'l')).toBe('OKLCH lightness');
    expect(getColorChannelLabel('hsl', 'l')).toBe('Lightness');
    expect(getColorChannelLabel('rgb', 'g')).toBe('Green');
    expect(getColorChannelLabel('rgb', 'alpha')).toBe('Opacity');
  });

  it('reports a changed channel only for OKLCH edits', () => {
    expect(getChangedColorChannel('oklch', 'c')).toBe('c');
    expect(getChangedColorChannel('oklch', 'alpha')).toBe('alpha');
    expect(getChangedColorChannel('rgb', 'alpha')).toBeUndefined();
    expect(getChangedColorChannel('hsl', 'h')).toBeUndefined();
  });

  it('clamps or wraps channel values into a range', () => {
    expect(normalizeColorChannelValue(500, [0, 255], false)).toBe(255);
    expect(normalizeColorChannelValue(-3, [0, 255], false)).toBe(0);
    expect(normalizeColorChannelValue(370, [0, 360], true)).toBeCloseTo(10, 6);
    expect(normalizeColorChannelValue(-20, [0, 360], true)).toBeCloseTo(340, 6);
    // The top of a wrapped range stays put instead of folding onto the start.
    expect(normalizeColorChannelValue(360, [0, 360], true)).toBe(360);
    expect(normalizeColorChannelValue(0, [0, 360], true)).toBe(0);
    expect(normalizeColorChannelValue(Number.NaN, [10, 20], false)).toBe(10);
    expect(
      normalizeColorChannelValue(Number.POSITIVE_INFINITY, [10, 20], true),
    ).toBe(10);
    // Empty and inverted ranges leave the value alone.
    expect(normalizeColorChannelValue(5, [1, 1], false)).toBe(5);
    expect(normalizeColorChannelValue(5, [1, 0], true)).toBe(5);
  });

  it('formats channel values with trimmed decimals', () => {
    expect(formatColorChannelValue(0.62795, 3)).toBe('0.628');
    expect(formatColorChannelValue(120, 2)).toBe('120');
    expect(formatColorChannelValue(59.4, 0)).toBe('59');
    expect(formatColorChannelValue(-0.0001, 2)).toBe('0');
    expect(formatColorChannelValue(Number.NaN, 2)).toBe('0');
    // Precision is rounded and clamped to 0-6.
    expect(formatColorChannelValue(0.123456789, 12)).toBe('0.123457');
    expect(formatColorChannelValue(1.26, -2)).toBe('1');
    expect(formatColorChannelValue(1.26, 0.6)).toBe('1.3');
  });

  it('steps a channel by composing read, normalize and write', () => {
    const base = parse('oklch(0.6 0.2 350)');
    const range = resolveColorChannelRange('oklch', 'h');
    const { step } = resolveColorChannelSteps('oklch', 'h', { step: 15 });
    const value = normalizeColorChannelValue(
      getColorChannelValue(base, 'oklch', 'h') + step,
      range,
      resolveColorChannelWrap('oklch', 'h'),
    );
    expect(value).toBeCloseTo(5, 6);
    expect(colorFromColorChannelValue(base, 'oklch', 'h', value)).toEqual({
      ...base,
      h: value,
    });
  });

  it('formats endpoint OKLCH colors as gamut-mapped hex values', () => {
    expect(
      formatColorStringInputValue({ l: 0, c: 0.211, h: 28, alpha: 1 }, 'hex'),
    ).toBe('#000000');
    expect(
      formatColorStringInputValue({ l: 1, c: 0.211, h: 28, alpha: 1 }, 'hex'),
    ).toBe('#ffffff');
  });

  it('parses legacy color-string input values', () => {
    expect(parseColorStringInputValue('#2563eb')).not.toBeNull();
    expect(parseColorStringInputValue('not-a-color')).toBeNull();
  });
});
