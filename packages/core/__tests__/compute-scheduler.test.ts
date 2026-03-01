import { describe, expect, it } from 'vitest';
import {
  createJsPlaneComputeBackend,
  createPlaneComputeScheduler,
  type PlaneComputeBackend,
  type PlaneComputeRequest,
} from '../src/index.js';

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
  it('prefers faster wasm backend after baseline telemetry', () => {
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: createTimedBackend('js', 8),
        wasm: createTimedBackend('wasm', 3),
      },
      options: {
        preferredBackends: ['wasm', 'js'],
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

    expect(first.backend).toBe('wasm');
    expect(second.backend).toBe('wasm');
    expect(third.backend).toBe('wasm');
    expect(fourth.backend).toBe('js');
    expect(fourth.schedule?.reason).toBe('baseline-probe');
    expect(fifth.backend).toBe('wasm');
    expect(fifth.schedule?.reason).toBe('telemetry-win');
  });

  it('opens a circuit breaker after repeated wasm backend errors', () => {
    const jsBackend = createTimedBackend('js', 5);
    const throwingWasmBackend: PlaneComputeBackend = {
      kind: 'wasm',
      run() {
        throw new Error('wasm backend unavailable');
      },
    };
    const scheduler = createPlaneComputeScheduler({
      backends: {
        js: jsBackend,
        wasm: throwingWasmBackend,
      },
      options: {
        preferredBackends: ['wasm', 'js'],
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
    expect(snapshot.circuitBreakers.wasm?.disabledUntilMs ?? 0).toBeGreaterThan(
      0,
    );
  });
});
