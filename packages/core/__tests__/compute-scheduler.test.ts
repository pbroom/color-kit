import { describe, expect, it } from 'vitest';
import {
  createJsPlaneComputeBackend,
  createPlaneComputeScheduler,
  type PlaneQueryTrace,
  type PlaneComputeBackend,
  type PlaneComputeRequest,
} from '../src/index.js';
import { applyComputeTraceMetadata } from '../src/plane/trace.js';

const schedulerRequest: PlaneComputeRequest = {
  plane: {
    model: 'oklch',
    x: { channel: 'l', range: [0, 1] },
    y: { channel: 'c', range: [0, 0.4] },
    fixed: { h: 275, alpha: 1 },
  },
  queries: [
    {
      kind: 'gamutBoundary',
      gamut: 'srgb',
      hue: 275,
      steps: 96,
      samplingMode: 'adaptive',
    },
  ],
  priority: 'drag',
  quality: 'high',
  performanceProfile: 'balanced',
};

const contrastSchedulerRequest: PlaneComputeRequest = {
  plane: {
    model: 'oklch',
    x: { channel: 'l', range: [0, 1] },
    y: { channel: 'c', range: [0, 0.4] },
    fixed: { h: 275, alpha: 1 },
  },
  queries: [
    {
      kind: 'contrastRegion',
      reference: { l: 0.58, c: 0.15, h: 275, alpha: 1 },
      metric: 'wcag',
      threshold: 4.5,
      samplingMode: 'hybrid',
      hybridMaxDepth: 7,
      hybridErrorTolerance: 0.0015,
      hue: 275,
    },
  ],
  priority: 'drag',
  quality: 'high',
  performanceProfile: 'balanced',
};

const gamutRegionSchedulerRequest: PlaneComputeRequest = {
  plane: {
    model: 'p3',
    x: { channel: 'r', range: [0, 1] },
    y: { channel: 'g', range: [1, 0] },
    fixed: { b: 1, alpha: 1 },
  },
  queries: [
    {
      kind: 'gamutRegion',
      gamut: 'srgb',
      scope: 'viewport',
    },
  ],
  priority: 'drag',
  quality: 'high',
  performanceProfile: 'balanced',
};

const gamutRegionDomainEdgeSchedulerRequest: PlaneComputeRequest = {
  plane: {
    model: 'hsl',
    x: { channel: 'h', range: [0, 360] },
    y: { channel: 's', range: [100, 0] },
    fixed: { l: 50, alpha: 1 },
  },
  queries: [
    {
      kind: 'gamutRegion',
      gamut: 'srgb',
      scope: 'viewport',
    },
  ],
  priority: 'drag',
  quality: 'high',
  performanceProfile: 'balanced',
};

function createTimedBackend(
  kind: PlaneComputeBackend['kind'],
  computeTimeMs: number,
): PlaneComputeBackend {
  const jsBackend = createJsPlaneComputeBackend();
  return {
    kind,
    run(request) {
      const response = jsBackend.run(request);
      return {
        ...response,
        backend: kind,
        computeTimeMs,
        marshalTimeMs: 0,
      };
    },
  };
}

