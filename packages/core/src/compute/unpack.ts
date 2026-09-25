import {
  invalidPackedResult,
  PACKED_PLANE_QUERY_ABI_VERSION,
  PackedReader,
  requireNonNegativeInteger,
  type PackedPlaneQueryDescriptor,
  type PackedPlaneQueryResult,
} from '../plane/packed-abi.js';
import type {
  PlaneQueryPointChannels,
  PlaneQuerySpec,
} from '../plane/query-spec.js';
import {
  getPlaneQuerySpec,
  isPlaneQueryKind,
} from '../plane/query-specs/index.js';
import type { PlaneQueryResult } from '../plane/types.js';
import type { PlaneQueryKind } from '../trace/types.js';

const PACKED_BUFFER_TYPES = {
  pathRanges: 'Uint32Array',
  pointXY: 'Float32Array',
  pointLC: 'Float32Array',
  pointColorLcha: 'Float32Array',
} as const;

/**
 * Requires every buffer to be present and of its documented typed-array type
 * before any `.length` or element reads. The tag check stays valid for
 * buffers that crossed a realm (e.g. structured-cloned from a worker).
 */
function validateBufferTypes(packed: PackedPlaneQueryResult): void {
  for (const [field, typeName] of Object.entries(PACKED_BUFFER_TYPES)) {
    const buffer = (packed as unknown as Record<string, unknown>)[field];
    if (buffer == null) {
      invalidPackedResult(`${field} is required.`);
    }
    if (Object.prototype.toString.call(buffer) !== `[object ${typeName}]`) {
      invalidPackedResult(`${field} must be a ${typeName}.`);
    }
  }
}

function validateBufferShapes(packed: PackedPlaneQueryResult): {
  pathRangeCount: number;
  pointCount: number;
} {
  validateBufferTypes(packed);
  if (packed.pathRanges.length % 2 !== 0) {
    invalidPackedResult(
      'pathRanges must contain [startPoint, pointCount] pairs.',
    );
  }
  if (packed.pointXY.length % 2 !== 0) {
    invalidPackedResult('pointXY must contain [x, y] pairs.');
  }
  const pointCount = packed.pointXY.length / 2;
  if (packed.pointLC.length !== pointCount * 2) {
    invalidPackedResult('pointLC length must match pointXY point count.');
  }
  if (packed.pointColorLcha.length !== pointCount * 4) {
    invalidPackedResult(
      'pointColorLcha length must match pointXY point count.',
    );
  }

  const pathRangeCount = packed.pathRanges.length / 2;
  for (let pathIndex = 0; pathIndex < pathRangeCount; pathIndex += 1) {
    const startPoint = packed.pathRanges[pathIndex * 2];
    const rangePointCount = packed.pathRanges[pathIndex * 2 + 1];
    if (startPoint + rangePointCount > pointCount) {
      invalidPackedResult(
        `path ${pathIndex} points are outside point buffers.`,
      );
    }
  }
  return { pathRangeCount, pointCount };
}

function validatePathPoints(
  packed: PackedPlaneQueryResult,
  pathIndex: number,
  channels: PlaneQueryPointChannels,
  label: string,
): void {
  const startPoint = packed.pathRanges[pathIndex * 2];
  const pointCount = packed.pathRanges[pathIndex * 2 + 1];
  const { pointXY, pointLC, pointColorLcha } = packed;
  for (let point = startPoint; point < startPoint + pointCount; point += 1) {
    if (
      !Number.isFinite(pointXY[point * 2]) ||
      !Number.isFinite(pointXY[point * 2 + 1])
    ) {
      invalidPackedResult(`${label} point ${point} has non-finite x/y.`);
    }
    if (
      channels === 'xylc' &&
      (!Number.isFinite(pointLC[point * 2]) ||
        !Number.isFinite(pointLC[point * 2 + 1]))
    ) {
      invalidPackedResult(`${label} point ${point} has non-finite l/c.`);
    }
    if (channels === 'xycolor') {
      for (let channel = 0; channel < 4; channel += 1) {
        if (!Number.isFinite(pointColorLcha[point * 4 + channel])) {
          invalidPackedResult(`${label} point ${point} has non-finite color.`);
        }
      }
    }
  }
}

