import type { PlaneQueryTrace } from '../trace/types.js';
import type {
  PlaneComputeBackendKind,
  PlaneComputeScheduleTrace,
} from './types.js';

/**
 * Returns a traced query copy with backend/scheduler metadata merged in.
 *
 * The scheduler and backend may decorate the same logical trace at different
 * layers, so this helper must stay non-mutating to avoid aliasing surprises.
 */
export function applyComputeTraceMetadata(
  trace: PlaneQueryTrace,
  metadata: {
    backend: PlaneComputeBackendKind;
    computeTimeMs?: number;
    marshalTimeMs?: number;
    schedule?: PlaneComputeScheduleTrace;
  },
): PlaneQueryTrace {
  const timings =
    metadata.computeTimeMs != null || metadata.marshalTimeMs != null
      ? {
          ...(trace.summary.timings ?? {}),
          ...(metadata.computeTimeMs != null
            ? { compute: metadata.computeTimeMs }
            : {}),
          ...(metadata.marshalTimeMs != null
            ? { marshal: metadata.marshalTimeMs }
            : {}),
        }
      : trace.summary.timings;

  return {
    ...trace,
    summary: {
      ...trace.summary,
      backend: metadata.backend,
      ...(timings ? { timings } : {}),
      ...(metadata.schedule
        ? {
            bucketKey: metadata.schedule.bucketKey,
            scheduleReason: metadata.schedule.reason,
          }
        : {}),
    },
  };
}
