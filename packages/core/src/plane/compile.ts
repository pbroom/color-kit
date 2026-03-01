import type {
  PlaneDefinition,
  PlanePoint,
  PlaneQuery,
  PlaneQueryResult,
} from './types.js';

export interface SvgPathCompileOptions {
  closeLoop?: boolean;
  precision?: number;
  scale?: number;
}

function format(value: number, precision: number): string {
  return value.toFixed(precision);
}

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

export function toSvgPath(
  points: PlanePoint[],
  options: SvgPathCompileOptions = {},
): string {
  return pathForPoints(points, options);
}

export function toSvgCompoundPath(
  paths: PlanePoint[][],
  options: SvgPathCompileOptions = {},
): string {
  return paths
    .map((path) => pathForPoints(path, options))
    .filter((path) => path.length > 0)
    .join(' ');
}

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

export function createPlaneQueryKey(
  plane: PlaneDefinition,
  query: PlaneQuery,
): string {
  return `${stableStringify(plane)}:${stableStringify(query)}`;
}

export class PlaneQueryCache {
  private entries = new Map<string, PlaneQueryResult>();

  get(plane: PlaneDefinition, query: PlaneQuery): PlaneQueryResult | undefined {
    return this.entries.get(createPlaneQueryKey(plane, query));
  }

  set(
    plane: PlaneDefinition,
    query: PlaneQuery,
    result: PlaneQueryResult,
  ): void {
    this.entries.set(createPlaneQueryKey(plane, query), result);
  }

  has(plane: PlaneDefinition, query: PlaneQuery): boolean {
    return this.entries.has(createPlaneQueryKey(plane, query));
  }

  clear(): void {
    this.entries.clear();
  }

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
