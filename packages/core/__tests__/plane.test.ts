import { describe, expect, it } from 'vitest';
import { parse } from '../src/conversion/index.js';
import {
  PlaneQueryCache,
  colorToPlane,
  containsPoint,
  createPlaneQueryKey,
  definePlane,
  definePlaneFromColor,
  differenceRegions,
  intersectRegions,
  planeToColor,
  pointDistance,
  projectRegionBetweenPlanes,
  rotateRegion,
  runCachedPlaneQuery,
  scaleRegion,
  toHct,
  toHsl,
  toHsv,
  toOklab,
  toOklch,
  toP3,
  toRgb,
  toSvgCompoundPath,
  toSvgPath,
  translateRegion,
  unionRegions,
  sense,
} from '../src/index.js';

const basePlane = definePlane({
  model: 'oklch',
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0, 0.4] },
  fixed: { h: 250, alpha: 1 },
});

function expectUnitInterval(value: number): void {
  expect(value).toBeGreaterThanOrEqual(0);
  expect(value).toBeLessThanOrEqual(1);
}

function expectRgbApprox(
  actual: { r: number; g: number; b: number; alpha: number },
  expected: { r: number; g: number; b: number; alpha: number },
  tolerance: number,
): void {
  expect(Math.abs(actual.r - expected.r)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.g - expected.g)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.b - expected.b)).toBeLessThanOrEqual(tolerance);
  expect(actual.alpha).toBeCloseTo(expected.alpha, 3);
}

