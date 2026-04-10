import {
  chromaBand,
  gamutBoundaryPath,
  toP3Gamut,
  toSrgbGamut,
} from '../gamut/index.js';
import { contrastRegionPath, contrastRegionPaths } from '../contrast/index.js';
import { generateScale } from '../scale/index.js';
import type { Color } from '../types.js';
import { getPlaneGamutRegion } from './gamut-region.js';
import {
  createPlaneTraceContext,
  finalizePlaneTrace,
  type InternalPlaneTraceContext,
} from './trace.js';
import type {
  Plane,
  PlaneChromaBandQuery,
  PlaneChromaBandResult,
  PlaneContrastBoundaryQuery,
  PlaneContrastBoundaryResult,
  PlaneContrastRegionQuery,
  PlaneContrastRegionResult,
  PlaneDefinition,
  PlaneFallbackPointQuery,
  PlaneFallbackPointResult,
  PlaneGamutBoundaryQuery,
  PlaneGamutBoundaryResult,
  PlaneGamutRegionQuery,
  PlaneGamutRegionResult,
  PlaneGradientQuery,
  PlaneGradientResult,
  PlaneQueryInspection,
  PlaneQuery,
  PlaneQueryResult,
  PlaneQueryTraceOptions,
} from './types.js';
import {
  colorToPlane,
  planeHue,
  planeToColor,
  resolvePlaneDefinition,
  usesLightnessAndChroma,
} from './plane.js';

export { getPlaneGamutRegion };

/**
 * Converts an `(l, c)` boundary point into normalized plane coordinates.
 *
 * @param resolvedPlane Resolved plane definition with fixed channels.
 * @param hue Hue value to apply while rebuilding the color.
 * @param point Boundary point in lightness/chroma space.
 */
function toPlaneBoundaryPoint(
  resolvedPlane: Plane,
  hue: number,
  point: { l: number; c: number },
) {
  const color: Color = {
    l: point.l,
    c: point.c,
    h: hue,
    alpha: resolvedPlane.fixed.alpha,
  };
  const planePoint = colorToPlane(resolvedPlane, color);
  return {
    l: point.l,
    c: point.c,
    x: planePoint.x,
    y: planePoint.y,
  };
}

/**
 * Computes a gamut boundary contour projected into the target plane.
 *
 * Returns an empty point list when the plane is not a lightness/chroma pairing.
 *
 * @param planeDefinition Plane definition used to project the result points.
 * @param query Boundary sampling configuration.
 * @param query.hue Optional hue override; falls back to the plane's hue.
 * @param query.gamut Target gamut used for the boundary calculation.
 * @param query.steps Optional fixed sample count.
 * @param query.simplifyTolerance Optional simplification tolerance.
 * @param query.samplingMode Optional sampling strategy.
 * @param query.adaptiveTolerance Optional adaptive sampling error tolerance.
 * @param query.adaptiveMaxDepth Optional adaptive recursion depth cap.
 */
export function getPlaneGamutBoundary(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGamutBoundaryQuery, 'kind'> = {},
): PlaneGamutBoundaryResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'gamutBoundary',
      gamut: query.gamut ?? 'srgb',
      hue: planeHue(resolvedPlane, query.hue),
      points: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const boundary = gamutBoundaryPath(hue, {
    gamut: query.gamut ?? 'srgb',
    steps: query.steps,
    simplifyTolerance: query.simplifyTolerance,
    samplingMode: query.samplingMode,
    adaptiveTolerance: query.adaptiveTolerance,
    adaptiveMaxDepth: query.adaptiveMaxDepth,
  });

  return {
    kind: 'gamutBoundary',
    gamut: query.gamut ?? 'srgb',
    hue,
    points: boundary.map((point) =>
      toPlaneBoundaryPoint(resolvedPlane, hue, point),
    ),
  };
}

/**
 * Computes a contrast-threshold contour projected into the target plane.
 *
 * Returns an empty point list when the plane is not a lightness/chroma pairing.
 *
 * @param planeDefinition Plane definition used to project the result points.
 * @param query Contrast contour configuration.
 * @param query.reference Reference color used for the contrast test.
 * @param query.hue Optional hue override; falls back to the plane's hue.
 * @param query.metric Contrast metric to evaluate (for example WCAG/APCA).
 * @param query.level Named threshold level for the selected metric.
 * @param query.threshold Explicit contrast threshold override.
 * @param query.gamut Optional gamut clamp for contour search.
 */
