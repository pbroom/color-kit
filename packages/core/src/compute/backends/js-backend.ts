import { resolvePlaneDefinition } from '../../plane/plane.js';
import { inspectPlaneQueries, runPlaneQueries } from '../../plane/query.js';
import { applyComputeTraceMetadata } from '../../plane/trace.js';
import { packPlaneQueryResults } from '../pack.js';
import type { PlaneComputeBackend } from '../types.js';

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function distributeBatchDuration(totalMs: number, weights: number[]): number[] {
  if (weights.length === 0) {
    return [];
  }

  const safeTotalMs = Number.isFinite(totalMs) ? Math.max(0, totalMs) : 0;
  const normalizedWeights = weights.map((weight) =>
    Number.isFinite(weight) && weight > 0 ? weight : 0,
  );
  const totalWeight = normalizedWeights.reduce(
    (sum, weight) => sum + weight,
    0,
  );

  if (totalWeight <= 0) {
    const evenShare = safeTotalMs / normalizedWeights.length;
    return normalizedWeights.map((_, index) =>
      index === normalizedWeights.length - 1
        ? Math.max(0, safeTotalMs - evenShare * index)
        : evenShare,
    );
  }

  let assignedMs = 0;
  return normalizedWeights.map((weight, index) => {
    if (index === normalizedWeights.length - 1) {
      return Math.max(0, safeTotalMs - assignedMs);
    }
    const share = (weight / totalWeight) * safeTotalMs;
    assignedMs += share;
    return share;
  });
}

export function createJsPlaneComputeBackend(): PlaneComputeBackend {
  return {
    kind: 'js',
    run(request) {
      const resolvedPlane = resolvePlaneDefinition(request.plane);

      const computeStart = nowMs();
      const inspected = request.trace
        ? inspectPlaneQueries(resolvedPlane, request.queries, request.trace)
        : null;
      const raw = inspected
        ? inspected.map((inspection) => inspection.result)
        : runPlaneQueries(resolvedPlane, request.queries);
      const computeEnd = nowMs();

      const marshalStart = nowMs();
      const result = packPlaneQueryResults(raw);
      const marshalEnd = nowMs();
      const computeTimeMs = computeEnd - computeStart;
      const marshalTimeMs = marshalEnd - marshalStart;
      const debugTrace = inspected
        ? (() => {
            const perQueryComputeTimeMs = distributeBatchDuration(
              computeTimeMs,
              inspected.map(
                (inspection) => inspection.trace.summary.totalTimeMs,
              ),
            );
            const perQueryMarshalTimeMs = distributeBatchDuration(
              marshalTimeMs,
              inspected.map((inspection) =>
                Math.max(
                  1,
                  inspection.trace.summary.resultPointCount +
                    inspection.trace.summary.resultPathCount,
                ),
              ),
            );
            return {
              queries: inspected.map((inspection, index) =>
                applyComputeTraceMetadata(inspection.trace, {
                  backend: 'js',
                  computeTimeMs: perQueryComputeTimeMs[index],
                  marshalTimeMs: perQueryMarshalTimeMs[index],
                }),
              ),
            };
          })()
        : undefined;

      return {
        backend: 'js',
        computeTimeMs,
        marshalTimeMs,
        result,
        debugTrace,
      };
    },
  };
}
