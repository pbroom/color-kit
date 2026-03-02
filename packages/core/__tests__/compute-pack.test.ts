import { describe, expect, it } from 'vitest';
import {
  getPackedPlaneQueryTransferables,
  packPlaneQueryResults,
  plane,
  parse,
  runPackedPlaneQueries,
  runPlaneQueries,
  unpackPlaneQueryResults,
  type PlaneQueryResult,
} from '../src/index.js';

function expectBoundaryPointsClose(
  actual: Array<{ x: number; y: number; l: number; c: number }>,
  expected: Array<{ x: number; y: number; l: number; c: number }>,
): void {
  expect(actual).toHaveLength(expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    expect(actual[index].x).toBeCloseTo(expected[index].x, 5);
    expect(actual[index].y).toBeCloseTo(expected[index].y, 5);
    expect(actual[index].l).toBeCloseTo(expected[index].l, 5);
    expect(actual[index].c).toBeCloseTo(expected[index].c, 5);
  }
}

function expectColorPointsClose(
  actual: Array<{
    x: number;
    y: number;
    color: { l: number; c: number; h: number; alpha: number };
  }>,
  expected: Array<{
    x: number;
    y: number;
    color: { l: number; c: number; h: number; alpha: number };
  }>,
): void {
  expect(actual).toHaveLength(expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    expect(actual[index].x).toBeCloseTo(expected[index].x, 5);
    expect(actual[index].y).toBeCloseTo(expected[index].y, 5);
    // Color payload uses Float32Array packing, so compare at float32-friendly precision.
    expect(actual[index].color.l).toBeCloseTo(expected[index].color.l, 4);
    expect(actual[index].color.c).toBeCloseTo(expected[index].color.c, 4);
    expect(actual[index].color.h).toBeCloseTo(expected[index].color.h, 4);
    expect(actual[index].color.alpha).toBeCloseTo(
      expected[index].color.alpha,
      4,
    );
  }
}

function expectQueryResultClose(
  actual: PlaneQueryResult,
  expected: PlaneQueryResult,
): void {
  expect(actual.kind).toBe(expected.kind);

  if (actual.kind === 'gamutBoundary' && expected.kind === 'gamutBoundary') {
    expect(actual.gamut).toBe(expected.gamut);
    expect(actual.hue).toBeCloseTo(expected.hue, 6);
    expectBoundaryPointsClose(actual.points, expected.points);
    return;
  }

  if (
    actual.kind === 'contrastBoundary' &&
    expected.kind === 'contrastBoundary'
  ) {
    expect(actual.hue).toBeCloseTo(expected.hue, 6);
    expectBoundaryPointsClose(actual.points, expected.points);
    return;
  }

  if (actual.kind === 'contrastRegion' && expected.kind === 'contrastRegion') {
    expect(actual.hue).toBeCloseTo(expected.hue, 6);
    expect(actual.paths).toHaveLength(expected.paths.length);
    for (let index = 0; index < actual.paths.length; index += 1) {
      expectBoundaryPointsClose(actual.paths[index], expected.paths[index]);
    }
    return;
  }

  if (actual.kind === 'chromaBand' && expected.kind === 'chromaBand') {
    expect(actual.hue).toBeCloseTo(expected.hue, 6);
    expectBoundaryPointsClose(actual.points, expected.points);
    return;
  }

  if (actual.kind === 'fallbackPoint' && expected.kind === 'fallbackPoint') {
    expect(actual.gamut).toBe(expected.gamut);
    expectColorPointsClose([actual.point], [expected.point]);
    return;
  }

  if (actual.kind === 'gradient' && expected.kind === 'gradient') {
    expectColorPointsClose(actual.points, expected.points);
    return;
  }

  throw new Error(
    `Unsupported query result pair: ${actual.kind}/${expected.kind}`,
  );
}

describe('plane compute packing', () => {
  it('round-trips batched plane query results through packed transfer format', () => {
    const resolvedPlane = plane({
      model: 'oklch',
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.4] },
      fixed: { h: 250, alpha: 1 },
    });

    const queries = [
      {
        kind: 'gamutBoundary' as const,
        gamut: 'display-p3' as const,
        samplingMode: 'adaptive' as const,
      },
      {
        kind: 'contrastBoundary' as const,
        reference: parse('#ffffff'),
        threshold: 4.5,
        lightnessSteps: 24,
        chromaSteps: 24,
      },
      {
        kind: 'contrastRegion' as const,
        reference: parse('#111827'),
        threshold: 3,
        lightnessSteps: 20,
        chromaSteps: 20,
      },
      {
        kind: 'chromaBand' as const,
        requestedChroma: 0.22,
        samplingMode: 'adaptive' as const,
      },
      {
        kind: 'fallbackPoint' as const,
        color: { l: 0.82, c: 0.34, h: 10, alpha: 1 },
        gamut: 'srgb' as const,
      },
      {
        kind: 'gradient' as const,
        from: parse('#2563eb'),
        to: parse('#ef4444'),
        steps: 9,
      },
    ];

    const expected = runPlaneQueries(resolvedPlane, queries);
    const packed = packPlaneQueryResults(expected);
    const unpacked = unpackPlaneQueryResults(packed);

    expect(unpacked).toHaveLength(expected.length);
    for (let index = 0; index < unpacked.length; index += 1) {
      expectQueryResultClose(unpacked[index], expected[index]);
    }
  });

  it('keeps packed LC/LCHA schema stable for non-OKLCH planes', () => {
    const rgbPlane = plane({
      model: 'rgb',
      x: { channel: 'r', range: [0, 255] },
      y: { channel: 'g', range: [0, 255] },
      fixed: { b: 180, alpha: 1 },
    });

    const results = runPlaneQueries(rgbPlane, [
      {
        kind: 'gamutBoundary',
        gamut: 'srgb',
      },
      {
        kind: 'fallbackPoint',
        color: parse('#ef4444'),
        gamut: 'display-p3',
      },
      {
        kind: 'gradient',
        from: parse('#2563eb'),
        to: parse('#ef4444'),
        steps: 5,
      },
    ]);

    const packed = packPlaneQueryResults(results);
    expect(packed.pointLC.length).toBe(packed.pointXY.length);
    for (let index = 0; index < packed.pointLC.length; index += 1) {
      expect(Number.isNaN(packed.pointLC[index])).toBe(true);
    }

    const unpacked = unpackPlaneQueryResults(packed);
    expect(unpacked).toHaveLength(3);
    expect(unpacked[0]).toMatchObject({ kind: 'gamutBoundary', points: [] });
    expect(unpacked[1]).toMatchObject({ kind: 'fallbackPoint' });
    expect(unpacked[2]).toMatchObject({ kind: 'gradient' });
  });

  it('returns transferable buffers for worker postMessage', () => {
    const resolvedPlane = plane({
      model: 'oklch',
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.4] },
      fixed: { h: 25, alpha: 1 },
    });

    const packed = runPackedPlaneQueries({
      plane: resolvedPlane,
      queries: [
        {
          kind: 'gamutBoundary',
          gamut: 'srgb',
          samplingMode: 'adaptive',
        },
      ],
    });
    const transferables = getPackedPlaneQueryTransferables(packed);

    expect(transferables).toHaveLength(4);
    expect(transferables[0]).toBe(packed.pathRanges.buffer);
    expect(transferables[1]).toBe(packed.pointXY.buffer);
    expect(transferables[2]).toBe(packed.pointLC.buffer);
    expect(transferables[3]).toBe(packed.pointColorLcha.buffer);
  });
});
