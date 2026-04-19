import {
  linearSrgbToLinearP3,
  oklabToLinearRgb,
  oklchToOklab,
} from '../conversion/index.js';
import { gamutBoundaryPath, maxChromaAt } from '../gamut/index.js';
import { maxHctChromaAtTone } from '../hct/index.js';
import type { Color } from '../types.js';
import { normalizeHue, simplifyPolyline } from '../utils/index.js';
import {
  modelColorToPlane,
  planeHue,
  planeToColorUnclamped,
  planeToModelColor,
  resolvePlaneDefinition,
  usesLightnessAndChroma,
} from './plane.js';
import {
  incrementTraceSummary,
  limitTraceEntries,
  limitTracePaths,
  recordTraceStage,
  setTraceSummaryField,
  shouldTraceFull,
  shouldTraceScalarGrid,
  type InternalPlaneTraceContext,
} from './trace.js';
import type {
  Plane,
  PlaneChannel,
  PlaneDefinition,
  PlaneGamutRegionQuery,
  PlaneGamutRegionResult,
  PlaneGamutRegionScope,
  PlaneGamutSolver,
  PlaneModel,
  PlaneModelColor,
  PlanePoint,
  PlaneRegion,
  PlaneViewportRelation,
} from './types.js';

const GAMUT_MARGIN_EPSILON = 0.000075;
const DEFAULT_BOUNDARY_STEPS = 192;
const DEFAULT_VIEWPORT_RESOLUTION = 64;
const DEFAULT_FULL_RESOLUTION = 96;
const DEFAULT_VIEWPORT_FILL_RESOLUTION = 32;
const DEFAULT_VIEWPORT_BASE_RESOLUTION = 8;
const DEFAULT_FULL_BASE_RESOLUTION = 12;
const DEFAULT_IMPLICIT_MAX_DEPTH = 3;
const ADAPTIVE_REFINEMENT_EPSILON = GAMUT_MARGIN_EPSILON * 8;
const CLIP_EPSILON = 1e-6;
// `extendViewportGrid()` inserts a one-cell border of outside samples around the
// original scalar grid. Expanding the bounds by one full cell keeps the shifted
// interior indices aligned with their original sample coordinates.
const BORDER_PAD_CELLS = 1;

type ScalarField = (point: PlanePoint) => number;

interface ScalarSampler {
  sample(x: number, y: number): number;
}

interface ScalarGrid {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  resolution: number;
  values: number[][];
}

interface ScalarBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ScalarGridClassification {
  relation: PlaneViewportRelation;
  minValue: number;
  maxValue: number;
}

interface AdaptiveContourResult {
  minValue: number;
  maxValue: number;
  segments: Array<[PlanePoint, PlanePoint]>;
}

function readModelChannel(
  modelColor: PlaneModelColor,
  channel: string,
  fallback: number,
): number {
  const value = (modelColor as Record<string, number | undefined>)[channel];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function unclampedNormalize(value: number, range: [number, number]): number {
  const span = range[1] - range[0];
  if (Math.abs(span) <= Number.EPSILON) return 0;
  return (value - range[0]) / span;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function approxEqual(
  a: number,
  b: number,
  epsilon: number = CLIP_EPSILON,
): boolean {
  return Math.abs(a - b) <= epsilon;
}

function pointsEqual(
  a: PlanePoint,
  b: PlanePoint,
  epsilon: number = CLIP_EPSILON,
): boolean {
  return approxEqual(a.x, b.x, epsilon) && approxEqual(a.y, b.y, epsilon);
}

function clampToViewport(point: PlanePoint): PlanePoint {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  };
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

function viewportRectPath(): PlanePoint[] {
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
}

function emptyRegion(): PlaneRegion {
  return { paths: [] };
}

function fullViewportRegion(): PlaneRegion {
  return { paths: [viewportRectPath()] };
}

function rectRegion(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): PlaneRegion {
  if (maxX - minX <= CLIP_EPSILON || maxY - minY <= CLIP_EPSILON) {
    return emptyRegion();
  }
  return {
    paths: [
      [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
    ],
  };
}

function simplifyPlanePath(
  points: PlanePoint[],
  tolerance: number,
): PlanePoint[] {
  if (!Number.isFinite(tolerance) || tolerance <= 0 || points.length <= 2) {
    return points.slice();
  }
  return simplifyPolyline(
    points.map((point) => ({ l: point.x, c: point.y, point })),
    tolerance,
    false,
  )
    .map((entry) => entry.point)
    .filter(
      (point, index, array) =>
        index === 0 || !pointsEqual(point, array[index - 1]),
    );
}

function simplifyPlanePaths(
  paths: PlanePoint[][],
  tolerance?: number,
): PlanePoint[][] {
  if (!Number.isFinite(tolerance) || (tolerance ?? 0) <= 0) {
    return paths.filter((path) => path.length >= 2).map((path) => path.slice());
  }
  return paths
    .map((path) => simplifyPlanePath(path, tolerance!))
    .filter((path) => path.length >= 2);
}

function clipSegmentToViewport(
  a: PlanePoint,
  b: PlanePoint,
): [PlanePoint, PlanePoint] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) <= Number.EPSILON) {
      return q >= 0;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (
    !clip(-dx, a.x) ||
    !clip(dx, 1 - a.x) ||
    !clip(-dy, a.y) ||
    !clip(dy, 1 - a.y)
  ) {
    return null;
  }

  const start = {
    x: a.x + t0 * dx,
    y: a.y + t0 * dy,
  };
  const end = {
    x: a.x + t1 * dx,
    y: a.y + t1 * dy,
  };

  if (pointsEqual(start, end)) {
    return null;
  }

  return [clampToViewport(start), clampToViewport(end)];
}

function clipPolylineToViewport(points: PlanePoint[]): PlanePoint[][] {
  if (points.length < 2) return [];
  const paths: PlanePoint[][] = [];
  let current: PlanePoint[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const clipped = clipSegmentToViewport(points[index - 1], points[index]);
    if (!clipped) {
      if (current.length >= 2) {
        paths.push(current);
      }
      current = [];
      continue;
    }

    const [start, end] = clipped;
    if (current.length === 0) {
      current = [start, end];
      continue;
    }

    const last = current[current.length - 1];
    if (!pointsEqual(last, start)) {
      if (current.length >= 2) {
        paths.push(current);
      }
      current = [start, end];
      continue;
    }

    if (!pointsEqual(last, end)) {
      current.push(end);
    }
  }

  if (current.length >= 2) {
    paths.push(current);
  }

  return paths;
}

function clipPathsToViewport(paths: PlanePoint[][]): PlanePoint[][] {
  return paths.flatMap((path) => clipPolylineToViewport(path));
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

function interpolateZero(a: number, b: number): number {
  const denominator = a - b;
  if (Math.abs(denominator) <= 1e-12) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, a / denominator));
}

