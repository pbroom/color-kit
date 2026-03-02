import {
  chromaBand,
  gamutBoundaryPath,
  toP3Gamut,
  toSrgbGamut,
} from '../gamut/index.js';
import { contrastRegionPath, contrastRegionPaths } from '../contrast/index.js';
import { generateScale } from '../scale/index.js';
import type { Color } from '../types.js';
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
  PlaneGradientQuery,
  PlaneGradientResult,
  PlaneQuery,
  PlaneQueryResult,
} from './types.js';
import {
  colorToPlane,
  plane,
  planeHue,
  planeToColor,
  usesLightnessAndChroma,
} from './plane.js';

/**
 * Converts an `(l, c)` boundary point into normalized plane coordinates.
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
 */
export function getPlaneGamutBoundary(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGamutBoundaryQuery, 'kind'> = {},
): PlaneGamutBoundaryResult {
  const resolvedPlane = plane(planeDefinition);
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
 */
export function getPlaneContrastBoundary(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneContrastBoundaryQuery, 'kind'>,
): PlaneContrastBoundaryResult {
  const resolvedPlane = plane(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'contrastBoundary',
      hue: planeHue(resolvedPlane, query.hue),
      points: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const path = contrastRegionPath(query.reference, hue, {
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
  });

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
 */
export function getPlaneContrastRegion(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneContrastRegionQuery, 'kind'>,
): PlaneContrastRegionResult {
  const resolvedPlane = plane(planeDefinition);
  if (!usesLightnessAndChroma(resolvedPlane)) {
    return {
      kind: 'contrastRegion',
      hue: planeHue(resolvedPlane, query.hue),
      paths: [],
    };
  }

  const hue = planeHue(resolvedPlane, query.hue);
  const paths = contrastRegionPaths(query.reference, hue, {
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
  });

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
 */
export function getPlaneChromaBand(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneChromaBandQuery, 'kind'> = {},
): PlaneChromaBandResult {
  const resolvedPlane = plane(planeDefinition);
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
 */
export function getPlaneFallbackPoint(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneFallbackPointQuery, 'kind'>,
): PlaneFallbackPointResult {
  const resolvedPlane = plane(planeDefinition);
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
 */
export function samplePlaneGradient(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGradientQuery, 'kind'>,
): PlaneGradientResult {
  const resolvedPlane = plane(planeDefinition);
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

/**
 * Executes one stateless plane query and returns a typed result payload.
 */
export function runPlaneQuery(
  planeDefinition: PlaneDefinition,
  query: PlaneQuery,
): PlaneQueryResult {
  switch (query.kind) {
    case 'gamutBoundary':
      return getPlaneGamutBoundary(planeDefinition, query);
    case 'contrastBoundary':
      return getPlaneContrastBoundary(planeDefinition, query);
    case 'contrastRegion':
      return getPlaneContrastRegion(planeDefinition, query);
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
 * Executes a list of stateless plane queries in order.
 */
export function runPlaneQueries(
  planeDefinition: PlaneDefinition,
  queries: PlaneQuery[],
): PlaneQueryResult[] {
  return queries.map((query) => runPlaneQuery(planeDefinition, query));
}

export interface PlaneQueries {
  gamutBoundary: (
    query?: Omit<PlaneGamutBoundaryQuery, 'kind'>,
  ) => PlaneGamutBoundaryResult;
  contrastBoundary: (
    query: Omit<PlaneContrastBoundaryQuery, 'kind'>,
  ) => PlaneContrastBoundaryResult;
  contrastRegion: (
    query: Omit<PlaneContrastRegionQuery, 'kind'>,
  ) => PlaneContrastRegionResult;
  chromaBand: (
    query?: Omit<PlaneChromaBandQuery, 'kind'>,
  ) => PlaneChromaBandResult;
  fallbackPoint: (
    query: Omit<PlaneFallbackPointQuery, 'kind'>,
  ) => PlaneFallbackPointResult;
  gradient: (query: Omit<PlaneGradientQuery, 'kind'>) => PlaneGradientResult;
}

export type PlaneQueryApi = PlaneQueries;

export interface PlaneWithQueries extends PlaneQueries, Plane {}

/**
 * Creates a fluent query helper bound to a single plane definition.
 */
export function createPlaneQuery(
  planeDefinition: PlaneDefinition,
): PlaneQueries {
  return {
    gamutBoundary: (query = {}) =>
      getPlaneGamutBoundary(planeDefinition, query),
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
 */
export function colorAtPlanePoint(
  planeDefinition: PlaneDefinition,
  point: { x: number; y: number },
): Color {
  const resolvedPlane = plane(planeDefinition);
  return planeToColor(resolvedPlane, point);
}
