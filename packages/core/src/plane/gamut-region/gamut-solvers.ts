import {
  linearSrgbToLinearP3,
  oklabToLinearRgb,
  oklchToOklab,
} from '../../conversion/index.js';
import { gamutBoundaryPath, maxChromaAt } from '../../gamut/index.js';
import { maxHctChromaAtTone } from '../../hct/index.js';
import type { Color } from '../../types.js';
import { normalizeHue } from '../../utils/index.js';
import {
  modelColorToPlane,
  planeHue,
  planeToColorUnclamped,
  planeToModelColor,
  usesLightnessAndChroma,
} from '../plane.js';
import {
  limitTracePaths,
  recordTraceStage,
  type InternalPlaneTraceContext,
} from '../trace.js';
import type {
  Plane,
  PlaneChannel,
  PlaneGamutRegionResult,
  PlaneGamutRegionScope,
  PlaneGamutSolver,
  PlaneModel,
  PlaneModelColor,
  PlanePoint,
} from '../types.js';
import {
  buildSegmentPaths,
  CLIP_EPSILON,
  emptyRegion,
  extractAdaptiveContourSegments,
  fullViewportRegion,
  rectRegion,
  simplifyPlanePaths,
  type ScalarBounds,
  type ScalarField,
  type ScalarSampler,
} from './viewport-geometry.js';

export const DEFAULT_BOUNDARY_STEPS = 192;
export const DEFAULT_VIEWPORT_RESOLUTION = 64;
export const DEFAULT_FULL_RESOLUTION = 96;
export const DEFAULT_VIEWPORT_FILL_RESOLUTION = 32;
export const DEFAULT_VIEWPORT_BASE_RESOLUTION = 8;
export const DEFAULT_FULL_BASE_RESOLUTION = 12;
export const DEFAULT_IMPLICIT_MAX_DEPTH = 3;

