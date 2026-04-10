import { createJsPlaneComputeBackend } from './backends/js-backend.js';
import { applyComputeTraceMetadata } from '../plane/trace.js';
import type {
  PlaneComputeBackend,
  PlaneComputeBackendKind,
  PlaneComputeCircuitBreakerState,
  PlaneComputeRequest,
  PlaneComputeResponse,
  PlaneComputeScheduleTrace,
  PlaneComputeScheduler,
  PlaneComputeSchedulerOptions,
  PlaneComputeTelemetryBackendStats,
  PlaneComputeTelemetryBucket,
  PlaneComputeTelemetrySnapshot,
} from './types.js';

interface MutableTelemetryBackendStats extends PlaneComputeTelemetryBackendStats {
  lastUpdatedMs: number;
}

interface MutableTelemetryBucket extends PlaneComputeTelemetryBucket {
  backends: Partial<
    Record<PlaneComputeBackendKind, MutableTelemetryBackendStats>
  >;
}

interface SchedulerConfig {
  preferredBackends: PlaneComputeBackendKind[];
  minSamplesForDecision: number;
  warmupSamples: number;
  baselineProbeInterval: number;
  ewmaAlpha: number;
  dragRegressionRatio: number;
  idleRegressionRatio: number;
  hysteresisTrips: number;
  circuitBreakerCooldownMs: number;
  backendErrorTripCount: number;
  maxTelemetryBuckets: number;
}

interface SchedulerDecision {
  backend: PlaneComputeBackend;
  trace: PlaneComputeScheduleTrace;
}

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  preferredBackends: ['wasm', 'webgpu', 'js'],
  minSamplesForDecision: 4,
  warmupSamples: 2,
  baselineProbeInterval: 8,
  ewmaAlpha: 0.35,
  dragRegressionRatio: 1.12,
  idleRegressionRatio: 1.28,
  hysteresisTrips: 3,
  circuitBreakerCooldownMs: 15_000,
  backendErrorTripCount: 2,
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
    preferredBackends:
      options.preferredBackends ?? DEFAULT_SCHEDULER_CONFIG.preferredBackends,
    minSamplesForDecision:
      options.minSamplesForDecision ??
      DEFAULT_SCHEDULER_CONFIG.minSamplesForDecision,
    warmupSamples:
      options.warmupSamples ?? DEFAULT_SCHEDULER_CONFIG.warmupSamples,
    baselineProbeInterval:
      options.baselineProbeInterval ??
      DEFAULT_SCHEDULER_CONFIG.baselineProbeInterval,
    ewmaAlpha: options.ewmaAlpha ?? DEFAULT_SCHEDULER_CONFIG.ewmaAlpha,
    dragRegressionRatio:
      options.dragRegressionRatio ??
      DEFAULT_SCHEDULER_CONFIG.dragRegressionRatio,
    idleRegressionRatio:
      options.idleRegressionRatio ??
      DEFAULT_SCHEDULER_CONFIG.idleRegressionRatio,
    hysteresisTrips:
      options.hysteresisTrips ?? DEFAULT_SCHEDULER_CONFIG.hysteresisTrips,
    circuitBreakerCooldownMs:
      options.circuitBreakerCooldownMs ??
      DEFAULT_SCHEDULER_CONFIG.circuitBreakerCooldownMs,
    backendErrorTripCount:
      options.backendErrorTripCount ??
      DEFAULT_SCHEDULER_CONFIG.backendErrorTripCount,
    maxTelemetryBuckets:
      options.maxTelemetryBuckets ??
      DEFAULT_SCHEDULER_CONFIG.maxTelemetryBuckets,
  };
}

