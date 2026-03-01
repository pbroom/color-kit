import type { Color } from '../types.js';
import type {
  PlaneBoundaryPoint,
  PlaneColorPoint,
  PlaneQueryResult,
  PlaneRegionPoint,
} from '../plane/types.js';
import type {
  PackedPlaneQueryDescriptor,
  PackedPlaneQueryResult,
} from './types.js';

type PlanePackedPoint =
  | PlaneBoundaryPoint
  | PlaneRegionPoint
  | PlaneColorPoint
  | { x: number; y: number };

function hasLightnessAndChroma(point: PlanePackedPoint): point is {
  x: number;
  y: number;
  l: number;
  c: number;
} {
  return (
    typeof (point as { l?: number }).l === 'number' &&
    typeof (point as { c?: number }).c === 'number'
  );
}

function hasColor(
  point: PlanePackedPoint,
): point is { x: number; y: number; color: Color } {
  return (
    typeof (point as { color?: Color }).color === 'object' &&
    (point as { color?: Color }).color != null
  );
}

export function packPlaneQueryResults(
  results: PlaneQueryResult[],
): PackedPlaneQueryResult {
  const queryDescriptors: PackedPlaneQueryDescriptor[] = [];
  const pathRanges: number[] = [];
  const pointXY: number[] = [];
  const pointLC: number[] = [];
  const pointColorLcha: number[] = [];

  const appendPoint = (point: PlanePackedPoint): void => {
    pointXY.push(point.x, point.y);
    if (hasLightnessAndChroma(point)) {
      pointLC.push(point.l, point.c);
    } else {
      pointLC.push(Number.NaN, Number.NaN);
    }

    if (hasColor(point)) {
      pointColorLcha.push(
        point.color.l,
        point.color.c,
        point.color.h,
        point.color.alpha,
      );
    } else {
      pointColorLcha.push(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
    }
  };

  const appendPath = (points: PlanePackedPoint[]): void => {
    const startPoint = pointXY.length / 2;
    for (const point of points) {
      appendPoint(point);
    }
    const pointCount = pointXY.length / 2 - startPoint;
    pathRanges.push(startPoint, pointCount);
  };

  for (const result of results) {
    const pathStart = pathRanges.length / 2;

    switch (result.kind) {
      case 'gamutBoundary': {
        appendPath(result.points);
        queryDescriptors.push({
          kind: result.kind,
          pathStart,
          pathCount: 1,
          gamut: result.gamut,
          hue: result.hue,
        });
        break;
      }

      case 'contrastBoundary': {
        appendPath(result.points);
        queryDescriptors.push({
          kind: result.kind,
          pathStart,
          pathCount: 1,
          hue: result.hue,
        });
        break;
      }

      case 'contrastRegion': {
        for (const path of result.paths) {
          appendPath(path);
        }
        queryDescriptors.push({
          kind: result.kind,
          pathStart,
          pathCount: result.paths.length,
          hue: result.hue,
        });
        break;
      }

      case 'chromaBand': {
        appendPath(result.points);
        queryDescriptors.push({
          kind: result.kind,
          pathStart,
          pathCount: 1,
          hue: result.hue,
        });
        break;
      }

      case 'fallbackPoint': {
        appendPath([result.point]);
        queryDescriptors.push({
          kind: result.kind,
          pathStart,
          pathCount: 1,
          gamut: result.gamut,
        });
        break;
      }

      case 'gradient': {
        appendPath(result.points);
        queryDescriptors.push({
          kind: result.kind,
          pathStart,
          pathCount: 1,
        });
        break;
      }

      default:
        throw new Error(
          `Unsupported plane query result kind: ${(result as PlaneQueryResult).kind}`,
        );
    }
  }

  return {
    queryDescriptors,
    pathRanges: Uint32Array.from(pathRanges),
    pointXY: Float32Array.from(pointXY),
    pointLC: Float32Array.from(pointLC),
    pointColorLcha: Float32Array.from(pointColorLcha),
  };
}

export function getPackedPlaneQueryTransferables(
  packed: PackedPlaneQueryResult,
): ArrayBuffer[] {
  return [
    packed.pathRanges.buffer as ArrayBuffer,
    packed.pointXY.buffer as ArrayBuffer,
    packed.pointLC.buffer as ArrayBuffer,
    packed.pointColorLcha.buffer as ArrayBuffer,
  ];
}
