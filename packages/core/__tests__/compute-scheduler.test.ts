import { describe, expect, it } from 'vitest';
import type { PlaneQueryTrace } from '../src/index.js';
import {
  createJsPlaneComputeBackend,
  createPlaneComputeScheduler,
  type PlaneComputeBackend,
  type PlaneComputeRequest,
} from '../src/compute/index.js';
import { applyComputeTraceMetadata } from '../src/compute/trace-metadata.js';

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
    model: 'display-p3',
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
  it('runs on the JS backend and records EWMA telemetry per bucket', () => {
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: createTimedBackend('js', 8),
      },
      options: { ewmaAlpha: 0.5 },
    });

    const first = scheduler.run(schedulerRequest);
    const second = scheduler.run(schedulerRequest);
    const snapshot = scheduler.getTelemetrySnapshot();

    expect(first.backend).toBe('js');
    expect(first.schedule?.reason).toBe('default-js');
    expect(second.schedule?.reason).toBe('default-js');
    expect(second.schedule?.bucketKey).toBe(first.schedule?.bucketKey);
    expect(snapshot.buckets).toHaveLength(1);
    expect(snapshot.buckets[0]?.totalSamples).toBe(2);
    expect(snapshot.buckets[0]?.lastUsedBackend).toBe('js');
    expect(snapshot.buckets[0]?.backends.js).toEqual({
      sampleCount: 2,
      averageTotalMs: 8,
      lastTotalMs: 8,
    });

    scheduler.resetTelemetry();
    expect(scheduler.getTelemetrySnapshot().buckets).toEqual([]);
  });

  it('keys contrast workloads by metric and solver signature', () => {
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: createTimedBackend('js', 6),
      },
    });

    scheduler.run(contrastSchedulerRequest);
    const snapshot = scheduler.getTelemetrySnapshot();

    expect(
      snapshot.buckets.some((bucket) =>
        bucket.key.includes('contrast:wcag:hybrid'),
      ),
    ).toBe(true);
  });

  it('evicts the least recently used telemetry bucket', () => {
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: createTimedBackend('js', 6),
      },
      options: { maxTelemetryBuckets: 1 },
    });

    scheduler.run(schedulerRequest);
    const latest = scheduler.run(contrastSchedulerRequest);
    const snapshot = scheduler.getTelemetrySnapshot();

    expect(snapshot.buckets.map((bucket) => bucket.key)).toEqual([
      latest.schedule?.bucketKey,
    ]);
  });

  it('propagates backend errors without recording telemetry', () => {
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: {
          kind: 'js',
          run() {
            throw new Error('backend failed');
          },
        },
      },
    });

    expect(() => scheduler.run(schedulerRequest)).toThrow('backend failed');
    expect(scheduler.getTelemetrySnapshot().buckets).toEqual([]);
  });

  it('separates gamut-region telemetry buckets by workload signature', () => {
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: createTimedBackend('js', 6),
      },
    });

    scheduler.run(gamutRegionSchedulerRequest);
    scheduler.run(gamutRegionDomainEdgeSchedulerRequest);
    const snapshot = scheduler.getTelemetrySnapshot();
    const bucketKeys = snapshot.buckets.map((bucket) => bucket.key);

    expect(
      bucketKeys.some((key) =>
        key.includes('gamutRegion:srgb:viewport:display-p3:r/g'),
      ),
    ).toBe(true);
    expect(
      bucketKeys.some((key) =>
        key.includes('gamutRegion:srgb:viewport:hsl:h/s'),
      ),
    ).toBe(true);
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
      'gamutRegion:srgb:viewport:display-p3:r/g',
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