/**
 * Validates an entire packed payload before any geometry is rebuilt.
 *
 * Every descriptor must be well-formed for its kind, descriptors must cover
 * the path list contiguously and in order, and every point must carry finite
 * values for the channels its kind uses.
 */
function validatePackedPlaneQueryResult(
  packed: PackedPlaneQueryResult,
): PackedPlaneQueryDescriptor[] {
  if (packed == null || typeof packed !== 'object') {
    invalidPackedResult('payload must be an object.');
  }
  const abiVersion = (packed as { abiVersion?: unknown }).abiVersion;
  if (abiVersion !== PACKED_PLANE_QUERY_ABI_VERSION) {
    invalidPackedResult(
      `abiVersion must be ${PACKED_PLANE_QUERY_ABI_VERSION}, received ${JSON.stringify(abiVersion)}.`,
    );
  }
  const { pathRangeCount } = validateBufferShapes(packed);
  if (!Array.isArray(packed.queryDescriptors)) {
    invalidPackedResult('queryDescriptors must be an array.');
  }

  let nextPathStart = 0;
  packed.queryDescriptors.forEach((descriptor: unknown, index) => {
    if (descriptor == null || typeof descriptor !== 'object') {
      invalidPackedResult(`descriptor ${index} must be an object.`);
    }
    const kind = (descriptor as { kind?: unknown }).kind;
    if (!isPlaneQueryKind(kind)) {
      invalidPackedResult(
        `descriptor ${index} has unknown kind ${JSON.stringify(kind)}.`,
      );
    }
    const label = `descriptor ${index} (${kind})`;
    const pathStart = requireNonNegativeInteger(descriptor, 'pathStart', label);
    const pathCount = requireNonNegativeInteger(descriptor, 'pathCount', label);
    const spec: PlaneQuerySpec<PlaneQueryKind> = getPlaneQuerySpec(kind);
    spec.validateDescriptor(descriptor, label);

    if (spec.fixedPathCount != null && pathCount !== spec.fixedPathCount) {
      invalidPackedResult(
        `${label} pathCount must be ${spec.fixedPathCount}, received ${pathCount}.`,
      );
    }
    if (pathStart !== nextPathStart) {
      invalidPackedResult(
        `${label} pathStart must be ${nextPathStart} so descriptor ranges stay contiguous and ordered.`,
      );
    }
    const pathSpan = spec.pathSpan?.(descriptor) ?? pathCount;
    if (pathStart + pathSpan > pathRangeCount) {
      invalidPackedResult(`${label} path range is outside pathRanges.`);
    }
    for (let path = pathStart; path < pathStart + pathSpan; path += 1) {
      if (
        spec.fixedPointCount != null &&
        packed.pathRanges[path * 2 + 1] !== spec.fixedPointCount
      ) {
        invalidPackedResult(
          `${label} path ${path} must contain exactly ${spec.fixedPointCount} point.`,
        );
      }
      validatePathPoints(packed, path, spec.pointChannels, label);
    }
    nextPathStart = pathStart + pathSpan;
  });

  if (nextPathStart !== pathRangeCount) {
    invalidPackedResult(
      `descriptors cover ${nextPathStart} paths but pathRanges holds ${pathRangeCount}.`,
    );
  }
  return packed.queryDescriptors;
}

/**
 * Decodes a packed plane query payload back into query results.
 *
 * Throws `Invalid packed plane query result: …` when the payload has the
 * wrong ABI version, missing or mistyped buffers, unknown kinds, missing or
 * invalid descriptor fields, non-contiguous ranges, or non-finite point data.
 * Nothing is defaulted.
 */
export function unpackPlaneQueryResults(
  packed: PackedPlaneQueryResult,
): PlaneQueryResult[] {
  const descriptors = validatePackedPlaneQueryResult(packed);
  const reader = new PackedReader(packed);
  return descriptors.map((descriptor) =>
    getPlaneQuerySpec(descriptor.kind).unpack(descriptor, reader),
  );
}
