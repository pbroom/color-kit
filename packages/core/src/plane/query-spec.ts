import type { InternalPlaneTraceContext } from '../trace/context.js';
import type { PlaneQueryKind } from '../trace/types.js';
import type {
  Plane,
  PlaneDefinition,
  PlaneQuery,
  PlaneQueryResult,
} from './types.js';

export type PlaneQueryOf<K extends PlaneQueryKind> = Extract<
  PlaneQuery,
  { kind: K }
>;

export type PlaneQueryResultOf<K extends PlaneQueryKind> = Extract<
  PlaneQueryResult,
  { kind: K }
>;

export interface PlaneQueryGeometryCount {
  pathCount: number;
  pointCount: number;
}

/**
 * Which per-point channels a query kind carries in its geometry.
 *
 * - `xy`: plane coordinates only
 * - `xylc`: plane coordinates plus OKLCH lightness/chroma
 * - `xycolor`: plane coordinates plus a full color
 */
export type PlaneQueryPointChannels = 'xy' | 'xylc' | 'xycolor';

/**
 * Scheduler telemetry section a query contributes a signature to. Buckets
 * are keyed by these groups in a fixed order so keys stay stable.
 */
export type PlaneQueryTelemetryGroup = 'gamutRegion' | 'contrast';

/**
 * Everything the plane, trace and compute layers need to know about one
 * query kind. Adding a query kind means adding one spec to the registry
 * instead of extending switch statements across modules.
 */
export interface PlaneQuerySpec<K extends PlaneQueryKind> {
  kind: K;
  run(
    plane: PlaneDefinition,
    query: PlaneQueryOf<K>,
    trace?: InternalPlaneTraceContext | null,
  ): PlaneQueryResultOf<K>;
  pointChannels: PlaneQueryPointChannels;
  /** Set when the kind always packs exactly one path. */
  fixedPathCount?: 1;
  countGeometry(result: PlaneQueryResultOf<K>): PlaneQueryGeometryCount;
  /** Relative work estimate used by the compute scheduler's budget buckets. */
  budget(query: PlaneQueryOf<K>): number;
  telemetryGroup?: PlaneQueryTelemetryGroup;
  telemetrySignature?(query: PlaneQueryOf<K>, plane: Plane): string;
}

export type PlaneQuerySpecRegistry = {
  [K in PlaneQueryKind]: PlaneQuerySpec<K>;
};