export function getPlaneContrastBoundary(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneContrastBoundaryQuery, 'kind'>,
  trace?: InternalPlaneTraceContext | null,
): PlaneContrastBoundaryResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'contrastBoundary',
      hue: planeHue(resolvedPlane, query.hue),
      points: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const path = contrastRegionPath(
    query.reference,
    hue,
    {
      gamut: query.gamut,
      metric: query.metric,
      level: query.level,
      threshold: query.threshold,
      apcaPreset: query.apcaPreset,
      apcaPolarity: query.apcaPolarity,
      apcaRole: query.apcaRole,
      lightnessSteps: query.lightnessSteps,
      chromaSteps: query.chromaSteps,
      maxChroma: query.maxChroma,
      tolerance: query.tolerance,
      maxIterations: query.maxIterations,
      alpha: query.alpha,
      edgeInterpolation: query.edgeInterpolation,
      simplifyTolerance: query.simplifyTolerance,
      samplingMode: query.samplingMode,
      adaptiveBaseSteps: query.adaptiveBaseSteps,
      adaptiveMaxDepth: query.adaptiveMaxDepth,
      hybridMaxDepth: query.hybridMaxDepth,
      hybridErrorTolerance: query.hybridErrorTolerance,
    },
    trace,
  );

  return {
    kind: 'contrastBoundary',
    hue,
    points: path.map((point) =>
      toPlaneBoundaryPoint(resolvedPlane, hue, point),
    ),
  };
}

/**
 * Computes one or more filled contrast regions projected into the target plane.
 *
 * Returns an empty path list when the plane is not a lightness/chroma pairing.
 *
 * @param planeDefinition Plane definition used to project the result points.
 * @param query Contrast region configuration.
 * @param query.reference Reference color used for the contrast test.
 * @param query.hue Optional hue override; falls back to the plane's hue.
 * @param query.metric Contrast metric to evaluate (for example WCAG/APCA).
 * @param query.level Named threshold level for the selected metric.
 * @param query.threshold Explicit contrast threshold override.
 * @param query.gamut Optional gamut clamp for region search.
 */
export function getPlaneContrastRegion(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneContrastRegionQuery, 'kind'>,
  trace?: InternalPlaneTraceContext | null,
): PlaneContrastRegionResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'contrastRegion',
      hue: planeHue(resolvedPlane, query.hue),
      paths: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const paths = contrastRegionPaths(
    query.reference,
    hue,
    {
      gamut: query.gamut,
      metric: query.metric,
      level: query.level,
      threshold: query.threshold,
      apcaPreset: query.apcaPreset,
      apcaPolarity: query.apcaPolarity,
      apcaRole: query.apcaRole,
      lightnessSteps: query.lightnessSteps,
      chromaSteps: query.chromaSteps,
      maxChroma: query.maxChroma,
      tolerance: query.tolerance,
      maxIterations: query.maxIterations,
      alpha: query.alpha,
      edgeInterpolation: query.edgeInterpolation,
      simplifyTolerance: query.simplifyTolerance,
      samplingMode: query.samplingMode,
      adaptiveBaseSteps: query.adaptiveBaseSteps,
      adaptiveMaxDepth: query.adaptiveMaxDepth,
      hybridMaxDepth: query.hybridMaxDepth,
      hybridErrorTolerance: query.hybridErrorTolerance,
    },
    trace,
  );

  return {
    kind: 'contrastRegion',
    hue,
    paths: paths.map((path) =>
      path.map((point) => toPlaneBoundaryPoint(resolvedPlane, hue, point)),
    ),
  };
}

/**
 * Samples a chroma band and projects the resulting points into the target plane.
 *
 * Returns an empty point list when the plane is not a lightness/chroma pairing.
 *
 * @param planeDefinition Plane definition used to project the result points.
 * @param query Chroma-band sampling configuration.
 * @param query.hue Optional hue override; falls back to the plane's hue.
 * @param query.requestedChroma Desired chroma target for the band.
 * @param query.selectedLightness Optional selected lightness anchor.
 * @param query.mode Chroma-band sampling mode.
 * @param query.steps Optional fixed sample count.
 * @param query.gamut Optional gamut clamp for band search.
 */