function edgePoint(
  edge: 0 | 1 | 2 | 3,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  v0: number,
  v1: number,
  v2: number,
  v3: number,
): PlanePoint {
  switch (edge) {
    case 0: {
      const t = interpolateZero(v0, v1);
      return { x: lerp(x0, x1, t), y: y0 };
    }
    case 1: {
      const t = interpolateZero(v1, v2);
      return { x: x1, y: lerp(y0, y1, t) };
    }
    case 2: {
      const t = interpolateZero(v3, v2);
      return { x: lerp(x0, x1, t), y: y1 };
    }
    case 3: {
      const t = interpolateZero(v0, v3);
      return { x: x0, y: lerp(y0, y1, t) };
    }
    default:
      return { x: x0, y: y0 };
  }
}

function buildSegmentPaths(
  segments: Array<[PlanePoint, PlanePoint]>,
  options: { closedOnly?: boolean } = {},
): PlanePoint[][] {
  if (segments.length === 0) return [];

  const pointByKey = new Map<string, PlanePoint>();
  const adjacency = new Map<string, Set<string>>();
  const visited = new Set<string>();
  // Scale the traversal guard with the number of input segments so dense
  // implicit contours can walk nearly every edge before the safety hatch trips.
  const traversalGuardLimit = Math.max(2048, segments.length * 4);

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
    while (guard < traversalGuardLimit) {
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

  const result: PlanePoint[][] = [];

  const acceptPath = (pathKeys: string[]) => {
    if (pathKeys.length < 2) return;
    const points = pathKeys
      .map((key) => pointByKey.get(key))
      .filter((point): point is PlanePoint => point != null);
    if (points.length < 2) return;
    const isClosed = pointsEqual(points[0], points[points.length - 1], 1e-5);
    if (options.closedOnly && !isClosed) return;
    result.push(points);
  };

  for (const [node, neighbors] of adjacency) {
    if (neighbors.size !== 1) continue;
    acceptPath(trace(node));
  }

  for (const [node, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      if (visited.has(edgeKey(node, neighbor))) continue;
      acceptPath(trace(node));
    }
  }

  return result;
}

function cellMask(v0: number, v1: number, v2: number, v3: number): number {
  return (
    (v0 >= 0 ? 1 : 0) |
    (v1 >= 0 ? 2 : 0) |
    (v2 >= 0 ? 4 : 0) |
    (v3 >= 0 ? 8 : 0)
  );
}

function scalarSampleKey(x: number, y: number): string {
  return `${x.toFixed(10)}:${y.toFixed(10)}`;
}

function createScalarSampler(
  field: ScalarField,
  trace?: InternalPlaneTraceContext | null,
): ScalarSampler {
  const cache = new Map<string, number>();

  return {
    sample(x: number, y: number): number {
      const key = scalarSampleKey(x, y);
      const cached = cache.get(key);
      if (cached != null) {
        return cached;
      }
      const value = field({ x, y });
      cache.set(key, value);
      incrementTraceSummary(trace, 'sampleCount', 1);
      incrementTraceSummary(trace, 'scalarEvaluationCount', 1);
      return value;
    },
  };
}

function shouldRefineUniformAdaptiveCell(
  cornerValues: [number, number, number, number],
  interiorValues: [number, number, number, number, number],
): boolean {
  const sign = cornerValues[0] >= 0;
  const values = [...cornerValues, ...interiorValues];
  return values.some(
    (value) =>
      Math.abs(value) <= ADAPTIVE_REFINEMENT_EPSILON || value >= 0 !== sign,
  );
}

function classifyAdaptiveContourResult(
  result: AdaptiveContourResult,
): ScalarGridClassification {
  if (result.segments.length > 0) {
    return {
      relation: 'intersects',
      minValue: result.minValue,
      maxValue: result.maxValue,
    };
  }
  if (result.minValue >= -GAMUT_MARGIN_EPSILON) {
    return {
      relation: 'inside',
      minValue: result.minValue,
      maxValue: result.maxValue,
    };
  }
  if (result.maxValue < -GAMUT_MARGIN_EPSILON) {
    return {
      relation: 'outside',
      minValue: result.minValue,
      maxValue: result.maxValue,
    };
  }
  return {
    relation: 'intersects',
    minValue: result.minValue,
    maxValue: result.maxValue,
  };
}

function extractAdaptiveContourSegments(
  sampler: ScalarSampler,
  bounds: ScalarBounds,
  baseResolution: number,
  maxDepth: number,
  trace?: InternalPlaneTraceContext | null,
  label: string = 'marching-squares',
): AdaptiveContourResult {
  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minY = Math.min(bounds.minY, bounds.maxY);
  const maxY = Math.max(bounds.minY, bounds.maxY);
  const stepX = (maxX - minX) / baseResolution;
  const stepY = (maxY - minY) / baseResolution;
  const effectiveResolution = baseResolution * 2 ** maxDepth;
  const segments: Array<[PlanePoint, PlanePoint]> = [];
  const cellEvents: Array<{
    xIndex: number;
    yIndex: number;
    mask: number;
    points: PlanePoint[];
  }> = [];
  let segmentCount = 0;
  let cellCount = 0;
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  const sample = (x: number, y: number): number => {
    const value = sampler.sample(x, y);
    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);
    return value;
  };

  const emitSegments = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    v0: number,
    v1: number,
    v2: number,
    v3: number,
  ): void => {
    const mask = cellMask(v0, v1, v2, v3);
    const edgePairs = segmentEdgesForCell(mask);
    if (edgePairs.length === 0) {
      return;
    }
    const tracePoints: PlanePoint[] = [];
    for (const [fromEdge, toEdge] of edgePairs) {
      const from = edgePoint(fromEdge, x0, x1, y0, y1, v0, v1, v2, v3);
      const to = edgePoint(toEdge, x0, x1, y0, y1, v0, v1, v2, v3);
      segments.push([from, to]);
      segmentCount += 1;
      if (shouldTraceFull(trace)) {
        tracePoints.push(from, to);
      }
    }
    if (shouldTraceFull(trace)) {
      const spanX = Math.max(maxX - minX, 1e-9);
      const spanY = Math.max(maxY - minY, 1e-9);
      cellEvents.push({
        xIndex: Math.round(((x0 - minX) / spanX) * effectiveResolution),
        yIndex: Math.round(((y0 - minY) / spanY) * effectiveResolution),
        mask,
        points: tracePoints,
      });
    }
  };

  const processCell = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    v0: number,
    v1: number,
    v2: number,
    v3: number,
    depth: number,
  ): void => {
    cellCount += 1;
    incrementTraceSummary(trace, 'cellCount', 1);
    const mask = cellMask(v0, v1, v2, v3);
    const uniform = mask === 0 || mask === 15;
    if (depth >= maxDepth) {
      if (!uniform) {
        emitSegments(x0, x1, y0, y1, v0, v1, v2, v3);
      }
      return;
    }

    const xMid = (x0 + x1) / 2;
    const yMid = (y0 + y1) / 2;
    const vMidBottom = sample(xMid, y0);
    const vMidRight = sample(x1, yMid);
    const vMidTop = sample(xMid, y1);
    const vMidLeft = sample(x0, yMid);
    const vCenter = sample(xMid, yMid);

    if (
      uniform &&
      !shouldRefineUniformAdaptiveCell(
        [v0, v1, v2, v3],
        [vMidBottom, vMidRight, vMidTop, vMidLeft, vCenter],
      )
    ) {
      return;
    }

    processCell(
      x0,
      xMid,
      y0,
      yMid,
      v0,
      vMidBottom,
      vCenter,
      vMidLeft,
      depth + 1,
    );
    processCell(
      xMid,
      x1,
      y0,
      yMid,
      vMidBottom,
      v1,
      vMidRight,
      vCenter,
      depth + 1,
    );
    processCell(xMid, x1, yMid, y1, vCenter, vMidRight, v2, vMidTop, depth + 1);
    processCell(x0, xMid, yMid, y1, vMidLeft, vCenter, vMidTop, v3, depth + 1);
  };

  for (let y = 0; y < baseResolution; y += 1) {
    const y0 = minY + y * stepY;
    const y1 = minY + (y + 1) * stepY;
    for (let x = 0; x < baseResolution; x += 1) {
      const x0 = minX + x * stepX;
      const x1 = minX + (x + 1) * stepX;
      processCell(
        x0,
        x1,
        y0,
        y1,
        sample(x0, y0),
        sample(x1, y0),
        sample(x1, y1),
        sample(x0, y1),
        0,
      );
    }
  }

  if (!Number.isFinite(minValue)) {
    minValue = 0;
    maxValue = 0;
  }

  incrementTraceSummary(trace, 'segmentCount', segmentCount);
  recordTraceStage(trace, {
    kind: 'marchingSquares',
    label,
    resolution: effectiveResolution,
    cellCount,
    segmentCount,
    cells: limitTraceEntries(trace, cellEvents),
  });

  return {
    minValue,
    maxValue,
    segments,
  };
}