function readModelChannel(
  modelColor: PlaneModelColor,
  channel: string,
  fallback: number,
): number {
  const value = (modelColor as Record<string, number | undefined>)[channel];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function unclampedNormalize(value: number, range: [number, number]): number {
  const span = range[1] - range[0];
  if (Math.abs(span) <= Number.EPSILON) return 0;
  return (value - range[0]) / span;
}

function gamutMargin(color: Color, gamut: 'srgb' | 'display-p3'): number {
  const lab = oklchToOklab({
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  });
  const linearSrgb = oklabToLinearRgb(lab);
  const linear =
    gamut === 'display-p3' ? linearSrgbToLinearP3(linearSrgb) : linearSrgb;
  return Math.min(
    linear.r,
    linear.g,
    linear.b,
    1 - linear.r,
    1 - linear.g,
    1 - linear.b,
  );
}

export function createFieldEvaluator(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
): ScalarField {
  if (resolvedPlane.model === 'oklch') {
    return (point) => {
      const modelColor = planeToModelColor(resolvedPlane, point, {
        clampToViewport: false,
      });
      const l = Math.min(
        1,
        Math.max(0, readModelChannel(modelColor, 'l', 0.5)),
      );
      const c = Math.max(0, readModelChannel(modelColor, 'c', 0));
      const h = normalizeHue(
        readModelChannel(modelColor, 'h', planeHue(resolvedPlane)),
      );
      return maxChromaAt(l, h, { gamut, alpha: resolvedPlane.fixed.alpha }) - c;
    };
  }

  if (resolvedPlane.model === 'hct' && gamut === 'srgb') {
    return (point) => {
      const modelColor = planeToModelColor(resolvedPlane, point, {
        clampToViewport: false,
      });
      const h = normalizeHue(readModelChannel(modelColor, 'h', 0));
      const c = Math.max(0, readModelChannel(modelColor, 'c', 0));
      const t = Math.min(
        100,
        Math.max(0, readModelChannel(modelColor, 't', 50)),
      );
      return maxHctChromaAtTone(h, t) - c;
    };
  }

  return (point) =>
    gamutMargin(planeToColorUnclamped(resolvedPlane, point), gamut);
}

function canonicalChannelBounds(
  model: PlaneModel,
  channel: PlaneChannel,
): [number, number] | null {
  switch (model) {
    case 'oklch':
      if (channel === 'l') return [0, 1];
      if (channel === 'h') return [0, 360];
      return null;
    case 'rgb':
      return [0, 255];
    case 'hsl':
      if (channel === 'h') return [0, 360];
      if (channel === 's' || channel === 'l') return [0, 100];
      return null;
    case 'hsv':
      if (channel === 'h') return [0, 360];
      if (channel === 's' || channel === 'v') return [0, 100];
      return null;
    case 'oklab':
      if (channel === 'L') return [0, 1];
      if (channel === 'a' || channel === 'b') return [-0.4, 0.4];
      return null;
    case 'hct':
      if (channel === 'h') return [0, 360];
      if (channel === 't') return [0, 100];
      return null;
    case 'p3':
    case 'display-p3':
      return [0, 1];
    default:
      return null;
  }
}

export function fullScopeBounds(resolvedPlane: Plane): ScalarBounds {
  const xDomain = canonicalChannelBounds(
    resolvedPlane.model,
    resolvedPlane.x.channel,
  );
  const yDomain = canonicalChannelBounds(
    resolvedPlane.model,
    resolvedPlane.y.channel,
  );
  const minX = xDomain
    ? unclampedNormalize(xDomain[0], resolvedPlane.x.range)
    : 0;
  const maxX = xDomain
    ? unclampedNormalize(xDomain[1], resolvedPlane.x.range)
    : 1;
  const minY = yDomain
    ? unclampedNormalize(yDomain[0], resolvedPlane.y.range)
    : 0;
  const maxY = yDomain
    ? unclampedNormalize(yDomain[1], resolvedPlane.y.range)
    : 1;
  return { minX, maxX, minY, maxY };
}

function buildOklchBoundaryPoint(
  resolvedPlane: Plane,
  l: number,
  c: number,
  h: number,
): PlanePoint {
  return modelColorToPlane(
    resolvedPlane,
    {
      ...resolvedPlane.fixed,
      l,
      c,
      h,
      alpha: resolvedPlane.fixed.alpha,
    },
    { clampToViewport: false },
  );
}

function buildHctBoundaryPoint(
  resolvedPlane: Plane,
  h: number,
  c: number,
  t: number,
): PlanePoint {
  return modelColorToPlane(
    resolvedPlane,
    {
      ...resolvedPlane.fixed,
      h,
      c,
      t,
      alpha: resolvedPlane.fixed.alpha,
    },
    { clampToViewport: false },
  );
}

function buildAnalyticLcBoundary(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
): PlanePoint[] {
  const hue = planeHue(resolvedPlane);
  return gamutBoundaryPath(hue, {
    gamut,
    samplingMode: 'adaptive',
  }).map((point) =>
    buildOklchBoundaryPoint(resolvedPlane, point.l, point.c, hue),
  );
}

function buildAnalyticHcBoundary(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
): PlanePoint[] {
  const fixedLightness = Math.min(
    1,
    Math.max(0, readModelChannel(resolvedPlane.fixed, 'l', 0.5)),
  );
  const points: PlanePoint[] = [];
  for (let index = 0; index <= DEFAULT_BOUNDARY_STEPS; index += 1) {
    const hue = (index / DEFAULT_BOUNDARY_STEPS) * 360;
    const chroma = maxChromaAt(fixedLightness, hue, {
      gamut,
      alpha: resolvedPlane.fixed.alpha,
    });
    points.push(
      buildOklchBoundaryPoint(resolvedPlane, fixedLightness, chroma, hue),
    );
  }
  return points;
}

function buildAnalyticHctBoundary(resolvedPlane: Plane): PlanePoint[] {
  const xChannel = resolvedPlane.x.channel;
  const yChannel = resolvedPlane.y.channel;
  const points: PlanePoint[] = [];

  if (
    (xChannel === 'h' && yChannel === 'c') ||
    (xChannel === 'c' && yChannel === 'h')
  ) {
    const tone = Math.min(
      100,
      Math.max(0, readModelChannel(resolvedPlane.fixed, 't', 50)),
    );
    for (let index = 0; index <= DEFAULT_BOUNDARY_STEPS; index += 1) {
      const hue = (index / DEFAULT_BOUNDARY_STEPS) * 360;
      points.push(
        buildHctBoundaryPoint(
          resolvedPlane,
          hue,
          maxHctChromaAtTone(hue, tone),
          tone,
        ),
      );
    }
    return points;
  }

  const hue = normalizeHue(readModelChannel(resolvedPlane.fixed, 'h', 0));
  for (let index = 0; index <= DEFAULT_BOUNDARY_STEPS; index += 1) {
    const tone = (index / DEFAULT_BOUNDARY_STEPS) * 100;
    points.push(
      buildHctBoundaryPoint(
        resolvedPlane,
        hue,
        maxHctChromaAtTone(hue, tone),
        tone,
      ),
    );
  }
  return points;
}

export function buildDomainEdgeViewportResult(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
  scope: PlaneGamutRegionScope,
  simplifyTolerance?: number,
): PlaneGamutRegionResult {
  const axisInterval = (
    channel: PlaneChannel,
    range: [number, number],
  ): { min: number; max: number } => {
    const domain = canonicalChannelBounds(resolvedPlane.model, channel);
    if (!domain) {
      return { min: 0, max: 1 };
    }
    const first = unclampedNormalize(domain[0], range);
    const second = unclampedNormalize(domain[1], range);
    return {
      min: Math.min(first, second),
      max: Math.max(first, second),
    };
  };

  const xInterval = axisInterval(
    resolvedPlane.x.channel,
    resolvedPlane.x.range,
  );
  const yInterval = axisInterval(
    resolvedPlane.y.channel,
    resolvedPlane.y.range,
  );
  const clippedMinX = Math.max(0, xInterval.min);
  const clippedMaxX = Math.min(1, xInterval.max);
  const clippedMinY = Math.max(0, yInterval.min);
  const clippedMaxY = Math.min(1, yInterval.max);

  if (
    clippedMaxX - clippedMinX <= CLIP_EPSILON ||
    clippedMaxY - clippedMinY <= CLIP_EPSILON
  ) {
    return {
      kind: 'gamutRegion',
      gamut,
      scope,
      viewportRelation: 'outside',
      solver: 'domain-edge',
      boundaryPaths:
        scope === 'full'
          ? simplifyPlanePaths(
              [
                [
                  {
                    x: Math.min(xInterval.min, xInterval.max),
                    y: Math.min(yInterval.min, yInterval.max),
                  },
                  {
                    x: Math.max(xInterval.min, xInterval.max),
                    y: Math.min(yInterval.min, yInterval.max),
                  },
                  {
                    x: Math.max(xInterval.min, xInterval.max),
                    y: Math.max(yInterval.min, yInterval.max),
                  },
                  {
                    x: Math.min(xInterval.min, xInterval.max),
                    y: Math.max(yInterval.min, yInterval.max),
                  },
                ],
              ],
              simplifyTolerance,
            )
          : [],
      visibleRegion: emptyRegion(),
    };
  }

  const inside =
    clippedMinX <= CLIP_EPSILON &&
    clippedMaxX >= 1 - CLIP_EPSILON &&
    clippedMinY <= CLIP_EPSILON &&
    clippedMaxY >= 1 - CLIP_EPSILON;

  const viewportBoundaryPaths: PlanePoint[][] = [];
  if (clippedMinX > CLIP_EPSILON) {
    viewportBoundaryPaths.push([
      { x: clippedMinX, y: clippedMinY },
      { x: clippedMinX, y: clippedMaxY },
    ]);
  }
  if (clippedMaxX < 1 - CLIP_EPSILON) {
    viewportBoundaryPaths.push([
      { x: clippedMaxX, y: clippedMinY },
      { x: clippedMaxX, y: clippedMaxY },
    ]);
  }
  if (clippedMinY > CLIP_EPSILON) {
    viewportBoundaryPaths.push([
      { x: clippedMinX, y: clippedMinY },
      { x: clippedMaxX, y: clippedMinY },
    ]);
  }
  if (clippedMaxY < 1 - CLIP_EPSILON) {
    viewportBoundaryPaths.push([
      { x: clippedMinX, y: clippedMaxY },
      { x: clippedMaxX, y: clippedMaxY },
    ]);
  }

  const fullBoundaryPaths = simplifyPlanePaths(
    [
      [
        {
          x: Math.min(xInterval.min, xInterval.max),
          y: Math.min(yInterval.min, yInterval.max),
        },
        {
          x: Math.max(xInterval.min, xInterval.max),
          y: Math.min(yInterval.min, yInterval.max),
        },
        {
          x: Math.max(xInterval.min, xInterval.max),
          y: Math.max(yInterval.min, yInterval.max),
        },
        {
          x: Math.min(xInterval.min, xInterval.max),
          y: Math.max(yInterval.min, yInterval.max),
        },
      ],
    ],
    simplifyTolerance,
  );

  return {
    kind: 'gamutRegion',
    gamut,
    scope,
    viewportRelation: inside ? 'inside' : 'intersects',
    solver: 'domain-edge',
    boundaryPaths:
      scope === 'full'
        ? fullBoundaryPaths
        : simplifyPlanePaths(viewportBoundaryPaths, simplifyTolerance),
    visibleRegion: inside
      ? fullViewportRegion()
      : rectRegion(clippedMinX, clippedMaxX, clippedMinY, clippedMaxY),
  };
}

/**
 * Policy matrix mapping a resolved plane + gamut target to the solver
 * strategy used by `getPlaneGamutRegion()`.
 */
export function resolveGamutSolver(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
): PlaneGamutSolver {
  if (
    resolvedPlane.model === 'rgb' ||
    resolvedPlane.model === 'hsl' ||
    resolvedPlane.model === 'hsv' ||
    (resolvedPlane.model === 'p3' && gamut === 'display-p3')
  ) {
    return 'domain-edge';
  }

  if (usesLightnessAndChroma(resolvedPlane)) {
    return 'analytic-lc';
  }

  if (
    resolvedPlane.model === 'oklch' &&
    ((resolvedPlane.x.channel === 'h' && resolvedPlane.y.channel === 'c') ||
      (resolvedPlane.x.channel === 'c' && resolvedPlane.y.channel === 'h'))
  ) {
    return 'analytic-hc';
  }

  if (
    resolvedPlane.model === 'hct' &&
    gamut === 'srgb' &&
    ((resolvedPlane.x.channel === 'h' && resolvedPlane.y.channel === 'c') ||
      (resolvedPlane.x.channel === 'c' && resolvedPlane.y.channel === 'h') ||
      (resolvedPlane.x.channel === 't' && resolvedPlane.y.channel === 'c') ||
      (resolvedPlane.x.channel === 'c' && resolvedPlane.y.channel === 't'))
  ) {
    return 'analytic-hct';
  }

  return 'implicit-contour';
}

export function buildFullBoundaryPaths(
  resolvedPlane: Plane,
  gamut: 'srgb' | 'display-p3',
  solver: PlaneGamutSolver,
  simplifyTolerance?: number,
): PlanePoint[][] {
  const rawPaths: PlanePoint[][] = (() => {
    switch (solver) {
      case 'analytic-lc':
        return [buildAnalyticLcBoundary(resolvedPlane, gamut)];
      case 'analytic-hc':
        return [buildAnalyticHcBoundary(resolvedPlane, gamut)];
      case 'analytic-hct':
        return [buildAnalyticHctBoundary(resolvedPlane)];
      default:
        return [];
    }
  })();
  return simplifyPlanePaths(rawPaths, simplifyTolerance);
}

export function buildImplicitBoundaryPaths(
  sampler: ScalarSampler,
  scope: PlaneGamutRegionScope,
  resolvedPlane: Plane,
  simplifyTolerance?: number,
  trace?: InternalPlaneTraceContext | null,
): PlanePoint[][] {
  const bounds =
    scope === 'full'
      ? fullScopeBounds(resolvedPlane)
      : { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  const adaptiveContour = extractAdaptiveContourSegments(
    sampler,
    bounds,
    scope === 'full'
      ? DEFAULT_FULL_BASE_RESOLUTION
      : DEFAULT_VIEWPORT_BASE_RESOLUTION,
    DEFAULT_IMPLICIT_MAX_DEPTH,
    trace,
    scope === 'full' ? 'implicit-full-boundary' : 'implicit-viewport-boundary',
  );
  const simplified = simplifyPlanePaths(
    buildSegmentPaths(adaptiveContour.segments),
    simplifyTolerance,
  );
  recordTraceStage(trace, {
    kind: 'paths',
    label: scope === 'full' ? 'implicit-full-paths' : 'implicit-viewport-paths',
    pathCount: simplified.length,
    pointCount: simplified.reduce((total, path) => total + path.length, 0),
    paths: limitTracePaths(trace, simplified),
  });
  return simplified;
}