export function getPlaneChromaBand(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneChromaBandQuery, 'kind'> = {},
): PlaneChromaBandResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'chromaBand',
      hue: planeHue(resolvedPlane, query.hue),
      points: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const selectedLightness =
    query.selectedLightness ?? resolvedPlane.fixed.l ?? 0.5;
  const requestedChroma = query.requestedChroma ?? resolvedPlane.fixed.c ?? 0;
  const band = chromaBand(hue, requestedChroma, {
    gamut: query.gamut,
    mode: query.mode,
    steps: query.steps,
    samplingMode: query.samplingMode,
    adaptiveTolerance: query.adaptiveTolerance,
    adaptiveMaxDepth: query.adaptiveMaxDepth,
    selectedLightness,
    maxChroma: query.maxChroma,
    tolerance: query.tolerance,
    maxIterations: query.maxIterations,
    alpha: query.alpha ?? resolvedPlane.fixed.alpha,
  });

  return {
    kind: 'chromaBand',
    hue,
    points: band.map((color) =>
      toPlaneBoundaryPoint(resolvedPlane, hue, { l: color.l, c: color.c }),
    ),
  };
}

/**
 * Maps a color into the requested gamut and returns its projected plane point.
 *
 * @param planeDefinition Plane definition used to project the mapped color.
 * @param query Fallback mapping input.
 * @param query.color Input color to map into gamut.
 * @param query.gamut Target gamut (`srgb` or `display-p3`).
 */
export function getPlaneFallbackPoint(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneFallbackPointQuery, 'kind'>,
): PlaneFallbackPointResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  const mapped =
    query.gamut === 'display-p3'
      ? toP3Gamut(query.color)
      : toSrgbGamut(query.color);
  const point = colorToPlane(resolvedPlane, mapped);

  return {
    kind: 'fallbackPoint',
    gamut: query.gamut,
    point: {
      x: point.x,
      y: point.y,
      color: mapped,
    },
  };
}

/**
 * Samples evenly spaced gradient points and projects each color to the plane.
 *
 * @param planeDefinition Plane definition used to project sampled colors.
 * @param query Gradient sampling input.
 * @param query.from Gradient start color.
 * @param query.to Gradient end color.
 * @param query.steps Number of samples to generate (minimum 2).
 */
export function samplePlaneGradient(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGradientQuery, 'kind'>,
): PlaneGradientResult {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  const steps = query.steps ?? 16;
  const colors = generateScale(query.from, query.to, Math.max(2, steps));
  const points = colors.map((color) => {
    const point = colorToPlane(resolvedPlane, color);
    return {
      x: point.x,
      y: point.y,
      color,
    };
  });

  return {
    kind: 'gradient',
    points,
  };
}

function runPlaneQueryInternal(
  planeDefinition: PlaneDefinition,
  query: PlaneQuery,
  trace?: InternalPlaneTraceContext | null,
): PlaneQueryResult {
  switch (query.kind) {
    case 'gamutBoundary':
      return getPlaneGamutBoundary(planeDefinition, query);
    case 'gamutRegion':
      return getPlaneGamutRegion(planeDefinition, query, trace);
    case 'contrastBoundary':
      return getPlaneContrastBoundary(planeDefinition, query, trace);
    case 'contrastRegion':
      return getPlaneContrastRegion(planeDefinition, query, trace);
    case 'chromaBand':
      return getPlaneChromaBand(planeDefinition, query);
    case 'fallbackPoint':
      return getPlaneFallbackPoint(planeDefinition, query);
    case 'gradient':
      return samplePlaneGradient(planeDefinition, query);
    default:
      throw new Error(
        `Unsupported plane query kind: ${(query as PlaneQuery).kind}`,
      );
  }
}

/**
 * Executes one stateless plane query and returns a typed result payload.
 *
 * @param planeDefinition Plane definition used for query execution.
 * @param query Discriminated plane query payload.
 */
export function runPlaneQuery(
  planeDefinition: PlaneDefinition,
  query: PlaneQuery,
): PlaneQueryResult {
  return runPlaneQueryInternal(planeDefinition, query);
}

/**
 * Executes a list of stateless plane queries in order.
 *
 * @param planeDefinition Plane definition used for query execution.
 * @param queries Query list to execute in sequence.
 */
export function runPlaneQueries(
  planeDefinition: PlaneDefinition,
  queries: PlaneQuery[],
): PlaneQueryResult[] {
  return queries.map((query) => runPlaneQueryInternal(planeDefinition, query));
}