function extractContourSegments(
  grid: ScalarGrid,
  trace?: InternalPlaneTraceContext | null,
  label: string = 'marching-squares',
): Array<[PlanePoint, PlanePoint]> {
  const segments: Array<[PlanePoint, PlanePoint]> = [];
  const stepX = (grid.maxX - grid.minX) / grid.resolution;
  const stepY = (grid.maxY - grid.minY) / grid.resolution;
  const cellEvents: Array<{
    xIndex: number;
    yIndex: number;
    mask: number;
    points: PlanePoint[];
  }> = [];
  let segmentCount = 0;
  let cellCount = 0;

  for (let y = 0; y < grid.resolution; y += 1) {
    const y0 = grid.minY + y * stepY;
    const y1 = grid.minY + (y + 1) * stepY;
    for (let x = 0; x < grid.resolution; x += 1) {
      const x0 = grid.minX + x * stepX;
      const x1 = grid.minX + (x + 1) * stepX;
      const v0 = grid.values[y][x];
      const v1 = grid.values[y][x + 1];
      const v2 = grid.values[y + 1][x + 1];
      const v3 = grid.values[y + 1][x];
      const mask =
        (v0 >= 0 ? 1 : 0) |
        (v1 >= 0 ? 2 : 0) |
        (v2 >= 0 ? 4 : 0) |
        (v3 >= 0 ? 8 : 0);
      const edgePairs = segmentEdgesForCell(mask);
      cellCount += 1;
      for (const [fromEdge, toEdge] of edgePairs) {
        const from = edgePoint(fromEdge, x0, x1, y0, y1, v0, v1, v2, v3);
        const to = edgePoint(toEdge, x0, x1, y0, y1, v0, v1, v2, v3);
        segments.push([from, to]);
        segmentCount += 1;
        if (shouldTraceFull(trace)) {
          cellEvents.push({
            xIndex: x,
            yIndex: y,
            mask,
            points: [from, to],
          });
        }
      }
    }
  }

  incrementTraceSummary(trace, 'cellCount', cellCount);
  incrementTraceSummary(trace, 'segmentCount', segmentCount);
  recordTraceStage(trace, {
    kind: 'marchingSquares',
    label,
    resolution: grid.resolution,
    cellCount,
    segmentCount,
    cells: limitTraceEntries(trace, cellEvents),
  });
  return segments;
}

