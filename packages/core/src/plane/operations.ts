import {
  buildContourPaths,
  cellMaskFromBooleans,
  pointOnCellEdge,
  segmentEdgesForCell,
  type ContourSegment,
} from '../contour/index.js';
import type { PlanePoint, PlaneRegion } from './types.js';

export interface PlaneBooleanOptions {
  /**
   * Grid resolution for boolean rasterization.
   * Higher values improve fidelity at higher compute cost.
   * @default 96
   */
  resolution?: number;
}

function pointInPolygon(point: PlanePoint, polygon: PlanePoint[]): boolean {
  let inside = false;
  for (
    let index = 0, prev = polygon.length - 1;
    index < polygon.length;
    prev = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[prev];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y + 1e-12) +
          current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function containsPoint(region: PlaneRegion, point: PlanePoint): boolean {
  // Treat region paths as compound contours (even-odd fill) so holes work.
  let inside = false;
  for (const path of region.paths) {
    if (pointInPolygon(point, path)) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointDistance(a: PlanePoint, b: PlanePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function projectToSegment(
  point: PlanePoint,
  a: PlanePoint,
  b: PlanePoint,
): PlanePoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-12) return a;
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  );
  return {
    x: a.x + dx * t,
    y: a.y + dy * t,
  };
}

export function nearestPointOnPath(
  path: PlanePoint[],
  point: PlanePoint,
): PlanePoint | null {
  if (path.length < 2) return null;
  let nearest: PlanePoint | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    const projected = projectToSegment(point, path[index - 1], path[index]);
    const distance = pointDistance(projected, point);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = projected;
    }
  }
  return nearest;
}

function regionBounds(region: PlaneRegion): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const path of region.paths) {
    for (const point of path) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  return { minX, minY, maxX, maxY };
}

function booleanRegion(
  a: PlaneRegion,
  b: PlaneRegion,
  op: 'union' | 'intersect' | 'difference',
  options: PlaneBooleanOptions = {},
): PlaneRegion {
  const resolution = Math.max(16, Math.min(256, options.resolution ?? 96));
  const aBounds = regionBounds(a);
  const bBounds = regionBounds(b);
  const rawMinX = Math.min(aBounds.minX, bBounds.minX);
  const rawMinY = Math.min(aBounds.minY, bBounds.minY);
  const rawMaxX = Math.max(aBounds.maxX, bBounds.maxX);
  const rawMaxY = Math.max(aBounds.maxY, bBounds.maxY);
  const rawSpanX = Math.max(1e-6, rawMaxX - rawMinX);
  const rawSpanY = Math.max(1e-6, rawMaxY - rawMinY);
  // Expand the raster domain slightly to avoid clipping contours at bounds.
  const padX = rawSpanX / resolution;
  const padY = rawSpanY / resolution;
  const minX = rawMinX - padX;
  const minY = rawMinY - padY;
  const maxX = rawMaxX + padX;
  const maxY = rawMaxY + padY;
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);

  const boolGrid: boolean[][] = [];
  for (let y = 0; y <= resolution; y += 1) {
    const row: boolean[] = [];
    const yValue = minY + (y / resolution) * spanY;
    for (let x = 0; x <= resolution; x += 1) {
      const xValue = minX + (x / resolution) * spanX;
      const point = { x: xValue, y: yValue };
      const inA = containsPoint(a, point);
      const inB = containsPoint(b, point);
      let value = false;
      if (op === 'union') value = inA || inB;
      else if (op === 'intersect') value = inA && inB;
      else value = inA && !inB;
      row.push(value);
    }
    boolGrid.push(row);
  }

  const segments: Array<ContourSegment<PlanePoint>> = [];
  for (let y = 0; y < resolution; y += 1) {
    const y0 = minY + (y / resolution) * spanY;
    const y1 = minY + ((y + 1) / resolution) * spanY;
    for (let x = 0; x < resolution; x += 1) {
      const x0 = minX + (x / resolution) * spanX;
      const x1 = minX + ((x + 1) / resolution) * spanX;
      const b0 = boolGrid[y][x];
      const b1 = boolGrid[y][x + 1];
      const b2 = boolGrid[y + 1][x + 1];
      const b3 = boolGrid[y + 1][x];
      const mask = cellMaskFromBooleans(b0, b1, b2, b3);
      const edgePairs = segmentEdgesForCell(mask);
      for (const [fromEdge, toEdge] of edgePairs) {
        const bounds = { x0, x1, y0, y1 };
        const from = pointOnCellEdge(fromEdge, bounds) as PlanePoint;
        const to = pointOnCellEdge(toEdge, bounds) as PlanePoint;
        segments.push([from, to]);
      }
    }
  }

  const paths = buildContourPaths(segments, {
    canonicalTolerance: 1e-5,
    closedOnly: true,
  });
  return { paths };
}

export function unionRegions(
  a: PlaneRegion,
  b: PlaneRegion,
  options: PlaneBooleanOptions = {},
): PlaneRegion {
  return booleanRegion(a, b, 'union', options);
}

export function intersectRegions(
  a: PlaneRegion,
  b: PlaneRegion,
  options: PlaneBooleanOptions = {},
): PlaneRegion {
  return booleanRegion(a, b, 'intersect', options);
}

export function differenceRegions(
  a: PlaneRegion,
  b: PlaneRegion,
  options: PlaneBooleanOptions = {},
): PlaneRegion {
  return booleanRegion(a, b, 'difference', options);
}
