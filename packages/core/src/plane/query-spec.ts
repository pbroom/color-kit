import type { InternalPlaneTraceContext } from '../trace/context.js';
import type {
  PackedPlaneQueryDescriptorOf,
  PackedReader,
  PackedWriter,
} from './packed-abi.js';
import type { PlaneQueryKind } from '../trace/types.js';
import type {
  Plane,
  PlaneDefinition,
  PlaneQuery,
  PlaneQueryResult,
} from './types.js';

/** The `PlaneQuery` variant whose `kind` is `K`. */
export type PlaneQueryOf<K extends PlaneQueryKind> = Extract<
  PlaneQuery,
  { kind: K }
>;

/** The `PlaneQueryResult` variant whose `kind` is `K`. */
export type PlaneQueryResultOf<K extends PlaneQueryKind> = Extract<
  PlaneQueryResult,
  { kind: K }
>;

/** Path and point totals of one query result's geometry. */
export interface PlaneQueryGeometryCount {
  /** Number of non-empty paths. */
  pathCount: number;
  /** Total points across all paths. */
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
  /** Executes the query, recording into `trace` when one is given. */
  run(
    plane: PlaneDefinition,
    query: PlaneQueryOf<K>,
    trace?: InternalPlaneTraceContext | null,
  ): PlaneQueryResultOf<K>;
  /** Per-point channels this kind packs. */
  pointChannels: PlaneQueryPointChannels;
  /** Set when the kind always packs exactly one path. */
  fixedPathCount?: 1;
  /** Counts the result's paths and points (trace summaries, packing). */
  countGeometry(result: PlaneQueryResultOf<K>): PlaneQueryGeometryCount;
  /** Relative work estimate used by the compute scheduler's budget buckets. */
  budget(query: PlaneQueryOf<K>): number;
  /** Scheduler telemetry section this kind reports into, if any. */
  telemetryGroup?: PlaneQueryTelemetryGroup;
  /** Stable signature that buckets this query within its telemetry group. */
  telemetrySignature?(query: PlaneQueryOf<K>, plane: Plane): string;
  /** Set when every packed path of this kind holds exactly one point. */
  fixedPointCount?: 1;
  /**
   * Appends the result's paths to the writer and returns its descriptor.
   * `pathStart` must be the writer's path count before appending.
   */
  pack(
    result: PlaneQueryResultOf<K>,
    writer: PackedWriter,
    label: string,
  ): PackedPlaneQueryDescriptorOf<K>;
  /**
   * Checks kind-specific descriptor fields (presence, enums, finite hue,
   * secondary path ranges). Base fields are validated by the decoder.
   */
  validateDescriptor(
    descriptor: object,
    label: string,
  ): asserts descriptor is PackedPlaneQueryDescriptorOf<K>;
  /** Total number of consecutive paths the descriptor owns from pathStart. */
  pathSpan?(descriptor: PackedPlaneQueryDescriptorOf<K>): number;
  /** Rebuilds the result from its descriptor and the packed buffers. */
  unpack(
    descriptor: PackedPlaneQueryDescriptorOf<K>,
    reader: PackedReader,
  ): PlaneQueryResultOf<K>;
}

/** One `PlaneQuerySpec` per query kind, keyed by `kind`. */
export type PlaneQuerySpecRegistry = {
  [K in PlaneQueryKind]: PlaneQuerySpec<K>;
};