describe('plane api', () => {
  it('uses default x/y axes when omitted', () => {
    const defaulted = definePlane();
    expect(defaulted.x.channel).toBe('l');
    expect(defaulted.y.channel).toBe('c');
    expect(defaulted.x.range).toEqual([0, 1]);
    expect(defaulted.y.range).toEqual([0.4, 0]);

    const partial = definePlane({ fixed: { h: 250 } });
    expect(partial.x.channel).toBe('l');
    expect(partial.y.channel).toBe('c');
    expect(partial.fixed.h).toBe(250);
  });

  it('resolves model-specific default channels/ranges and validates model channels', () => {
    const rgbPlane = definePlane({ model: 'rgb' });
    expect(rgbPlane.x.channel).toBe('r');
    expect(rgbPlane.y.channel).toBe('g');
    expect(rgbPlane.x.range).toEqual([0, 255]);
    expect(rgbPlane.y.range).toEqual([0, 255]);

    const hslPlane = definePlane({ model: 'hsl' });
    expect(hslPlane.x.channel).toBe('h');
    expect(hslPlane.y.channel).toBe('s');
    expect(hslPlane.x.range).toEqual([0, 360]);
    expect(hslPlane.y.range).toEqual([100, 0]);

    const p3Plane = definePlane({ model: 'p3' });
    expect(p3Plane.x.channel).toBe('r');
    expect(p3Plane.y.channel).toBe('g');
    expect(p3Plane.x.range).toEqual([0, 1]);
    expect(p3Plane.y.range).toEqual([0, 1]);

    expect(() =>
      definePlane({
        model: 'rgb',
        x: { channel: 'l' },
        y: { channel: 'g' },
      }),
    ).toThrowError(/not supported by model "rgb"/);
  });

  it('resolves and validates plane definitions', () => {
    expect(basePlane.model).toBe('oklch');
    expect(basePlane.fixed.h).toBe(250);
    expect(() =>
      definePlane({
        x: { channel: 'l' },
        y: { channel: 'l' },
      }),
    ).toThrowError(/distinct channels/);
  });

  it('rejects invalid fixed inputs for the selected model', () => {
    expect(() =>
      definePlane({
        model: 'rgb',
        fixed: { h: 250 },
      }),
    ).toThrowError(/fixed channel "h" is not supported by model "rgb"/);

    expect(() =>
      definePlane({
        fixed: { h: Number.NaN },
      }),
    ).toThrowError(/fixed channel "h" must be a finite numeric value/);

    expect(() =>
      definePlane({
        fixed: { alpha: Number.NaN },
      }),
    ).toThrowError(/fixed alpha must be a finite numeric value/);
  });

  it('can anchor fixed values to a source color', () => {
    const color = parse('#3b82f6');
    const rgb = toRgb(color);
    const hsl = toHsl(color);

    const anchoredRgbPlane = definePlane({
      model: 'rgb',
      x: { channel: 'r' },
      y: { channel: 'g' },
      color,
    });
    expect(anchoredRgbPlane.fixed.b).toBeCloseTo(rgb.b, 6);
    expect(anchoredRgbPlane.fixed.alpha).toBeCloseTo(rgb.alpha, 6);

    const overriddenRgbPlane = definePlane({
      model: 'rgb',
      x: { channel: 'r' },
      y: { channel: 'g' },
      color,
      fixed: { b: 12 },
    });
    expect(overriddenRgbPlane.fixed.b).toBe(12);
    expect(overriddenRgbPlane.fixed.r).toBeCloseTo(rgb.r, 6);

    const anchoredHslPlane = definePlaneFromColor(color, {
      model: 'hsl',
      x: { channel: 'h' },
      y: { channel: 's' },
    });
    expect(anchoredHslPlane.fixed.l).toBeCloseTo(hsl.l, 6);
    expect(anchoredHslPlane.fixed.alpha).toBeCloseTo(hsl.alpha, 6);
  });

  it('maps colors to and from plane coordinates', () => {
    const color = parse('#3b82f6');
    const point = colorToPlane(basePlane, color);
    const roundtrip = planeToColor(basePlane, point);
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThanOrEqual(1);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(point.y).toBeLessThanOrEqual(1);
    expect(roundtrip.l).toBeCloseTo(color.l, 6);
    expect(roundtrip.c).toBeCloseTo(color.c, 6);
  });

  it('maps points through adapters for all supported models', () => {
    const color = parse('#3b82f6');
    const expectedRgb = toRgb(color);
    const oklch = toOklch(color);
    const rgb = toRgb(color);
    const hsl = toHsl(color);
    const hsv = toHsv(color);
    const oklab = toOklab(color);
    const hct = toHct(color);
    const p3 = toP3(color);

    const cases = [
      {
        name: 'oklch',
        definition: {
          model: 'oklch' as const,
          x: { channel: 'l' as const },
          y: { channel: 'c' as const },
          fixed: { h: oklch.h, alpha: oklch.alpha },
        },
        tolerance: 2,
      },
      {
        name: 'rgb',
        definition: {
          model: 'rgb' as const,
          x: { channel: 'r' as const },
          y: { channel: 'g' as const },
          fixed: { b: rgb.b, alpha: rgb.alpha },
        },
        tolerance: 2,
      },
      {
        name: 'hsl',
        definition: {
          model: 'hsl' as const,
          x: { channel: 'h' as const },
          y: { channel: 's' as const },
          fixed: { l: hsl.l, alpha: hsl.alpha },
        },
        tolerance: 3,
      },
      {
        name: 'hsv',
        definition: {
          model: 'hsv' as const,
          x: { channel: 'h' as const },
          y: { channel: 's' as const },
          fixed: { v: hsv.v, alpha: hsv.alpha },
        },
        tolerance: 3,
      },
      {
        name: 'oklab',
        definition: {
          model: 'oklab' as const,
          x: { channel: 'a' as const },
          y: { channel: 'b' as const },
          fixed: { L: oklab.L, alpha: oklab.alpha },
        },
        tolerance: 2,
      },
      {
        name: 'hct',
        definition: {
          model: 'hct' as const,
          x: { channel: 'h' as const },
          y: { channel: 'c' as const },
          fixed: { t: hct.t, alpha: hct.alpha },
        },
        tolerance: 10,
      },
      {
        name: 'p3',
        definition: {
          model: 'p3' as const,
          x: { channel: 'r' as const },
          y: { channel: 'g' as const },
          fixed: { b: p3.b, alpha: p3.alpha },
        },
        tolerance: 2,
      },
    ];

    for (const entry of cases) {
      const resolvedPlane = definePlane(entry.definition);
      const point = colorToPlane(resolvedPlane, color);
      expectUnitInterval(point.x);
      expectUnitInterval(point.y);
      const roundtrip = planeToColor(resolvedPlane, point);
      expectRgbApprox(toRgb(roundtrip), expectedRgb, entry.tolerance);
    }
  });

  it('executes mvp plane queries', () => {
    const query = sense(basePlane);
    const boundary = query.gamutBoundary({ gamut: 'srgb', steps: 16 });
    expect(boundary.points.length).toBeGreaterThan(8);

    const contrastBoundary = query.contrastBoundary({
      reference: parse('#ffffff'),
      threshold: 4.5,
      lightnessSteps: 20,
      chromaSteps: 20,
    });
    expect(contrastBoundary.points.length).toBeGreaterThan(1);

    const contrastRegion = query.contrastRegion({
      reference: parse('#111827'),
      threshold: 3,
      lightnessSteps: 20,
      chromaSteps: 20,
    });
    expect(contrastRegion.paths.length).toBeGreaterThan(0);

    const band = query.chromaBand({
      requestedChroma: 0.2,
      steps: 12,
      mode: 'proportional',
    });
    expect(band.points.length).toBe(13);

    const fallback = query.fallbackPoint({
      color: { l: 0.82, c: 0.34, h: 10, alpha: 1 },
      gamut: 'srgb',
    });
    expect(fallback.point.x).toBeGreaterThanOrEqual(0);
    expect(fallback.point.x).toBeLessThanOrEqual(1);

    const gradient = query.gradient({
      from: parse('#2563eb'),
      to: parse('#ef4444'),
      steps: 9,
    });
    expect(gradient.points).toHaveLength(9);
  });

  it('keeps LC-only queries gated for non-OKLCH planes', () => {
    const rgbPlane = definePlane({
      model: 'rgb',
      x: { channel: 'r' },
      y: { channel: 'g' },
      fixed: { b: 180, alpha: 1 },
    });
    const query = sense(rgbPlane);

    const boundary = query.gamutBoundary({ gamut: 'srgb', steps: 12 });
    expect(boundary.points).toEqual([]);
    expect(boundary.hue).toBeGreaterThanOrEqual(0);
    expect(boundary.hue).toBeLessThan(360);

    const contrastBoundary = query.contrastBoundary({
      reference: parse('#ffffff'),
      threshold: 4.5,
      lightnessSteps: 12,
      chromaSteps: 12,
    });
    expect(contrastBoundary.points).toEqual([]);

    const contrastRegion = query.contrastRegion({
      reference: parse('#111827'),
      threshold: 3,
      lightnessSteps: 12,
      chromaSteps: 12,
    });
    expect(contrastRegion.paths).toEqual([]);

    const chromaBand = query.chromaBand({
      requestedChroma: 0.2,
      steps: 8,
    });
    expect(chromaBand.points).toEqual([]);

    const fallback = query.fallbackPoint({
      color: parse('#ef4444'),
      gamut: 'srgb',
    });
    expectUnitInterval(fallback.point.x);
    expectUnitInterval(fallback.point.y);

    const gradient = query.gradient({
      from: parse('#2563eb'),
      to: parse('#ef4444'),
      steps: 7,
    });
    expect(gradient.points).toHaveLength(7);
  });

  it('compiles deterministic svg path output and caches query results', () => {
    const query = sense(basePlane);
    const boundaryQuery = {
      kind: 'gamutBoundary' as const,
      gamut: 'display-p3' as const,
      steps: 24,
    };
    const cache = new PlaneQueryCache();
    const first = runCachedPlaneQuery(cache, basePlane, boundaryQuery, () =>
      query.gamutBoundary(boundaryQuery),
    );
    const second = runCachedPlaneQuery(cache, basePlane, boundaryQuery, () =>
      query.gamutBoundary(boundaryQuery),
    );
    expect(first).toBe(second);

    const d = toSvgPath(first.points);
    expect(d.startsWith('M ')).toBe(true);
    const compound = toSvgCompoundPath([first.points], { closeLoop: true });
    expect(compound.includes('Z')).toBe(true);
  });

  it('normalizes equivalent plane definitions into the same cache key', () => {
    const query = {
      kind: 'gamutBoundary' as const,
      gamut: 'srgb' as const,
    };
    const color = parse('#3b82f6');
    const rgb = toRgb(color);

    expect(createPlaneQueryKey({}, query)).toBe(
      createPlaneQueryKey(
        {
          model: 'oklch',
          x: { channel: 'l', range: [0, 1] },
          y: { channel: 'c', range: [0.4, 0] },
          fixed: { l: 0.5, c: 0, h: 0, alpha: 1 },
        },
        query,
      ),
    );

    expect(
      createPlaneQueryKey(
        {
          model: 'rgb',
          x: { channel: 'r' },
          y: { channel: 'g' },
          color,
        },
        query,
      ),
    ).toBe(
      createPlaneQueryKey(
        {
          model: 'rgb',
          x: { channel: 'r' },
          y: { channel: 'g' },
          fixed: { r: rgb.r, g: rgb.g, b: rgb.b, alpha: rgb.alpha },
        },
        query,
      ),
    );
  });

  it('runs region operations and transforms', () => {
    const squareA = {
      paths: [
        [
          { x: 0.1, y: 0.1 },
          { x: 0.6, y: 0.1 },
          { x: 0.6, y: 0.6 },
          { x: 0.1, y: 0.6 },
          { x: 0.1, y: 0.1 },
        ],
      ],
    };
    const squareB = {
      paths: [
        [
          { x: 0.4, y: 0.4 },
          { x: 0.8, y: 0.4 },
          { x: 0.8, y: 0.8 },
          { x: 0.4, y: 0.8 },
          { x: 0.4, y: 0.4 },
        ],
      ],
    };

    const union = unionRegions(squareA, squareB, { resolution: 72 });
    const intersection = intersectRegions(squareA, squareB, { resolution: 72 });
    const difference = differenceRegions(squareA, squareB, { resolution: 72 });
    expect(union.paths.length).toBeGreaterThan(0);
    expect(intersection.paths.length).toBeGreaterThan(0);
    expect(difference.paths.length).toBeGreaterThan(0);

    const hole = {
      paths: [
        [
          { x: 0.35, y: 0.35 },
          { x: 0.55, y: 0.35 },
          { x: 0.55, y: 0.55 },
          { x: 0.35, y: 0.55 },
          { x: 0.35, y: 0.35 },
        ],
      ],
    };
    const donut = differenceRegions(squareA, hole, { resolution: 96 });
    expect(containsPoint(donut, { x: 0.45, y: 0.45 })).toBe(false);
    expect(containsPoint(donut, { x: 0.2, y: 0.4 })).toBe(true);

    const translated = translateRegion(squareA, 0.1, -0.05);
    const scaled = scaleRegion(squareA, 0.8);
    const rotated = rotateRegion(squareA, 15);
    expect(translated.paths[0][0].x).toBeCloseTo(0.2, 6);
    expect(scaled.paths[0][1].x).toBeLessThan(squareA.paths[0][1].x);
    expect(rotated.paths[0].length).toBe(squareA.paths[0].length);

    const projected = projectRegionBetweenPlanes(
      basePlane,
      {
        x: { channel: 'c', range: [0, 0.4] },
        y: { channel: 'l', range: [0, 1] },
        fixed: { h: 250, alpha: 1 },
      },
      squareA,
    );
    expect(projected.paths[0][0].x).toBeGreaterThanOrEqual(0);
  });

  it('exposes geometric helpers', () => {
    const region = {
      paths: [
        [
          { x: 0.2, y: 0.2 },
          { x: 0.7, y: 0.2 },
          { x: 0.7, y: 0.7 },
          { x: 0.2, y: 0.7 },
        ],
      ],
    };
    expect(containsPoint(region, { x: 0.4, y: 0.4 })).toBe(true);
    expect(containsPoint(region, { x: 0.9, y: 0.9 })).toBe(false);
    expect(pointDistance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(
      Math.SQRT2,
      6,
    );
  });
});
