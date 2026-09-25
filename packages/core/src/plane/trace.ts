import {
  createTraceContext,
  shouldTraceStages,
  traceNowMs,
  type InternalPlaneTraceContext,
} from '../trace/context.js';
import type {
  PlanePoint,
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

function countPlanePaths(paths: PlanePoint[][]): {
  pathCount: number;
  pointCount: number;
} {
  return {
    pathCount: paths.length,
    pointCount: paths.reduce((total, path) => total + path.length, 0),
  };
}

export function countResultGeometry(result: PlaneQueryResult): {
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
