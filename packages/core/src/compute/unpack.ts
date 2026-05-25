import type {
  PlaneBoundaryPoint,
  PlaneColorPoint,
  PlaneContrastBoundaryResult,
  PlaneContrastRegionResult,
  PlaneFallbackPointResult,
  PlaneGamutBoundaryResult,
  PlaneGamutRegionResult,
  PlaneGradientResult,
  PlanePoint,
  PlaneQueryResult,
  PlaneRegionPoint,
} from '../plane/types.js';
import type {
  PackedPlaneQueryDescriptor,
  PackedPlaneQueryResult,
} from './types.js';

function invalidPackedResult(reason: string): never {
  throw new Error(`Invalid packed plane query result: ${reason}`);
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    invalidPackedResult(`${label} must be a non-negative integer.`);
  }
}

function getPathRangeCount(packed: PackedPlaneQueryResult): number {
  if (packed.pathRanges.length % 2 !== 0) {
    invalidPackedResult(
      'pathRanges must contain [startPoint, pointCount] pairs.',
    );
  }
  return packed.pathRanges.length / 2;
}

function getPointCount(packed: PackedPlaneQueryResult): number {
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
  return pointCount;
}

function validatePathRange(
  packed: PackedPlaneQueryResult,
  pathIndex: number,
  pathRangeCount: number,
  pointCount: number,
): void {
  assertNonNegativeInteger(pathIndex, 'path index');
  if (pathIndex >= pathRangeCount) {
    invalidPackedResult(`path index ${pathIndex} is outside pathRanges.`);
  }

  const offset = pathIndex * 2;
  const startPoint = packed.pathRanges[offset];
  const rangePointCount = packed.pathRanges[offset + 1];
  assertNonNegativeInteger(startPoint, `path ${pathIndex} startPoint`);
  assertNonNegativeInteger(rangePointCount, `path ${pathIndex} pointCount`);
  if (startPoint + rangePointCount > pointCount) {
    invalidPackedResult(`path ${pathIndex} points are outside point buffers.`);
  }
}

function validateDescriptorPathRange(
  descriptor: PackedPlaneQueryDescriptor,
  pathRangeCount: number,
  label: string,
): void {
  assertNonNegativeInteger(descriptor.pathStart, `${label} pathStart`);
  assertNonNegativeInteger(descriptor.pathCount, `${label} pathCount`);
  if (descriptor.pathStart + descriptor.pathCount > pathRangeCount) {
    invalidPackedResult(`${label} path range is outside pathRanges.`);
  }
}

function validateOptionalRegionPathRange(
  descriptor: PackedPlaneQueryDescriptor,
  pathRangeCount: number,
  label: string,
): void {
  const regionPathCount = descriptor.regionPathCount ?? 0;
  assertNonNegativeInteger(regionPathCount, `${label} regionPathCount`);
  if (descriptor.regionPathStart !== undefined) {
    assertNonNegativeInteger(
      descriptor.regionPathStart,
      `${label} regionPathStart`,
    );
  }

  const regionPathStart =
    descriptor.regionPathStart ?? descriptor.pathStart + descriptor.pathCount;
  if (regionPathStart + regionPathCount > pathRangeCount) {
    invalidPackedResult(`${label} region path range is outside pathRanges.`);
  }
}

function validatePackedPlaneQueryResult(packed: PackedPlaneQueryResult): void {
  const pathRangeCount = getPathRangeCount(packed);
  const pointCount = getPointCount(packed);

  for (let index = 0; index < pathRangeCount; index += 1) {
    validatePathRange(packed, index, pathRangeCount, pointCount);
  }

  packed.queryDescriptors.forEach((descriptor, index) => {
    const label = `descriptor ${index} (${descriptor.kind})`;
    validateDescriptorPathRange(descriptor, pathRangeCount, label);
    if (descriptor.kind === 'gamutRegion') {
      validateOptionalRegionPathRange(descriptor, pathRangeCount, label);
    }
  });
}

function readPathRange(
  pathRanges: Uint32Array,
  pathIndex: number,
): { startPoint: number; pointCount: number } {
  const offset = pathIndex * 2;
  return {
    startPoint: pathRanges[offset],
    pointCount: pathRanges[offset + 1],
  };
}

function readPointXY(
  packed: PackedPlaneQueryResult,
  pointIndex: number,
): { x: number; y: number } {
  const offset = pointIndex * 2;
  return {
    x: packed.pointXY[offset],
    y: packed.pointXY[offset + 1],
  };
}

function readPointLC(
  packed: PackedPlaneQueryResult,
  pointIndex: number,
): { l: number; c: number } | null {
  const offset = pointIndex * 2;
  const l = packed.pointLC[offset];
  const c = packed.pointLC[offset + 1];
  if (!Number.isFinite(l) || !Number.isFinite(c)) {
    return null;
  }
  return { l, c };
}

function readPointColor(
  packed: PackedPlaneQueryResult,
  pointIndex: number,
): PlaneColorPoint['color'] | null {
  const offset = pointIndex * 4;
  const l = packed.pointColorLcha[offset];
  const c = packed.pointColorLcha[offset + 1];
  const h = packed.pointColorLcha[offset + 2];
  const alpha = packed.pointColorLcha[offset + 3];
  if (
    !Number.isFinite(l) ||
    !Number.isFinite(c) ||
    !Number.isFinite(h) ||
    !Number.isFinite(alpha)
  ) {
    return null;
  }
  return { l, c, h, alpha };
}

