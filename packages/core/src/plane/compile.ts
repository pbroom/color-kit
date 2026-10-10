import type {
  PlaneDefinition,
  PlanePoint,
  PlaneQuery,
  PlaneQueryResult,
} from './types.js';
import { resolvePlaneDefinition } from './plane.js';

/** Formatting options for {@link toSvgPath} and {@link toSvgCompoundPath}. */
export interface SvgPathCompileOptions {
  /**
   * Appends `Z` to close each generated path.
   * @defaultValue false
   */
  closeLoop?: boolean;
  /**
   * Decimal places used when formatting each coordinate.
   * @defaultValue 3
   */
  precision?: number;
  /**
   * Multiplier applied to normalized plane coordinates before formatting;
   * `100` maps the plane onto an SVG `viewBox="0 0 100 100"`.
   * @defaultValue 100
   */
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
 * Compiles an ordered list of plane points into an SVG path `d` string.
 *
 * Emits `M x y` for the first point and `L x y` for each following point,
 * with coordinates multiplied by `scale` and fixed to `precision` decimals.
 * Plane `y` maps directly to SVG `y` (both grow downward). Returns `''` when
 * fewer than two points are given.
 *
 * @param points - Ordered points in normalized plane coordinates.
 * @param options - Formatting options; see {@link SvgPathCompileOptions}.
 * @returns The path data string.
 * @see {@link toSvgCompoundPath} for several paths at once.
 *
 * @example
 * ```ts
 * import { toSvgPath } from 'color-kit/plane';
 *
 * const points = [
 *   { x: 0, y: 1 },
 *   { x: 0.5, y: 0.25 },
 *   { x: 1, y: 1 },
 * ];
 * toSvgPath(points); // → 'M 0.000 100.000 L 50.000 25.000 L 100.000 100.000'
 * toSvgPath(points, { scale: 200, precision: 0, closeLoop: true });
 * // → 'M 0 200 L 100 50 L 200 200 Z'
 * ```
 */
export function toSvgPath(
  points: PlanePoint[],
  options: SvgPathCompileOptions = {},
): string {
  return pathForPoints(points, options);
}

/**
 * Compiles several point lists into one compound SVG path `d` string.
 *
 * Each list becomes a subpath formatted as in {@link toSvgPath}; lists with
 * fewer than two points are skipped. Use it for multi-path query output such
 * as a gamut region's `visibleRegion.paths` or a contrast region's `paths`.
 *
 * @param paths - Point lists in normalized plane coordinates.
 * @param options - Formatting options applied to every subpath; see
 * {@link SvgPathCompileOptions}.
 * @returns The path data string, subpaths separated by spaces.
 *
 * @example
 * ```ts
 * import {
 *   definePlane,
 *   getPlaneGamutRegion,
 *   toSvgCompoundPath,
 * } from 'color-kit/plane';
 *
 * const region = getPlaneGamutRegion(definePlane({ fixed: { h: 264 } }));
 * const d = toSvgCompoundPath(region.visibleRegion.paths, { closeLoop: true });
 * // → 'M 50.000 29.736 L … Z' (one closed subpath)
 * ```
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
 * The plane is resolved first and both parts are serialized with sorted
 * object keys, so equivalent definitions (defaults omitted or spelled out,
 * properties in any order) produce the same key. The key starts with the
 * serialized plane, so `PlaneQueryCache.invalidateByPrefix()` can drop every
 * entry for one plane.
 *
 * @param plane - Plane the query runs against; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - Query payload.
 * @returns The key string.
 * @throws {TypeError} When the plane model is not supported.
 * @throws {Error} When the plane definition is otherwise invalid.
 *
 * @example
 * ```ts
 * import { createPlaneQueryKey, definePlane } from 'color-kit/plane';
 *
 * const a = createPlaneQueryKey({ fixed: { h: 264 } }, { kind: 'gamutBoundary' });
 * const b = createPlaneQueryKey(definePlane({ fixed: { h: 264, alpha: 1 } }), {
 *   kind: 'gamutBoundary',
 * });
 * a === b; // → true
 * a.slice(0, 24); // → '{"fixed":{"alpha":1,"c":'
 * ```
 */
export function createPlaneQueryKey(
  plane: PlaneDefinition,
  query: PlaneQuery,
): string {
  return `${stableStringify(resolvePlaneDefinition(plane))}:${stableStringify(query)}`;
}

/** Options for the {@link PlaneQueryCache} constructor. */
export interface PlaneQueryCacheOptions {
  /**
   * Maximum number of cached query results retained. When the cache grows
   * past this bound, least-recently-used entries are evicted first. Values
   * are floored and raised to at least `1`; non-finite values use the default.
   *
   * @defaultValue 128
   */
  maxEntries?: number;
}

/**
 * Default entry bound for {@link PlaneQueryCache}. Cached values hold query
 * geometry (point/path arrays that can reach tens of kilobytes each), so 128
 * entries keeps worst-case retained memory in the low megabytes while still
 * covering typical interactive plane workloads.
 */
const DEFAULT_PLANE_QUERY_CACHE_MAX_ENTRIES = 128;

/**
 * LRU cache of plane query results, keyed by {@link createPlaneQueryKey}.
 *
 * Reads (`get`, `has`) refresh an entry's recency and writes evict the
 * least-recently-used entries once {@link PlaneQueryCacheOptions.maxEntries}
 * is exceeded. Results are stored and returned by reference; treat them as
 * read-only. Pair it with {@link runCachedPlaneQuery}.
 *
 * @example
 * ```ts
 * import { definePlane, PlaneQueryCache, runPlaneQuery } from 'color-kit/plane';
 *
 * const cache = new PlaneQueryCache({ maxEntries: 1 });
 * const plane = definePlane({ fixed: { h: 264 } });
 * const a = { kind: 'gamutBoundary' } as const;
 * const b = { kind: 'chromaBand' } as const;
 * cache.set(plane, a, runPlaneQuery(plane, a));
 * cache.set(plane, b, runPlaneQuery(plane, b)); // evicts `a`
 * cache.has(plane, a); // → false
 * cache.has(plane, b); // → true
 * ```
 */
export class PlaneQueryCache {
  private entries = new Map<string, PlaneQueryResult>();
  private readonly maxEntries: number;