function extendViewportGrid(grid: ScalarGrid): ScalarGrid {
  const stepX = (grid.maxX - grid.minX) / grid.resolution;
  const stepY = (grid.maxY - grid.minY) / grid.resolution;
  const width = grid.resolution + 2;
  const height = grid.resolution + 2;
  const values: number[][] = [];

  for (let y = 0; y <= height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x <= width; x += 1) {
      if (x === 0 || y === 0 || x === width || y === height) {
        row.push(-1);
        continue;
      }
      row.push(grid.values[y - 1][x - 1]);
    }
    values.push(row);
  }

  return {
    minX: grid.minX - stepX * BORDER_PAD_CELLS,
    maxX: grid.maxX + stepX * BORDER_PAD_CELLS,
    minY: grid.minY - stepY * BORDER_PAD_CELLS,
    maxY: grid.maxY + stepY * BORDER_PAD_CELLS,
    resolution: grid.resolution + 2,
    values,
  };
}

function buildVisibleRegionFromViewportGrid(
  grid: ScalarGrid,
  trace?: InternalPlaneTraceContext | null,
): PlaneRegion {
  const extended = extendViewportGrid(grid);
  const region = {
    paths: buildSegmentPaths(
      extractContourSegments(extended, trace, 'visible-region'),
      {
        closedOnly: true,
      },
    )
      .map((path) => path.map(clampToViewport))
      .filter((path) => path.length >= 3),
  };
  recordTraceStage(trace, {
    kind: 'paths',
    label: 'visible-region',
    pathCount: region.paths.length,
    pointCount: region.paths.reduce((total, path) => total + path.length, 0),
    paths: limitTracePaths(trace, region.paths),
  });
  return region;
}

function isViewportEdgeSegment(a: PlanePoint, b: PlanePoint): boolean {
  return (
    (approxEqual(a.x, 0) && approxEqual(b.x, 0)) ||
    (approxEqual(a.x, 1) && approxEqual(b.x, 1)) ||
    (approxEqual(a.y, 0) && approxEqual(b.y, 0)) ||
    (approxEqual(a.y, 1) && approxEqual(b.y, 1))
  );
}

function extractBoundaryPathsFromVisibleRegion(
  region: PlaneRegion,
): PlanePoint[][] {
  const paths: PlanePoint[][] = [];

  for (const path of region.paths) {
    if (path.length < 2) continue;
    const loop = pointsEqual(path[0], path[path.length - 1], 1e-5)
      ? path
      : [...path, path[0]];
    let current: PlanePoint[] = [];

    const flush = () => {
      if (current.length >= 2) {
        paths.push(current);
      }
      current = [];
    };

    for (let index = 1; index < loop.length; index += 1) {
      const start = loop[index - 1];
      const end = loop[index];
      if (isViewportEdgeSegment(start, end)) {
        flush();
        continue;
      }
      if (current.length === 0) {
        current = [start, end];
        continue;
      }
      if (!pointsEqual(current[current.length - 1], start)) {
        flush();
        current = [start, end];
        continue;
      }
      if (!pointsEqual(current[current.length - 1], end)) {
        current.push(end);
      }
    }

    flush();
  }

  return paths;
}

function sampleScalarGrid(
  sampler: ScalarSampler,
  bounds: ScalarBounds,
  resolution: number,
  trace?: InternalPlaneTraceContext | null,
  label: string = 'scalar-grid',
): ScalarGrid {
  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minY = Math.min(bounds.minY, bounds.maxY);
  const maxY = Math.max(bounds.minY, bounds.maxY);
  const values: number[][] = [];
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  for (let y = 0; y <= resolution; y += 1) {
    const row: number[] = [];
    const yValue = lerp(minY, maxY, y / resolution);
    for (let x = 0; x <= resolution; x += 1) {
      const xValue = lerp(minX, maxX, x / resolution);
      const value = sampler.sample(xValue, yValue);
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
      row.push(value);
    }
    values.push(row);
  }

  const sampleCount = (resolution + 1) * (resolution + 1);
  if (shouldTraceScalarGrid(trace)) {
    recordTraceStage(trace, {
      kind: 'scalarGrid',
      label,
      bounds: { minX, maxX, minY, maxY },
      resolution,
      sampleCount,
      minValue,
      maxValue,
      values: values.map((row) => row.slice()),
    });
  }

  return { minX, maxX, minY, maxY, resolution, values };
}

function gamutMargin(color: Color, gamut: 'srgb' | 'display-p3'): number {
  const lab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linearSrgb = oklabToLinearRgb(lab);
  const linear =
    gamut === 'display-p3' ? linearSrgbToLinearP3(linearSrgb) : linearSrgb;
  return Math.min(
    linear.r,
    linear.g,
    linear.b,
    1 - linear.r,
    1 - linear.g,
    1 - linear.b,
  );
}

