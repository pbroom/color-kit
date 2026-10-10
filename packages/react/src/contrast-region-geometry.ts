import {
  contrastAPCA,
  contrastRatio,
  toP3Gamut,
  toSrgbGamut,
  type Color,
  type ContrastApcaPolarity,
  type ContrastApcaPreset,
  type ContrastApcaRole,
  type ContrastMetric,
  type ContrastRegionLevel,
  type GamutTarget,
  type PlaneContrastRegionResult,
} from '@color-kit/core';
import type { ColorAreaContrastRegionPoint } from '@color-kit/driver';

// Non-rendering geometry for contrast regions: snaps solver contours onto
// the gamut boundary and closes open contours into fillable regions on the
// side that passes the contrast check.

export function countPathPoints(
  paths: ColorAreaContrastRegionPoint[][],
): number {
  return paths.reduce((total, path) => total + path.length, 0);
}

export function toColorAreaContrastRegionPaths(
  result: PlaneContrastRegionResult,
): ColorAreaContrastRegionPoint[][] {
  return result.paths.map((path) =>
    path.map((point) => ({
      l: point.l,
      c: point.c,
      x: point.x,
      y: 1 - point.y,
    })),
  );
}

/**
 * Interactive defaults for the contrast-region solver, tuned against a
 * brute-force fill check (180 regions): mean fill mismatch stays under
 * 0.025% with no region over 5%, at a fraction of the core defaults' cost.
 */
export const DEFAULT_LAYER_INITIAL_SAMPLES = 8;
export const DEFAULT_LAYER_ERROR_TOLERANCE = 0.004;
export const MIN_LAYER_INITIAL_SAMPLES = 2;

export interface LayerSampling {
  initialSamples: number;
  maxDepth: number;
}

export const CLOSED_PATH_TOLERANCE = 1e-6;
export const BOUNDARY_CONNECT_TOLERANCE = 0.02;
export const BOUNDARY_SNAP_TOLERANCE = 0.008;
export const REGION_MIN_AREA = 0.00002;

export type ColorAreaLcPoint = Pick<
  ColorAreaContrastRegionPoint,
  'l' | 'c' | 'x' | 'y'
>;

export function isPathClosed(points: ColorAreaContrastRegionPoint[]): boolean {
  if (points.length < 2) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(first.x - last.x, first.y - last.y) < CLOSED_PATH_TOLERANCE;
}

export function isSamePoint(a: ColorAreaLcPoint, b: ColorAreaLcPoint): boolean {
  return (
    Math.abs(a.x - b.x) < CLOSED_PATH_TOLERANCE &&
    Math.abs(a.y - b.y) < CLOSED_PATH_TOLERANCE
  );
}

export function distanceInLc(a: ColorAreaLcPoint, b: ColorAreaLcPoint): number {
  return Math.hypot(a.l - b.l, a.c - b.c);
}

export function polylineLength(points: ColorAreaLcPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const next = points[index];
    total += Math.hypot(next.x - prev.x, next.y - prev.y);
  }
  return total;
}

export function polygonArea(points: ColorAreaLcPoint[]): number {
  if (points.length < 3) return 0;
  let doubleArea = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    doubleArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(doubleArea) * 0.5;
}

export function pointInPolygonLc(
  point: Pick<ColorAreaLcPoint, 'l' | 'c'>,
  polygon: Pick<ColorAreaLcPoint, 'l' | 'c'>[],
): boolean {
  let inside = false;
  for (
    let index = 0, prev = polygon.length - 1;
    index < polygon.length;
    prev = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[prev];
    const intersects =
      current.c > point.c !== previous.c > point.c &&
      point.l <
        ((previous.l - current.l) * (point.c - current.c)) /
          (previous.c - current.c + 1e-12) +
          current.l;
    if (intersects) inside = !inside;
  }
  return inside;
}

export const APCA_PRESET_THRESHOLDS: Record<ContrastApcaPreset, number> = {
  body: 0.6,
  'large-text': 0.45,
  ui: 0.3,
};

