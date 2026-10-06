import { createJsPlaneComputeBackend } from './backends/js-backend.js';
import { resolvePlaneDefinition } from '../plane/plane.js';
import type { PlaneQueryTelemetryGroup } from '../plane/query-spec.js';
import { getPlaneQuerySpec } from '../plane/query-specs/index.js';
import type {
  PlaneComputeBackend,
  PlaneComputeBackendKind,
  PlaneComputeRequest,
  PlaneComputeResponse,
  PlaneComputeScheduleTrace,
  PlaneComputeScheduler,
  PlaneComputeSchedulerOptions,
  PlaneComputeTelemetryBackendStats,
  PlaneComputeTelemetryBucket,
  PlaneComputeTelemetrySnapshot,
} from './types.js';
import { applyComputeTraceMetadata } from './trace-metadata.js';

interface MutableTelemetryBackendStats extends PlaneComputeTelemetryBackendStats {
  lastUpdatedMs: number;
}

interface MutableTelemetryBucket extends PlaneComputeTelemetryBucket {
  backends: Partial<
    Record<PlaneComputeBackendKind, MutableTelemetryBackendStats>
  >;
}

interface SchedulerConfig {
  ewmaAlpha: number;
  maxTelemetryBuckets: number;
}

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  ewmaAlpha: 0.35,
  maxTelemetryBuckets: 120,
};

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function withDefaults(
  options: PlaneComputeSchedulerOptions | undefined,
): SchedulerConfig {
  if (!options) {
    return DEFAULT_SCHEDULER_CONFIG;
  }
  return {
    ewmaAlpha: options.ewmaAlpha ?? DEFAULT_SCHEDULER_CONFIG.ewmaAlpha,
    maxTelemetryBuckets:
      options.maxTelemetryBuckets ??
      DEFAULT_SCHEDULER_CONFIG.maxTelemetryBuckets,
  };
}

function estimateQueryBudget(request: PlaneComputeRequest): number {
  let budget = 0;
  for (const query of request.queries) {
    budget += getPlaneQuerySpec(query.kind).budget(query);
  }
  return Math.max(1, budget);
}

function budgetBucketLabel(budget: number): string {
  if (budget <= 64) return 'xs';
  if (budget <= 256) return 'sm';
  if (budget <= 1024) return 'md';
  if (budget <= 4096) return 'lg';
  return 'xl';
}

const TELEMETRY_GROUPS: readonly PlaneQueryTelemetryGroup[] = [
  'gamutRegion',
  'contrast',
];

function createBucketKey(request: PlaneComputeRequest): string {
  const kinds = [...new Set(request.queries.map((query) => query.kind))]
    .sort()
    .join('+');
  const resolvedPlane = resolvePlaneDefinition(request.plane);
  const signatures = new Map<PlaneQueryTelemetryGroup, Set<string>>();
  for (const query of request.queries) {
    const spec = getPlaneQuerySpec(query.kind);
    if (!spec.telemetryGroup || !spec.telemetrySignature) continue;
    let group = signatures.get(spec.telemetryGroup);
    if (!group) {
      group = new Set();
      signatures.set(spec.telemetryGroup, group);
    }
    group.add(spec.telemetrySignature(query, resolvedPlane));
  }
  const groupKeys = TELEMETRY_GROUPS.map((groupName) => {
    const signature = [...(signatures.get(groupName) ?? [])].sort().join(',');
    return `${groupName}:${signature || 'none'}`;
  });
  const priority = request.priority ?? 'idle';
  const quality = request.quality ?? 'medium';
  const profile = request.performanceProfile ?? 'balanced';
  const budget = budgetBucketLabel(estimateQueryBudget(request));
  return `${kinds}|${groupKeys.join('|')}|priority:${priority}|quality:${quality}|profile:${profile}|budget:${budget}`;
}

function totalTimeMs(response: PlaneComputeResponse): number {
  return response.computeTimeMs + response.marshalTimeMs;
}

