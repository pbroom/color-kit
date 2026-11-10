import type { Gamut } from '../gamut/spec.js';
import type {
  PlaneGamutRegionScope,
  PlaneGamutSolver,
  PlaneQueryKind,
  PlaneViewportRelation,
} from '../trace/types.js';
import type {
  PlaneBoundaryPoint,
  PlaneColorPoint,
  PlaneContrastPointStatus,
  PlanePoint,
} from './types.js';

/**
 * Version of the packed plane query transfer format.
 *
 * Bump whenever descriptor fields or buffer layouts change so producers and
 * consumers on different builds fail loudly instead of misreading data.
 */
export const PACKED_PLANE_QUERY_ABI_VERSION = 3;

interface PackedPlaneQueryDescriptorBase<K extends PlaneQueryKind> {
  /** Query kind this descriptor belongs to. */
  kind: K;
  /** Index of the query's first path in `pathRanges`. */
  pathStart: number;
  /** Number of consecutive paths the query owns, starting at `pathStart`. */
  pathCount: number;
}

/** Packed metadata of a `gamutBoundary` result (one path). */
export interface PackedGamutBoundaryDescriptor extends PackedPlaneQueryDescriptorBase<'gamutBoundary'> {
  /** Gamut that was traced. */
  gamut: Gamut;
  /** Hue the boundary was traced at, in degrees. */
  hue: number;
}

/**
 * Packed metadata of a `gamutRegion` result: `pathCount` boundary paths
 * followed by `regionPathCount` visible-region paths.
 */
export interface PackedGamutRegionDescriptor extends PackedPlaneQueryDescriptorBase<'gamutRegion'> {
  /** Always `pathStart + pathCount`: visible-region paths follow boundaries. */
  regionPathStart: number;
  /** Number of visible-region paths. */
  regionPathCount: number;
  /** Gamut that was analyzed. */
  gamut: Gamut;
  /** Scope the boundary paths were traced in. */
  scope: PlaneGamutRegionScope;
  /** Solver that produced the geometry. */
  solver: PlaneGamutSolver;
  /** How the gamut relates to the plane window. */
  viewportRelation: PlaneViewportRelation;
}

/** Packed metadata of a `contrastBoundary` result (one path). */
export interface PackedContrastBoundaryDescriptor extends PackedPlaneQueryDescriptorBase<'contrastBoundary'> {
  /** Hue the contour was traced at, in degrees. */
  hue: number;
}

/** Packed metadata of a `contrastRegion` result (one path per contour). */
export interface PackedContrastRegionDescriptor extends PackedPlaneQueryDescriptorBase<'contrastRegion'> {
  /** Hue the region was traced at, in degrees. */
  hue: number;
}

/** Packed metadata of a `chromaBand` result (one path). */
export interface PackedChromaBandDescriptor extends PackedPlaneQueryDescriptorBase<'chromaBand'> {
  /** Hue the band was sampled at, in degrees. */
  hue: number;
}

/** Packed metadata of a `fallbackPoint` result (one single-point path). */
export interface PackedFallbackPointDescriptor extends PackedPlaneQueryDescriptorBase<'fallbackPoint'> {
  /** Gamut the color was mapped into. */
  gamut: Gamut;
}

/**
 * Packed metadata of a `contrastPoint` result: one single-point path, or no
 * path (`pathCount` 0) when `status` is `'unreachable'`.
 */
export interface PackedContrastPointDescriptor extends PackedPlaneQueryDescriptorBase<'contrastPoint'> {
  /** Outcome of the query. */
  status: PlaneContrastPointStatus;
  /** Contrast at the point (float64); `null` when unreachable. */
  contrast: number | null;
  /** Distance from the start point (float64); `null` when unreachable. */
  distance: number | null;
}

/** Packed metadata of a `gradient` result (one path); no extra fields. */
export type PackedGradientDescriptor =
  PackedPlaneQueryDescriptorBase<'gradient'>;

/**
 * Per-query metadata in a packed result. Every field listed for a kind is
 * required; decoders reject descriptors with missing or invalid fields.
 */