function createFieldEvaluator(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
): ScalarField {
  if (resolvedPlane.model === 'oklch') {
    return (point) => {
      const modelColor = planeToModelColor(resolvedPlane, point, {
        clampToViewport: false,
      });
      const l = Math.min(
        1,
        Math.max(0, readModelChannel(modelColor, 'l', 0.5)),
      );
      const c = Math.max(0, readModelChannel(modelColor, 'c', 0));
      const h = normalizeHue(
        readModelChannel(modelColor, 'h', planeHue(resolvedPlane)),
      );
      return maxChromaAt(l, h, { gamut, alpha: resolvedPlane.fixed.alpha }) - c;
    };
  }

  if (resolvedPlane.model === 'hct' && gamut === 'srgb') {
    return (point) => {
      const modelColor = planeToModelColor(resolvedPlane, point, {
        clampToViewport: false,
      });
      const h = normalizeHue(readModelChannel(modelColor, 'h', 0));
      const c = Math.max(0, readModelChannel(modelColor, 'c', 0));
      const t = Math.min(
        100,
        Math.max(0, readModelChannel(modelColor, 't', 50)),
      );
      return maxHctChromaAtTone(h, t) - c;
    };
  }

  return (point) =>
    gamutMargin(planeToColorUnclamped(resolvedPlane, point), gamut);
}

function canonicalChannelBounds(
  model: PlaneModel,
  channel: PlaneChannel,
): [number, number] | null {
  switch (model) {
    case 'oklch':
      if (channel === 'l') return [0, 1];
      if (channel === 'h') return [0, 360];
      return null;
    case 'rgb':
      return [0, 255];
    case 'hsl':
      if (channel === 'h') return [0, 360];
      if (channel === 's' || channel === 'l') return [0, 100];
      return null;
    case 'hsv':
      if (channel === 'h') return [0, 360];
      if (channel === 's' || channel === 'v') return [0, 100];
      return null;
    case 'oklab':
      if (channel === 'L') return [0, 1];
      if (channel === 'a' || channel === 'b') return [-0.4, 0.4];
      return null;
    case 'hct':
      if (channel === 'h') return [0, 360];
      if (channel === 't') return [0, 100];
      return null;
    case 'p3':
    case 'display-p3':
      return [0, 1];
    default:
      return null;
  }
}

function fullScopeBounds(resolvedPlane: Plane): ScalarBounds {
  const xDomain = canonicalChannelBounds(
    resolvedPlane.model,
    resolvedPlane.x.channel,
  );
  const yDomain = canonicalChannelBounds(
    resolvedPlane.model,
    resolvedPlane.y.channel,
  );
  const minX = xDomain
    ? unclampedNormalize(xDomain[0], resolvedPlane.x.range)
    : 0;
  const maxX = xDomain
    ? unclampedNormalize(xDomain[1], resolvedPlane.x.range)
    : 1;
  const minY = yDomain
    ? unclampedNormalize(yDomain[0], resolvedPlane.y.range)
    : 0;
  const maxY = yDomain
    ? unclampedNormalize(yDomain[1], resolvedPlane.y.range)
    : 1;
  return { minX, maxX, minY, maxY };
}

function buildOklchBoundaryPoint(
  resolvedPlane: Plane,
  l: number,
  c: number,
  h: number,
): PlanePoint {
  return modelColorToPlane(
    resolvedPlane,
    {
      ...resolvedPlane.fixed,
      l,
      c,
      h,
      alpha: resolvedPlane.fixed.alpha,
    },
    { clampToViewport: false },
  );
}

function buildHctBoundaryPoint(
  resolvedPlane: Plane,
  h: number,
  c: number,
  t: number,
): PlanePoint {
  return modelColorToPlane(
    resolvedPlane,
    {
      ...resolvedPlane.fixed,
      h,
      c,
      t,
      alpha: resolvedPlane.fixed.alpha,
    },
    { clampToViewport: false },
  );
}

function buildAnalyticLcBoundary(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
): PlanePoint[] {
  const hue = planeHue(resolvedPlane);
  return gamutBoundaryPath(hue, {
    gamut,
    samplingMode: 'adaptive',
  }).map((point) =>
    buildOklchBoundaryPoint(resolvedPlane, point.l, point.c, hue),
  );
}

function buildAnalyticHcBoundary(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
): PlanePoint[] {
  const fixedLightness = Math.min(
    1,
    Math.max(0, readModelChannel(resolvedPlane.fixed, 'l', 0.5)),
  );
  const points: PlanePoint[] = [];
  for (let index = 0; index <= DEFAULT_BOUNDARY_STEPS; index += 1) {
    const hue = (index / DEFAULT_BOUNDARY_STEPS) * 360;
    const chroma = maxChromaAt(fixedLightness, hue, {
      gamut,
      alpha: resolvedPlane.fixed.alpha,
    });
    points.push(
      buildOklchBoundaryPoint(resolvedPlane, fixedLightness, chroma, hue),
    );
  }
  return points;
}

function buildAnalyticHctBoundary(resolvedPlane: Plane): PlanePoint[] {
  const xChannel = resolvedPlane.x.channel;
  const yChannel = resolvedPlane.y.channel;
  const points: PlanePoint[] = [];

  if (
    (xChannel === 'h' && yChannel === 'c') ||
    (xChannel === 'c' && yChannel === 'h')
  ) {
    const tone = Math.min(
      100,
      Math.max(0, readModelChannel(resolvedPlane.fixed, 't', 50)),
    );
    for (let index = 0; index <= DEFAULT_BOUNDARY_STEPS; index += 1) {
      const hue = (index / DEFAULT_BOUNDARY_STEPS) * 360;
      points.push(
        buildHctBoundaryPoint(
          resolvedPlane,
          hue,
          maxHctChromaAtTone(hue, tone),
          tone,
        ),
      );
    }
    return points;
  }

  const hue = normalizeHue(readModelChannel(resolvedPlane.fixed, 'h', 0));
  for (let index = 0; index <= DEFAULT_BOUNDARY_STEPS; index += 1) {
    const tone = (index / DEFAULT_BOUNDARY_STEPS) * 100;
    points.push(
      buildHctBoundaryPoint(
        resolvedPlane,
        hue,
        maxHctChromaAtTone(hue, tone),
        tone,
      ),
    );
  }
  return points;
}

