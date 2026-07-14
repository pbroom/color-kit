import {
  buildContourPaths,
  extractAdaptiveContourSegments as extractAdaptiveContourSegmentsGeneric,
  extractGridContourSegments,
  type AdaptiveContourCell,
  type ContourSegment,
} from '../../contour/index.js';
import { GAMUT_EPSILON } from '../../gamut/index.js';
import { simplifyPolyline } from '../../utils/index.js';
import {
  incrementTraceSummary,
  limitTraceEntries,
  limitTracePaths,
  recordTraceStage,
  shouldTraceFull,
  shouldTraceScalarGrid,
  type InternalPlaneTraceContext,
} from '../trace.js';
import type {
  PlanePoint,
  PlaneRegion,
  PlaneViewportRelation,
} from '../types.js';

const ADAPTIVE_REFINEMENT_EPSILON = GAMUT_EPSILON * 8;
export const CLIP_EPSILON = 1e-6;
// `extendViewportGrid()` inserts a one-cell border of outside samples around the
// original scalar grid. Expanding the bounds by one full cell keeps the shifted
// interior indices aligned with their original sample coordinates.
const BORDER_PAD_CELLS = 1;

export type ScalarField = (point: PlanePoint) => number;

export interface ScalarSampler {
  sample(x: number, y: number): number;
}

export interface ScalarGrid {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  resolution: number;
  values: number[][];
}

export interface ScalarBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ScalarGridClassification {
  relation: PlaneViewportRelation;
  minValue: number;
  maxValue: number;
}

export interface AdaptiveContourResult {
  minValue: number;
  maxValue: number;
  segments: Array<ContourSegment<PlanePoint>>;
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

export function pointsEqual(
  a: PlanePoint,
  b: PlanePoint,
  epsilon: number = CLIP_EPSILON,
): boolean {
  return approxEqual(a.x, b.x, epsilon) && approxEqual(a.y, b.y, epsilon);
}

export function clampToViewport(point: PlanePoint): PlanePoint {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
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

export function emptyRegion(): PlaneRegion {
  return { paths: [] };
}

export function fullViewportRegion(): PlaneRegion {
  return { paths: [viewportRectPath()] };
}

export function rectRegion(
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

export function simplifyPlanePaths(
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

export function clipPathsToViewport(paths: PlanePoint[][]): PlanePoint[][] {
  return paths.flatMap((path) => clipPolylineToViewport(path));
}

export function buildSegmentPaths(
  segments: Array<ContourSegment<PlanePoint>>,
  options: { closedOnly?: boolean } = {},
): PlanePoint[][] {
  return buildContourPaths(segments, {
    canonicalTolerance: 1e-5,
    closedOnly: options.closedOnly,
    traversalGuardLimit: (segmentCount) => Math.max(2048, segmentCount * 4),
  });
}

function scalarSampleKey(x: number, y: number): string {
  return `${x.toFixed(10)}:${y.toFixed(10)}`;
}

export function createScalarSampler(
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

export function classifyAdaptiveContourResult(
  result: AdaptiveContourResult,
): ScalarGridClassification {
  if (result.segments.length > 0) {
    return {
      relation: 'intersects',
      minValue: result.minValue,
      maxValue: result.maxValue,
    };
  }
  if (result.minValue >= -GAMUT_EPSILON) {
    return {
      relation: 'inside',
      minValue: result.minValue,
      maxValue: result.maxValue,
    };
  }
  if (result.maxValue < -GAMUT_EPSILON) {
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

export function extractAdaptiveContourSegments(
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
  const cells: AdaptiveContourCell[] = [];
  const sample = (x: number, y: number): number => sampler.sample(x, y);

  for (let y = 0; y < baseResolution; y += 1) {
    const y0 = minY + y * stepY;
    const y1 = minY + (y + 1) * stepY;
    for (let x = 0; x < baseResolution; x += 1) {
      const x0 = minX + x * stepX;
      const x1 = minX + (x + 1) * stepX;
      cells.push({
        x0,
        x1,
        y0,
        y1,
        v0: sample(x0, y0),
        v1: sample(x1, y0),
        v2: sample(x1, y1),
        v3: sample(x0, y1),
      });
    }
  }

  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const result = extractAdaptiveContourSegmentsGeneric(cells, sample, {
    maxDepth,
    collectCellEvents: shouldTraceFull(trace),
    getCellIndex: (cell) => ({
      xIndex: Math.round(((cell.x0 - minX) / spanX) * effectiveResolution),
      yIndex: Math.round(((cell.y0 - minY) / spanY) * effectiveResolution),
    }),
    shouldRefineUniformCell: ({ cornerValues, midpointValues }) =>
      shouldRefineUniformAdaptiveCell(
        [...cornerValues] as [number, number, number, number],
        [...midpointValues] as [number, number, number, number, number],
      ),
  });

  incrementTraceSummary(trace, 'cellCount', result.cellCount);
  incrementTraceSummary(trace, 'segmentCount', result.segmentCount);
  recordTraceStage(trace, {
    kind: 'marchingSquares',
    label,
    resolution: effectiveResolution,
    cellCount: result.cellCount,
    segmentCount: result.segmentCount,
    cells: limitTraceEntries(trace, result.cellEvents),
  });

  return {
    minValue: result.minValue,
    maxValue: result.maxValue,
    segments: result.segments,
  };
}

function extractContourSegments(
  grid: ScalarGrid,
  trace?: InternalPlaneTraceContext | null,
  label: string = 'marching-squares',
): Array<ContourSegment<PlanePoint>> {
  const extraction = extractGridContourSegments<PlanePoint>(grid, {
    collectCellEvents: shouldTraceFull(trace),
    cellEventMode: 'segment',
  });

  incrementTraceSummary(trace, 'cellCount', extraction.cellCount);
  incrementTraceSummary(trace, 'segmentCount', extraction.segmentCount);
  recordTraceStage(trace, {
    kind: 'marchingSquares',
    label,
    resolution: grid.resolution,
    cellCount: extraction.cellCount,
    segmentCount: extraction.segmentCount,
    cells: limitTraceEntries(trace, extraction.cellEvents),
  });
  return extraction.segments;
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

export function extractBoundaryPathsFromVisibleRegion(
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

export function sampleScalarGrid(
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

export function buildViewportVisibleRegion(
  grid: ScalarGrid | null,
  relation: PlaneViewportRelation,
  trace?: InternalPlaneTraceContext | null,
): PlaneRegion {
  if (relation === 'inside') return fullViewportRegion();
  if (relation === 'outside') return emptyRegion();
  if (!grid) return emptyRegion();
  return buildVisibleRegionFromViewportGrid(grid, trace);
}