export type PackedPlaneQueryDescriptor =
  | PackedGamutBoundaryDescriptor
  | PackedGamutRegionDescriptor
  | PackedContrastBoundaryDescriptor
  | PackedContrastRegionDescriptor
  | PackedChromaBandDescriptor
  | PackedFallbackPointDescriptor
  | PackedContrastPointDescriptor
  | PackedGradientDescriptor;

/** The packed descriptor variant whose `kind` is `K`. */
export type PackedPlaneQueryDescriptorOf<K extends PlaneQueryKind> = Extract<
  PackedPlaneQueryDescriptor,
  { kind: K }
>;

/**
 * Transfer-friendly packed representation of batched plane query output.
 *
 * `pathRanges` contains `[startPoint, pointCount]` tuples.
 * `pointXY` contains `[x0, y0, x1, y1, ...]`.
 * `pointLC` contains `[l0, c0, l1, c1, ...]` (NaN when the query kind carries
 * no lightness/chroma).
 * `pointColorLcha` contains `[l0, c0, h0, a0, ...]` (NaN when the query kind
 * carries no color).
 *
 * Descriptors cover the path list contiguously and in order.
 */
export interface PackedPlaneQueryResult {
  /** Format version; decoders reject any other value. */
  abiVersion: typeof PACKED_PLANE_QUERY_ABI_VERSION;
  /** One descriptor per query, in query order. */
  queryDescriptors: PackedPlaneQueryDescriptor[];
  /** `[startPoint, pointCount]` per path. */
  pathRanges: Uint32Array;
  /** Plane coordinates, `[x0, y0, x1, y1, ...]`. */
  pointXY: Float32Array;
  /** OKLCH lightness/chroma per point, `NaN` when the kind has none. */
  pointLC: Float32Array;
  /** OKLCH color and alpha per point, `NaN` when the kind has none. */
  pointColorLcha: Float32Array;
}

export function invalidPackedResult(reason: string): never {
  throw new Error(`Invalid packed plane query result: ${reason}`);
}

const GAMUT_REGION_SCOPES: Record<PlaneGamutRegionScope, true> = {
  viewport: true,
  full: true,
};
const GAMUT_SOLVERS: Record<PlaneGamutSolver, true> = {
  'domain-edge': true,
  'analytic-lc': true,
  'analytic-hc': true,
  'analytic-hct': true,
  'implicit-contour': true,
};
const VIEWPORT_RELATIONS: Record<PlaneViewportRelation, true> = {
  inside: true,
  outside: true,
  intersects: true,
};

function requireField(
  descriptor: object,
  field: string,
  label: string,
): unknown {
  const value = (descriptor as Record<string, unknown>)[field];
  if (value === undefined) {
    invalidPackedResult(`${label} is missing required field "${field}".`);
  }
  return value;
}

function requireEnum(
  descriptor: object,
  field: string,
  allowed: Record<string, true>,
  label: string,
): void {
  const value = requireField(descriptor, field, label);
  if (
    typeof value !== 'string' ||
    !Object.prototype.hasOwnProperty.call(allowed, value)
  ) {
    invalidPackedResult(
      `${label} has invalid ${field} ${JSON.stringify(value)}.`,
    );
  }
}

export function requireNonNegativeInteger(
  descriptor: object,
  field: string,
  label: string,
): number {
  const value = requireField(descriptor, field, label);
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    invalidPackedResult(`${label} ${field} must be a non-negative integer.`);
  }
  return value;
}

/**
 * A packed descriptor carries the query's {@link Gamut} descriptor itself
 * (plain data, so it survives the structured clone to and from a worker).
 * Any gamut is accepted, so this checks the shape only.
 */
export function requireGamutField(descriptor: object, label: string): void {
  const value = requireField(
    descriptor,
    'gamut',
    label,
  ) as Partial<Gamut> | null;
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.id !== 'string' ||
    !Array.isArray(value.lmsToLinear)
  ) {
    invalidPackedResult(
      `${label} has invalid gamut: expected a Gamut descriptor object.`,
    );
  }
}

export function requireHueField(descriptor: object, label: string): void {
  const value = requireField(descriptor, 'hue', label);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalidPackedResult(`${label} hue must be a finite number.`);
  }
}

const CONTRAST_POINT_STATUSES: Record<PlaneContrastPointStatus, true> = {
  satisfied: true,
  adjusted: true,
  unreachable: true,
};