function buildDomainEdgeViewportResult(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
  scope: PlaneGamutRegionScope,
  simplifyTolerance?: number,
): PlaneGamutRegionResult {
  const axisInterval = (
    channel: PlaneChannel,
    range: [number, number],
  ): { min: number; max: number } => {
    const domain = canonicalChannelBounds(resolvedPlane.model, channel);
    if (!domain) {
      return { min: 0, max: 1 };
    }
    const first = unclampedNormalize(domain[0], range);
    const second = unclampedNormalize(domain[1], range);
    return {
      min: Math.min(first, second),
      max: Math.max(first, second),
    };
  };

  const xInterval = axisInterval(
    resolvedPlane.x.channel,
    resolvedPlane.x.range,
  );
  const yInterval = axisInterval(
    resolvedPlane.y.channel,
    resolvedPlane.y.range,
  );
  const clippedMinX = Math.max(0, xInterval.min);
  const clippedMaxX = Math.min(1, xInterval.max);
  const clippedMinY = Math.max(0, yInterval.min);
  const clippedMaxY = Math.min(1, yInterval.max);

  if (
    clippedMaxX - clippedMinX <= CLIP_EPSILON ||
    clippedMaxY - clippedMinY <= CLIP_EPSILON
  ) {
    return {
      kind: 'gamutRegion',
      gamut,
      scope,
      viewportRelation: 'outside',
      solver: 'domain-edge',
      boundaryPaths:
        scope === 'full'
          ? simplifyPlanePaths(
              [
                [
                  {
                    x: Math.min(xInterval.min, xInterval.max),
                    y: Math.min(yInterval.min, yInterval.max),
                  },
                  {
                    x: Math.max(xInterval.min, xInterval.max),
                    y: Math.min(yInterval.min, yInterval.max),
                  },
                  {
                    x: Math.max(xInterval.min, xInterval.max),
                    y: Math.max(yInterval.min, yInterval.max),
                  },
                  {
                    x: Math.min(xInterval.min, xInterval.max),
                    y: Math.max(yInterval.min, yInterval.max),
                  },
                ],
              ],
              simplifyTolerance,
            )
          : [],
      visibleRegion: emptyRegion(),
    };
  }

  const inside =
    clippedMinX <= CLIP_EPSILON &&
    clippedMaxX >= 1 - CLIP_EPSILON &&
    clippedMinY <= CLIP_EPSILON &&
    clippedMaxY >= 1 - CLIP_EPSILON;

  const viewportBoundaryPaths: PlanePoint[][] = [];
  if (clippedMinX > CLIP_EPSILON) {
    viewportBoundaryPaths.push([
      { x: clippedMinX, y: clippedMinY },
      { x: clippedMinX, y: clippedMaxY },
    ]);
  }
  if (clippedMaxX < 1 - CLIP_EPSILON) {
    viewportBoundaryPaths.push([
      { x: clippedMaxX, y: clippedMinY },
      { x: clippedMaxX, y: clippedMaxY },
    ]);
  }
  if (clippedMinY > CLIP_EPSILON) {
    viewportBoundaryPaths.push([
      { x: clippedMinX, y: clippedMinY },
      { x: clippedMaxX, y: clippedMinY },
    ]);
  }
  if (clippedMaxY < 1 - CLIP_EPSILON) {
    viewportBoundaryPaths.push([
      { x: clippedMinX, y: clippedMaxY },
      { x: clippedMaxX, y: clippedMaxY },
    ]);
  }

  const fullBoundaryPaths = simplifyPlanePaths(
    [
      [
        {
          x: Math.min(xInterval.min, xInterval.max),
          y: Math.min(yInterval.min, yInterval.max),
        },
        {
          x: Math.max(xInterval.min, xInterval.max),
          y: Math.min(yInterval.min, yInterval.max),
        },
        {
          x: Math.max(xInterval.min, xInterval.max),
          y: Math.max(yInterval.min, yInterval.max),
        },
        {
          x: Math.min(xInterval.min, xInterval.max),
          y: Math.max(yInterval.min, yInterval.max),
        },
      ],
    ],
    simplifyTolerance,
  );

  return {
    kind: 'gamutRegion',
    gamut,
    scope,
    viewportRelation: inside ? 'inside' : 'intersects',
    solver: 'domain-edge',
    boundaryPaths:
      scope === 'full'
        ? fullBoundaryPaths
        : simplifyPlanePaths(viewportBoundaryPaths, simplifyTolerance),
    visibleRegion: inside
      ? fullViewportRegion()
      : rectRegion(clippedMinX, clippedMaxX, clippedMinY, clippedMaxY),
  };
}

