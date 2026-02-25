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
  oklabToLinearRgb,
  oklchToOklab,
  toP3Gamut,
  toSrgbGamut,
  type Color,
  type ContrastRegionLevel,
  type GamutTarget,
} from '@color-kit/core';
import {
  getColorAreaContrastRegionPaths,
  getColorAreaGamutBoundaryPoints,
  type ColorAreaContrastRegionOptions,
  type ColorAreaContrastRegionPoint,
} from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';
import { Layer, type LayerProps } from './layer.js';
import { Line, pathWithRoundedCorners } from './line.js';
import { PathPointsOverlay } from './path-points-overlay.js';
import type { ColorAreaLayerQuality } from './gamut-boundary-layer.js';
import type {
  ContrastRegionWorkerRequest,
  ContrastRegionWorkerResponse,
} from './workers/contrast-region.worker.types.js';

export interface ContrastRegionLayerMetrics {
  source: 'sync' | 'worker';
  requestId: number;
  computeTimeMs: number;
  pathCount: number;
  pointCount: number;
  lightnessSteps: number;
  chromaSteps: number;
  quality: 'high' | 'medium' | 'low';
  isDragging: boolean;
}

export interface ContrastRegionLayerProps extends LayerProps {
  reference?: Color;
  hue?: number;
  gamut?: GamutTarget;
  threshold?: number;
  level?: ColorAreaContrastRegionOptions['level'];
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
  /** 'uniform' (default) or 'adaptive' grid for contour extraction */
  samplingMode?: 'uniform' | 'adaptive';
  adaptiveBaseSteps?: number;
  adaptiveMaxDepth?: number;
  /** Corner radius in 0-1 for path vertices; omit for sharp corners */
  cornerRadius?: number;
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
  const [size, setSize] = useState({ width: 100, height: 100 });
  const hasRegionPath = regionPathData.length > 0;

  const dotOpacityClamped = clamp01(dotOpacity);
  const dotSizeEffective = Math.max(1, dotSize);
  const dotGapEffective = Math.max(0, dotGap);
  const dotCell = dotSizeEffective + dotGapEffective;
  const dotCellX = (dotCell * 100) / Math.max(1, size.width);
  const dotCellY = (dotCell * 100) / Math.max(1, size.height);
  const dotSizeX = (dotSizeEffective * 100) / Math.max(1, size.width);
  const dotSizeY = (dotSizeEffective * 100) / Math.max(1, size.height);

  useEffect(() => {
    if (
      dotOpacityClamped <= 0 ||
      !hasRegionPath ||
      typeof window === 'undefined'
    ) {
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setSize((current) => {
        if (
          Math.abs(current.width - rect.width) < 0.5 &&
          Math.abs(current.height - rect.height) < 0.5
        ) {
          return current;
        }
        return { width: rect.width, height: rect.height };
      });
    };
    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(measure);
    };
    schedule();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(schedule);
      observer.observe(svg);
      return () => {
        observer.disconnect();
        if (frame !== 0) window.cancelAnimationFrame(frame);
      };
    }
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [dotOpacityClamped, hasRegionPath]);

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

function resolveQuality(
  quality: ColorAreaLayerQuality,
  contextQuality: 'high' | 'medium' | 'low',
): 'high' | 'medium' | 'low' {
  if (quality === 'auto') {
    return contextQuality;
  }
  return quality;
}

function qualityStepMultiplier(quality: 'high' | 'medium' | 'low'): number {
  if (quality === 'high') return 1;
  if (quality === 'medium') return 0.68;
  return 0.45;
}

const MIN_AUTO_ADAPTIVE_BASE_STEPS = 8;
const MAX_AUTO_ADAPTIVE_BASE_STEPS = 48;
const MIN_AUTO_ADAPTIVE_DEPTH = 1;
const MAX_AUTO_ADAPTIVE_DEPTH = 6;

function autoAdaptiveBaseSteps(
  quality: 'high' | 'medium' | 'low',
  widthPx: number,
  heightPx: number,
): number {
  const targetCellPx = quality === 'high' ? 28 : quality === 'medium' ? 36 : 48;
  const longestEdge = Math.max(1, Math.max(widthPx, heightPx));
  const baseSteps = Math.round(longestEdge / targetCellPx);
  return Math.min(
    MAX_AUTO_ADAPTIVE_BASE_STEPS,
    Math.max(MIN_AUTO_ADAPTIVE_BASE_STEPS, baseSteps),
  );
}

function autoAdaptiveMaxDepth(
  quality: 'high' | 'medium' | 'low',
  widthPx: number,
  heightPx: number,
  baseSteps: number,
): number {
  const longestEdge = Math.max(1, Math.max(widthPx, heightPx));
  const baseCellPx = longestEdge / Math.max(1, baseSteps);
  const targetLeafPx = quality === 'high' ? 7 : quality === 'medium' ? 9 : 12;
  const depth = Math.ceil(Math.log2(Math.max(1, baseCellPx / targetLeafPx)));
  return Math.min(
    MAX_AUTO_ADAPTIVE_DEPTH,
    Math.max(MIN_AUTO_ADAPTIVE_DEPTH, depth),
  );
}

