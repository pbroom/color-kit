import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type SVGAttributes,
} from 'react';
import {
  contrastAPCA,
  oklabToLinearRgb,
  oklchToOklab,
  unpackPlaneQueryResults,
  toP3Gamut,
  toSrgbGamut,
  type ContrastApcaPolarity,
  type ContrastApcaPreset,
  type ContrastApcaRole,
  type ContrastMetric,
  type Color,
  type ContrastRegionLevel,
  type GamutTarget,
  type PlaneContrastRegionResult,
} from '@color-kit/core';
import {
  getColorAreaContrastRegionPaths,
  getColorAreaGamutBoundaryPoints,
  toColorAreaPlaneDefinition,
  type ColorAreaContrastRegionOptions,
  type ColorAreaContrastRegionPoint,
} from '@color-kit/driver';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line, pathWithRoundedCorners } from './line.js';
import { PathPointsOverlay } from './path-points-overlay.js';
import {
  autoAdaptiveRegionBaseSteps,
  autoAdaptiveRegionMaxDepth,
  qualityStepMultiplier,
  REGION_QUALITY_STEP_MULTIPLIERS,
  resolveQuality,
  type ColorAreaLayerQuality,
} from './layer-quality-utils.js';
import { useMeasuredElementSize } from './use-measured-element-size.js';
import {
  usePlaneQueryLayer,
  canUseWorkerOffload,
  type PlaneQueryWorkerPayload,
} from './use-plane-query-layer.js';
import type { PlaneQueryWorkerResponse } from './workers/plane-query-client.js';

export interface ContrastRegionLayerMetrics {
  source: 'sync' | 'worker';
  requestId: number;
  computeTimeMs: number;
  pathCount: number;
  pointCount: number;
  lightnessSteps: number;
  chromaSteps: number;
  samplingMode: 'hybrid' | 'uniform' | 'adaptive';
  contrastMetric: ContrastMetric;
  backend?: 'js' | 'wasm' | 'webgpu';
  scheduleReason?: string;
  schedulerBucketCount?: number;
  wasmCircuitOpen?: boolean;
  wasmParityStatus?:
    | 'ok'
    | 'shape-mismatch'
    | 'numeric-mismatch'
    | 'no-wasm'
    | 'error';
  wasmParityPathDelta?: number;
  wasmParityPointDelta?: number;
  wasmInitStatus?: 'pending' | 'ready' | 'unavailable' | 'error';
  wasmInitError?: string;
  wasmBackendVersion?: string;
  quality: 'high' | 'medium' | 'low';
  isDragging: boolean;
}

export interface ContrastRegionLayerProps extends LayerProps {
  reference?: Color;
  hue?: number;
  gamut?: GamutTarget;
  metric?: ContrastMetric;
  threshold?: number;
  level?: ColorAreaContrastRegionOptions['level'];
  apcaPreset?: ColorAreaContrastRegionOptions['apcaPreset'];
  apcaPolarity?: ColorAreaContrastRegionOptions['apcaPolarity'];
  apcaRole?: ColorAreaContrastRegionOptions['apcaRole'];
  lightnessSteps?: number;
  chromaSteps?: number;
  maxChroma?: number;
  tolerance?: number;
  maxIterations?: number;
  alpha?: number;
  edgeInterpolation?: ColorAreaContrastRegionOptions['edgeInterpolation'];
  quality?: ColorAreaLayerQuality;
  pathProps?: SVGAttributes<SVGPathElement>;
  showPathPoints?: boolean;
  pointProps?: SVGAttributes<SVGCircleElement>;
  onMetrics?: (metrics: ContrastRegionLayerMetrics) => void;
  /** RDP simplification tolerance in (l,c) space; omit to disable */
  simplifyTolerance?: number;
  /** 'hybrid' (default), 'uniform', or 'adaptive' grid for contour extraction */
  samplingMode?: 'hybrid' | 'uniform' | 'adaptive';
  adaptiveBaseSteps?: number;
  adaptiveMaxDepth?: number;
  hybridMaxDepth?: number;
  hybridErrorTolerance?: number;
  includeSchedulerTelemetry?: boolean;
  wasmParityMode?: 'off' | 'shape' | 'numeric';
  /** Corner radius in 0-1 for path vertices; omit for sharp corners */
  cornerRadius?: number;
  /** Optional precomputed contour paths (for plane-driven overlays). */
  paths?: ColorAreaContrastRegionPoint[][];
}