  constructor(options: PlaneQueryCacheOptions = {}) {
    const maxEntries = Math.floor(
      options.maxEntries ?? DEFAULT_PLANE_QUERY_CACHE_MAX_ENTRIES,
    );
    this.maxEntries = Number.isFinite(maxEntries)
      ? Math.max(1, maxEntries)
      : DEFAULT_PLANE_QUERY_CACHE_MAX_ENTRIES;
  }

  /** Gets a cached query result for the given plane/query pair. */
  get(plane: PlaneDefinition, query: PlaneQuery): PlaneQueryResult | undefined {
    const key = createPlaneQueryKey(plane, query);
    const cached = this.entries.get(key);
    if (cached === undefined) return undefined;
    // Re-insert on hit so Map iteration order tracks least-recently-used.
    this.entries.delete(key);
    this.entries.set(key, cached);
    return cached;
  }

  /** Stores a query result for the given plane/query pair. */
  set(
    plane: PlaneDefinition,
    query: PlaneQuery,
    result: PlaneQueryResult,
  ): void {
    const key = createPlaneQueryKey(plane, query);
    this.entries.delete(key);
    this.entries.set(key, result);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /** Returns `true` when a cached value exists for the plane/query pair. */
  has(plane: PlaneDefinition, query: PlaneQuery): boolean {
    return this.get(plane, query) !== undefined;
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
 * Returns the cached result for a plane/query pair, or runs `execute` and
 * caches what it returns.
 *
 * `execute` is called only on a cache miss; it is not checked against
 * `query`, so it must compute the result for that same plane and query.
 *
 * @param cache - Cache to read from and write to.
 * @param plane - Plane the query runs against; a {@link Plane} or any
 * {@link PlaneDefinition}.
 * @param query - Query payload, used for the cache key.
 * @param execute - Computes the result on a miss (for example
 * `() => runPlaneQuery(plane, query)`).
 * @returns The cached or freshly computed result (same reference on a hit).
 *
 * @example
 * ```ts
 * import {
 *   definePlane,
 *   getPlaneGamutBoundary,
 *   PlaneQueryCache,
 *   runCachedPlaneQuery,
 * } from 'color-kit/plane';
 *
 * const cache = new PlaneQueryCache({ maxEntries: 32 });
 * const plane = definePlane({ fixed: { h: 264 } });
 * const query = { kind: 'gamutBoundary' } as const;
 * const first = runCachedPlaneQuery(cache, plane, query, () =>
 *   getPlaneGamutBoundary(plane),
 * );
 * const second = runCachedPlaneQuery(cache, plane, query, () =>
 *   getPlaneGamutBoundary(plane),
 * );
 * first === second; // → true (execute ran once)
 * ```
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