/**
 * Executes one stateless plane query and returns a sidecar trace payload.
 *
 * @param planeDefinition Plane definition used for query execution.
 * @param query Discriminated plane query payload.
 * @param options Trace capture configuration.
 */
export function inspectPlaneQuery<Result extends PlaneQuery = PlaneQuery>(
  planeDefinition: PlaneDefinition,
  query: Result,
  options?: PlaneQueryTraceOptions,
): PlaneQueryInspection<Extract<PlaneQueryResult, { kind: Result['kind'] }>> {
  const trace = createPlaneTraceContext(query, options);
  const result = runPlaneQueryInternal(planeDefinition, query, trace);
  return finalizePlaneTrace(
    trace,
    result as Extract<PlaneQueryResult, { kind: Result['kind'] }>,
  );
}

/**
 * Executes a list of stateless plane queries and returns sidecar traces.
 *
 * @param planeDefinition Plane definition used for query execution.
 * @param queries Query list to execute in sequence.
 * @param options Trace capture configuration.
 */
export function inspectPlaneQueries(
  planeDefinition: PlaneDefinition,
  queries: PlaneQuery[],
  options?: PlaneQueryTraceOptions,
): PlaneQueryInspection[] {
  return queries.map((query) =>
    inspectPlaneQuery(planeDefinition, query, options),
  );
}

/** Fluent query helper methods bound to a single plane definition. */
export interface PlaneSense {
  /** Computes a projected gamut boundary contour. */
  gamutBoundary: (
    query?: Omit<PlaneGamutBoundaryQuery, 'kind'>,
  ) => PlaneGamutBoundaryResult;
  /** Computes visible gamut geometry for the current plane window. */
  gamutRegion: (
    query?: Omit<PlaneGamutRegionQuery, 'kind'>,
  ) => PlaneGamutRegionResult;
  /** Computes a projected contrast-threshold contour. */
  contrastBoundary: (
    query: Omit<PlaneContrastBoundaryQuery, 'kind'>,
  ) => PlaneContrastBoundaryResult;
  /** Computes one or more projected filled contrast regions. */
  contrastRegion: (
    query: Omit<PlaneContrastRegionQuery, 'kind'>,
  ) => PlaneContrastRegionResult;
  /** Computes a projected chroma-band point sequence. */
  chromaBand: (
    query?: Omit<PlaneChromaBandQuery, 'kind'>,
  ) => PlaneChromaBandResult;
  /** Maps a color into gamut and projects it to one plane point. */
  fallbackPoint: (
    query: Omit<PlaneFallbackPointQuery, 'kind'>,
  ) => PlaneFallbackPointResult;
  /** Samples a gradient and projects each sample to plane coordinates. */
  gradient: (query: Omit<PlaneGradientQuery, 'kind'>) => PlaneGradientResult;
}

/** Alias kept for API readability and migration ergonomics. */
export type PlaneSenseApi = PlaneSense;

/** A resolved plane instance augmented with fluent sensing helpers. */
export interface PlaneWithSense extends PlaneSense, Plane {}

/**
 * Creates a fluent sensing helper bound to a single plane definition.
 *
 * @param planeDefinition Plane definition captured by all returned methods.
 */
export function sense(planeDefinition: PlaneDefinition): PlaneSense {
  return {
    gamutBoundary: (query = {}) =>
      getPlaneGamutBoundary(planeDefinition, query),
    gamutRegion: (query = {}) => getPlaneGamutRegion(planeDefinition, query),
    contrastBoundary: (query) =>
      getPlaneContrastBoundary(planeDefinition, query),
    contrastRegion: (query) => getPlaneContrastRegion(planeDefinition, query),
    chromaBand: (query = {}) => getPlaneChromaBand(planeDefinition, query),
    fallbackPoint: (query) => getPlaneFallbackPoint(planeDefinition, query),
    gradient: (query) => samplePlaneGradient(planeDefinition, query),
  };
}

/**
 * Converts a normalized plane point directly into a color for the given plane.
 *
 * @param planeDefinition Plane definition used for conversion.
 * @param point Normalized plane point (`x`/`y`) to convert.
 */
export function colorAtPlanePoint(
  planeDefinition: PlaneDefinition,
  point: { x: number; y: number },
): Color {
  const resolvedPlane = resolvePlaneDefinition(planeDefinition);
  return planeToColor(resolvedPlane, point);
}
