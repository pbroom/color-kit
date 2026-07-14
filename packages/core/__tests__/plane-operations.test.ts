import { describe, expect, it } from 'vitest';
import {
  nearestPointOnPath,
  pointDistance,
  type PlanePoint,
} from '../src/index.js';

function expectPointClose(
  actual: PlanePoint | null,
  expected: PlanePoint,
): void {
  expect(actual).not.toBeNull();
  expect(actual!.x).toBeCloseTo(expected.x, 9);
  expect(actual!.y).toBeCloseTo(expected.y, 9);
}

describe('nearestPointOnPath()', () => {
  const horizontal: PlanePoint[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ];

  it('projects onto the interior of a segment', () => {
    const nearest = nearestPointOnPath(horizontal, { x: 0.5, y: 0.3 });
    expectPointClose(nearest, { x: 0.5, y: 0 });
    expect(pointDistance(nearest!, { x: 0.5, y: 0.3 })).toBeCloseTo(0.3, 9);
  });

  it('clamps to the nearest vertex when the point is beyond an endpoint', () => {
    const beyondEnd = nearestPointOnPath(horizontal, { x: 1.5, y: 0.4 });
    expectPointClose(beyondEnd, { x: 1, y: 0 });

    const beforeStart = nearestPointOnPath(horizontal, { x: -0.5, y: -0.2 });
    expectPointClose(beforeStart, { x: 0, y: 0 });
  });

  it('picks the closest segment on a multi-segment path', () => {
    const lShape: PlanePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];

    // Closer to the vertical segment (x = 1) than the horizontal one.
    const nearVertical = nearestPointOnPath(lShape, { x: 0.9, y: 0.8 });
    expectPointClose(nearVertical, { x: 1, y: 0.8 });

    // Closer to the horizontal segment (y = 0).
    const nearHorizontal = nearestPointOnPath(lShape, { x: 0.3, y: 0.1 });
    expectPointClose(nearHorizontal, { x: 0.3, y: 0 });
  });

  it('returns distance 0 for a point exactly on the path', () => {
    const onSegment = { x: 0.25, y: 0 };
    const nearest = nearestPointOnPath(horizontal, onSegment);
    expectPointClose(nearest, onSegment);
    expect(pointDistance(nearest!, onSegment)).toBe(0);

    const onVertex = { x: 1, y: 0 };
    const vertexNearest = nearestPointOnPath(horizontal, onVertex);
    expectPointClose(vertexNearest, onVertex);
    expect(pointDistance(vertexNearest!, onVertex)).toBe(0);
  });

  it('returns null for paths with fewer than two points', () => {
    // The implementation requires at least one segment; empty and
    // single-point paths are rejected rather than treated as a point.
    expect(nearestPointOnPath([], { x: 0.5, y: 0.5 })).toBeNull();
    expect(nearestPointOnPath([{ x: 0.5, y: 0.5 }], { x: 0, y: 0 })).toBeNull();
  });

  it('treats zero-length segments as their start vertex', () => {
    // A degenerate segment (both endpoints identical) projects every query
    // to that shared vertex instead of dividing by zero.
    const degenerate: PlanePoint[] = [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ];
    const nearest = nearestPointOnPath(degenerate, { x: 0, y: 0 });
    expectPointClose(nearest, { x: 0.5, y: 0.5 });
  });
});
