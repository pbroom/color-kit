import {
  createPlaneComputeScheduler,
  getPackedPlaneQueryTransferables,
} from '@color-kit/core';
import type {
  PlaneComputeRequest,
  PlaneComputeSchedulerOptions,
} from '@color-kit/core';
import type {
  PlaneQueryWorkerRequest,
  PlaneQueryWorkerResponse,
} from './plane-query.worker.types.js';

interface MinimalWorkerScope {
  onmessage: ((event: MessageEvent<PlaneQueryWorkerRequest>) => void) | null;
  postMessage: (
    message: PlaneQueryWorkerResponse,
    transfer?: Transferable[],
  ) => void;
}

const workerScope = self as unknown as MinimalWorkerScope;
const SCHEDULER_OPTIONS: PlaneComputeSchedulerOptions = {
  preferredBackends: ['js'],
  minSamplesForDecision: 3,
  warmupSamples: 2,
  baselineProbeInterval: 8,
  dragRegressionRatio: 1.1,
  idleRegressionRatio: 1.25,
  hysteresisTrips: 3,
  circuitBreakerCooldownMs: 20_000,
};

const scheduler = createPlaneComputeScheduler({
  options: SCHEDULER_OPTIONS,
});

workerScope.onmessage = (event): void => {
  const payload = event.data;

  try {
    const request: PlaneComputeRequest = {
      plane: payload.plane,
      queries: payload.queries,
      priority: payload.priority,
      quality: payload.quality,
      performanceProfile: payload.performanceProfile,
    };
    const response = scheduler.run(request);

    workerScope.postMessage(
      {
        id: payload.id,
        backend: response.backend,
        result: response.result,
        computeTimeMs: response.computeTimeMs,
        marshalTimeMs: response.marshalTimeMs,
        schedule: response.schedule,
        schedulerTelemetry: payload.includeSchedulerTelemetry
          ? scheduler.getTelemetrySnapshot()
          : undefined,
      },
      getPackedPlaneQueryTransferables(response.result),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    workerScope.postMessage({
      id: payload.id,
      error: message,
    });
  }
};

export {};