function resolveGamutSolver(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
): PlaneGamutSolver {
  if (
    resolvedPlane.model === 'rgb' ||
    resolvedPlane.model === 'hsl' ||
    resolvedPlane.model === 'hsv' ||
    (resolvedPlane.model === 'p3' && gamut === 'display-p3')
  ) {
    return 'domain-edge';
  }

  if (usesLightnessAndChroma(resolvedPlane)) {
    return 'analytic-lc';
  }

  if (
    resolvedPlane.model === 'oklch' &&
    ((resolvedPlane.x.channel === 'h' && resolvedPlane.y.channel === 'c') ||
      (resolvedPlane.x.channel === 'c' && resolvedPlane.y.channel === 'h'))
  ) {
    return 'analytic-hc';
  }

  if (
    resolvedPlane.model === 'hct' &&
    gamut === 'srgb' &&
    ((resolvedPlane.x.channel === 'h' && resolvedPlane.y.channel === 'c') ||
      (resolvedPlane.x.channel === 'c' && resolvedPlane.y.channel === 'h') ||
      (resolvedPlane.x.channel === 't' && resolvedPlane.y.channel === 'c') ||
      (resolvedPlane.x.channel === 'c' && resolvedPlane.y.channel === 't'))
  ) {
    return 'analytic-hct';
  }

  return 'implicit-contour';
}

function buildFullBoundaryPaths(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
  solver: PlaneGamutSolver,
  simplifyTolerance?: number,
): PlanePoint[][] {
  const rawPaths: PlanePoint[][] = (() => {
    switch (solver) {
      case 'analytic-lc':
        return [buildAnalyticLcBoundary(resolvedPlane, gamut)];
      case 'analytic-hc':
        return [buildAnalyticHcBoundary(resolvedPlane, gamut)];
      case 'analytic-hct':
        return [buildAnalyticHctBoundary(resolvedPlane)];
      default:
        return [];
    }
  })();
  return simplifyPlanePaths(rawPaths, simplifyTolerance);
}

