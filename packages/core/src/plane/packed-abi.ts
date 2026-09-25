import type { GamutTarget } from '../gamut/index.js';
import type {
  PlaneGamutRegionScope,
  PlaneGamutSolver,
  PlaneQueryKind,
  PlaneViewportRelation,
} from '../trace/types.js';
import type {
  PlaneBoundaryPoint,
  PlaneColorPoint,
  PlanePoint,
} from './types.js';

/**
 * Version of the packed plane query transfer format.
 *
 * Bump whenever descriptor fields or buffer layouts change so producers and
 * consumers on different builds fail loudly instead of misreading data.
 */
export const PACKED_PLANE_QUERY_ABI_VERSION = 2;

interface PackedPlaneQueryDescriptorBase<K extends PlaneQueryKind> {
  kind: K;
  pathStart: number;
  pathCount: number;
}

export interface PackedGamutBoundaryDescriptor extends PackedPlaneQueryDescriptorBase<'gamutBoundary'> {
  gamut: GamutTarget;
  hue: number;
}

export interface PackedGamutRegionDescriptor extends PackedPlaneQueryDescriptorBase<'gamutRegion'> {
  /** Always `pathStart + pathCount`: visible-region paths follow boundaries. */
  regionPathStart: number;
  regionPathCount: number;
  gamut: GamutTarget;
  scope: PlaneGamutRegionScope;
  solver: PlaneGamutSolver;
  viewportRelation: PlaneViewportRelation;
}

export interface PackedContrastBoundaryDescriptor extends PackedPlaneQueryDescriptorBase<'contrastBoundary'> {
  hue: number;
}

export interface PackedContrastRegionDescriptor extends PackedPlaneQueryDescriptorBase<'contrastRegion'> {
  hue: number;
}

export interface PackedChromaBandDescriptor extends PackedPlaneQueryDescriptorBase<'chromaBand'> {
  hue: number;
}

export interface PackedFallbackPointDescriptor extends PackedPlaneQueryDescriptorBase<'fallbackPoint'> {
  gamut: GamutTarget;
}

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
  | PackedGradientDescriptor;

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
  abiVersion: typeof PACKED_PLANE_QUERY_ABI_VERSION;
  queryDescriptors: PackedPlaneQueryDescriptor[];
  pathRanges: Uint32Array;
  pointXY: Float32Array;
  pointLC: Float32Array;
  pointColorLcha: Float32Array;
}

export function invalidPackedResult(reason: string): never {
  throw new Error(`Invalid packed plane query result: ${reason}`);
}

const GAMUT_TARGETS: Record<GamutTarget, true> = {
  srgb: true,
  'display-p3': true,
};
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

export function requireGamutField(descriptor: object, label: string): void {
  requireEnum(descriptor, 'gamut', GAMUT_TARGETS, label);
}

export function requireHueField(descriptor: object, label: string): void {
  const value = requireField(descriptor, 'hue', label);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalidPackedResult(`${label} hue must be a finite number.`);
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
 * Accumulates path geometry for a packed result. Every appended value is
 * asserted finite so malformed solver output fails at the producer.
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
    if (!Number.isFinite(x)) nonFinitePackValue(label, index, 'x', x);
    if (!Number.isFinite(y)) nonFinitePackValue(label, index, 'y', y);
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
      if (!Number.isFinite(l)) nonFinitePackValue(label, index, 'l', l);
      if (!Number.isFinite(c)) nonFinitePackValue(label, index, 'c', c);
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
      if (!Number.isFinite(l)) nonFinitePackValue(label, index, 'color.l', l);
      if (!Number.isFinite(c)) nonFinitePackValue(label, index, 'color.c', c);
      if (!Number.isFinite(h)) nonFinitePackValue(label, index, 'color.h', h);
      if (!Number.isFinite(alpha)) {
        nonFinitePackValue(label, index, 'color.alpha', alpha);
      }
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
