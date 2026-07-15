import type { Color } from '../types.js';
import {
  setTraceSummaryField,
  type InternalPlaneTraceContext,
} from '../plane/trace.js';
import { contrastRegionPathsHybrid } from './region-hybrid.js';
import { contrastRegionPathsLegacy } from './region-legacy.js';
import { validateSteps } from './region-shared.js';
import type {
  ContrastRegionPathOptions,
  ContrastRegionPoint,
} from './types.js';

interface TraceWorkCounters {
  sampleCount: number;
  scalarEvaluationCount: number;
  cellCount: number;
  segmentCount: number;
  pathCount: number;
  pointCount: number;
}

function snapshotTraceWorkCounters(
  trace: InternalPlaneTraceContext | null | undefined,
): TraceWorkCounters | null {
  if (!trace) return null;
  const {
    sampleCount,
    scalarEvaluationCount,
    cellCount,
    segmentCount,
    pathCount,
    pointCount,
  } = trace.summary;
  return {
    sampleCount,
    scalarEvaluationCount,
    cellCount,
    segmentCount,
    pathCount,
    pointCount,
  };
}

function restoreTraceWorkCounters(
  trace: InternalPlaneTraceContext | null | undefined,
  counters: TraceWorkCounters | null,
): void {
  if (!trace || !counters) return;
  Object.assign(trace.summary, counters);
}

/**
 * Generate contour paths for the region that meets/exceeds
 * the configured contrast criterion at a fixed hue.
 */
export function contrastRegionPaths(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
  trace?: InternalPlaneTraceContext | null,
): ContrastRegionPoint[][] {
  if (options.lightnessSteps != null) {
    validateSteps(
      'contrastRegionPaths() lightnessSteps',
      options.lightnessSteps,
    );
  }
  if (options.chromaSteps != null) {
    validateSteps('contrastRegionPaths() chromaSteps', options.chromaSteps);
  }
  if (
    options.edgeInterpolation != null &&
    options.edgeInterpolation !== 'linear' &&
    options.edgeInterpolation !== 'midpoint'
  ) {
    throw new Error(
      "contrastRegionPaths() edgeInterpolation must be 'linear' or 'midpoint'",
    );
  }

  const mode = options.samplingMode ?? 'hybrid';
  const requestedLegacySamplingMode = mode === 'uniform' || mode === 'adaptive';
  const usesLegacyControls =
    requestedLegacySamplingMode ||
    options.edgeInterpolation != null ||
    options.adaptiveBaseSteps != null ||
    options.adaptiveMaxDepth != null;
  if (usesLegacyControls) {
    return contrastRegionPathsLegacy(
      reference,
      hue,
      {
        ...options,
        samplingMode: requestedLegacySamplingMode
          ? mode
          : options.adaptiveBaseSteps != null ||
              options.adaptiveMaxDepth != null
            ? 'adaptive'
            : 'uniform',
      },
      trace,
    );
  }

  const traceCountersBeforeHybrid = snapshotTraceWorkCounters(trace);
  const hybridOutcome = contrastRegionPathsHybrid(
    reference,
    hue,
    options,
    trace,
  );
  if (hybridOutcome.status === 'ok') {
    return hybridOutcome.paths;
  }
  restoreTraceWorkCounters(trace, traceCountersBeforeHybrid);
  const paths = contrastRegionPathsLegacy(
    reference,
    hue,
    {
      ...options,
      samplingMode: 'adaptive',
    },
    trace,
  );
  setTraceSummaryField(trace, 'fallbackReason', hybridOutcome.fallbackReason);
  return paths;
}

/**
 * Convenience helper that returns the largest detected contour path.
 */
export function contrastRegionPath(
  reference: Color,
  hue: number,
  options: ContrastRegionPathOptions = {},
  trace?: InternalPlaneTraceContext | null,
): ContrastRegionPoint[] {
  const paths = contrastRegionPaths(reference, hue, options, trace);
  return paths[0] ?? [];
}