function estimateQueryBudget(request: PlaneComputeRequest): number {
  let budget = 0;
  for (const query of request.queries) {
    switch (query.kind) {
      case 'gamutBoundary':
      case 'chromaBand':
      case 'gradient': {
        budget += query.steps ?? 48;
        break;
      }
      case 'gamutRegion': {
        budget += query.scope === 'full' ? 6144 : 4096;
        break;
      }
      case 'contrastBoundary':
      case 'contrastRegion': {
        const samplingMode = query.samplingMode ?? 'hybrid';
        if (samplingMode === 'uniform') {
          const lightness = query.lightnessSteps ?? 64;
          const chroma = query.chromaSteps ?? 64;
          budget += lightness * chroma;
          break;
        }
        if (samplingMode === 'adaptive') {
          const base = Math.max(8, query.adaptiveBaseSteps ?? 16);
          const depth = Math.max(0, query.adaptiveMaxDepth ?? 3);
          const refinementFactor = 1 + depth * 0.85;
          budget += Math.round(base * base * refinementFactor);
          break;
        }
        const lightness = query.lightnessSteps ?? 72;
        const chromaBrackets = query.chromaSteps ?? 96;
        const depth = Math.max(0, query.hybridMaxDepth ?? 7);
        const errorTolerance =
          query.hybridErrorTolerance != null && query.hybridErrorTolerance > 0
            ? query.hybridErrorTolerance
            : 0.0015;
        const precisionFactor = Math.min(
          3.2,
          Math.max(1, 0.0015 / errorTolerance),
        );
        const metricFactor = query.metric === 'apca' ? 1.12 : 1;
        budget += Math.round(
          lightness *
            Math.sqrt(chromaBrackets) *
            (1 + depth * 0.24) *
            precisionFactor *
            metricFactor,
        );
        break;
      }
      case 'fallbackPoint': {
        budget += 1;
        break;
      }
      default: {
        const exhaustiveCheck: never = query;
        throw new Error(`Unhandled plane query kind: ${exhaustiveCheck}`);
      }
    }
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

function createBucketKey(request: PlaneComputeRequest): string {
  const kinds = [...new Set(request.queries.map((query) => query.kind))]
    .sort()
    .join('+');
  const gamutRegionSignature = [
    ...new Set(
      request.queries
        .filter(
          (
            query,
          ): query is Extract<
            PlaneComputeRequest['queries'][number],
            { kind: 'gamutRegion' }
          > => query.kind === 'gamutRegion',
        )
        .map((query) => `${query.scope ?? 'viewport'}`),
    ),
  ]
    .sort()
    .join(',');
  const contrastSignature = [
    ...new Set(
      request.queries
        .filter(
          (
            query,
          ): query is Extract<
            PlaneComputeRequest['queries'][number],
            { kind: 'contrastBoundary' | 'contrastRegion' }
          > =>
            query.kind === 'contrastBoundary' ||
            query.kind === 'contrastRegion',
        )
        .map((query) => {
          const metric = query.metric ?? 'wcag';
          const samplingMode = query.samplingMode ?? 'hybrid';
          if (metric !== 'apca') {
            return `${metric}:${samplingMode}`;
          }
          return `${metric}:${samplingMode}:${query.apcaPolarity ?? 'absolute'}:${query.apcaRole ?? 'sample-text'}`;
        }),
    ),
  ]
    .sort()
    .join(',');
  const priority = request.priority ?? 'idle';
  const quality = request.quality ?? 'medium';
  const profile = request.performanceProfile ?? 'balanced';
  const budget = budgetBucketLabel(estimateQueryBudget(request));
  return `${kinds}|gamutRegion:${gamutRegionSignature || 'none'}|contrast:${contrastSignature || 'none'}|priority:${priority}|quality:${quality}|profile:${profile}|budget:${budget}`;
}

function totalTimeMs(response: PlaneComputeResponse): number {
  return response.computeTimeMs + response.marshalTimeMs;
}

function cloneCircuitBreakers(
  circuitBreakers: Partial<
    Record<PlaneComputeBackendKind, PlaneComputeCircuitBreakerState>
  >,
): PlaneComputeTelemetrySnapshot['circuitBreakers'] {
  return {
    js: circuitBreakers.js ? { ...circuitBreakers.js } : undefined,
    wasm: circuitBreakers.wasm ? { ...circuitBreakers.wasm } : undefined,
    webgpu: circuitBreakers.webgpu ? { ...circuitBreakers.webgpu } : undefined,
  };
}

function sortBucketsByRecentUse(
  buckets: Map<string, MutableTelemetryBucket>,
): PlaneComputeTelemetryBucket[] {
  return [...buckets.values()]
    .sort((left, right) => {
      const leftLast = Math.max(
        left.backends.js?.lastUpdatedMs ?? 0,
        left.backends.wasm?.lastUpdatedMs ?? 0,
        left.backends.webgpu?.lastUpdatedMs ?? 0,
      );
      const rightLast = Math.max(
        right.backends.js?.lastUpdatedMs ?? 0,
        right.backends.wasm?.lastUpdatedMs ?? 0,
        right.backends.webgpu?.lastUpdatedMs ?? 0,
      );
      return rightLast - leftLast;
    })
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
        wasm: bucket.backends.wasm
          ? {
              sampleCount: bucket.backends.wasm.sampleCount,
              averageTotalMs: bucket.backends.wasm.averageTotalMs,
              lastTotalMs: bucket.backends.wasm.lastTotalMs,
            }
          : undefined,
        webgpu: bucket.backends.webgpu
          ? {
              sampleCount: bucket.backends.webgpu.sampleCount,
              averageTotalMs: bucket.backends.webgpu.averageTotalMs,
              lastTotalMs: bucket.backends.webgpu.lastTotalMs,
            }
          : undefined,
      },
    }));
}

