import type { PlanePoint } from '../geometry/types.js';
import type {
  PlaneQueryKind,
  PlaneQueryTraceLevel,
  PlaneQueryTraceOptions,
  PlaneQueryTraceStage,
  PlaneQueryTraceSummary,
} from './types.js';

interface ResolvedTraceOptions {
  level: PlaneQueryTraceLevel;
  maxStageEntries: number;
  includeScalarGrid: boolean;
}

export interface InternalPlaneTraceContext {
  options: ResolvedTraceOptions;
  summary: PlaneQueryTraceSummary;
  stages: PlaneQueryTraceStage[];
  startedAtMs: number;
}

type TraceTimingKey =
  NonNullable<PlaneQueryTraceSummary['timings']> extends Partial<
    Record<infer TimingKey, number>
  >
    ? TimingKey & string
    : never;

export function traceNowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/**
 * Creates a mutable trace context for one query of the given kind.
 */
export function createTraceContext(
  queryKind: PlaneQueryKind,
  options?: PlaneQueryTraceOptions,
): InternalPlaneTraceContext {
  const level = options?.level ?? 'stages';
  const resolvedOptions: ResolvedTraceOptions = {
    level,
    maxStageEntries: Math.max(
      8,
      Math.min(512, Math.floor(options?.maxStageEntries ?? 128)),
    ),
    includeScalarGrid: options?.includeScalarGrid ?? level === 'full',
  };

  return {
    options: resolvedOptions,
    summary: {
      queryKind,
      level,
      totalTimeMs: 0,
      sampleCount: 0,
      scalarEvaluationCount: 0,
      cellCount: 0,
      segmentCount: 0,
      pathCount: 0,
      pointCount: 0,
      resultPathCount: 0,
      resultPointCount: 0,
    },
    stages: [],
    startedAtMs: traceNowMs(),
  };
}

export function shouldTraceStages(
  trace: InternalPlaneTraceContext | null | undefined,
): trace is InternalPlaneTraceContext {
  return !!trace && trace.options.level !== 'summary';
}

export function shouldTraceFull(
  trace: InternalPlaneTraceContext | null | undefined,
): trace is InternalPlaneTraceContext {
  return !!trace && trace.options.level === 'full';
}

export function shouldTraceScalarGrid(
  trace: InternalPlaneTraceContext | null | undefined,
): trace is InternalPlaneTraceContext {
  return !!trace && trace.options.includeScalarGrid;
}

export function recordTraceStage(
  trace: InternalPlaneTraceContext | null | undefined,
  stage: PlaneQueryTraceStage,
): void {
  if (!shouldTraceStages(trace)) return;
  trace.stages.push(stage);
}

export function setTraceSummaryField<Key extends keyof PlaneQueryTraceSummary>(
  trace: InternalPlaneTraceContext | null | undefined,
  key: Key,
  value: PlaneQueryTraceSummary[Key],
): void {
  if (!trace) return;
  trace.summary[key] = value;
}

export function incrementTraceSummary(
  trace: InternalPlaneTraceContext | null | undefined,
  key:
    | 'sampleCount'
    | 'scalarEvaluationCount'
    | 'cellCount'
    | 'segmentCount'
    | 'pathCount'
    | 'pointCount',
  amount: number,
): void {
  if (!trace || !Number.isFinite(amount)) return;
  trace.summary[key] += amount;
}

export function addTraceTiming(
  trace: InternalPlaneTraceContext | null | undefined,
  key: TraceTimingKey,
  durationMs: number,
): void {
  if (!trace || !Number.isFinite(durationMs)) return;
  trace.summary.timings ??= {};
  trace.summary.timings[key] = (trace.summary.timings[key] ?? 0) + durationMs;
}

export function measureTraceTiming<T>(
  trace: InternalPlaneTraceContext | null | undefined,
  key: TraceTimingKey,
  fn: () => T,
): T {
  if (!trace) return fn();
  const startedAtMs = traceNowMs();
  const result = fn();
  addTraceTiming(trace, key, traceNowMs() - startedAtMs);
  return result;
}

export function limitTraceEntries<T>(
  trace: InternalPlaneTraceContext | null | undefined,
  values: T[],
): T[] | undefined {
  if (!shouldTraceStages(trace)) return undefined;
  return values.slice(0, trace.options.maxStageEntries);
}

export function limitTracePaths(
  trace: InternalPlaneTraceContext | null | undefined,
  paths: PlanePoint[][],
): PlanePoint[][] | undefined {
  if (!shouldTraceStages(trace)) return undefined;
  return paths
    .slice(0, trace.options.maxStageEntries)
    .map((path) => path.slice(0, trace.options.maxStageEntries));
}