describe('plane compute scheduler', () => {
  it('prefers faster non-js backend after baseline telemetry', () => {
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: createTimedBackend('js', 8),
        webgpu: createTimedBackend('webgpu', 3),
      },
      options: {
        preferredBackends: ['webgpu', 'js'],
        minSamplesForDecision: 1,
        warmupSamples: 1,
        baselineProbeInterval: 3,
        dragRegressionRatio: 1.1,
        idleRegressionRatio: 1.2,
      },
    });

    const first = scheduler.run(schedulerRequest);
    const second = scheduler.run(schedulerRequest);
    const third = scheduler.run(schedulerRequest);
    const fourth = scheduler.run(schedulerRequest);
    const fifth = scheduler.run(schedulerRequest);

    expect(first.backend).toBe('webgpu');
    expect(second.backend).toBe('webgpu');
    expect(third.backend).toBe('webgpu');
    expect(fourth.backend).toBe('js');
    expect(fourth.schedule?.reason).toBe('baseline-probe');
    expect(fifth.backend).toBe('webgpu');
    expect(fifth.schedule?.reason).toBe('telemetry-win');
  });

  it('opens a circuit breaker after repeated non-js backend errors', () => {
    const jsBackend = createTimedBackend('js', 5);
    const throwingBackend: PlaneComputeBackend = {
      kind: 'webgpu',
      run() {
        throw new Error('webgpu backend unavailable');
      },
    };
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: jsBackend,
        webgpu: throwingBackend,
      },
      options: {
        preferredBackends: ['webgpu', 'js'],
        baselineProbeInterval: 99,
        backendErrorTripCount: 2,
        circuitBreakerCooldownMs: 60_000,
      },
    });

    const first = scheduler.run(schedulerRequest);
    const second = scheduler.run(schedulerRequest);
    const third = scheduler.run(schedulerRequest);
    const snapshot = scheduler.getTelemetrySnapshot();

    expect(first.backend).toBe('js');
    expect(first.schedule?.reason).toBe('backend-error');
    expect(second.backend).toBe('js');
    expect(second.schedule?.reason).toBe('backend-error');
    expect(third.backend).toBe('js');
    expect(third.schedule?.reason).toBe('circuit-open');
    expect(
      snapshot.circuitBreakers.webgpu?.disabledUntilMs ?? 0,
    ).toBeGreaterThan(0);
  });

  it('falls back to js and opens circuit for contrast queries when the backend fails', () => {
    const jsBackend = createTimedBackend('js', 7);
    const throwingBackend: PlaneComputeBackend = {
      kind: 'webgpu',
      run() {
        throw new Error('contrast webgpu backend unavailable');
      },
    };
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: jsBackend,
        webgpu: throwingBackend,
      },
      options: {
        preferredBackends: ['webgpu', 'js'],
        baselineProbeInterval: 99,
        backendErrorTripCount: 2,
        circuitBreakerCooldownMs: 60_000,
      },
    });

    const first = scheduler.run(contrastSchedulerRequest);
    const second = scheduler.run(contrastSchedulerRequest);
    const third = scheduler.run(contrastSchedulerRequest);
    const snapshot = scheduler.getTelemetrySnapshot();

    expect(first.backend).toBe('js');
    expect(first.schedule?.reason).toBe('backend-error');
    expect(second.backend).toBe('js');
    expect(second.schedule?.reason).toBe('backend-error');
    expect(third.backend).toBe('js');
    expect(third.schedule?.reason).toBe('circuit-open');
    expect(
      snapshot.buckets.some((bucket) =>
        bucket.key.includes('contrast:wcag:hybrid'),
      ),
    ).toBe(true);
  });

  it('separates gamut-region telemetry buckets by workload signature', () => {
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: createTimedBackend('js', 6),
      },
      options: {
        preferredBackends: ['js'],
      },
    });

    scheduler.run(gamutRegionSchedulerRequest);
    scheduler.run(gamutRegionDomainEdgeSchedulerRequest);
    const snapshot = scheduler.getTelemetrySnapshot();
    const bucketKeys = snapshot.buckets.map((bucket) => bucket.key);

    expect(
      bucketKeys.some((key) =>
        key.includes('gamutRegion:srgb:viewport:p3:r/g'),
      ),
    ).toBe(true);
    expect(
      bucketKeys.some((key) =>
        key.includes('gamutRegion:srgb:viewport:hsl:h/s'),
      ),
    ).toBe(true);
  });

  it('skips unsupported non-js backends before recording telemetry', () => {
    let backendRunCount = 0;
    const unsupportedBackend: PlaneComputeBackend = {
      kind: 'webgpu',
      supportsRequest: (request) =>
        request.queries.every((query) => query.kind === 'contrastRegion'),
      run(request) {
        backendRunCount += 1;
        return createTimedBackend('webgpu', 1).run(request);
      },
    };
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: createTimedBackend('js', 6),
        webgpu: unsupportedBackend,
      },
      options: {
        preferredBackends: ['webgpu', 'js'],
      },
    });

    const response = scheduler.run(schedulerRequest);
    const snapshot = scheduler.getTelemetrySnapshot();

    expect(response.backend).toBe('js');
    expect(response.schedule?.reason).toBe('unsupported-backend');
    expect(backendRunCount).toBe(0);
    expect(snapshot.buckets[0]?.backends.webgpu).toBeUndefined();
    expect(snapshot.buckets[0]?.backends.js?.sampleCount).toBe(1);
  });

  it('distributes batched debug timings across traced queries', () => {
    const response = createJsPlaneComputeBackend().run({
      plane: gamutRegionSchedulerRequest.plane,
      queries: [
        {
          kind: 'gamutRegion',
          gamut: 'srgb',
          scope: 'viewport',
        },
        {
          kind: 'gamutRegion',
          gamut: 'srgb',
          scope: 'viewport',
        },
      ],
      trace: {
        level: 'summary',
      },
    });

    const computeTimings =
      response.debugTrace?.queries.map(
        (trace) => trace.summary.timings?.compute ?? 0,
      ) ?? [];
    const marshalTimings =
      response.debugTrace?.queries.map(
        (trace) => trace.summary.timings?.marshal ?? 0,
      ) ?? [];

    expect(computeTimings).toHaveLength(2);
    expect(computeTimings.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      response.computeTimeMs,
      6,
    );
    expect(marshalTimings.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      response.marshalTimeMs,
      6,
    );
    expect(Math.max(...computeTimings)).toBeLessThan(response.computeTimeMs);
  });

  it('attaches debug trace metadata without changing scheduler bucket selection', () => {
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: createTimedBackend('js', 6),
      },
      options: {
        preferredBackends: ['js'],
      },
    });

    const response = scheduler.run({
      ...gamutRegionSchedulerRequest,
      trace: {
        level: 'full',
        maxStageEntries: 16,
      },
    });

    expect(response.debugTrace?.queries).toHaveLength(1);
    expect(response.debugTrace?.queries[0].summary.backend).toBe('js');
    expect(response.debugTrace?.queries[0].summary.bucketKey).toContain(
      'gamutRegion:srgb:viewport:p3:r/g',
    );
    expect(response.debugTrace?.queries[0].summary.scheduleReason).toBe(
      'default-js',
    );
    expect(
      response.debugTrace?.queries[0].summary.timings?.compute ?? 0,
    ).toBeGreaterThan(0);
    expect(
      response.debugTrace?.queries[0].summary.timings?.marshal ?? 0,
    ).toBeGreaterThanOrEqual(0);
    expect(
      response.debugTrace?.queries[0].stages.some(
        (stage) => stage.kind === 'viewportClassification',
      ),
    ).toBe(true);
  });

  it('returns a copy when applying compute trace metadata', () => {
    const trace: PlaneQueryTrace = {
      summary: {
        queryKind: 'gamutRegion',
        level: 'summary',
        totalTimeMs: 12,
        sampleCount: 0,
        scalarEvaluationCount: 0,
        cellCount: 0,
        segmentCount: 0,
        pathCount: 0,
        pointCount: 0,
        resultPathCount: 1,
        resultPointCount: 4,
        timings: {
          compute: 5,
        },
      },
      stages: [],
    };

    const updated = applyComputeTraceMetadata(trace, {
      backend: 'js',
      schedule: {
        bucketKey: 'gamutRegion:demo',
        selectedBackend: 'js',
        reason: 'default-js',
      },
    });

    expect(updated).not.toBe(trace);
    expect(updated.summary).not.toBe(trace.summary);
    expect(trace.summary.bucketKey).toBeUndefined();
    expect(trace.summary.scheduleReason).toBeUndefined();
    expect(updated.summary.bucketKey).toBe('gamutRegion:demo');
    expect(updated.summary.scheduleReason).toBe('default-js');
  });
});
