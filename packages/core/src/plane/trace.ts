import type {
  PlaneComputeBackendKind,
  PlaneComputeScheduleTrace,
} from '../compute/types.js';
import type {
  PlanePoint,
  PlaneQuery,
  PlaneQueryInspection,
  PlaneQueryResult,
  PlaneQueryTrace,
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

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function createPlaneTraceContext(
  query: PlaneQuery,
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
      queryKind: query.kind,
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
    startedAtMs: nowMs(),
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
  key: NonNullable<PlaneQueryTraceSummary['timings']> extends Partial<
    Record<infer TimingKey, number>
  >
    ? TimingKey & string
    : never,
  durationMs: number,
): void {
  if (!trace || !Number.isFinite(durationMs)) return;
  trace.summary.timings ??= {};
  trace.summary.timings[key] = (trace.summary.timings[key] ?? 0) + durationMs;
}

export function measureTraceTiming<T>(
  trace: InternalPlaneTraceContext | null | undefined,
  key: NonNullable<PlaneQueryTraceSummary['timings']> extends Partial<
    Record<infer TimingKey, number>
  >
    ? TimingKey & string
    : never,
  fn: () => T,
): T {
  if (!trace) return fn();
  const startedAtMs = nowMs();
  const result = fn();
  addTraceTiming(trace, key, nowMs() - startedAtMs);
  return result;
}

function countPlanePaths(paths: PlanePoint[][]): {
  pathCount: number;
  pointCount: number;
} {
  return {
    pathCount: paths.length,
    pointCount: paths.reduce((total, path) => total + path.length, 0),
  };
}

export function summarizeTracePaths(
  trace: InternalPlaneTraceContext | null | undefined,
  paths: PlanePoint[][],
): void {
  if (!trace) return;
  const { pathCount, pointCount } = countPlanePaths(paths);
  trace.summary.pathCount += pathCount;
  trace.summary.pointCount += pointCount;
}

function countResultGeometry(result: PlaneQueryResult): {
  pathCount: number;
  pointCount: number;
} {
  switch (result.kind) {
    case 'gamutBoundary':
    case 'chromaBand':
    case 'gradient':
      return {
        pathCount: result.points.length > 0 ? 1 : 0,
        pointCount: result.points.length,
      };
    case 'gamutRegion': {
      const boundary = countPlanePaths(result.boundaryPaths);
      const visible = countPlanePaths(result.visibleRegion.paths);
      return {
        pathCount: boundary.pathCount + visible.pathCount,
        pointCount: boundary.pointCount + visible.pointCount,
      };
    }
    case 'contrastBoundary':
      return {
        pathCount: result.points.length > 0 ? 1 : 0,
        pointCount: result.points.length,
      };
    case 'contrastRegion': {
      const counts = countPlanePaths(result.paths);
      return { pathCount: counts.pathCount, pointCount: counts.pointCount };
    }
    case 'fallbackPoint':
      return { pathCount: 1, pointCount: 1 };
    default: {
      const exhaustiveCheck: never = result;
      throw new Error(`Unhandled trace result kind: ${exhaustiveCheck}`);
    }
  }
}

export function finalizePlaneTrace<Result extends PlaneQueryResult>(
  trace: InternalPlaneTraceContext,
  result: Result,
): PlaneQueryInspection<Result> {
  const geometry = countResultGeometry(result);
  trace.summary.resultPathCount = geometry.pathCount;
  trace.summary.resultPointCount = geometry.pointCount;
  trace.summary.totalTimeMs = nowMs() - trace.startedAtMs;

  if (shouldTraceStages(trace)) {
    trace.stages.push({
      kind: 'metrics',
      summary: {
        sampleCount: trace.summary.sampleCount,
        scalarEvaluationCount: trace.summary.scalarEvaluationCount,
        cellCount: trace.summary.cellCount,
        segmentCount: trace.summary.segmentCount,
        pathCount: trace.summary.pathCount,
        pointCount: trace.summary.pointCount,
        resultPathCount: trace.summary.resultPathCount,
        resultPointCount: trace.summary.resultPointCount,
      },
    });
  }

  return {
    result,
    trace: {
      summary: trace.summary,
      stages: trace.stages,
    },
  };
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

export function applyComputeTraceMetadata(
  trace: PlaneQueryTrace,
  metadata: {
    backend: PlaneComputeBackendKind;
    computeTimeMs?: number;
    marshalTimeMs?: number;
    schedule?: PlaneComputeScheduleTrace;
  },
): PlaneQueryTrace {
  trace.summary.backend = metadata.backend;
  if (metadata.computeTimeMs != null) {
    trace.summary.timings ??= {};
    trace.summary.timings.compute = metadata.computeTimeMs;
  }
  if (metadata.marshalTimeMs != null) {
    trace.summary.timings ??= {};
    trace.summary.timings.marshal = metadata.marshalTimeMs;
  }
  if (metadata.schedule) {
    trace.summary.bucketKey = metadata.schedule.bucketKey;
    trace.summary.scheduleReason = metadata.schedule.reason;
  }
  return trace;
}