interface ContrastRegionPathContextValue {
  paths: ColorAreaContrastRegionPoint[][];
  regionPathData: string;
  cornerRadius?: number;
}

const ContrastRegionPathContext =
  createContext<ContrastRegionPathContextValue | null>(null);

function useContrastRegionPath(): ContrastRegionPathContextValue {
  const value = useContext(ContrastRegionPathContext);
  if (!value) {
    throw new Error(
      'ContrastRegionFill must be used as a child of ContrastRegionLayer.',
    );
  }
  return value;
}

export interface ContrastRegionFillProps {
  /** Fill color for the region. @default '#c0e1ff' */
  fillColor?: string;
  /** Fill opacity 0–1. @default 0.22 */
  fillOpacity?: number;
  /** Dot pattern opacity 0–1; 0 disables dots. @default 0 */
  dotOpacity?: number;
  /** Dot size in px. @default 2 */
  dotSize?: number;
  /** Gap between dots in px. @default 3 */
  dotGap?: number;
  /** Additional path element props (e.g. fill). */
  pathProps?: SVGAttributes<SVGPathElement>;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Renders a filled region (and optional dot pattern) for the computed contrast
 * contour. Must be used as a child of ContrastRegionLayer.
 */
export function ContrastRegionFill({
  fillColor = '#c0e1ff',
  fillOpacity = 0.22,
  dotOpacity = 0,
  dotSize = 2,
  dotGap = 3,
  pathProps,
}: ContrastRegionFillProps) {
  const { regionPathData } = useContrastRegionPath();
  const patternId = useId().replace(/[:]/g, '_');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hasRegionPath = regionPathData.length > 0;

  const dotOpacityClamped = clamp01(dotOpacity);
  const size = useMeasuredElementSize(svgRef, {
    enabled: dotOpacityClamped > 0 && hasRegionPath,
    initialWidth: 100,
    initialHeight: 100,
  });
  const dotSizeEffective = Math.max(1, dotSize);
  const dotGapEffective = Math.max(0, dotGap);
  const dotCell = dotSizeEffective + dotGapEffective;
  const dotCellX = (dotCell * 100) / Math.max(1, size.width);
  const dotCellY = (dotCell * 100) / Math.max(1, size.height);
  const dotSizeX = (dotSizeEffective * 100) / Math.max(1, size.width);
  const dotSizeY = (dotSizeEffective * 100) / Math.max(1, size.height);

  if (!hasRegionPath) return null;

  return (
    <svg
      ref={svgRef}
      data-color-area-contrast-region-fill=""
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {dotOpacityClamped > 0 ? (
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={dotCellX}
            height={dotCellY}
          >
            <ellipse
              cx={dotSizeX * 0.5}
              cy={dotSizeY * 0.5}
              rx={dotSizeX * 0.5}
              ry={dotSizeY * 0.5}
              fill={`rgba(255,255,255,${dotOpacityClamped})`}
            />
          </pattern>
        </defs>
      ) : null}
      <path
        d={regionPathData}
        fill={fillColor}
        fillOpacity={clamp01(fillOpacity)}
        {...pathProps}
      />
      {dotOpacityClamped > 0 ? (
        <path d={regionPathData} fill={`url(#${patternId})`} stroke="none" />
      ) : null}
    </svg>
  );
}

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function countPathPoints(paths: ColorAreaContrastRegionPoint[][]): number {
  return paths.reduce((total, path) => total + path.length, 0);
}

function toColorAreaContrastRegionPaths(
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

const CLOSED_PATH_TOLERANCE = 1e-6;
const BOUNDARY_CONNECT_TOLERANCE = 0.02;
const BOUNDARY_SNAP_TOLERANCE = 0.008;
const REGION_MIN_AREA = 0.00002;

type ColorAreaLcPoint = Pick<
  ColorAreaContrastRegionPoint,
  'l' | 'c' | 'x' | 'y'
>;

function isPathClosed(points: ColorAreaContrastRegionPoint[]): boolean {
  if (points.length < 2) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(first.x - last.x, first.y - last.y) < CLOSED_PATH_TOLERANCE;
}

function isSamePoint(a: ColorAreaLcPoint, b: ColorAreaLcPoint): boolean {
  return (
    Math.abs(a.x - b.x) < CLOSED_PATH_TOLERANCE &&
    Math.abs(a.y - b.y) < CLOSED_PATH_TOLERANCE
  );
}

function distanceInLc(a: ColorAreaLcPoint, b: ColorAreaLcPoint): number {
  return Math.hypot(a.l - b.l, a.c - b.c);
}

function polylineLength(points: ColorAreaLcPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const next = points[index];
    total += Math.hypot(next.x - prev.x, next.y - prev.y);
  }
  return total;
}

function polygonArea(points: ColorAreaLcPoint[]): number {
  if (points.length < 3) return 0;
  let doubleArea = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    doubleArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(doubleArea) * 0.5;
}

function pointInPolygonLc(
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

const APCA_PRESET_THRESHOLDS: Record<ContrastApcaPreset, number> = {
  body: 0.6,
  'large-text': 0.45,
  ui: 0.3,
};

function resolveContrastThresholdValue(
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

function mapColorToGamut(color: Color, gamut: GamutTarget): Color {
  return gamut === 'display-p3' ? toP3Gamut(color) : toSrgbGamut(color);
}

function relativeLuminanceUnclamped(color: Color): number {
  const linear = oklabToLinearRgb(
    oklchToOklab({
      l: color.l,
      c: color.c,
      h: color.h,
      alpha: color.alpha,
    }),
  );
  return 0.2126 * linear.r + 0.7152 * linear.g + 0.0722 * linear.b;
}

function contrastRatioUnclamped(color1: Color, color2: Color): number {
  const l1 = relativeLuminanceUnclamped(color1);
  const l2 = relativeLuminanceUnclamped(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function evaluateContrastCriterionScore(
  sample: Color,
  mappedReference: Color,
  metric: ContrastMetric | undefined,
  threshold: number,
  apcaPolarity: ContrastApcaPolarity | undefined,
  apcaRole: ContrastApcaRole | undefined,
): number {
  if (metric === 'apca') {
    const lc =
      (apcaRole ?? 'sample-text') === 'sample-background'
        ? contrastAPCA(mappedReference, sample)
        : contrastAPCA(sample, mappedReference);
    if (apcaPolarity === 'positive') {
      return lc - threshold;
    }
    if (apcaPolarity === 'negative') {
      return -lc - threshold;
    }
    return Math.abs(lc) - threshold;
  }
  return contrastRatioUnclamped(sample, mappedReference) - threshold;
}

function estimateRegionValidityScore(
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

function projectToBoundarySegment(
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

function projectToBoundary(
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

function projectToBoundaryWithSegment(
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

function boundaryArcPointsFromSegments(
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

function dedupeSequential(
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

function snapPathToBoundary(
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

function withDomainBaselinePoints(
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

function buildBoundaryClosedPath(
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

function toPath(
  points: ColorAreaContrastRegionPoint[],
  closeLoop: boolean,
  cornerRadius?: number,
): string {
  if (points.length < 2) {
    return '';
  }
  if (cornerRadius != null && cornerRadius > 0) {
    return pathWithRoundedCorners(
      points.map((p) => ({ x: p.x, y: p.y })),
      cornerRadius,
      closeLoop,
    );
  }
  const commands = points.map((point, index) => {
    const x = (point.x * 100).toFixed(3);
    const y = (point.y * 100).toFixed(3);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  });

  if (closeLoop) {
    commands.push('Z');
  }

  return commands.join(' ');
}

/**
 * Precomposed Layer wrapper for drawing contrast-safe paths. Compose
 * ContrastRegionFill as a child for filled region + dot pattern.
 */
export function ContrastRegionLayer({
  reference,
  hue,
  gamut = 'srgb',
  metric,
  threshold,
  level,
  apcaPreset,
  apcaPolarity,
  apcaRole,
  lightnessSteps,
  chromaSteps,
  maxChroma,
  tolerance,
  maxIterations,
  alpha,
  edgeInterpolation = 'linear',
  quality = 'auto',
  pathProps,
  showPathPoints = false,
  pointProps,
  onMetrics,
  simplifyTolerance,
  samplingMode,
  adaptiveBaseSteps,
  adaptiveMaxDepth,
  hybridMaxDepth,
  hybridErrorTolerance,
  includeSchedulerTelemetry = false,
  wasmParityMode = 'off',
  cornerRadius,
  paths: pathsProp,
  children,
  ...props
}: ContrastRegionLayerProps) {
  const {
    areaRef,
    requested,
    axes,
    performanceProfile,
    qualityLevel,
    isDragging,
  } = useColorAreaContext();
  const areaSize = useMeasuredElementSize(areaRef);
  const resolvedQuality = resolveQuality(quality, qualityLevel);
  const multiplier = qualityStepMultiplier(
    resolvedQuality,
    REGION_QUALITY_STEP_MULTIPLIERS,
  );
  const effectiveLightnessSteps = Math.max(
    12,
    Math.round((lightnessSteps ?? 64) * multiplier),
  );
  const effectiveChromaSteps = Math.max(
    12,
    Math.round((chromaSteps ?? 64) * multiplier),
  );

  const resolvedReference = reference ?? requested;
  const resolvedHue = hue ?? requested.h;
  const contrastReference = useMemo(
    () => mapColorToGamut(resolvedReference, gamut),
    [gamut, resolvedReference],
  );

  const [frozenSteps, setFrozenSteps] = useState<{
    lightness: number;
    chroma: number;
  } | null>(null);
  const [frozenAdaptive, setFrozenAdaptive] = useState<{
    baseSteps: number | undefined;
    maxDepth: number | undefined;
  } | null>(null);
  const [lastStablePaths, setLastStablePaths] = useState<
    ColorAreaContrastRegionPoint[][]
  >([]);
  const [lastStableRegionPathData, setLastStableRegionPathData] = useState('');
  const prevDraggingRef = useRef(false);
  const lastIdleSamplingRef = useRef<{
    lightness: number;
    chroma: number;
    baseSteps: number | undefined;
    maxDepth: number | undefined;
  } | null>(null);

  const resolvedAdaptiveBaseSteps = useMemo(() => {
    if (samplingMode !== 'adaptive') {
      return adaptiveBaseSteps;
    }
    if (adaptiveBaseSteps != null) {
      return adaptiveBaseSteps;
    }
    if (areaSize.width <= 0 || areaSize.height <= 0) {
      return undefined;
    }
    const widthPx = areaSize.width * areaSize.dpr;
    const heightPx = areaSize.height * areaSize.dpr;
    return autoAdaptiveRegionBaseSteps(resolvedQuality, widthPx, heightPx);
  }, [
    adaptiveBaseSteps,
    areaSize.dpr,
    areaSize.height,
    areaSize.width,
    resolvedQuality,
    samplingMode,
  ]);

  const resolvedAdaptiveMaxDepth = useMemo(() => {
    if (samplingMode !== 'adaptive') {
      return adaptiveMaxDepth;
    }
    if (adaptiveMaxDepth != null) {
      return adaptiveMaxDepth;
    }
    if (areaSize.width <= 0 || areaSize.height <= 0) {
      return undefined;
    }
    const widthPx = areaSize.width * areaSize.dpr;
    const heightPx = areaSize.height * areaSize.dpr;
    const baseSteps =
      resolvedAdaptiveBaseSteps ??
      autoAdaptiveRegionBaseSteps(resolvedQuality, widthPx, heightPx);
    return autoAdaptiveRegionMaxDepth(
      resolvedQuality,
      widthPx,
      heightPx,
      baseSteps,
    );
  }, [
    adaptiveMaxDepth,
    areaSize.dpr,
    areaSize.height,
    areaSize.width,
    resolvedAdaptiveBaseSteps,
    resolvedQuality,
    samplingMode,
  ]);

  useEffect(() => {
    if (isDragging) {
      return;
    }
    lastIdleSamplingRef.current = {
      lightness: effectiveLightnessSteps,
      chroma: effectiveChromaSteps,
      baseSteps: resolvedAdaptiveBaseSteps,
      maxDepth: resolvedAdaptiveMaxDepth,
    };
  }, [
    effectiveChromaSteps,
    effectiveLightnessSteps,
    isDragging,
    resolvedAdaptiveBaseSteps,
    resolvedAdaptiveMaxDepth,
  ]);

  useEffect(() => {
    if (isDragging && !prevDraggingRef.current) {
      const previousIdleSampling = lastIdleSamplingRef.current ?? {
        lightness: effectiveLightnessSteps,
        chroma: effectiveChromaSteps,
        baseSteps: resolvedAdaptiveBaseSteps,
        maxDepth: resolvedAdaptiveMaxDepth,
      };
      queueMicrotask(() =>
        setFrozenAdaptive({
          baseSteps: previousIdleSampling.baseSteps,
          maxDepth: previousIdleSampling.maxDepth,
        }),
      );
      queueMicrotask(() =>
        setFrozenSteps({
          lightness: previousIdleSampling.lightness,
          chroma: previousIdleSampling.chroma,
        }),
      );
    }
    if (!isDragging) {
      queueMicrotask(() => setFrozenSteps(null));
      queueMicrotask(() => setFrozenAdaptive(null));
    }
    prevDraggingRef.current = isDragging;
  }, [
    isDragging,
    effectiveLightnessSteps,
    effectiveChromaSteps,
    resolvedAdaptiveBaseSteps,
    resolvedAdaptiveMaxDepth,
  ]);

  const stepsForOptions =
    isDragging && frozenSteps
      ? frozenSteps
      : {
          lightness: effectiveLightnessSteps,
          chroma: effectiveChromaSteps,
        };

  const adaptiveForOptions =
    isDragging && frozenAdaptive
      ? {
          baseSteps: frozenAdaptive.baseSteps,
          maxDepth: frozenAdaptive.maxDepth,
        }
      : {
          baseSteps: resolvedAdaptiveBaseSteps,
          maxDepth: resolvedAdaptiveMaxDepth,
        };
  const resolvedSamplingMode = samplingMode ?? 'hybrid';
  const resolvedContrastMetric = metric ?? 'wcag';

  const options = useMemo<ColorAreaContrastRegionOptions>(
    () => ({
      gamut,
      metric,
      threshold,
      level,
      apcaPreset,
      apcaPolarity,
      apcaRole,
      lightnessSteps: stepsForOptions.lightness,
      chromaSteps: stepsForOptions.chroma,
      maxChroma,
      tolerance,
      maxIterations,
      alpha,
      edgeInterpolation,
      simplifyTolerance,
      samplingMode: resolvedSamplingMode,
      adaptiveBaseSteps: adaptiveForOptions.baseSteps,
      adaptiveMaxDepth: adaptiveForOptions.maxDepth,
      hybridMaxDepth,
      hybridErrorTolerance,
    }),
    [
      alpha,
      apcaPolarity,
      apcaPreset,
      apcaRole,
      edgeInterpolation,
      stepsForOptions.lightness,
      stepsForOptions.chroma,
      adaptiveForOptions.baseSteps,
      adaptiveForOptions.maxDepth,
      gamut,
      hybridErrorTolerance,
      hybridMaxDepth,
      level,
      maxChroma,
      maxIterations,
      metric,
      simplifyTolerance,
      resolvedSamplingMode,
      threshold,
      tolerance,
    ],
  );

  const computeSync = useCallback(
    () =>
      getColorAreaContrastRegionPaths(
        contrastReference,
        resolvedHue,
        axes,
        options,
      ),
    [axes, contrastReference, options, resolvedHue],
  );

  const workerPayload = useMemo<PlaneQueryWorkerPayload>(
    () => ({
      plane: toColorAreaPlaneDefinition(axes, contrastReference),
      queries: [
        {
          kind: 'contrastRegion' as const,
          reference: contrastReference,
          ...options,
          hue: resolvedHue,
        },
      ],
      priority: isDragging ? 'drag' : 'idle',
      quality: resolvedQuality,
      performanceProfile,
      includeSchedulerTelemetry,
      includeWasmInitStatus: includeSchedulerTelemetry,
      wasmParityMode,
    }),
    [
      axes,
      contrastReference,
      isDragging,
      options,
      performanceProfile,
      resolvedHue,
      resolvedQuality,
      includeSchedulerTelemetry,
      wasmParityMode,
    ],
  );

  const extractResult = useCallback(
    (
      response: PlaneQueryWorkerResponse,
    ): ColorAreaContrastRegionPoint[][] | undefined => {
      if (response.error) {
        return undefined;
      }
      if (!response.result) {
        return [];
      }
      const unpacked = unpackPlaneQueryResults(response.result);
      const contrastRegionResult = unpacked.find(
        (entry): entry is PlaneContrastRegionResult =>
          entry.kind === 'contrastRegion',
      );
      return contrastRegionResult
        ? toColorAreaContrastRegionPaths(contrastRegionResult)
        : [];
    },
    [],
  );

  const emitMetrics = useCallback(
    (payload: {
      source: 'sync' | 'worker';
      requestId: number;
      computeTimeMs: number;
      paths: ColorAreaContrastRegionPoint[][];
      backend?: 'js' | 'wasm' | 'webgpu';
      scheduleReason?: string;
      schedulerBucketCount?: number;
      wasmCircuitOpen?: boolean;
      wasmParityStatus?:
        | 'ok'
        | 'shape-mismatch'
        | 'numeric-mismatch'
        | 'no-wasm'
        | 'error';
      wasmParityPathDelta?: number;
      wasmParityPointDelta?: number;
      wasmInitStatus?: 'pending' | 'ready' | 'unavailable' | 'error';
      wasmInitError?: string;
      wasmBackendVersion?: string;
    }) => {
      onMetrics?.({
        source: payload.source,
        requestId: payload.requestId,
        computeTimeMs: payload.computeTimeMs,
        pathCount: payload.paths.length,
        pointCount: countPathPoints(payload.paths),
        lightnessSteps: effectiveLightnessSteps,
        chromaSteps: effectiveChromaSteps,
        samplingMode: resolvedSamplingMode,
        contrastMetric: resolvedContrastMetric,
        backend: payload.backend,
        scheduleReason: payload.scheduleReason,
        schedulerBucketCount: payload.schedulerBucketCount,
        wasmCircuitOpen: payload.wasmCircuitOpen,
        wasmParityStatus: payload.wasmParityStatus,
        wasmParityPathDelta: payload.wasmParityPathDelta,
        wasmParityPointDelta: payload.wasmParityPointDelta,
        wasmInitStatus: payload.wasmInitStatus,
        wasmInitError: payload.wasmInitError,
        wasmBackendVersion: payload.wasmBackendVersion,
        quality: resolvedQuality,
        isDragging,
      });
    },
    [
      effectiveChromaSteps,
      effectiveLightnessSteps,
      isDragging,
      onMetrics,
      resolvedContrastMetric,
      resolvedQuality,
      resolvedSamplingMode,
    ],
  );

  const handleWorkerResponse = useCallback(
    (
      response: PlaneQueryWorkerResponse,
      data: ColorAreaContrastRegionPoint[][] | undefined,
    ) => {
      if (response.error || !response.result || data === undefined) {
        return;
      }
      const wasmDisabledUntilMs =
        response.schedulerTelemetry?.circuitBreakers.wasm?.disabledUntilMs ?? 0;
      const now = nowMs();
      emitMetrics({
        source: 'worker',
        requestId: response.id,
        computeTimeMs:
          (response.computeTimeMs ?? 0) + (response.marshalTimeMs ?? 0),
        paths: data,
        backend: response.backend,
        scheduleReason: response.schedule?.reason,
        schedulerBucketCount: response.schedulerTelemetry?.buckets.length,
        wasmCircuitOpen: wasmDisabledUntilMs > now,
        wasmParityStatus: response.wasmParity?.status,
        wasmParityPathDelta: response.wasmParity?.pathCountDelta,
        wasmParityPointDelta: response.wasmParity?.pointCountDelta,
        wasmInitStatus: response.wasmInit?.status,
        wasmInitError: response.wasmInit?.error,
        wasmBackendVersion: response.wasmInit?.backendVersion,
      });
    },
    [emitMetrics],
  );

  const {
    sync,
    workerData,
    hasCurrentWorkerResponse,
    usingWorkerPath,
    requestIdRef,
  } = usePlaneQueryLayer<ColorAreaContrastRegionPoint[][]>({
    external: pathsProp != null,
    isDragging,
    computeSync,
    syncWhileDragging: 'never',
    workerPayload,
    extractResult,
    onWorkerResponse: handleWorkerResponse,
  });

  // External paths participate in metrics and stable-path tracking the same
  // way an instant sync computation would.
  const syncComputation = useMemo(() => {
    if (pathsProp) {
      return {
        paths: pathsProp,
        computeTimeMs: 0,
      };
    }
    return sync
      ? { paths: sync.data, computeTimeMs: sync.computeTimeMs }
      : null;
  }, [pathsProp, sync]);

  const rawPathsAreFresh = useMemo(() => {
    if (pathsProp) return true;
    if (!usingWorkerPath) return true;
    return hasCurrentWorkerResponse;
  }, [hasCurrentWorkerResponse, pathsProp, usingWorkerPath]);

  const rawPaths = useMemo(() => {
    if (pathsProp) {
      return pathsProp;
    }
    if (usingWorkerPath) {
      if (hasCurrentWorkerResponse && workerData != null) {
        return workerData.data;
      }
      if (lastStablePaths.length > 0) {
        return lastStablePaths;
      }
      return syncComputation?.paths ?? [];
    }
    return syncComputation?.paths ?? [];
  }, [
    usingWorkerPath,
    lastStablePaths,
    hasCurrentWorkerResponse,
    pathsProp,
    syncComputation,
    workerData,
  ]);

  useEffect(() => {
    if (!syncComputation) {
      return;
    }
    emitMetrics({
      source: 'sync',
      requestId: requestIdRef.current,
      computeTimeMs: syncComputation.computeTimeMs,
      paths: syncComputation.paths,
      backend: 'js',
      scheduleReason: 'sync-inline',
    });
  }, [emitMetrics, requestIdRef, syncComputation]);

  useEffect(() => {
    if (!isDragging) {
      if (syncComputation?.paths) {
        queueMicrotask(() => setLastStablePaths(syncComputation.paths));
      }
      return;
    }
    if (!hasCurrentWorkerResponse || !workerData) {
      return;
    }
    queueMicrotask(() => setLastStablePaths(workerData.data));
  }, [hasCurrentWorkerResponse, isDragging, syncComputation, workerData]);

  const contrastGamutBoundary = useMemo(
    () =>
      getColorAreaGamutBoundaryPoints(resolvedHue, axes, {
        gamut,
        steps: Math.max(128, stepsForOptions.lightness),
        samplingMode: 'adaptive',
        simplifyTolerance: simplifyTolerance ?? 0.001,
      }),
    [axes, gamut, resolvedHue, simplifyTolerance, stepsForOptions.lightness],
  );

  const paths = useMemo(
    () =>
      rawPaths.map((path) =>
        snapPathToBoundary(
          path,
          contrastGamutBoundary,
          BOUNDARY_SNAP_TOLERANCE,
        ),
      ),
    [contrastGamutBoundary, rawPaths],
  );

  const contrastFillBoundary = useMemo(
    () => withDomainBaselinePoints(contrastGamutBoundary),
    [contrastGamutBoundary],
  );

  const resolvedThreshold = useMemo(
    () => resolveContrastThresholdValue(threshold, level, metric, apcaPreset),
    [apcaPreset, level, metric, threshold],
  );
  const mappedReference = contrastReference;
  const referencePoint = useMemo(
    () => ({
      l: mappedReference.l,
      c: mappedReference.c,
    }),
    [mappedReference.c, mappedReference.l],
  );

  const regionFillPaths = useMemo(() => {
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
        contrastFillBoundary,
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
            resolvedHue,
            gamut,
            metric,
            resolvedThreshold,
            apcaPolarity,
            apcaRole,
          );
          const backwardScore = estimateRegionValidityScore(
            backwardCandidate,
            mappedReference,
            resolvedHue,
            gamut,
            metric,
            resolvedThreshold,
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
  }, [
    contrastFillBoundary,
    gamut,
    mappedReference,
    metric,
    paths,
    referencePoint,
    resolvedHue,
    resolvedThreshold,
    apcaPolarity,
    apcaRole,
  ]);

  const regionPathData = useMemo(
    () =>
      regionFillPaths
        .map((points) => toPath(points, true, cornerRadius))
        .filter((path) => path.length > 0)
        .join(' '),
    [regionFillPaths, cornerRadius],
  );

  useEffect(() => {
    if (rawPathsAreFresh) {
      queueMicrotask(() => setLastStableRegionPathData(regionPathData));
    }
  }, [rawPathsAreFresh, regionPathData]);

  const visibleRegionPathData =
    isDragging && !rawPathsAreFresh ? lastStableRegionPathData : regionPathData;

  const pathContextValue: ContrastRegionPathContextValue = useMemo(
    () => ({
      paths,
      regionPathData: visibleRegionPathData,
      cornerRadius,
    }),
    [paths, visibleRegionPathData, cornerRadius],
  );

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-contrast-region-layer=""
      data-quality={resolvedQuality}
      data-worker={
        pathsProp
          ? 'external'
          : isDragging && canUseWorkerOffload()
            ? 'async'
            : 'sync'
      }
    >
      <ContrastRegionPathContext.Provider value={pathContextValue}>
        {children}
      </ContrastRegionPathContext.Provider>
      {paths.map((points, index) => {
        const closed = isPathClosed(points);
        return (
          <Line
            key={index}
            points={points}
            cornerRadius={cornerRadius}
            closed={closed}
            pathProps={{
              fill: 'none',
              ...pathProps,
            }}
          />
        );
      })}
      {showPathPoints ? (
        <PathPointsOverlay
          paths={paths}
          pointProps={pointProps}
          data-color-area-contrast-region-points=""
        />
      ) : null}
    </Layer>
  );
}