function readBoundaryPath(
  packed: PackedPlaneQueryResult,
  pathIndex: number,
): PlaneBoundaryPoint[] {
  const range = readPathRange(packed.pathRanges, pathIndex);
  const points: PlaneBoundaryPoint[] = [];
  for (let index = 0; index < range.pointCount; index += 1) {
    const pointIndex = range.startPoint + index;
    const xy = readPointXY(packed, pointIndex);
    const lc = readPointLC(packed, pointIndex) ?? { l: 0, c: 0 };
    points.push({
      x: xy.x,
      y: xy.y,
      l: lc.l,
      c: lc.c,
    });
  }
  return points;
}

function readPlainPath(
  packed: PackedPlaneQueryResult,
  pathIndex: number,
): PlanePoint[] {
  const range = readPathRange(packed.pathRanges, pathIndex);
  const points: PlanePoint[] = [];
  for (let index = 0; index < range.pointCount; index += 1) {
    const pointIndex = range.startPoint + index;
    points.push(readPointXY(packed, pointIndex));
  }
  return points;
}

function readRegionPath(
  packed: PackedPlaneQueryResult,
  pathIndex: number,
): PlaneRegionPoint[] {
  const range = readPathRange(packed.pathRanges, pathIndex);
  const points: PlaneRegionPoint[] = [];
  for (let index = 0; index < range.pointCount; index += 1) {
    const pointIndex = range.startPoint + index;
    const xy = readPointXY(packed, pointIndex);
    const lc = readPointLC(packed, pointIndex) ?? { l: 0, c: 0 };
    points.push({
      x: xy.x,
      y: xy.y,
      l: lc.l,
      c: lc.c,
    });
  }
  return points;
}

function readColorPath(
  packed: PackedPlaneQueryResult,
  pathIndex: number,
): PlaneColorPoint[] {
  const range = readPathRange(packed.pathRanges, pathIndex);
  const points: PlaneColorPoint[] = [];
  for (let index = 0; index < range.pointCount; index += 1) {
    const pointIndex = range.startPoint + index;
    const xy = readPointXY(packed, pointIndex);
    const color = readPointColor(packed, pointIndex) ?? {
      l: 0,
      c: 0,
      h: 0,
      alpha: 1,
    };
    points.push({
      x: xy.x,
      y: xy.y,
      color,
    });
  }
  return points;
}

export function unpackPlaneQueryResults(
  packed: PackedPlaneQueryResult,
): PlaneQueryResult[] {
  validatePackedPlaneQueryResult(packed);

  return packed.queryDescriptors.map((descriptor) => {
    switch (descriptor.kind) {
      case 'gamutBoundary': {
        const points = descriptor.pathCount
          ? readBoundaryPath(packed, descriptor.pathStart)
          : [];
        const result: PlaneGamutBoundaryResult = {
          kind: 'gamutBoundary',
          gamut: descriptor.gamut ?? 'srgb',
          hue: descriptor.hue ?? 0,
          points,
        };
        return result;
      }

      case 'gamutRegion': {
        const boundaryPaths: PlanePoint[][] = [];
        for (let index = 0; index < descriptor.pathCount; index += 1) {
          boundaryPaths.push(
            readPlainPath(packed, descriptor.pathStart + index),
          );
        }
        const visiblePaths: PlanePoint[][] = [];
        const regionPathStart =
          descriptor.regionPathStart ??
          descriptor.pathStart + descriptor.pathCount;
        const regionPathCount = descriptor.regionPathCount ?? 0;
        for (let index = 0; index < regionPathCount; index += 1) {
          visiblePaths.push(readPlainPath(packed, regionPathStart + index));
        }
        const result: PlaneGamutRegionResult = {
          kind: 'gamutRegion',
          gamut: descriptor.gamut ?? 'srgb',
          scope: descriptor.scope ?? 'viewport',
          solver: descriptor.solver ?? 'implicit-contour',
          viewportRelation: descriptor.viewportRelation ?? 'outside',
          boundaryPaths,
          visibleRegion: { paths: visiblePaths },
        };
        return result;
      }

      case 'contrastBoundary': {
        const points = descriptor.pathCount
          ? readRegionPath(packed, descriptor.pathStart)
          : [];
        const result: PlaneContrastBoundaryResult = {
          kind: 'contrastBoundary',
          hue: descriptor.hue ?? 0,
          points,
        };
        return result;
      }

      case 'contrastRegion': {
        const paths: PlaneRegionPoint[][] = [];
        for (let index = 0; index < descriptor.pathCount; index += 1) {
          paths.push(readRegionPath(packed, descriptor.pathStart + index));
        }
        const result: PlaneContrastRegionResult = {
          kind: 'contrastRegion',
          hue: descriptor.hue ?? 0,
          paths,
        };
        return result;
      }

      case 'chromaBand': {
        const points = descriptor.pathCount
          ? readBoundaryPath(packed, descriptor.pathStart)
          : [];
        return {
          kind: 'chromaBand',
          hue: descriptor.hue ?? 0,
          points,
        };
      }

      case 'fallbackPoint': {
        const points = descriptor.pathCount
          ? readColorPath(packed, descriptor.pathStart)
          : [];
        const point = points[0] ?? {
          x: 0,
          y: 0,
          color: { l: 0, c: 0, h: 0, alpha: 1 },
        };
        const result: PlaneFallbackPointResult = {
          kind: 'fallbackPoint',
          gamut: descriptor.gamut ?? 'srgb',
          point,
        };
        return result;
      }

      case 'gradient': {
        const points = descriptor.pathCount
          ? readColorPath(packed, descriptor.pathStart)
          : [];
        const result: PlaneGradientResult = {
          kind: 'gradient',
          points,
        };
        return result;
      }

      default:
        throw new Error(
          `Unsupported packed plane query kind: ${(descriptor as { kind: string }).kind}`,
        );
    }
  });
}