export function createPlaneComputeScheduler({
  backends,
  options,
}: {
  backends?: Partial<Record<PlaneComputeBackendKind, PlaneComputeBackend>>;
  options?: PlaneComputeSchedulerOptions;
} = {}): PlaneComputeScheduler {
  const config = withDefaults(options);
  const backendMap: Partial<
    Record<PlaneComputeBackendKind, PlaneComputeBackend>
  > = {
    js: backends?.js ?? createJsPlaneComputeBackend(),
    wasm: backends?.wasm,
    webgpu: backends?.webgpu,
  };
  const telemetryBuckets = new Map<string, MutableTelemetryBucket>();
  const circuitBreakers: Partial<
    Record<PlaneComputeBackendKind, PlaneComputeCircuitBreakerState>
  > = {
    wasm: {
      disabledUntilMs: 0,
      regressionStreak: 0,
      errorStreak: 0,
    },
    webgpu: {
      disabledUntilMs: 0,
      regressionStreak: 0,
      errorStreak: 0,
    },
  };

  const getOrCreateBucket = (key: string): MutableTelemetryBucket => {
    const existing = telemetryBuckets.get(key);
    if (existing) {
      return existing;
    }
    const created: MutableTelemetryBucket = {
      key,
      totalSamples: 0,
      backends: {},
    };
    telemetryBuckets.set(key, created);
    if (telemetryBuckets.size > config.maxTelemetryBuckets) {
      const oldest = sortBucketsByRecentUse(telemetryBuckets).at(-1);
      if (oldest) {
        telemetryBuckets.delete(oldest.key);
      }
    }
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

  const chooseBackend = (
    request: PlaneComputeRequest,
    key: string,
  ): SchedulerDecision => {
    const bucket = telemetryBuckets.get(key);
    const jsBackend = backendMap.js;
    if (!jsBackend) {
      throw new Error('Plane compute scheduler requires a JS backend.');
    }

    if (
      bucket &&
      bucket.totalSamples > 0 &&
      bucket.totalSamples % config.baselineProbeInterval === 0
    ) {
      return {
        backend: jsBackend,
        trace: {
          bucketKey: key,
          selectedBackend: 'js',
          reason: 'baseline-probe',
        },
      };
    }

    const jsStats = bucket?.backends.js;
    const threshold =
      (request.priority ?? 'idle') === 'drag'
        ? config.dragRegressionRatio
        : config.idleRegressionRatio;

    let skippedForCircuit = false;
    for (const kind of config.preferredBackends) {
      const backend = backendMap[kind];
      if (!backend) {
        continue;
      }
      if (kind === 'js') {
        return {
          backend,
          trace: {
            bucketKey: key,
            selectedBackend: 'js',
            reason: skippedForCircuit ? 'circuit-open' : 'default-js',
          },
        };
      }

      const circuit = circuitBreakers[kind];
      if (circuit && circuit.disabledUntilMs > nowMs()) {
        skippedForCircuit = true;
        continue;
      }

      const candidateStats = bucket?.backends[kind];
      if (!bucket || !candidateStats || !jsStats) {
        return {
          backend,
          trace: {
            bucketKey: key,
            selectedBackend: kind,
            reason: 'warmup',
          },
        };
      }

      if (
        candidateStats.sampleCount < config.warmupSamples ||
        jsStats.sampleCount < config.minSamplesForDecision ||
        candidateStats.sampleCount < config.minSamplesForDecision
      ) {
        return {
          backend,
          trace: {
            bucketKey: key,
            selectedBackend: kind,
            reason: 'warmup',
          },
        };
      }

      if (candidateStats.averageTotalMs <= jsStats.averageTotalMs * threshold) {
        return {
          backend,
          trace: {
            bucketKey: key,
            selectedBackend: kind,
            reason: 'telemetry-win',
          },
        };
      }
    }

    return {
      backend: jsBackend,
      trace: {
        bucketKey: key,
        selectedBackend: 'js',
        reason: skippedForCircuit ? 'circuit-open' : 'telemetry-regression',
      },
    };
  };

  const recordBackendError = (backendKind: PlaneComputeBackendKind): void => {
    if (backendKind === 'js') {
      return;
    }
    const circuit = circuitBreakers[backendKind];
    if (!circuit) {
      return;
    }
    circuit.errorStreak += 1;
    if (circuit.errorStreak >= config.backendErrorTripCount) {
      circuit.disabledUntilMs = nowMs() + config.circuitBreakerCooldownMs;
      circuit.errorStreak = 0;
      circuit.regressionStreak = 0;
    }
  };

  const recordRegression = (
    backendKind: PlaneComputeBackendKind,
    key: string,
    totalMs: number,
    request: PlaneComputeRequest,
  ): void => {
    if (backendKind === 'js') {
      return;
    }
    const circuit = circuitBreakers[backendKind];
    if (!circuit) {
      return;
    }
    const bucket = telemetryBuckets.get(key);
    const jsStats = bucket?.backends.js;
    if (!jsStats || jsStats.sampleCount < config.minSamplesForDecision) {
      circuit.regressionStreak = 0;
      return;
    }
    const threshold =
      (request.priority ?? 'idle') === 'drag'
        ? config.dragRegressionRatio
        : config.idleRegressionRatio;
    if (totalMs <= jsStats.averageTotalMs * threshold) {
      circuit.regressionStreak = 0;
      circuit.errorStreak = 0;
      return;
    }
    circuit.regressionStreak += 1;
    if (circuit.regressionStreak >= config.hysteresisTrips) {
      circuit.disabledUntilMs = nowMs() + config.circuitBreakerCooldownMs;
      circuit.regressionStreak = 0;
      circuit.errorStreak = 0;
    }
  };

  const run = (request: PlaneComputeRequest): PlaneComputeResponse => {
    const key = createBucketKey(request);
    const decision = chooseBackend(request, key);
    try {
      const response = decision.backend.run(request);
      const totalMs = totalTimeMs(response);
      updateTelemetry(key, response.backend, totalMs);
      recordRegression(response.backend, key, totalMs, request);
      const debugTrace = response.debugTrace
        ? {
            queries: response.debugTrace.queries.map((trace) =>
              applyComputeTraceMetadata(trace, {
                backend: response.backend,
                computeTimeMs: response.computeTimeMs,
                marshalTimeMs: response.marshalTimeMs,
                schedule: decision.trace,
              }),
            ),
          }
        : undefined;
      return {
        ...response,
        schedule: decision.trace,
        debugTrace,
      };
    } catch (error) {
      const fallbackBackend = backendMap.js;
      if (!fallbackBackend) {
        throw error;
      }
      recordBackendError(decision.backend.kind);
      const fallbackResponse = fallbackBackend.run(request);
      updateTelemetry(key, 'js', totalTimeMs(fallbackResponse));
      const schedule = {
        bucketKey: key,
        selectedBackend: 'js' as const,
        reason: 'backend-error' as const,
      };
      const debugTrace = fallbackResponse.debugTrace
        ? {
            queries: fallbackResponse.debugTrace.queries.map((trace) =>
              applyComputeTraceMetadata(trace, {
                backend: fallbackResponse.backend,
                computeTimeMs: fallbackResponse.computeTimeMs,
                marshalTimeMs: fallbackResponse.marshalTimeMs,
                schedule,
              }),
            ),
          }
        : undefined;
      return {
        ...fallbackResponse,
        schedule,
        debugTrace,
      };
    }
  };

  const getTelemetrySnapshot = (): PlaneComputeTelemetrySnapshot => ({
    buckets: sortBucketsByRecentUse(telemetryBuckets),
    circuitBreakers: cloneCircuitBreakers(circuitBreakers),
  });

  const resetTelemetry = (): void => {
    telemetryBuckets.clear();
    for (const kind of ['wasm', 'webgpu'] as const) {
      const breaker = circuitBreakers[kind];
      if (!breaker) {
        continue;
      }
      breaker.disabledUntilMs = 0;
      breaker.errorStreak = 0;
      breaker.regressionStreak = 0;
    }
  };

  return {
    run,
    getTelemetrySnapshot,
    resetTelemetry,
  };
}
