export type ContourEdge = 0 | 1 | 2 | 3;
export type ContourEdgePair = readonly [ContourEdge, ContourEdge];
export type ContourInterpolation = 'linear' | 'midpoint';

export interface ContourPoint {
  x: number;
  y: number;
}

export type ContourSegment<TPoint extends ContourPoint = ContourPoint> =
  readonly [TPoint, TPoint];

export interface ContourCellBounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface ContourCellValues {
  v0: number;
  v1: number;
  v2: number;
  v3: number;
}

export interface ContourCell extends ContourCellBounds, ContourCellValues {}

export interface ContourCellEvent<TPoint extends ContourPoint = ContourPoint> {
  xIndex: number;
  yIndex: number;
  mask: number;
  points: TPoint[];
}

export interface ScalarContourGrid {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  resolution: number;
  xSteps?: number;
  ySteps?: number;
  values: number[][];
}

export interface ContourSegmentExtraction<
  TPoint extends ContourPoint = ContourPoint,
> {
  segments: Array<ContourSegment<TPoint>>;
  cellCount: number;
  segmentCount: number;
  cellEvents: Array<ContourCellEvent<TPoint>>;
}

export interface AdaptiveContourExtraction<
  TPoint extends ContourPoint = ContourPoint,
> extends ContourSegmentExtraction<TPoint> {
  minValue: number;
  maxValue: number;
}

export interface BuildContourPathOptions<
  TPoint extends ContourPoint = ContourPoint,
> {
  canonicalTolerance?: number;
  closedOnly?: boolean;
  includeOpenPaths?: boolean;
  minPathPoints?: number | ((closed: boolean) => number);
  traversalGuardLimit?: number | ((segmentCount: number) => number);
  sortPaths?: (a: TPoint[], b: TPoint[]) => number;
  stopOpenPathsAtStart?: boolean;
  canonicalizePoint?: (point: TPoint, tolerance: number) => TPoint;
  pointKey?: (point: TPoint) => string;
  pointsEqual?: (a: TPoint, b: TPoint, tolerance: number) => boolean;
}

export interface GridContourOptions<
  TPoint extends ContourPoint = ContourPoint,
> {
  interpolation?: ContourInterpolation;
  threshold?: number;
  collectCellEvents?: boolean;
  cellEventMode?: 'cell' | 'segment';
  mapPoint?: (point: ContourPoint) => TPoint;
}

export interface AdaptiveContourCell extends ContourCell {
  xIndex?: number;
  yIndex?: number;
}

export interface AdaptiveContourRefineContext {
  cell: ContourCell;
  cornerValues: readonly [number, number, number, number];
  midpointValues: readonly [number, number, number, number, number];
  mask: number;
  depth: number;
  sample: (x: number, y: number) => number;
}

export interface AdaptiveContourOptions<
  TPoint extends ContourPoint = ContourPoint,
> {
  maxDepth: number;
  interpolation?: ContourInterpolation;
  collectCellEvents?: boolean;
  mapPoint?: (point: ContourPoint) => TPoint;
  getCellIndex?: (
    cell: ContourCell,
    depth: number,
  ) => {
    xIndex: number;
    yIndex: number;
  };
  shouldRefineUniformCell?: (context: AdaptiveContourRefineContext) => boolean;
}