export function resolveContrastThresholdValue(
  threshold: number | undefined,
  level: ContrastRegionLevel | undefined,
  metric: ContrastMetric | undefined,
  apcaPreset: ContrastApcaPreset | undefined,
): number {
  if (typeof threshold === 'number') {
    return threshold;
  }
  if (metric === 'apca') {
    return APCA_PRESET_THRESHOLDS[apcaPreset ?? 'body'];
  }
  if (level === 'AAA') return 7;
  if (level === 'AA-large') return 3;
  return 4.5;
}

export function mapColorToGamut(color: Color, gamut: GamutTarget): Color {
  return gamut === 'display-p3' ? toP3Gamut(color) : toSrgbGamut(color);
}

/**
 * Signed margin of `sample` against the threshold (`>= 0` passes), measured
 * with core's contrast metrics in the region's gamut so it agrees with the
 * contrast region field that produced the paths.
 */
export function evaluateContrastCriterionScore(
  sample: Color,
  mappedReference: Color,
  gamut: GamutTarget,
  metric: ContrastMetric | undefined,
  threshold: number,
  apcaPolarity: ContrastApcaPolarity | undefined,
  apcaRole: ContrastApcaRole | undefined,
): number {
  const options = { gamut };
  if (metric === 'apca') {
    const lc =
      (apcaRole ?? 'sample-text') === 'sample-background'
        ? contrastAPCA(mappedReference, sample, options)
        : contrastAPCA(sample, mappedReference, options);
    if (apcaPolarity === 'positive') {
      return lc - threshold;
    }
    if (apcaPolarity === 'negative') {
      return -lc - threshold;
    }
    return Math.abs(lc) - threshold;
  }
  return contrastRatio(sample, mappedReference, options) - threshold;
}

export function estimateRegionValidityScore(
  regionPath: ColorAreaContrastRegionPoint[],
  mappedReference: Color,
  hue: number,
  gamut: GamutTarget,
  metric: ContrastMetric | undefined,
  threshold: number,
  apcaPolarity: ContrastApcaPolarity | undefined,
  apcaRole: ContrastApcaRole | undefined,
): number {
  if (regionPath.length < 3) return 0;
  let minL = Number.POSITIVE_INFINITY;
  let maxL = Number.NEGATIVE_INFINITY;
  let minC = Number.POSITIVE_INFINITY;
  let maxC = Number.NEGATIVE_INFINITY;
  for (const point of regionPath) {
    minL = Math.min(minL, point.l);
    maxL = Math.max(maxL, point.l);
    minC = Math.min(minC, point.c);
    maxC = Math.max(maxC, point.c);
  }
  const spanL = Math.max(0, maxL - minL);
  const spanC = Math.max(0, maxC - minC);
  if (spanL <= 1e-6 || spanC <= 1e-6) {
    return 0;
  }

  let insideCount = 0;
  let validCount = 0;
  const samplesPerAxis = 5;
  for (let y = 0; y < samplesPerAxis; y += 1) {
    for (let x = 0; x < samplesPerAxis; x += 1) {
      const l = minL + ((x + 0.5) / samplesPerAxis) * spanL;
      const c = minC + ((y + 0.5) / samplesPerAxis) * spanC;
      if (!pointInPolygonLc({ l, c }, regionPath)) {
        continue;
      }
      insideCount += 1;
      const mappedSample = mapColorToGamut(
        {
          l,
          c,
          h: hue,
          alpha: mappedReference.alpha,
        },
        gamut,
      );
      const score = evaluateContrastCriterionScore(
        mappedSample,
        mappedReference,
        gamut,
        metric,
        threshold,
        apcaPolarity,
        apcaRole,
      );
      if (score >= 0) {
        validCount += 1;
      }
    }
  }

  if (insideCount === 0) {
    return 0;
  }
  return validCount / insideCount;
}