function buildImplicitBoundaryPaths(
  sampler: ScalarSampler,
  scope: PlaneGamutRegionScope,
  resolvedPlane: Plane,
  simplifyTolerance?: number,
  trace?: InternalPlaneTraceContext | null,
): PlanePoint[][] {
  const bounds =
    scope === 'full'
      ? fullScopeBounds(resolvedPlane)
      : { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  const adaptiveContour = extractAdaptiveContourSegments(
    sampler,
    bounds,
    scope === 'full'
      ? DEFAULT_FULL_BASE_RESOLUTION
      : DEFAULT_VIEWPORT_BASE_RESOLUTION,
    DEFAULT_IMPLICIT_MAX_DEPTH,
    trace,
    scope === 'full' ? 'implicit-full-boundary' : 'implicit-viewport-boundary',
  );
  const simplified = simplifyPlanePaths(
    buildSegmentPaths(adaptiveContour.segments),
    simplifyTolerance,
  );
  recordTraceStage(trace, {
    kind: 'paths',
    label: scope === 'full' ? 'implicit-full-paths' : 'implicit-viewport-paths',
    pathCount: simplified.length,
    pointCount: simplified.reduce((total, path) => total + path.length, 0),
    paths: limitTracePaths(trace, simplified),
  });
  return simplified;
}

function buildViewportVisibleRegion(
  grid: ScalarGrid | null,
  relation: PlaneViewportRelation,
  trace?: InternalPlaneTraceContext | null,
): PlaneRegion {
  if (relation === 'inside') return fullViewportRegion();
  if (relation === 'outside') return emptyRegion();
  if (!grid) return emptyRegion();
  return buildVisibleRegionFromViewportGrid(grid, trace);
}

export function getPlaneGamutRegion(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGamutRegionQuery, 'kind'> = {},
  trace?: InternalPlaneTraceContext | null,
): PlaneGamutRegionResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  const gamut = query.gamut ?? 'srgb';
  const scope = query.scope ?? 'viewport';
  const solver = resolveGamutSolver(resolvedPlane, gamut);
  setTraceSummaryField(trace, 'solver', solver);
  setTraceSummaryField(
    trace,
    'samplingMode',
    solver === 'implicit-contour' ? 'adaptive' : 'analytic',
  );
  setTraceSummaryField(trace, 'fidelity', {
    simplifyTolerance: query.simplifyTolerance,
    resolution:
      solver === 'implicit-contour'
        ? scope === 'full'
          ? DEFAULT_FULL_RESOLUTION
          : DEFAULT_VIEWPORT_RESOLUTION
        : DEFAULT_BOUNDARY_STEPS,
    steps: solver === 'implicit-contour' ? undefined : DEFAULT_BOUNDARY_STEPS,
  });
  recordTraceStage(trace, {
    kind: 'solver',
    solver,
    samplingMode: solver === 'implicit-contour' ? 'adaptive' : 'analytic',
    scope,
  });

  if (solver === 'domain-edge') {
    const result = buildDomainEdgeViewportResult(
      resolvedPlane,
      gamut,
      scope,
      query.simplifyTolerance,
    );
    setTraceSummaryField(trace, 'viewportRelation', result.viewportRelation);
    setTraceSummaryField(
      trace,
      'pathCount',
      result.boundaryPaths.length + result.visibleRegion.paths.length,
    );
    setTraceSummaryField(
      trace,
      'pointCount',
      result.boundaryPaths.reduce((total, path) => total + path.length, 0) +
        result.visibleRegion.paths.reduce(
          (total, path) => total + path.length,
          0,
        ),
    );
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'domain-edge-boundary',
      pathCount: result.boundaryPaths.length,
      pointCount: result.boundaryPaths.reduce(
        (total, path) => total + path.length,
        0,
      ),
      paths: limitTracePaths(trace, result.boundaryPaths),
    });
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'domain-edge-visible-region',
      pathCount: result.visibleRegion.paths.length,
      pointCount: result.visibleRegion.paths.reduce(
        (total, path) => total + path.length,
        0,
      ),
      paths: limitTracePaths(trace, result.visibleRegion.paths),
    });
    return result;
  }

  const field = createFieldEvaluator(resolvedPlane, gamut);
  const sampler = createScalarSampler(field, trace);
  const viewportContour = extractAdaptiveContourSegments(
    sampler,
    { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    DEFAULT_VIEWPORT_BASE_RESOLUTION,
    DEFAULT_IMPLICIT_MAX_DEPTH,
    trace,
    'viewport-boundary',
  );
  const viewportClassification = classifyAdaptiveContourResult(viewportContour);
  const viewportRelation = viewportClassification.relation;
  setTraceSummaryField(trace, 'viewportRelation', viewportRelation);
  recordTraceStage(trace, {
    kind: 'viewportClassification',
    relation: viewportRelation,
    minValue: viewportClassification.minValue,
    maxValue: viewportClassification.maxValue,
  });
  const viewportGrid =
    viewportRelation === 'intersects'
      ? sampleScalarGrid(
          sampler,
          { minX: 0, maxX: 1, minY: 0, maxY: 1 },
          DEFAULT_VIEWPORT_FILL_RESOLUTION,
          trace,
          'viewport-grid',
        )
      : null;

  if (
    solver === 'analytic-lc' ||
    solver === 'analytic-hc' ||
    solver === 'analytic-hct'
  ) {
    const fullBoundaryPaths = buildFullBoundaryPaths(
      resolvedPlane,
      gamut,
      solver,
      query.simplifyTolerance,
    );
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'analytic-full-boundary',
      pathCount: fullBoundaryPaths.length,
      pointCount: fullBoundaryPaths.reduce(
        (total, path) => total + path.length,
        0,
      ),
      paths: limitTracePaths(trace, fullBoundaryPaths),
    });
    const viewportBoundaryPaths = simplifyPlanePaths(
      clipPathsToViewport(fullBoundaryPaths),
      query.simplifyTolerance,
    );
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'analytic-viewport-boundary',
      pathCount: viewportBoundaryPaths.length,
      pointCount: viewportBoundaryPaths.reduce(
        (total, path) => total + path.length,
        0,
      ),
      paths: limitTracePaths(trace, viewportBoundaryPaths),
    });
    const resolvedViewportRelation =
      viewportBoundaryPaths.length > 0 ? 'intersects' : viewportRelation;
    const resolvedViewportGrid =
      resolvedViewportRelation === 'intersects'
        ? (viewportGrid ??
          sampleScalarGrid(
            sampler,
            { minX: 0, maxX: 1, minY: 0, maxY: 1 },
            DEFAULT_VIEWPORT_FILL_RESOLUTION,
            trace,
            'viewport-grid',
          ))
        : null;
    const visibleRegion = buildViewportVisibleRegion(
      resolvedViewportGrid,
      resolvedViewportRelation,
      trace,
    );
    if (resolvedViewportRelation !== 'intersects') {
      recordTraceStage(trace, {
        kind: 'paths',
        label: 'analytic-visible-region',
        pathCount: visibleRegion.paths.length,
        pointCount: visibleRegion.paths.reduce(
          (total, path) => total + path.length,
          0,
        ),
        paths: limitTracePaths(trace, visibleRegion.paths),
      });
    }
    const boundaryPaths =
      scope === 'full'
        ? fullBoundaryPaths
        : viewportBoundaryPaths.length > 0
          ? viewportBoundaryPaths
          : [];
    setTraceSummaryField(trace, 'viewportRelation', resolvedViewportRelation);
    setTraceSummaryField(
      trace,
      'pathCount',
      boundaryPaths.length + visibleRegion.paths.length,
    );
    setTraceSummaryField(
      trace,
      'pointCount',
      boundaryPaths.reduce((total, path) => total + path.length, 0) +
        visibleRegion.paths.reduce((total, path) => total + path.length, 0),
    );

    return {
      kind: 'gamutRegion',
      gamut,
      scope,
      viewportRelation: resolvedViewportRelation,
      solver,
      boundaryPaths,
      visibleRegion,
    };
  }

  const implicitBoundaryPaths =
    scope === 'full'
      ? buildImplicitBoundaryPaths(
          sampler,
          'full',
          resolvedPlane,
          query.simplifyTolerance,
          trace,
        )
      : viewportRelation === 'intersects'
        ? simplifyPlanePaths(
            buildSegmentPaths(viewportContour.segments),
            query.simplifyTolerance,
          )
        : [];
  const visibleRegion = buildViewportVisibleRegion(
    viewportGrid,
    viewportRelation,
    trace,
  );
  if (viewportRelation !== 'intersects') {
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'implicit-visible-region',
      pathCount: visibleRegion.paths.length,
      pointCount: visibleRegion.paths.reduce(
        (total, path) => total + path.length,
        0,
      ),
      paths: limitTracePaths(trace, visibleRegion.paths),
    });
  }
  const boundaryPaths =
    scope === 'viewport' &&
    viewportRelation === 'intersects' &&
    implicitBoundaryPaths.length === 0
      ? simplifyPlanePaths(
          extractBoundaryPathsFromVisibleRegion(visibleRegion),
          query.simplifyTolerance,
        )
      : implicitBoundaryPaths;
  if (
    scope === 'viewport' &&
    viewportRelation === 'intersects' &&
    implicitBoundaryPaths.length === 0
  ) {
    recordTraceStage(trace, {
      kind: 'paths',
      label: 'visible-region-boundary-fallback',
      pathCount: boundaryPaths.length,
      pointCount: boundaryPaths.reduce((total, path) => total + path.length, 0),
      paths: limitTracePaths(trace, boundaryPaths),
    });
  }
  setTraceSummaryField(
    trace,
    'pathCount',
    boundaryPaths.length + visibleRegion.paths.length,
  );
  setTraceSummaryField(
    trace,
    'pointCount',
    boundaryPaths.reduce((total, path) => total + path.length, 0) +
      visibleRegion.paths.reduce((total, path) => total + path.length, 0),
  );

  return {
    kind: 'gamutRegion',
    gamut,
    scope,
    viewportRelation,
    solver,
    boundaryPaths,
    visibleRegion,
  };
}
