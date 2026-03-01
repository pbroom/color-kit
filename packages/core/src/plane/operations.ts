import type { PlanePoint, PlaneRegion } from './types.js';

export interface PlaneBooleanOptions {
  /**
   * Grid resolution for boolean rasterization.
   * Higher values improve fidelity at higher compute cost.
   * @default 96
   */
  resolution?: number;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function pointKey(point: PlanePoint): string {
  return `${point.x.toFixed(6)}:${point.y.toFixed(6)}`;
}

function canonicalize(point: PlanePoint, tolerance: number = 1e-6): PlanePoint {
  const round = (value: number) => Math.round(value / tolerance) * tolerance;
  return {
    x: round(point.x),
    y: round(point.y),
  };
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
  return region.paths.some((path) => pointInPolygon(point, path));
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

function segmentEdgesForCell(
  mask: number,
): Array<[0 | 1 | 2 | 3, 0 | 1 | 2 | 3]> {
  switch (mask) {
    case 0:
    case 15:
      return [];
    case 1:
      return [[3, 0]];
    case 2:
      return [[0, 1]];
    case 3:
      return [[3, 1]];
    case 4:
      return [[1, 2]];
    case 5:
      return [
        [3, 2],
        [0, 1],
      ];
    case 6:
      return [[0, 2]];
    case 7:
      return [[3, 2]];
    case 8:
      return [[2, 3]];
    case 9:
      return [[0, 2]];
    case 10:
      return [
        [0, 3],
        [1, 2],
      ];
    case 11:
      return [[1, 2]];
    case 12:
      return [[3, 1]];
    case 13:
      return [[0, 1]];
    case 14:
      return [[3, 0]];
    default:
      return [];
  }
}

function edgePoint(
  edge: 0 | 1 | 2 | 3,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): PlanePoint {
  switch (edge) {
    case 0:
      return { x: (x0 + x1) / 2, y: y0 };
    case 1:
      return { x: x1, y: (y0 + y1) / 2 };
    case 2:
      return { x: (x0 + x1) / 2, y: y1 };
    case 3:
      return { x: x0, y: (y0 + y1) / 2 };
    default:
      return { x: x0, y: y0 };
  }
}

function buildContourPaths(
  segments: Array<[PlanePoint, PlanePoint]>,
): PlanePoint[][] {
  if (segments.length === 0) return [];

  const pointByKey = new Map<string, PlanePoint>();
  const adjacency = new Map<string, Set<string>>();
  const visited = new Set<string>();

  for (const [a, b] of segments) {
    const aCanonical = canonicalize(a, 1e-5);
    const bCanonical = canonicalize(b, 1e-5);
    const aKey = pointKey(aCanonical);
    const bKey = pointKey(bCanonical);

    pointByKey.set(aKey, aCanonical);
    pointByKey.set(bKey, bCanonical);

    if (!adjacency.has(aKey)) adjacency.set(aKey, new Set());
    if (!adjacency.has(bKey)) adjacency.set(bKey, new Set());
    adjacency.get(aKey)?.add(bKey);
    adjacency.get(bKey)?.add(aKey);
  }

  const trace = (start: string): string[] => {
    const path = [start];
    let current = start;
    let guard = 0;
    while (guard < 20000) {
      guard += 1;
      const neighbors = adjacency.get(current);
      if (!neighbors || neighbors.size === 0) break;
      let next: string | null = null;
      for (const candidate of neighbors) {
        const key = edgeKey(current, candidate);
        if (!visited.has(key)) {
          next = candidate;
          break;
        }
      }
      if (!next) break;
      visited.add(edgeKey(current, next));
      current = next;
      path.push(current);
      if (current === start) break;
    }
    return path;
  };

  const paths: PlanePoint[][] = [];
  for (const [node, neighbors] of adjacency) {
    if (neighbors.size !== 1) continue;
    const traced = trace(node);
    if (traced.length > 2) {
      paths.push(traced.map((key) => pointByKey.get(key)!).filter(Boolean));
    }
  }

  for (const [node, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      if (visited.has(edgeKey(node, neighbor))) continue;
      const traced = trace(node);
      if (traced.length > 2) {
        paths.push(traced.map((key) => pointByKey.get(key)!).filter(Boolean));
      }
    }
  }

  return paths;
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
  const minX = Math.min(aBounds.minX, bBounds.minX);
  const minY = Math.min(aBounds.minY, bBounds.minY);
  const maxX = Math.max(aBounds.maxX, bBounds.maxX);
  const maxY = Math.max(aBounds.maxY, bBounds.maxY);
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

  const segments: Array<[PlanePoint, PlanePoint]> = [];
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
      const mask = (b0 ? 1 : 0) | (b1 ? 2 : 0) | (b2 ? 4 : 0) | (b3 ? 8 : 0);
      const edgePairs = segmentEdgesForCell(mask);
      for (const [fromEdge, toEdge] of edgePairs) {
        const from = edgePoint(fromEdge, x0, x1, y0, y1);
        const to = edgePoint(toEdge, x0, x1, y0, y1);
        segments.push([from, to]);
      }
    }
  }

  const paths = buildContourPaths(segments);
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