export function projectToBoundarySegment(
  point: ColorAreaLcPoint,
  start: ColorAreaLcPoint,
  end: ColorAreaLcPoint,
): { projected: ColorAreaContrastRegionPoint; distance: number } {
  const dl = end.l - start.l;
  const dc = end.c - start.c;
  const lengthSquared = dl * dl + dc * dc;
  if (lengthSquared <= 1e-12) {
    const distance = distanceInLc(point, start);
    return {
      projected: {
        l: start.l,
        c: start.c,
        x: start.x,
        y: start.y,
      },
      distance,
    };
  }
  const pointDeltaL = point.l - start.l;
  const pointDeltaC = point.c - start.c;
  const t = Math.max(
    0,
    Math.min(1, (pointDeltaL * dl + pointDeltaC * dc) / lengthSquared),
  );
  const projected = {
    l: start.l + dl * t,
    c: start.c + dc * t,
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
  return {
    projected,
    distance: distanceInLc(point, projected),
  };
}

export function projectToBoundary(
  point: ColorAreaLcPoint,
  boundary: ColorAreaLcPoint[],
): { projected: ColorAreaContrastRegionPoint; distance: number } | null {
  if (boundary.length < 2) return null;
  let nearest: {
    projected: ColorAreaContrastRegionPoint;
    distance: number;
  } | null = null;
  for (let index = 0; index < boundary.length - 1; index += 1) {
    const candidate = projectToBoundarySegment(
      point,
      boundary[index],
      boundary[index + 1],
    );
    if (!nearest || candidate.distance < nearest.distance) {
      nearest = candidate;
    }
  }
  return nearest;
}

export function projectToBoundaryWithSegment(
  point: ColorAreaLcPoint,
  boundary: ColorAreaLcPoint[],
): {
  projected: ColorAreaContrastRegionPoint;
  distance: number;
  segmentIndex: number;
} | null {
  if (boundary.length < 2) return null;
  let nearest: {
    projected: ColorAreaContrastRegionPoint;
    distance: number;
    segmentIndex: number;
  } | null = null;
  for (let index = 0; index < boundary.length - 1; index += 1) {
    const candidate = projectToBoundarySegment(
      point,
      boundary[index],
      boundary[index + 1],
    );
    if (!nearest || candidate.distance < nearest.distance) {
      nearest = {
        ...candidate,
        segmentIndex: index,
      };
    }
  }
  return nearest;
}

export function boundaryArcPointsFromSegments(
  boundary: ColorAreaLcPoint[],
  fromSegmentIndex: number,
  toSegmentIndex: number,
  forward: boolean,
): ColorAreaLcPoint[] {
  const count = boundary.length;
  if (count === 0) return [];
  const points: ColorAreaLcPoint[] = [];
  const normalize = (value: number): number =>
    ((value % count) + count) % count;
  let segmentIndex = normalize(fromSegmentIndex);
  const targetSegmentIndex = normalize(toSegmentIndex);
  let guard = 0;
  while (segmentIndex !== targetSegmentIndex && guard < count + 2) {
    guard += 1;
    const vertexIndex = forward
      ? (segmentIndex + 1) % count
      : segmentIndex % count;
    points.push(boundary[vertexIndex]);
    segmentIndex = forward
      ? (segmentIndex + 1) % count
      : (segmentIndex - 1 + count) % count;
  }
  return points;
}

export function dedupeSequential(
  points: ColorAreaContrastRegionPoint[],
): ColorAreaContrastRegionPoint[] {
  if (points.length < 2) return points;
  const deduped: ColorAreaContrastRegionPoint[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    if (!isSamePoint(points[index], deduped[deduped.length - 1])) {
      deduped.push(points[index]);
    }
  }
  return deduped;
}

export function snapPathToBoundary(
  points: ColorAreaContrastRegionPoint[],
  boundary: ColorAreaLcPoint[],
  tolerance: number,
): ColorAreaContrastRegionPoint[] {
  if (points.length < 2 || boundary.length < 2) {
    return points;
  }
  const snapped = points.map((point) => {
    const projected = projectToBoundary(point, boundary);
    if (!projected || projected.distance > tolerance) {
      return point;
    }
    return projected.projected;
  });
  return dedupeSequential(snapped);
}

export function withDomainBaselinePoints(
  boundary: ColorAreaLcPoint[],
  segments: number = 64,
): ColorAreaLcPoint[] {
  if (boundary.length < 2) {
    return boundary;
  }
  const first = boundary[0];
  const last = boundary[boundary.length - 1];
  const extended: ColorAreaLcPoint[] = [...boundary];
  for (let index = 1; index < segments; index += 1) {
    const t = index / segments;
    extended.push({
      l: last.l + (first.l - last.l) * t,
      c: 0,
      x: last.x + (first.x - last.x) * t,
      y: last.y + (first.y - last.y) * t,
    });
  }
  return extended;
}

export function buildBoundaryClosedPath(
  openPath: ColorAreaContrastRegionPoint[],
  boundary: ColorAreaLcPoint[],
  chooseCandidate?: (
    forwardCandidate: ColorAreaContrastRegionPoint[],
    backwardCandidate: ColorAreaContrastRegionPoint[],
  ) => ColorAreaContrastRegionPoint[] | null,
): ColorAreaContrastRegionPoint[] | null {
  if (openPath.length < 2 || boundary.length < 2) {
    return null;
  }
  const start = openPath[0];
  const end = openPath[openPath.length - 1];
  const startProjection = projectToBoundaryWithSegment(start, boundary);
  const endProjection = projectToBoundaryWithSegment(end, boundary);
  if (!startProjection || !endProjection) {
    return null;
  }
  if (
    startProjection.distance > BOUNDARY_CONNECT_TOLERANCE ||
    endProjection.distance > BOUNDARY_CONNECT_TOLERANCE
  ) {
    return null;
  }

  const buildCandidate = (forward: boolean): ColorAreaContrastRegionPoint[] => {
    const connector = boundaryArcPointsFromSegments(
      boundary,
      endProjection.segmentIndex,
      startProjection.segmentIndex,
      forward,
    );
    const candidate: ColorAreaContrastRegionPoint[] = [...openPath];
    if (
      !isSamePoint(candidate[candidate.length - 1], endProjection.projected)
    ) {
      candidate.push(endProjection.projected);
    }
    if (
      connector.length > 0 &&
      !isSamePoint(candidate[candidate.length - 1], connector[0])
    ) {
      candidate.push({
        ...connector[0],
      });
    }
    for (let index = 1; index < connector.length; index += 1) {
      candidate.push({
        ...connector[index],
      });
    }
    if (
      !isSamePoint(candidate[candidate.length - 1], startProjection.projected)
    ) {
      candidate.push(startProjection.projected);
    }
    if (!isSamePoint(candidate[candidate.length - 1], start)) {
      candidate.push(start);
    }
    const deduped = dedupeSequential(candidate);
    if (!isPathClosed(deduped)) {
      deduped.push(deduped[0]);
    }
    return deduped;
  };

  const forwardCandidate = buildCandidate(true);
  const backwardCandidate = buildCandidate(false);
  const chosenCandidate = chooseCandidate?.(
    forwardCandidate,
    backwardCandidate,
  );
  if (chosenCandidate) {
    return chosenCandidate;
  }
  if (forwardCandidate.length < 3 && backwardCandidate.length < 3) {
    return null;
  }
  if (forwardCandidate.length < 3) {
    return backwardCandidate;
  }
  if (backwardCandidate.length < 3) {
    return forwardCandidate;
  }
  const forwardArea = polygonArea(forwardCandidate);
  const backwardArea = polygonArea(backwardCandidate);
  const smallerArea = Math.min(forwardArea, backwardArea);
  const largerArea = Math.max(forwardArea, backwardArea);
  // Prefer the non-degenerate candidate when one option nearly collapses.
  if (
    largerArea > 0 &&
    (smallerArea <= 0.00005 || largerArea / Math.max(smallerArea, 1e-9) > 25)
  ) {
    return forwardArea >= backwardArea ? forwardCandidate : backwardCandidate;
  }
  return polylineLength(forwardCandidate) <= polylineLength(backwardCandidate)
    ? forwardCandidate
    : backwardCandidate;
}

/** Inputs to {@link buildContrastRegionFillPaths}. */
export interface ContrastRegionFillInput {
  /** Contours, already snapped to the boundary. */
  paths: ColorAreaContrastRegionPoint[][];
  /** Gamut boundary extended along the `c = 0` baseline. */
  fillBoundary: ColorAreaLcPoint[];
  /** Reference color mapped into `gamut`. */
  mappedReference: Color;
  hue: number;
  gamut: GamutTarget;
  metric: ContrastMetric | undefined;
  threshold: number;
  apcaPolarity: ContrastApcaPolarity | undefined;
  apcaRole: ContrastApcaRole | undefined;
}

/**
 * Closes each contour into a fillable polygon: closed contours are kept,
 * open ones are closed along the gamut boundary on the side that excludes
 * the reference (or, failing that, scores better against the contrast
 * check). Polygons containing the reference and degenerate slivers are
 * dropped when an alternative exists.
 */
export function buildContrastRegionFillPaths({
  paths,
  fillBoundary,
  mappedReference,
  hue,
  gamut,
  metric,
  threshold,
  apcaPolarity,
  apcaRole,
}: ContrastRegionFillInput): ColorAreaContrastRegionPoint[][] {
  const referencePoint = { l: mappedReference.l, c: mappedReference.c };
  const candidates: ColorAreaContrastRegionPoint[][] = [];
  for (const points of paths) {
    if (points.length < 2) {
      continue;
    }
    if (isPathClosed(points)) {
      candidates.push(points);
      continue;
    }
    const boundaryClosedPath = buildBoundaryClosedPath(
      points,
      fillBoundary,
      (forwardCandidate, backwardCandidate) => {
        const forwardContainsReference = pointInPolygonLc(
          referencePoint,
          forwardCandidate,
        );
        const backwardContainsReference = pointInPolygonLc(
          referencePoint,
          backwardCandidate,
        );
        if (forwardContainsReference !== backwardContainsReference) {
          return forwardContainsReference
            ? backwardCandidate
            : forwardCandidate;
        }
        const forwardScore = estimateRegionValidityScore(
          forwardCandidate,
          mappedReference,
          hue,
          gamut,
          metric,
          threshold,
          apcaPolarity,
          apcaRole,
        );
        const backwardScore = estimateRegionValidityScore(
          backwardCandidate,
          mappedReference,
          hue,
          gamut,
          metric,
          threshold,
          apcaPolarity,
          apcaRole,
        );
        if (Math.abs(forwardScore - backwardScore) > 0.08) {
          return forwardScore >= backwardScore
            ? forwardCandidate
            : backwardCandidate;
        }
        return null;
      },
    );
    if (boundaryClosedPath) {
      candidates.push(boundaryClosedPath);
      continue;
    }
    // Keep a stable fill even when boundary closure can't be resolved.
    const directClosed = dedupeSequential([...points, points[0]]);
    if (directClosed.length >= 3) {
      candidates.push(directClosed);
    }
  }
  if (candidates.length === 0) {
    return [];
  }
  const candidatesExcludingReference = candidates.filter(
    (candidate) => !pointInPolygonLc(referencePoint, candidate),
  );
  const referenceSafeCandidates =
    candidatesExcludingReference.length > 0
      ? candidatesExcludingReference
      : candidates;
  const nonDegenerate = referenceSafeCandidates.filter(
    (candidate) => polygonArea(candidate) >= REGION_MIN_AREA,
  );
  return nonDegenerate.length > 0 ? nonDegenerate : referenceSafeCandidates;
}
