import type { PlaneDefinition, PlanePoint, PlaneRegion } from './types.js';
import { colorToPlane, planeToColor, resolvePlaneDefinition } from './plane.js';

function mapRegion(
  region: PlaneRegion,
  fn: (point: PlanePoint) => PlanePoint,
): PlaneRegion {
  return {
    paths: region.paths.map((path) => path.map((point) => fn(point))),
  };
}

export function translateRegion(
  region: PlaneRegion,
  dx: number,
  dy: number,
): PlaneRegion {
  return mapRegion(region, (point) => ({
    x: point.x + dx,
    y: point.y + dy,
  }));
}

export function scaleRegion(
  region: PlaneRegion,
  sx: number,
  sy: number = sx,
  origin: PlanePoint = { x: 0.5, y: 0.5 },
): PlaneRegion {
  return mapRegion(region, (point) => ({
    x: origin.x + (point.x - origin.x) * sx,
    y: origin.y + (point.y - origin.y) * sy,
  }));
}

export function rotateRegion(
  region: PlaneRegion,
  angleDeg: number,
  origin: PlanePoint = { x: 0.5, y: 0.5 },
): PlaneRegion {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return mapRegion(region, (point) => {
    const localX = point.x - origin.x;
    const localY = point.y - origin.y;
    return {
      x: origin.x + localX * cos - localY * sin,
      y: origin.y + localX * sin + localY * cos,
    };
  });
}

export function projectRegionBetweenPlanes(
  sourcePlaneDefinition: PlaneDefinition,
  targetPlaneDefinition: PlaneDefinition,
  region: PlaneRegion,
): PlaneRegion {
  const sourcePlane = resolvePlaneDefinition(sourcePlaneDefinition);
  const targetPlane = resolvePlaneDefinition(targetPlaneDefinition);
  return mapRegion(region, (point) => {
    const color = planeToColor(sourcePlane, point);
    return colorToPlane(targetPlane, color);
  });
}