function sortBucketsByRecentUse(
  buckets: Map<string, MutableTelemetryBucket>,
): PlaneComputeTelemetryBucket[] {
  return [...buckets.values()]
    .sort(
      (left, right) =>
        (right.backends.js?.lastUpdatedMs ?? 0) -
        (left.backends.js?.lastUpdatedMs ?? 0),
    )
    .map((bucket) => ({
      key: bucket.key,
      totalSamples: bucket.totalSamples,
      lastUsedBackend: bucket.lastUsedBackend,
      backends: {
        js: bucket.backends.js
          ? {
              sampleCount: bucket.backends.js.sampleCount,
              averageTotalMs: bucket.backends.js.averageTotalMs,
              lastTotalMs: bucket.backends.js.lastTotalMs,
            }
          : undefined,
      },
    }));
}

/**
 * Creates a plane compute scheduler that runs requests on the JS backend
 * and records per-workload timing telemetry (EWMA of total time, bucketed
 * by query kinds, workload signature, priority, quality, profile, and
 * estimated budget).
 */
export function createPlaneComputeScheduler({
  backends,
  options,
}: {
  backends?: Partial<Record<PlaneComputeBackendKind, PlaneComputeBackend>>;
  options?: PlaneComputeSchedulerOptions;
} = {}): PlaneComputeScheduler {
  const config = withDefaults(options);
  const backend = backends?.js ?? createJsPlaneComputeBackend();
  const telemetryBuckets = new Map<string, MutableTelemetryBucket>();

  const getOrCreateBucket = (key: string): MutableTelemetryBucket => {
    const existing = telemetryBuckets.get(key);
    if (existing) {
      return existing;
    }
    // Evict before inserting: a new bucket has no samples yet, so it would
    // otherwise sort as the least recently used and evict itself.
    if (telemetryBuckets.size >= config.maxTelemetryBuckets) {
      const oldest = sortBucketsByRecentUse(telemetryBuckets).at(-1);
      if (oldest) {
        telemetryBuckets.delete(oldest.key);
      }
    }
    const created: MutableTelemetryBucket = {
      key,
      totalSamples: 0,
      backends: {},
    };
    telemetryBuckets.set(key, created);
    return created;
  };

  const updateTelemetry = (
    key: string,
    backendKind: PlaneComputeBackendKind,
    totalMs: number,
  ): void => {
    const bucket = getOrCreateBucket(key);
    const timestamp = nowMs();
    const existing = bucket.backends[backendKind];
    if (existing) {
      existing.sampleCount += 1;
      existing.averageTotalMs =
        existing.averageTotalMs * (1 - config.ewmaAlpha) +
        totalMs * config.ewmaAlpha;
      existing.lastTotalMs = totalMs;
      existing.lastUpdatedMs = timestamp;
    } else {
      bucket.backends[backendKind] = {
        sampleCount: 1,
        averageTotalMs: totalMs,
        lastTotalMs: totalMs,
        lastUpdatedMs: timestamp,
      };
    }
    bucket.totalSamples += 1;
    bucket.lastUsedBackend = backendKind;
  };

  const run = (request: PlaneComputeRequest): PlaneComputeResponse => {
    const key = createBucketKey(request);
    const schedule: PlaneComputeScheduleTrace = {
      bucketKey: key,
      selectedBackend: backend.kind,
      reason: 'default-js',
    };
    const response = backend.run(request);
    updateTelemetry(key, response.backend, totalTimeMs(response));
    const debugTrace = response.debugTrace
      ? {
          queries: response.debugTrace.queries.map((trace) =>
            applyComputeTraceMetadata(trace, {
              backend: response.backend,
              schedule,
            }),
          ),
        }
      : undefined;
    return {
      ...response,
      schedule,
      debugTrace,
    };
  };

  const getTelemetrySnapshot = (): PlaneComputeTelemetrySnapshot => ({
    buckets: sortBucketsByRecentUse(telemetryBuckets),
  });

  const resetTelemetry = (): void => {
    telemetryBuckets.clear();
  };

  return {
    run,
    getTelemetrySnapshot,
    resetTelemetry,
  };
}
