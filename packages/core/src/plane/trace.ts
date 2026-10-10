import {
  createTraceContext,
  shouldTraceStages,
  traceNowMs,
  type InternalPlaneTraceContext,
} from '../trace/context.js';
import type { PlaneQueryGeometryCount } from './query-spec.js';
import { getPlaneQuerySpec } from './query-specs/index.js';
import type {
  PlaneQuery,
  PlaneQueryInspection,
  PlaneQueryResult,
  PlaneQueryTraceOptions,
} from './types.js';

/**
 * Creates the mutable trace context that collects one query's
 * `PlaneQueryTrace` while it runs. Used by `inspectPlaneQuery`; not part of
 * the public API.
 */
export function createPlaneTraceContext(
  query: PlaneQuery,
  options?: PlaneQueryTraceOptions,
): InternalPlaneTraceContext {
  return createTraceContext(query.kind, options);
}

/**
 * Counts the paths and points a query result carries, using the kind's query
 * spec. Feeds `resultPathCount` / `resultPointCount` in the trace summary.
 */
export function countResultGeometry(
  result: PlaneQueryResult,
): PlaneQueryGeometryCount {
  return getPlaneQuerySpec(result.kind).countGeometry(result);
}

/**
 * Completes a trace once its query has produced `result`: records the result
 * geometry counts and total time, appends the closing `metrics` stage (at
 * `'stages'` and `'full'` levels) and pairs the trace with the result.
 */
export function finalizePlaneTrace<Result extends PlaneQueryResult>(
  trace: InternalPlaneTraceContext,
  result: Result,
): PlaneQueryInspection<Result> {
  const geometry = countResultGeometry(result);
  trace.summary.resultPathCount = geometry.pathCount;
  trace.summary.resultPointCount = geometry.pointCount;
  trace.summary.totalTimeMs = traceNowMs() - trace.startedAtMs;

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
