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

export function createPlaneTraceContext(
  query: PlaneQuery,
  options?: PlaneQueryTraceOptions,
): InternalPlaneTraceContext {
  return createTraceContext(query.kind, options);
}

export function countResultGeometry(
  result: PlaneQueryResult,
): PlaneQueryGeometryCount {
  return getPlaneQuerySpec(result.kind).countGeometry(result);
}

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
