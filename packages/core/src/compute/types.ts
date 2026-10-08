import type { PackedPlaneQueryResult } from '../plane/packed-abi.js';
import type {
  PlaneDefinition,
  PlaneQuery,
  PlaneQueryResult,
  PlaneQueryTrace,
  PlaneQueryTraceOptions,
} from '../plane/types.js';
import type {
  PlaneComputeBackendKind,
  PlaneComputeScheduleReason,
} from '../trace/types.js';

export type {
  PlaneComputeBackendKind,
  PlaneComputeScheduleReason,
} from '../trace/types.js';
export type {
  PackedPlaneQueryDescriptor,
  PackedPlaneQueryResult,
} from '../plane/packed-abi.js';
/**
 * Caller's urgency hint: `'drag'` for interactive updates, `'idle'` for
 * settled renders. Currently only separates telemetry buckets.
 */
export type PlaneComputePriority = 'drag' | 'idle';
/** Caller's requested quality tier. Currently only separates telemetry buckets. */
export type PlaneComputeQuality = 'high' | 'medium' | 'low';
/** Caller's performance/quality trade-off profile. Currently only separates telemetry buckets. */
export type PlaneComputePerformanceProfile =
  | 'auto'
  | 'quality'
  | 'balanced'
  | 'performance';

/** A batch of plane queries to run against one plane. */
export interface PlaneComputeRequest {
  /** Plane every query runs on. */
  plane: PlaneDefinition;
  /** Queries to run, in order; results keep this order. */
  queries: PlaneQuery[];
  /**
   * Urgency hint. Does not change results; the scheduler files telemetry
   * under it.
   * @defaultValue `'idle'`
   */
  priority?: PlaneComputePriority;
  /**
   * Quality hint. Does not change results; the scheduler files telemetry
   * under it.
   * @defaultValue `'medium'`
   */
  quality?: PlaneComputeQuality;
  /**
   * Profile hint. Does not change results; the scheduler files telemetry
   * under it.
   * @defaultValue `'balanced'`
   */
  performanceProfile?: PlaneComputePerformanceProfile;
  /**
   * When set, each query is traced and the response carries `debugTrace`.
   * Omit for the fast path.
   */
  trace?: PlaneQueryTraceOptions;
}

/** How a scheduler routed one request. */
export interface PlaneComputeScheduleTrace {
  /**
   * Telemetry bucket key: query kinds, gamut/contrast workload signatures,
   * priority, quality, profile and an estimated budget size, joined with `|`.
   */
  bucketKey: string;
  /** Backend the request ran on. */
  selectedBackend: PlaneComputeBackendKind;
  /** Why that backend was chosen. */
  reason: PlaneComputeScheduleReason;
}

/** Output of running a {@link PlaneComputeRequest}. */
export interface PlaneComputeResponse {
  /** Backend that ran the request. */
  backend: PlaneComputeBackendKind;
  /** Wall-clock time spent solving queries, in milliseconds. Non-deterministic. */
  computeTimeMs: number;
  /** Wall-clock time spent packing results, in milliseconds. Non-deterministic. */
  marshalTimeMs: number;
  /** All query results packed into typed arrays; decode with {@link unpackPlaneQueryResults}. */
  result: PackedPlaneQueryResult;
  /** Routing details; set only by a scheduler. */
  schedule?: PlaneComputeScheduleTrace;
  /** Per-query traces; set only when the request has `trace`. */
  debugTrace?: PlaneComputeDebugTrace;
}

/** Something that can execute plane compute requests synchronously. */
export interface PlaneComputeBackend {
  /** Backend identifier. */
  kind: PlaneComputeBackendKind;
  /** Runs every query in the request and returns packed results. */
  run: (request: PlaneComputeRequest) => PlaneComputeResponse;
}

/** Packed results alongside the raw results they were packed from. */
export interface PlaneComputePackResult {
  packed: PackedPlaneQueryResult;
  raw: PlaneQueryResult[];
}

/** Traces for a traced compute request. */
export interface PlaneComputeDebugTrace {
  /**
   * One trace per query, in request order. Each summary carries `backend`,
   * and `timings.compute` / `timings.marshal` (the batch durations split
   * across queries); scheduled runs also add `bucketKey` and `scheduleReason`.
   */
  queries: PlaneQueryTrace[];
}

/** Telemetry settings for {@link createPlaneComputeScheduler}. */
export interface PlaneComputeSchedulerOptions {
  /**
   * Weight of the newest sample in each bucket's exponentially weighted
   * moving average of total time (`0`–`1`; higher reacts faster).
   * @defaultValue 0.35
   */
  ewmaAlpha?: number;
  /**
   * Maximum telemetry buckets kept; the least recently used is evicted.
   * `0` disables telemetry.
   * @defaultValue 120
   */
  maxTelemetryBuckets?: number;
}

/**
 * Timing statistics for one backend within a telemetry bucket. "Total" time is
 * `computeTimeMs + marshalTimeMs` of a run.
 */
export interface PlaneComputeTelemetryBackendStats {
  /** Runs recorded for this backend in the bucket. */
  sampleCount: number;
  /**
   * Exponentially weighted moving average of total time in milliseconds
   * (weight `ewmaAlpha` on the newest run; the first run seeds it).
   */
  averageTotalMs: number;
  /** Total time of the most recent run, in milliseconds. */
  lastTotalMs: number;
}

/**
 * Telemetry for one workload shape: all scheduled requests whose
 * `schedule.bucketKey` matches.
 */
export interface PlaneComputeTelemetryBucket {
  /** Bucket key (same as the response's `schedule.bucketKey`). */
  key: string;
  /** Runs recorded in this bucket across all backends. */
  totalSamples: number;
  /** Backend of the most recent run. */
  lastUsedBackend?: PlaneComputeBackendKind;
  /** Per-backend timing stats; only backends that have run appear. */
  backends: Partial<
    Record<PlaneComputeBackendKind, PlaneComputeTelemetryBackendStats>
  >;
}

/** Point-in-time copy of a scheduler's telemetry. */
export interface PlaneComputeTelemetrySnapshot {
  /** Buckets, most recently used first. Empty after a reset or when telemetry is disabled. */
  buckets: PlaneComputeTelemetryBucket[];
}

/** Routes compute requests to a backend and records timing telemetry. */
export interface PlaneComputeScheduler {
  /** Runs a request and records its total time; the response includes `schedule`. */
  run: (request: PlaneComputeRequest) => PlaneComputeResponse;
  /** Returns a copy of the current telemetry. */
  getTelemetrySnapshot: () => PlaneComputeTelemetrySnapshot;
  /** Discards all telemetry buckets. */
  resetTelemetry: () => void;
}
