import {
  buildContourPaths,
  cellMaskFromBooleans,
  pointOnCellEdge,
  segmentEdgesForCell,
  type ContourSegment,
} from '../contour/index.js';
import type { PlanePoint, PlaneRegion } from './types.js';

/**
 * Options for the raster-based region booleans ({@link unionRegions},
 * {@link intersectRegions}, {@link differenceRegions}).
 */
export interface PlaneBooleanOptions {
  /**
   * Grid cells per axis used to rasterize both regions. Clamped to
   * `[16, 256]`. Result edges can deviate from the exact boundary by up to
   * about one cell (combined bounding-box span / `resolution`); higher values
   * improve fidelity at quadratic compute cost.
   * @defaultValue 96
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

/**
 * Returns whether a point lies inside a region, using the even-odd fill rule.
 *
 * Each path is treated as a closed polygon (the last point connects back to
 * the first, so a repeated closing point is optional) and every path toggles
 * inside/outside. A path nested inside another therefore cuts a hole, which
 * matches the compound paths returned by plane queries and region booleans
 * and SVG `fill-rule="evenodd"`. Coordinates are compared as-is, so `region`
 * and `point` must share a space (plane-normalized `[0, 1]` for query
 * results). Points exactly on an edge may resolve either way.
 *
 * @param region - Region whose `paths` form one compound polygon.
 * @param point - Point to test, in the same coordinate space as `region`.
 * @returns `true` when the point is inside an odd number of paths.
 * @see {@link nearestPointOnPath}
 * @example
 * ```ts
 * import { containsPoint } from 'color-kit/plane';
 *
 * const outer = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
 * const hole = [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }];
 * const frame = { paths: [outer, hole] };
 *
 * containsPoint(frame, { x: 0.1, y: 0.1 }); // → true
 * containsPoint(frame, { x: 0.5, y: 0.5 }); // → false (inside the hole)
 * ```
 */
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

/**
 * Returns the Euclidean distance between two plane points.
 *
 * Distance is measured in the points' own coordinate space. For plane query
 * results that is plane-normalized units, where each axis spans `[0, 1]`
 * regardless of its channel range, so it is not a perceptual color
 * difference.
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns `hypot(a.x - b.x, a.y - b.y)`.
 * @example
 * ```ts
 * import { pointDistance } from 'color-kit/plane';
 *
 * pointDistance({ x: 0, y: 0 }, { x: 0.3, y: 0.4 }); // → 0.5
 * ```
 */
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

/**
 * Returns the point on a polyline closest to `point`.
 *
 * The path is treated as an open polyline: only consecutive points are joined,
 * so append the first point to include a closing segment. The projection is
 * exact (not sampled) and the result lies on a segment, possibly at a vertex.
 * When two segments are equally close, the earlier one wins.
 *
 * @param path - Polyline points in the same coordinate space as `point`.
 * @param point - Query point.
 * @returns The nearest point on the path, or `null` when `path` has fewer
 * than two points.
 * @see {@link pointDistance}
 * @example
 * ```ts
 * import { nearestPointOnPath } from 'color-kit/plane';
 *
 * const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
 *
 * nearestPointOnPath(path, { x: 0.4, y: 0.3 }); // → { x: 0.4, y: 0 }
 * nearestPointOnPath(path, { x: 0.9, y: 0.5 }); // → { x: 1, y: 0.5 }
 * ```
 */
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

/**
 * Returns the area covered by either region (`a ∪ b`).
 *
 * Both regions are rasterized with the even-odd rule (see
 * {@link containsPoint}) on a `resolution × resolution` grid covering their
 * combined bounding box plus one cell of padding, and the result is traced
 * back into closed paths with marching squares. Output is therefore
 * approximate: edges can be off by up to about one cell, corners are
 * bevelled, and where the two boundaries run within a cell of each other the
 * result can contain tiny one-cell fragments. Each output path repeats its
 * first point at the end; holes are separate paths. Works in any coordinate
 * space shared by both inputs (plane-normalized for query results).
 *
 * @param a - First region.
 * @param b - Second region.
 * @param options - Raster resolution.
 * @returns A new region; `{ paths: [] }` when both inputs are empty.
 * @see {@link intersectRegions}
 * @see {@link differenceRegions}
 * @example
 * ```ts
 * import { containsPoint, unionRegions } from 'color-kit/plane';
 *
 * const square = (x0: number, y0: number, x1: number, y1: number) => ({
 *   paths: [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]],
 * });
 * const merged = unionRegions(square(0, 0, 0.6, 0.6), square(0.4, 0.4, 1, 1));
 *
 * merged.paths.length; // → 1
 * containsPoint(merged, { x: 0.9, y: 0.9 }); // → true
 * containsPoint(merged, { x: 0.9, y: 0.1 }); // → false
 * ```
 */
export function unionRegions(
  a: PlaneRegion,
  b: PlaneRegion,
  options: PlaneBooleanOptions = {},
): PlaneRegion {
  return booleanRegion(a, b, 'union', options);
}

/**
 * Returns the area covered by both regions (`a ∩ b`).
 *
 * Both regions are rasterized with the even-odd rule (see
 * {@link containsPoint}) on a `resolution × resolution` grid covering their
 * combined bounding box plus one cell of padding, and the result is traced
 * back into closed paths with marching squares. Output is therefore
 * approximate: edges can be off by up to about one cell, corners are
 * bevelled, and where the two boundaries run within a cell of each other the
 * result can contain tiny one-cell fragments. Each output path repeats its
 * first point at the end; holes are separate paths. Works in any coordinate
 * space shared by both inputs (plane-normalized for query results).
 *
 * @param a - First region.
 * @param b - Second region.
 * @param options - Raster resolution.
 * @returns A new region; `{ paths: [] }` when the regions do not overlap.
 * @see {@link unionRegions}
 * @see {@link differenceRegions}
 * @example
 * ```ts
 * import { containsPoint, intersectRegions, sense } from 'color-kit/plane';
 *
 * // Default OKLCH plane: x = lightness, y = chroma (0.4 at the top, 0 at the bottom).
 * const srgb = sense({ model: 'oklch', fixed: { h: 250 } }).gamutRegion({ gamut: 'srgb' });
 * const darkHalf = { paths: [[{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }]] };
 * const darkInGamut = intersectRegions(srgb.visibleRegion, darkHalf);
 *
 * containsPoint(darkInGamut, { x: 0.3, y: 0.9 }); // → true
 * containsPoint(darkInGamut, { x: 0.7, y: 0.9 }); // → false
 * ```
 */
export function intersectRegions(
  a: PlaneRegion,
  b: PlaneRegion,
  options: PlaneBooleanOptions = {},
): PlaneRegion {
  return booleanRegion(a, b, 'intersect', options);
}

/**
 * Returns the area of `a` that is not covered by `b` (`a − b`).
 *
 * Both regions are rasterized with the even-odd rule (see
 * {@link containsPoint}) on a `resolution × resolution` grid covering their
 * combined bounding box plus one cell of padding, and the result is traced
 * back into closed paths with marching squares. Output is therefore
 * approximate: edges can be off by up to about one cell, corners are
 * bevelled, and where the two boundaries run within a cell of each other the
 * result can contain tiny one-cell fragments. Each output path repeats its
 * first point at the end; holes are separate paths. Works in any coordinate
 * space shared by both inputs (plane-normalized for query results).
 *
 * @param a - Region to subtract from.
 * @param b - Region to subtract.
 * @param options - Raster resolution.
 * @returns A new region; `{ paths: [] }` when `b` covers all of `a`.
 * @see {@link unionRegions}
 * @see {@link intersectRegions}
 * @example
 * ```ts
 * import { containsPoint, differenceRegions, sense } from 'color-kit/plane';
 *
 * const view = sense({ model: 'oklch', fixed: { h: 250 } });
 * const p3 = view.gamutRegion({ gamut: 'display-p3' }).visibleRegion;
 * const srgb = view.gamutRegion({ gamut: 'srgb' }).visibleRegion;
 * const p3Only = differenceRegions(p3, srgb); // colors P3 can show but sRGB cannot
 *
 * containsPoint(p3Only, { x: 0.6, y: 0.5 }); // → true
 * containsPoint(p3Only, { x: 0.6, y: 0.9 }); // → false
 * ```
 */
export function differenceRegions(
  a: PlaneRegion,
  b: PlaneRegion,
  options: PlaneBooleanOptions = {},
): PlaneRegion {
  return booleanRegion(a, b, 'difference', options);
}