function canUseWorkerOffload(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function countPathPoints(paths: ColorAreaContrastRegionPoint[][]): number {
  return paths.reduce((total, path) => total + path.length, 0);
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

function resolveContrastThresholdValue(
  threshold: number | undefined,
  level: ContrastRegionLevel | undefined,
): number {
  if (typeof threshold === 'number') {
    return threshold;
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

function estimateRegionValidityScore(
  regionPath: ColorAreaContrastRegionPoint[],
  mappedReference: Color,
  hue: number,
  gamut: GamutTarget,
  threshold: number,
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
      const ratio = contrastRatioUnclamped(mappedSample, mappedReference);
      if (ratio >= threshold) {
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
  threshold,
  level,
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
  cornerRadius,
  children,
  ...props
}: ContrastRegionLayerProps) {
  const { areaRef, requested, axes, qualityLevel, isDragging } =
    useColorAreaContext();
  const [areaSize, setAreaSize] = useState({
    width: 0,
    height: 0,
    dpr: 1,
  });
  const resolvedQuality = resolveQuality(quality, qualityLevel);
  const multiplier = qualityStepMultiplier(resolvedQuality);
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const areaNode = areaRef.current;
    if (!areaNode) {
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = areaNode.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      const nextDpr = window.devicePixelRatio || 1;
      setAreaSize((current) => {
        if (
          Math.abs(current.width - rect.width) < 0.5 &&
          Math.abs(current.height - rect.height) < 0.5 &&
          Math.abs(current.dpr - nextDpr) < 0.01
        ) {
          return current;
        }
        return {
          width: rect.width,
          height: rect.height,
          dpr: nextDpr,
        };
      });
    };
    const schedule = () => {
      if (frame !== 0) {
        return;
      }
      frame = window.requestAnimationFrame(measure);
    };

    schedule();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(schedule);
      observer.observe(areaNode);
      window.addEventListener('resize', schedule);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', schedule);
        if (frame !== 0) {
          window.cancelAnimationFrame(frame);
        }
      };
    }

    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [areaRef]);

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
    return autoAdaptiveBaseSteps(resolvedQuality, widthPx, heightPx);
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
      autoAdaptiveBaseSteps(resolvedQuality, widthPx, heightPx);
    return autoAdaptiveMaxDepth(resolvedQuality, widthPx, heightPx, baseSteps);
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

  const options = useMemo<ColorAreaContrastRegionOptions>(
    () => ({
      gamut,
      threshold,
      level,
      lightnessSteps: stepsForOptions.lightness,
      chromaSteps: stepsForOptions.chroma,
      maxChroma,
      tolerance,
      maxIterations,
      alpha,
      edgeInterpolation,
      simplifyTolerance,
      samplingMode,
      adaptiveBaseSteps: adaptiveForOptions.baseSteps,
      adaptiveMaxDepth: adaptiveForOptions.maxDepth,
    }),
    [
      alpha,
      edgeInterpolation,
      stepsForOptions.lightness,
      stepsForOptions.chroma,
      adaptiveForOptions.baseSteps,
      adaptiveForOptions.maxDepth,
      gamut,
      level,
      maxChroma,
      maxIterations,
      simplifyTolerance,
      samplingMode,
      threshold,
      tolerance,
    ],
  );

  const syncComputation = useMemo(() => {
    if (isDragging && canUseWorkerOffload()) {
      return null;
    }
    const start = nowMs();
    const paths = getColorAreaContrastRegionPaths(
      contrastReference,
      resolvedHue,
      axes,
      options,
    );
    return {
      paths,
      computeTimeMs: nowMs() - start,
    };
  }, [axes, contrastReference, isDragging, options, resolvedHue]);
  const workerPayload = useMemo(
    () => ({
      reference: contrastReference,
      hue: resolvedHue,
      axes,
      options,
    }),
    [axes, contrastReference, options, resolvedHue],
  );

  const [workerPaths, setWorkerPaths] = useState<{
    requestId: number;
    payload: typeof workerPayload;
    paths: ColorAreaContrastRegionPoint[][];
  } | null>(null);
  const [activeWorkerRequestId, setActiveWorkerRequestId] = useState<
    number | null
  >(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const rawPathsAreFresh = useMemo(() => {
    if (!(isDragging && canUseWorkerOffload())) return true;
    return (
      activeWorkerRequestId != null &&
      workerPaths != null &&
      workerPaths.requestId === activeWorkerRequestId &&
      workerPaths.paths.length > 0
    );
  }, [activeWorkerRequestId, isDragging, workerPaths]);

  const rawPaths = useMemo(() => {
    if (isDragging && canUseWorkerOffload()) {
      if (rawPathsAreFresh && workerPaths != null) {
        return workerPaths.paths;
      }
      if (lastStablePaths.length > 0) {
        return lastStablePaths;
      }
      return syncComputation?.paths ?? [];
    }
    return syncComputation?.paths ?? [];
  }, [
    isDragging,
    lastStablePaths,
    rawPathsAreFresh,
    syncComputation,
    workerPaths,
  ]);

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

  const emitMetrics = useCallback(
    (payload: {
      source: 'sync' | 'worker';
      requestId: number;
      computeTimeMs: number;
      paths: ColorAreaContrastRegionPoint[][];
    }) => {
      onMetrics?.({
        source: payload.source,
        requestId: payload.requestId,
        computeTimeMs: payload.computeTimeMs,
        pathCount: payload.paths.length,
        pointCount: countPathPoints(payload.paths),
        lightnessSteps: effectiveLightnessSteps,
        chromaSteps: effectiveChromaSteps,
        quality: resolvedQuality,
        isDragging,
      });
    },
    [
      effectiveChromaSteps,
      effectiveLightnessSteps,
      isDragging,
      onMetrics,
      resolvedQuality,
    ],
  );

  useEffect(() => {
    if (!syncComputation) {
      return;
    }
    emitMetrics({
      source: 'sync',
      requestId: requestIdRef.current,
      computeTimeMs: syncComputation.computeTimeMs,
      paths: syncComputation.paths,
    });
  }, [emitMetrics, syncComputation]);

  useEffect(() => {
    if (!isDragging) {
      if (syncComputation?.paths && syncComputation.paths.length > 0) {
        queueMicrotask(() => setLastStablePaths(syncComputation.paths));
      }
      return;
    }
    const hasCurrentWorkerResponse =
      activeWorkerRequestId != null &&
      workerPaths != null &&
      workerPaths.requestId === activeWorkerRequestId;
    if (!hasCurrentWorkerResponse || workerPaths.paths.length === 0) {
      return;
    }
    queueMicrotask(() => setLastStablePaths(workerPaths.paths));
  }, [activeWorkerRequestId, isDragging, syncComputation, workerPaths]);

  useEffect(() => {
    if (!canUseWorkerOffload() || !isDragging) {
      queueMicrotask(() => setActiveWorkerRequestId(null));
      return;
    }

    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL('./workers/contrast-region.worker.js', import.meta.url),
          {
            type: 'module',
          },
        );
      } catch {
        if (syncComputation) {
          emitMetrics({
            source: 'sync',
            requestId: requestIdRef.current,
            computeTimeMs: syncComputation.computeTimeMs,
            paths: syncComputation.paths,
          });
        }
        return;
      }
    }

    const worker = workerRef.current;
    if (!worker) {
      if (syncComputation) {
        emitMetrics({
          source: 'sync',
          requestId: requestIdRef.current,
          computeTimeMs: syncComputation.computeTimeMs,
          paths: syncComputation.paths,
        });
      }
      return;
    }

    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    queueMicrotask(() => setActiveWorkerRequestId(nextRequestId));

    const onMessage = (event: MessageEvent<ContrastRegionWorkerResponse>) => {
      const payload = event.data;
      if (!payload || payload.id !== nextRequestId) {
        return;
      }
      if (payload.error) {
        if (syncComputation) {
          emitMetrics({
            source: 'sync',
            requestId: requestIdRef.current,
            computeTimeMs: syncComputation.computeTimeMs,
            paths: syncComputation.paths,
          });
        }
        return;
      }
      setWorkerPaths({
        requestId: payload.id,
        payload: workerPayload,
        paths: payload.paths,
      });
      emitMetrics({
        source: 'worker',
        requestId: payload.id,
        computeTimeMs: payload.computeTimeMs ?? 0,
        paths: payload.paths,
      });
    };

    worker.addEventListener('message', onMessage);

    const message: ContrastRegionWorkerRequest = {
      id: nextRequestId,
      ...workerPayload,
    };
    worker.postMessage(message);

    return () => {
      worker.removeEventListener('message', onMessage);
    };
  }, [emitMetrics, isDragging, syncComputation, workerPayload]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const resolvedThreshold = useMemo(
    () => resolveContrastThresholdValue(threshold, level),
    [level, threshold],
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
            resolvedThreshold,
          );
          const backwardScore = estimateRegionValidityScore(
            backwardCandidate,
            mappedReference,
            resolvedHue,
            gamut,
            resolvedThreshold,
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
    paths,
    referencePoint,
    resolvedHue,
    resolvedThreshold,
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
    if (regionPathData.length > 0 && rawPathsAreFresh) {
      queueMicrotask(() => setLastStableRegionPathData(regionPathData));
      return;
    }
    if (!isDragging && regionPathData.length === 0) {
      queueMicrotask(() => setLastStableRegionPathData(''));
    }
  }, [isDragging, rawPathsAreFresh, regionPathData]);

  const visibleRegionPathData =
    isDragging && (!rawPathsAreFresh || regionPathData.length === 0)
      ? lastStableRegionPathData
      : regionPathData;

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
      data-worker={isDragging && canUseWorkerOffload() ? 'async' : 'sync'}
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