export function requireContrastPointFields(
  descriptor: object,
  label: string,
): void {
  requireEnum(descriptor, 'status', CONTRAST_POINT_STATUSES, label);
  const { status, pathCount } = descriptor as {
    status: PlaneContrastPointStatus;
    pathCount: number;
  };
  const expectedPathCount = status === 'unreachable' ? 0 : 1;
  if (pathCount !== expectedPathCount) {
    invalidPackedResult(
      `${label} pathCount must be ${expectedPathCount} when status is "${status}".`,
    );
  }
  for (const field of ['contrast', 'distance']) {
    const value = requireField(descriptor, field, label);
    const valid =
      status === 'unreachable'
        ? value === null
        : typeof value === 'number' && Number.isFinite(value);
    if (!valid) {
      invalidPackedResult(
        `${label} ${field} must be ${status === 'unreachable' ? 'null' : 'a finite number'} when status is "${status}".`,
      );
    }
  }
}

export function requireGamutRegionFields(
  descriptor: object,
  label: string,
): void {
  requireGamutField(descriptor, label);
  requireEnum(descriptor, 'scope', GAMUT_REGION_SCOPES, label);
  requireEnum(descriptor, 'solver', GAMUT_SOLVERS, label);
  requireEnum(descriptor, 'viewportRelation', VIEWPORT_RELATIONS, label);
  const regionPathStart = requireNonNegativeInteger(
    descriptor,
    'regionPathStart',
    label,
  );
  requireNonNegativeInteger(descriptor, 'regionPathCount', label);
  const expectedStart =
    requireNonNegativeInteger(descriptor, 'pathStart', label) +
    requireNonNegativeInteger(descriptor, 'pathCount', label);
  if (regionPathStart !== expectedStart) {
    invalidPackedResult(
      `${label} regionPathStart must equal pathStart + pathCount (${expectedStart}).`,
    );
  }
}

function nonFinitePackValue(
  label: string,
  pointIndex: number,
  channel: string,
  value: number,
): never {
  throw new Error(
    `Cannot pack plane query result: ${label} point ${pointIndex} ${channel} is not finite (${value}).`,
  );
}

/**
 * Asserts a value is a number that survives the Float32 point buffers.
 * Non-number inputs (e.g. `"0.5"`, `null` from untyped callers) are rejected
 * rather than coerced. Finite float64 values beyond the Float32 range (e.g.
 * `1e40`, `Number.MAX_VALUE`) would become `Infinity` when packed and fail
 * decoding, so reject them at the producer.
 */
function requirePackable(
  value: number,
  label: string,
  pointIndex: number,
  channel: string,
): void {
  // `Math.fround` coerces strings and null, so require a real number first.
  if (typeof value !== 'number') {
    throw new Error(
      `Cannot pack plane query result: ${label} point ${pointIndex} ${channel} must be a number (received ${value === null ? 'null' : typeof value}).`,
    );
  }
  if (Number.isFinite(Math.fround(value))) return;
  if (!Number.isFinite(value)) {
    nonFinitePackValue(label, pointIndex, channel, value);
  }
  throw new Error(
    `Cannot pack plane query result: ${label} point ${pointIndex} ${channel} is outside the Float32 range (${value}).`,
  );
}

/**
 * Accumulates path geometry for a packed result. Every appended value is
 * asserted finite in Float32 so malformed solver output fails at the producer.
 */
export class PackedWriter {
  private readonly pathRanges: number[] = [];
  private readonly pointXY: number[] = [];
  private readonly pointLC: number[] = [];
  private readonly pointColorLcha: number[] = [];

  /** Number of paths appended so far (the next path index). */
  get pathCount(): number {
    return this.pathRanges.length / 2;
  }

  private pushXY(point: PlanePoint, label: string, index: number): void {
    const { x, y } = point;
    requirePackable(x, label, index, 'x');
    requirePackable(y, label, index, 'y');
    this.pointXY.push(x, y);
  }

