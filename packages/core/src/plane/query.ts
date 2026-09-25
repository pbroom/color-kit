import type { Color } from '../types.js';
import type { InternalPlaneTraceContext } from '../trace/context.js';
import { getPlaneGamutRegion } from './gamut-region/index.js';
import { planeToColor } from './mapping.js';
import {
  getPlaneChromaBand,
  getPlaneContrastBoundary,
  getPlaneContrastRegion,
  getPlaneFallbackPoint,
  getPlaneGamutBoundary,
  getPlaneQuerySpec,
  samplePlaneGradient,
} from './query-specs/index.js';
import { resolvePlaneDefinition } from './resolve.js';
import { createPlaneTraceContext, finalizePlaneTrace } from './trace.js';
import type {
  Plane,
  PlaneChromaBandQuery,
  PlaneChromaBandResult,
  PlaneContrastBoundaryQuery,
  PlaneContrastBoundaryResult,
  PlaneContrastRegionQuery,
  PlaneContrastRegionResult,
  PlaneDefinition,
  PlaneFallbackPointQuery,
  PlaneFallbackPointResult,
  PlaneGamutBoundaryQuery,
  PlaneGamutBoundaryResult,
  PlaneGamutRegionQuery,
  PlaneGamutRegionResult,
  PlaneGradientQuery,
  PlaneGradientResult,
  PlaneQueryInspection,
  PlaneQuery,
  PlaneQueryResult,
  PlaneQueryTraceOptions,
} from './types.js';

export {
  getPlaneChromaBand,
  getPlaneContrastBoundary,
  getPlaneContrastRegion,
  getPlaneFallbackPoint,
  getPlaneGamutBoundary,
  getPlaneGamutRegion,
  samplePlaneGradient,
};

function runPlaneQueryInternal(
  planeDefinition: PlaneDefinition,
  query: PlaneQuery,
  trace?: InternalPlaneTraceContext | null,
): PlaneQueryResult {
  return getPlaneQuerySpec(query.kind).run(planeDefinition, query, trace);
}

/**
 * Executes one stateless plane query and returns a typed result payload.
 *
 * @param planeDefinition Plane definition used for query execution.
 * @param query Discriminated plane query payload.
 */
export function runPlaneQuery(
  planeDefinition: PlaneDefinition,
  query: PlaneQuery,
): PlaneQueryResult {
  return runPlaneQueryInternal(planeDefinition, query);
}

/**
 * Executes a list of stateless plane queries in order.
 *
 * @param planeDefinition Plane definition used for query execution.
 * @param queries Query list to execute in sequence.
 */
export function runPlaneQueries(
  planeDefinition: PlaneDefinition,
  queries: PlaneQuery[],
): PlaneQueryResult[] {
  return queries.map((query) => runPlaneQueryInternal(planeDefinition, query));
}

/**
 * Executes one stateless plane query and returns a sidecar trace payload.
 *
 * @param planeDefinition Plane definition used for query execution.
 * @param query Discriminated plane query payload.
 * @param options Trace capture configuration.
 */
export function inspectPlaneQuery<Result extends PlaneQuery = PlaneQuery>(
  planeDefinition: PlaneDefinition,
  query: Result,
  options?: PlaneQueryTraceOptions,
): PlaneQueryInspection<Extract<PlaneQueryResult, { kind: Result['kind'] }>> {
  const trace = createPlaneTraceContext(query, options);
  const result = runPlaneQueryInternal(planeDefinition, query, trace);
  return finalizePlaneTrace(
    trace,
    result as Extract<PlaneQueryResult, { kind: Result['kind'] }>,
  );
}

/**
 * Executes a list of stateless plane queries and returns sidecar traces.
 *
 * @param planeDefinition Plane definition used for query execution.
 * @param queries Query list to execute in sequence.
 * @param options Trace capture configuration.
 */
export function inspectPlaneQueries(
  planeDefinition: PlaneDefinition,
  queries: PlaneQuery[],
  options?: PlaneQueryTraceOptions,
): PlaneQueryInspection[] {
  return queries.map((query) =>
    inspectPlaneQuery(planeDefinition, query, options),
  );
}

/** Fluent query helper methods bound to a single plane definition. */
export interface PlaneSense {
  /** Computes a projected gamut boundary contour. */
  gamutBoundary: (
    query?: Omit<PlaneGamutBoundaryQuery, 'kind'>,
  ) => PlaneGamutBoundaryResult;
  /** Computes visible gamut geometry for the current plane window. */
  gamutRegion: (
    query?: Omit<PlaneGamutRegionQuery, 'kind'>,
  ) => PlaneGamutRegionResult;
  /** Computes a projected contrast-threshold contour. */
  contrastBoundary: (
    query: Omit<PlaneContrastBoundaryQuery, 'kind'>,
  ) => PlaneContrastBoundaryResult;
  /** Computes one or more projected filled contrast regions. */
  contrastRegion: (
    query: Omit<PlaneContrastRegionQuery, 'kind'>,
  ) => PlaneContrastRegionResult;
  /** Computes a projected chroma-band point sequence. */
  chromaBand: (
    query?: Omit<PlaneChromaBandQuery, 'kind'>,
  ) => PlaneChromaBandResult;
  /** Maps a color into gamut and projects it to one plane point. */
  fallbackPoint: (
    query: Omit<PlaneFallbackPointQuery, 'kind'>,
  ) => PlaneFallbackPointResult;
  /** Samples a gradient and projects each sample to plane coordinates. */
  gradient: (query: Omit<PlaneGradientQuery, 'kind'>) => PlaneGradientResult;
}

/** Alias kept for API readability and migration ergonomics. */
export type PlaneSenseApi = PlaneSense;

/** A resolved plane instance augmented with fluent sensing helpers. */
export interface PlaneWithSense extends PlaneSense, Plane {}

/**
 * Creates a fluent sensing helper bound to a single plane definition.
 *
 * @param planeDefinition Plane definition captured by all returned methods.
 */
export function sense(planeDefinition: PlaneDefinition): PlaneSense {
  return {
    gamutBoundary: (query = {}) =>
      getPlaneGamutBoundary(planeDefinition, query),
    gamutRegion: (query = {}) => getPlaneGamutRegion(planeDefinition, query),
    contrastBoundary: (query) =>
      getPlaneContrastBoundary(planeDefinition, query),
    contrastRegion: (query) => getPlaneContrastRegion(planeDefinition, query),
    chromaBand: (query = {}) => getPlaneChromaBand(planeDefinition, query),
    fallbackPoint: (query) => getPlaneFallbackPoint(planeDefinition, query),
    gradient: (query) => samplePlaneGradient(planeDefinition, query),
  };
}

/**
 * Converts a normalized plane point directly into a color for the given plane.
 *
 * @param planeDefinition Plane definition used for conversion.
 * @param point Normalized plane point (`x`/`y`) to convert.
 */
export function colorAtPlanePoint(
  planeDefinition: PlaneDefinition,
  point: { x: number; y: number },
): Color {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  return planeToColor(resolvedPlane, point);
}