const EDGE_PAIRS_BY_MASK: ReadonlyArray<readonly ContourEdgePair[]> = [
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

export function segmentEdgesForCell(mask: number): readonly ContourEdgePair[] {
  return EDGE_PAIRS_BY_MASK[mask] ?? [];
}

export function cellMaskFromBooleans(
  b0: boolean,
  b1: boolean,
  b2: boolean,
  b3: boolean,
): number {
  return (b0 ? 1 : 0) | (b1 ? 2 : 0) | (b2 ? 4 : 0) | (b3 ? 8 : 0);
}

export function cellMaskFromValues(
  values: ContourCellValues,
  threshold: number = 0,
): number {
  return cellMaskFromBooleans(
    values.v0 >= threshold,
    values.v1 >= threshold,
    values.v2 >= threshold,
    values.v3 >= threshold,
  );
}

export function interpolateZero(a: number, b: number): number {
  const denominator = a - b;
  if (!Number.isFinite(denominator) || Math.abs(denominator) <= 1e-12) {
    return 0.5;
  }
  const t = a / denominator;
  if (!Number.isFinite(t)) return 0.5;
  return Math.min(1, Math.max(0, t));
}

export function interpolateCellEdge(
  edge: ContourEdge,
  values: ContourCellValues,
  interpolation: ContourInterpolation = 'linear',
): number {
  if (interpolation === 'midpoint') {
    return 0.5;
  }
  switch (edge) {
    case 0:
      return interpolateZero(values.v0, values.v1);
    case 1:
      return interpolateZero(values.v1, values.v2);
    case 2:
      return interpolateZero(values.v3, values.v2);
    case 3:
      return interpolateZero(values.v0, values.v3);
    default:
      return 0.5;
  }
}

export function pointOnCellEdge(
  edge: ContourEdge,
  bounds: ContourCellBounds,
  values?: ContourCellValues,
  interpolation: ContourInterpolation = 'linear',
): ContourPoint {
  const t = values ? interpolateCellEdge(edge, values, interpolation) : 0.5;
  switch (edge) {
    case 0:
      return { x: bounds.x0 + (bounds.x1 - bounds.x0) * t, y: bounds.y0 };
    case 1:
      return { x: bounds.x1, y: bounds.y0 + (bounds.y1 - bounds.y0) * t };
    case 2:
      return { x: bounds.x0 + (bounds.x1 - bounds.x0) * t, y: bounds.y1 };
    case 3:
      return { x: bounds.x0, y: bounds.y0 + (bounds.y1 - bounds.y0) * t };
    default:
      return { x: bounds.x0, y: bounds.y0 };
  }
}

export function contourEdgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function contourPointKey(point: ContourPoint): string {
  return `${point.x.toFixed(6)}:${point.y.toFixed(6)}`;
}

export function canonicalizeContourPoint<TPoint extends ContourPoint>(
  point: TPoint,
  tolerance: number = 1e-6,
): TPoint {
  const round = (value: number) => Math.round(value / tolerance) * tolerance;
  return {
    ...point,
    x: round(point.x),
    y: round(point.y),
  };
}

export function contourPointsEqual<TPoint extends ContourPoint>(
  a: TPoint,
  b: TPoint,
  tolerance: number = 1e-6,
): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

export function buildContourPaths<TPoint extends ContourPoint = ContourPoint>(
  segments: Array<ContourSegment<TPoint>>,
  options: BuildContourPathOptions<TPoint> = {},
): TPoint[][] {
  if (segments.length === 0) return [];

  const canonicalTolerance = options.canonicalTolerance ?? 1e-6;
  const canonicalizePoint =
    options.canonicalizePoint ?? canonicalizeContourPoint<TPoint>;
  const pointKey = options.pointKey ?? contourPointKey;
  const pointsEqual = options.pointsEqual ?? contourPointsEqual<TPoint>;
  const includeOpenPaths = options.includeOpenPaths ?? !options.closedOnly;
  const traversalGuardLimit =
    typeof options.traversalGuardLimit === 'function'
      ? options.traversalGuardLimit(segments.length)
      : (options.traversalGuardLimit ?? 20000);
  const stopOpenPathsAtStart = options.stopOpenPathsAtStart ?? true;

  const pointByKey = new Map<string, TPoint>();
  const adjacency = new Map<string, Set<string>>();
  const visitedEdges = new Set<string>();

  for (const [a, b] of segments) {
    const aCanonical = canonicalizePoint(a, canonicalTolerance);
    const bCanonical = canonicalizePoint(b, canonicalTolerance);
    const aKey = pointKey(aCanonical);
    const bKey = pointKey(bCanonical);

    pointByKey.set(aKey, aCanonical);
    pointByKey.set(bKey, bCanonical);

    if (!adjacency.has(aKey)) adjacency.set(aKey, new Set());
    if (!adjacency.has(bKey)) adjacency.set(bKey, new Set());
    adjacency.get(aKey)?.add(bKey);
    adjacency.get(bKey)?.add(aKey);
  }

  const tracePath = (start: string, stopAtStart: boolean): string[] => {
    const path = [start];
    let current = start;
    let guard = 0;

    while (guard < traversalGuardLimit) {
      guard += 1;
      const neighbors = adjacency.get(current);
      if (!neighbors || neighbors.size === 0) break;

      let next: string | null = null;
      for (const candidate of neighbors) {
        const key = contourEdgeKey(current, candidate);
        if (!visitedEdges.has(key)) {
          next = candidate;
          break;
        }
      }

      if (!next) break;

      visitedEdges.add(contourEdgeKey(current, next));
      current = next;
      path.push(current);

      if (stopAtStart && current === start) {
        break;
      }
    }

    return path;
  };

  const paths: TPoint[][] = [];
  const minPathPointsFor = (closed: boolean): number => {
    if (typeof options.minPathPoints === 'function') {
      return options.minPathPoints(closed);
    }
    if (typeof options.minPathPoints === 'number') {
      return options.minPathPoints;
    }
    return closed ? 3 : 2;
  };

  const acceptPath = (pathKeys: string[]) => {
    const points = pathKeys
      .map((key) => pointByKey.get(key))
      .filter((point): point is TPoint => point != null);
    if (points.length === 0) return;

    const isClosed =
      pathKeys[0] === pathKeys[pathKeys.length - 1] ||
      pointsEqual(points[0], points[points.length - 1], canonicalTolerance);
    if (options.closedOnly && !isClosed) return;
    if (!includeOpenPaths && !isClosed) return;
    if (points.length < minPathPointsFor(isClosed)) return;

    paths.push(points);
  };

  if (includeOpenPaths || options.closedOnly) {
    for (const [node, neighbors] of adjacency) {
      if (neighbors.size !== 1) continue;
      acceptPath(tracePath(node, stopOpenPathsAtStart));
    }
  }

  for (const [node, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      if (visitedEdges.has(contourEdgeKey(node, neighbor))) continue;
      acceptPath(tracePath(node, true));
    }
  }

  return options.sortPaths ? paths.sort(options.sortPaths) : paths;
}

function defaultMapPoint<TPoint extends ContourPoint>(
  point: ContourPoint,
): TPoint {
  return point as TPoint;
}

export function extractGridContourSegments<
  TPoint extends ContourPoint = ContourPoint,
>(
  grid: ScalarContourGrid,
  options: GridContourOptions<TPoint> = {},
): ContourSegmentExtraction<TPoint> {
  const interpolation = options.interpolation ?? 'linear';
  const threshold = options.threshold ?? 0;
  const mapPoint = options.mapPoint ?? defaultMapPoint<TPoint>;
  const xSteps = grid.xSteps ?? grid.resolution;
  const ySteps = grid.ySteps ?? grid.resolution;
  const stepX = (grid.maxX - grid.minX) / xSteps;
  const stepY = (grid.maxY - grid.minY) / ySteps;
  const segments: Array<ContourSegment<TPoint>> = [];
  const cellEvents: Array<ContourCellEvent<TPoint>> = [];
  let segmentCount = 0;
  let cellCount = 0;

  for (let y = 0; y < ySteps; y += 1) {
    const y0 = grid.minY + y * stepY;
    const y1 = grid.minY + (y + 1) * stepY;
    for (let x = 0; x < xSteps; x += 1) {
      const x0 = grid.minX + x * stepX;
      const x1 = grid.minX + (x + 1) * stepX;
      const cell: ContourCell = {
        x0,
        x1,
        y0,
        y1,
        v0: grid.values[y][x],
        v1: grid.values[y][x + 1],
        v2: grid.values[y + 1][x + 1],
        v3: grid.values[y + 1][x],
      };
      const mask = cellMaskFromValues(cell, threshold);
      const edgePairs = segmentEdgesForCell(mask);
      const tracePoints: TPoint[] = [];
      cellCount += 1;

      for (const [fromEdge, toEdge] of edgePairs) {
        const from = mapPoint(
          pointOnCellEdge(fromEdge, cell, cell, interpolation),
        );
        const to = mapPoint(pointOnCellEdge(toEdge, cell, cell, interpolation));
        segments.push([from, to]);
        segmentCount += 1;

        if (options.collectCellEvents) {
          if (options.cellEventMode === 'segment') {
            cellEvents.push({ xIndex: x, yIndex: y, mask, points: [from, to] });
          } else {
            tracePoints.push(from, to);
          }
        }
      }

      if (
        options.collectCellEvents &&
        options.cellEventMode !== 'segment' &&
        tracePoints.length > 0
      ) {
        cellEvents.push({ xIndex: x, yIndex: y, mask, points: tracePoints });
      }
    }
  }

  return { segments, cellCount, segmentCount, cellEvents };
}

export function extractAdaptiveContourSegments<
  TPoint extends ContourPoint = ContourPoint,
>(
  initialCells: readonly AdaptiveContourCell[],
  sample: (x: number, y: number) => number,
  options: AdaptiveContourOptions<TPoint>,
): AdaptiveContourExtraction<TPoint> {
  const interpolation = options.interpolation ?? 'linear';
  const mapPoint = options.mapPoint ?? defaultMapPoint<TPoint>;
  const maxDepth = Math.max(0, options.maxDepth);
  const segments: Array<ContourSegment<TPoint>> = [];
  const cellEvents: Array<ContourCellEvent<TPoint>> = [];
  let segmentCount = 0;
  let cellCount = 0;
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  const observe = (value: number): number => {
    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);
    return value;
  };
  const sampleValue = (x: number, y: number): number => observe(sample(x, y));

  const cellIndex = (
    cell: ContourCell,
    depth: number,
  ): { xIndex: number; yIndex: number } => {
    if (options.getCellIndex) {
      return options.getCellIndex(cell, depth);
    }
    return {
      xIndex:
        'xIndex' in cell ? ((cell as AdaptiveContourCell).xIndex ?? 0) : 0,
      yIndex:
        'yIndex' in cell ? ((cell as AdaptiveContourCell).yIndex ?? 0) : 0,
    };
  };

  const emitSegments = (
    cell: ContourCell,
    mask: number,
    depth: number,
  ): void => {
    const edgePairs = segmentEdgesForCell(mask);
    if (edgePairs.length === 0) return;

    const tracePoints: TPoint[] = [];
    for (const [fromEdge, toEdge] of edgePairs) {
      const from = mapPoint(
        pointOnCellEdge(fromEdge, cell, cell, interpolation),
      );
      const to = mapPoint(pointOnCellEdge(toEdge, cell, cell, interpolation));
      segments.push([from, to]);
      segmentCount += 1;
      if (options.collectCellEvents) {
        tracePoints.push(from, to);
      }
    }

    if (options.collectCellEvents && tracePoints.length > 0) {
      const { xIndex, yIndex } = cellIndex(cell, depth);
      cellEvents.push({ xIndex, yIndex, mask, points: tracePoints });
    }
  };

  const processCell = (cell: ContourCell, depth: number): void => {
    cellCount += 1;
    const mask = cellMaskFromValues(cell);
    const uniform = mask === 0 || mask === 15;

    if (depth >= maxDepth) {
      if (!uniform) {
        emitSegments(cell, mask, depth);
      }
      return;
    }

    const xMid = (cell.x0 + cell.x1) / 2;
    const yMid = (cell.y0 + cell.y1) / 2;
    const vMidBottom = sampleValue(xMid, cell.y0);
    const vMidRight = sampleValue(cell.x1, yMid);
    const vMidTop = sampleValue(xMid, cell.y1);
    const vMidLeft = sampleValue(cell.x0, yMid);
    const vCenter = sampleValue(xMid, yMid);

    if (
      uniform &&
      !options.shouldRefineUniformCell?.({
        cell,
        cornerValues: [cell.v0, cell.v1, cell.v2, cell.v3],
        midpointValues: [vMidBottom, vMidRight, vMidTop, vMidLeft, vCenter],
        mask,
        depth,
        sample: sampleValue,
      })
    ) {
      return;
    }

    processCell(
      {
        x0: cell.x0,
        x1: xMid,
        y0: cell.y0,
        y1: yMid,
        v0: cell.v0,
        v1: vMidBottom,
        v2: vCenter,
        v3: vMidLeft,
      },
      depth + 1,
    );
    processCell(
      {
        x0: xMid,
        x1: cell.x1,
        y0: cell.y0,
        y1: yMid,
        v0: vMidBottom,
        v1: cell.v1,
        v2: vMidRight,
        v3: vCenter,
      },
      depth + 1,
    );
    processCell(
      {
        x0: xMid,
        x1: cell.x1,
        y0: yMid,
        y1: cell.y1,
        v0: vCenter,
        v1: vMidRight,
        v2: cell.v2,
        v3: vMidTop,
      },
      depth + 1,
    );
    processCell(
      {
        x0: cell.x0,
        x1: xMid,
        y0: yMid,
        y1: cell.y1,
        v0: vMidLeft,
        v1: vCenter,
        v2: vMidTop,
        v3: cell.v3,
      },
      depth + 1,
    );
  };

  for (const cell of initialCells) {
    observe(cell.v0);
    observe(cell.v1);
    observe(cell.v2);
    observe(cell.v3);
    processCell(cell, 0);
  }

  if (!Number.isFinite(minValue)) {
    minValue = 0;
    maxValue = 0;
  }

  return {
    minValue,
    maxValue,
    segments,
    cellCount,
    segmentCount,
    cellEvents,
  };
}