  appendXYPath(points: readonly PlanePoint[], label: string): void {
    const start = this.pointXY.length / 2;
    for (let index = 0; index < points.length; index += 1) {
      this.pushXY(points[index], label, index);
      this.pointLC.push(Number.NaN, Number.NaN);
      this.pointColorLcha.push(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
    }
    this.pathRanges.push(start, points.length);
  }

  appendLCPath(points: readonly PlaneBoundaryPoint[], label: string): void {
    const start = this.pointXY.length / 2;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      this.pushXY(point, label, index);
      const { l, c } = point;
      requirePackable(l, label, index, 'l');
      requirePackable(c, label, index, 'c');
      this.pointLC.push(l, c);
      this.pointColorLcha.push(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
    }
    this.pathRanges.push(start, points.length);
  }

  appendColorPath(points: readonly PlaneColorPoint[], label: string): void {
    const start = this.pointXY.length / 2;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      this.pushXY(point, label, index);
      const { l, c, h, alpha } = point.color;
      requirePackable(l, label, index, 'color.l');
      requirePackable(c, label, index, 'color.c');
      requirePackable(h, label, index, 'color.h');
      requirePackable(alpha, label, index, 'color.alpha');
      this.pointLC.push(Number.NaN, Number.NaN);
      this.pointColorLcha.push(l, c, h, alpha);
    }
    this.pathRanges.push(start, points.length);
  }

  finish(
    queryDescriptors: PackedPlaneQueryDescriptor[],
  ): PackedPlaneQueryResult {
    return {
      abiVersion: PACKED_PLANE_QUERY_ABI_VERSION,
      queryDescriptors,
      pathRanges: Uint32Array.from(this.pathRanges),
      pointXY: Float32Array.from(this.pointXY),
      pointLC: Float32Array.from(this.pointLC),
      pointColorLcha: Float32Array.from(this.pointColorLcha),
    };
  }
}

/**
 * Reads geometry out of an already-validated packed result.
 *
 * It performs no validation itself; `unpackPlaneQueryResults()` validates the
 * whole payload before any reader is created.
 */
export class PackedReader {
  constructor(private readonly packed: PackedPlaneQueryResult) {}

  private range(pathIndex: number): { start: number; count: number } {
    const offset = pathIndex * 2;
    return {
      start: this.packed.pathRanges[offset],
      count: this.packed.pathRanges[offset + 1],
    };
  }

  readXYPath(pathIndex: number): PlanePoint[] {
    const { start, count } = this.range(pathIndex);
    const { pointXY } = this.packed;
    const points: PlanePoint[] = [];
    for (let index = start; index < start + count; index += 1) {
      points.push({ x: pointXY[index * 2], y: pointXY[index * 2 + 1] });
    }
    return points;
  }

  readXYPaths(pathStart: number, pathCount: number): PlanePoint[][] {
    const paths: PlanePoint[][] = [];
    for (let index = 0; index < pathCount; index += 1) {
      paths.push(this.readXYPath(pathStart + index));
    }
    return paths;
  }

  readLCPath(pathIndex: number): PlaneBoundaryPoint[] {
    const { start, count } = this.range(pathIndex);
    const { pointXY, pointLC } = this.packed;
    const points: PlaneBoundaryPoint[] = [];
    for (let index = start; index < start + count; index += 1) {
      points.push({
        x: pointXY[index * 2],
        y: pointXY[index * 2 + 1],
        l: pointLC[index * 2],
        c: pointLC[index * 2 + 1],
      });
    }
    return points;
  }

  readLCPaths(pathStart: number, pathCount: number): PlaneBoundaryPoint[][] {
    const paths: PlaneBoundaryPoint[][] = [];
    for (let index = 0; index < pathCount; index += 1) {
      paths.push(this.readLCPath(pathStart + index));
    }
    return paths;
  }

  readColorPath(pathIndex: number): PlaneColorPoint[] {
    const { start, count } = this.range(pathIndex);
    const { pointXY, pointColorLcha } = this.packed;
    const points: PlaneColorPoint[] = [];
    for (let index = start; index < start + count; index += 1) {
      points.push({
        x: pointXY[index * 2],
        y: pointXY[index * 2 + 1],
        color: {
          l: pointColorLcha[index * 4],
          c: pointColorLcha[index * 4 + 1],
          h: pointColorLcha[index * 4 + 2],
          alpha: pointColorLcha[index * 4 + 3],
        },
      });
    }
    return points;
  }
}
