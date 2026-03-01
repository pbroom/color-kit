import { describe, expect, it } from 'vitest';
import { parse } from '../src/conversion/index.js';
import {
  PlaneQueryCache,
  colorToPlane,
  containsPoint,
  createPlaneQuery,
  differenceRegions,
  intersectRegions,
  planeToColor,
  pointDistance,
  projectRegionBetweenPlanes,
  resolvePlaneDefinition,
  rotateRegion,
  runCachedPlaneQuery,
  scaleRegion,
  toSvgCompoundPath,
  toSvgPath,
  translateRegion,
  unionRegions,
} from '../src/index.js';

const basePlane = resolvePlaneDefinition({
  model: 'oklch',
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0, 0.4] },
  fixed: { h: 250, alpha: 1 },
});

describe('plane api', () => {
  it('resolves and validates plane definitions', () => {
    expect(basePlane.model).toBe('oklch');
    expect(basePlane.fixed.h).toBe(250);
    expect(() =>
      resolvePlaneDefinition({
        x: { channel: 'l' },
        y: { channel: 'l' },
      }),
    ).toThrowError(/distinct channels/);
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

  it('executes mvp plane queries', () => {
    const query = createPlaneQuery(basePlane);
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

  it('compiles deterministic svg path output and caches query results', () => {
    const query = createPlaneQuery(basePlane);
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
