import { describe, expect, it } from 'vitest';
import {
  buildContourPaths,
  extractAdaptiveContourSegments,
  extractGridContourSegments,
  segmentEdgesForCell,
  type AdaptiveContourCell,
  type ContourEdgePair,
  type ContourPoint,
  type ContourSegment,
} from '../src/index.js';

describe('contour utilities', () => {
  it('defines the canonical marching-squares edge table', () => {
    const expected: ReadonlyArray<readonly ContourEdgePair[]> = [
      [],
      [[3, 0]],
      [[0, 1]],
      [[3, 1]],
      [[1, 2]],
      [
        [3, 2],
        [0, 1],
      ],
      [[0, 2]],
      [[3, 2]],
      [[2, 3]],
      [[0, 2]],
      [
        [0, 3],
        [1, 2],
      ],
      [[1, 2]],
      [[3, 1]],
      [[0, 1]],
      [[3, 0]],
      [],
    ];

    for (let mask = 0; mask < expected.length; mask += 1) {
      expect(segmentEdgesForCell(mask)).toEqual(expected[mask]);
    }
  });

  it('stitches open paths, closed loops, and near-equal vertices deterministically', () => {
    const segments: Array<ContourSegment<ContourPoint>> = [
      [
        { x: 0, y: 0 },
        { x: 1.000004, y: 0 },
      ],
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      [
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ],
      [
        { x: 5, y: 0 },
        { x: 5, y: 1 },
      ],
      [
        { x: 5, y: 1 },
        { x: 4, y: 1 },
      ],
      [
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ],
    ];

    const paths = buildContourPaths(segments, { canonicalTolerance: 1e-5 });
    expect(paths).toHaveLength(2);
    expect(paths[0]).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(paths[1][0]).toEqual(paths[1][paths[1].length - 1]);

    const loops = buildContourPaths(segments, {
      canonicalTolerance: 1e-5,
      closedOnly: true,
    });
    expect(loops).toHaveLength(1);
    expect(loops[0][0]).toEqual(loops[0][loops[0].length - 1]);
  });

  it('extracts scalar-grid contours with midpoint or linear interpolation', () => {
    const grid = {
      minX: 0,
      maxX: 1,
      minY: 0,
      maxY: 1,
      resolution: 1,
      values: [
        [-0.25, 0.75],
        [-0.25, 0.75],
      ],
    };

    const midpoint = extractGridContourSegments(grid, {
      interpolation: 'midpoint',
    });
    const linear = extractGridContourSegments(grid, {
      interpolation: 'linear',
    });

    expect(midpoint.segments[0]).toEqual([
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 },
    ]);
    expect(linear.segments[0]).toEqual([
      { x: 0.25, y: 0 },
      { x: 0.25, y: 1 },
    ]);
    expect(linear.cellCount).toBe(1);
    expect(linear.segmentCount).toBe(1);
  });

  it('refines uniform adaptive cells when the scalar field changes sign inside', () => {
    const cells: AdaptiveContourCell[] = [
      {
        x0: 0,
        x1: 1,
        y0: 0,
        y1: 1,
        v0: -1,
        v1: -1,
        v2: -1,
        v3: -1,
      },
    ];
    const sample = (x: number, y: number) => 0.2 - Math.hypot(x - 0.5, y - 0.5);

    const extraction = extractAdaptiveContourSegments(cells, sample, {
      maxDepth: 2,
      shouldRefineUniformCell: ({ cornerValues, midpointValues }) => {
        const sign = cornerValues[0] >= 0;
        return midpointValues.some((value) => value >= 0 !== sign);
      },
    });

    expect(extraction.cellCount).toBeGreaterThan(1);
    expect(extraction.segmentCount).toBeGreaterThan(0);
    expect(extraction.segments.length).toBeGreaterThan(0);
  });
});
