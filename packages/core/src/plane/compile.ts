import type {
  PlaneDefinition,
  PlanePoint,
  PlaneQuery,
  PlaneQueryResult,
} from './types.js';
import { resolvePlaneDefinition } from './plane.js';

export interface SvgPathCompileOptions {
  /** Appends `Z` to close the generated path. */
  closeLoop?: boolean;
  /** Decimal precision used when formatting SVG coordinates. */
  precision?: number;
  /** Multiplier applied to normalized plane coordinates before formatting. */
  scale?: number;
}

/** Formats a numeric coordinate with a fixed decimal precision. */
function format(value: number, precision: number): string {
  return value.toFixed(precision);
}

/** Compiles a sequence of plane points into a single SVG path segment. */
function pathForPoints(
  points: PlanePoint[],
  options: SvgPathCompileOptions = {},
): string {
  if (points.length < 2) return '';
  const precision = options.precision ?? 3;
  const scale = options.scale ?? 100;
  const commands = points.map((point, index) => {
    const x = format(point.x * scale, precision);
    const y = format(point.y * scale, precision);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  });
  if (options.closeLoop) {
    commands.push('Z');
  }
  return commands.join(' ');
}

/**
 * Compiles one point sequence into an SVG path string.
 *
 * @param points Ordered point list in normalized plane coordinates.
 * @param options SVG path formatting options.
 * @param options.closeLoop Appends `Z` to close the generated path.
 * @param options.precision Decimal precision used for coordinate formatting.
 * @param options.scale Multiplier applied to normalized point coordinates.
 */
export function toSvgPath(
  points: PlanePoint[],
  options: SvgPathCompileOptions = {},
): string {
  return pathForPoints(points, options);
}

/**
 * Compiles multiple point sequences into one compound SVG path string.
 *
 * @param paths Collection of point lists in normalized plane coordinates.
 * @param options SVG path formatting options applied to each subpath.
 * @param options.closeLoop Appends `Z` to close each generated subpath.
 * @param options.precision Decimal precision used for coordinate formatting.
 * @param options.scale Multiplier applied to normalized point coordinates.
 */
export function toSvgCompoundPath(
  paths: PlanePoint[][],
  options: SvgPathCompileOptions = {},
): string {
  return paths
    .map((path) => pathForPoints(path, options))
    .filter((path) => path.length > 0)
    .join(' ');
}

/** Deterministically serializes values for stable cache keys. */
function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    (a, b) => a[0].localeCompare(b[0]),
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

/**
 * Creates a deterministic cache key for a plane/query pair.
 *
 * @param plane Plane definition used for the query.
 * @param query Query definition run against the plane.
 */
export function createPlaneQueryKey(
  plane: PlaneDefinition,
  query: PlaneQuery,
): string {
  return `${stableStringify(resolvePlaneDefinition(plane))}:${stableStringify(query)}`;
}

/** Caches plane query results by a deterministic plane/query key. */
export class PlaneQueryCache {
  private entries = new Map<string, PlaneQueryResult>();

  /** Gets a cached query result for the given plane/query pair. */
  get(plane: PlaneDefinition, query: PlaneQuery): PlaneQueryResult | undefined {
    return this.entries.get(createPlaneQueryKey(plane, query));
  }

  /** Stores a query result for the given plane/query pair. */
  set(
    plane: PlaneDefinition,
    query: PlaneQuery,
    result: PlaneQueryResult,
  ): void {
    this.entries.set(createPlaneQueryKey(plane, query), result);
  }

  /** Returns `true` when a cached value exists for the plane/query pair. */
  has(plane: PlaneDefinition, query: PlaneQuery): boolean {
    return this.entries.has(createPlaneQueryKey(plane, query));
  }

  /** Clears all cached query entries. */
  clear(): void {
    this.entries.clear();
  }

  /** Deletes all entries whose key starts with `prefix`. */
  invalidateByPrefix(prefix: string): number {
    let removed = 0;
    for (const key of this.entries.keys()) {
      if (!key.startsWith(prefix)) continue;
      this.entries.delete(key);
      removed += 1;
    }
    return removed;
  }
}

/**
 * Executes a plane query with cache lookup and cache write-through.
 *
 * @param cache Cache instance used for reads and writes.
 * @param plane Plane definition used for the query.
 * @param query Query definition run against the plane.
 * @param execute Function invoked only on cache miss.
 */
export function runCachedPlaneQuery(
  cache: PlaneQueryCache,
  plane: PlaneDefinition,
  query: PlaneQuery,
  execute: () => PlaneQueryResult,
): PlaneQueryResult {
  const cached = cache.get(plane, query);
  if (cached) return cached;
  const result = execute();
  cache.set(plane, query, result);
  return result;
}
