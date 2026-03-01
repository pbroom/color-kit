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
  ResolvedPlaneDefinition,
} from './types.js';
import {
  colorToPlane,
  planeToColor,
  resolvePlaneDefinition,
  resolvePlaneHue,
  usesLightnessAndChroma,
} from './plane.js';

function toPlaneBoundaryPoint(
  plane: ResolvedPlaneDefinition,
  hue: number,
  point: { l: number; c: number },
) {
  const color: Color = {
    ...plane.fixed,
    l: point.l,
    c: point.c,
    h: hue,
    alpha: plane.fixed.alpha,
  };
  const planePoint = colorToPlane(plane, color);
  return {
    l: point.l,
    c: point.c,
    x: planePoint.x,
    y: planePoint.y,
  };
}

export function getPlaneGamutBoundary(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGamutBoundaryQuery, 'kind'> = {},
): PlaneGamutBoundaryResult {
  const plane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(plane)) {
    return {
      kind: 'gamutBoundary',
      gamut: query.gamut ?? 'srgb',
      hue: resolvePlaneHue(plane, query.hue),
      points: [],
    };
  }

  const hue = resolvePlaneHue(plane, query.hue);
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
    points: boundary.map((point) => toPlaneBoundaryPoint(plane, hue, point)),
  };
}

export function getPlaneContrastBoundary(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneContrastBoundaryQuery, 'kind'>,
): PlaneContrastBoundaryResult {
  const plane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(plane)) {
    return {
      kind: 'contrastBoundary',
      hue: resolvePlaneHue(plane, query.hue),
      points: [],
    };
  }

  const hue = resolvePlaneHue(plane, query.hue);
  const path = contrastRegionPath(query.reference, hue, {
    gamut: query.gamut,
    level: query.level,
    threshold: query.threshold,
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
  });

  return {
    kind: 'contrastBoundary',
    hue,
    points: path.map((point) => toPlaneBoundaryPoint(plane, hue, point)),
  };
}

export function getPlaneContrastRegion(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneContrastRegionQuery, 'kind'>,
): PlaneContrastRegionResult {
  const plane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(plane)) {
    return {
      kind: 'contrastRegion',
      hue: resolvePlaneHue(plane, query.hue),
      paths: [],
    };
  }

  const hue = resolvePlaneHue(plane, query.hue);
  const paths = contrastRegionPaths(query.reference, hue, {
    gamut: query.gamut,
    level: query.level,
    threshold: query.threshold,
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
  });

  return {
    kind: 'contrastRegion',
    hue,
    paths: paths.map((path) =>
      path.map((point) => toPlaneBoundaryPoint(plane, hue, point)),
    ),
  };
}

export function getPlaneChromaBand(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneChromaBandQuery, 'kind'> = {},
): PlaneChromaBandResult {
  const plane = resolvePlaneDefinition(planeDefinition);
  if (!usesLightnessAndChroma(plane)) {
    return {
      kind: 'chromaBand',
      hue: resolvePlaneHue(plane, query.hue),
      points: [],
    };
  }

  const hue = resolvePlaneHue(plane, query.hue);
  const selectedLightness = query.selectedLightness ?? plane.fixed.l;
  const requestedChroma = query.requestedChroma ?? plane.fixed.c;
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
    alpha: query.alpha ?? plane.fixed.alpha,
  });

  return {
    kind: 'chromaBand',
    hue,
    points: band.map((color) =>
      toPlaneBoundaryPoint(plane, hue, { l: color.l, c: color.c }),
    ),
  };
}

export function getPlaneFallbackPoint(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneFallbackPointQuery, 'kind'>,
): PlaneFallbackPointResult {
  const plane = resolvePlaneDefinition(planeDefinition);
  const mapped =
    query.gamut === 'display-p3'
      ? toP3Gamut(query.color)
      : toSrgbGamut(query.color);
  const point = colorToPlane(plane, mapped);

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

export function samplePlaneGradient(
  planeDefinition: PlaneDefinition,
  query: Omit<PlaneGradientQuery, 'kind'>,
): PlaneGradientResult {
  const plane = resolvePlaneDefinition(planeDefinition);
  const steps = query.steps ?? 16;
  const colors = generateScale(query.from, query.to, Math.max(2, steps));
  const points = colors.map((color) => {
    const point = colorToPlane(plane, color);
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

export function runPlaneQueries(
  planeDefinition: PlaneDefinition,
  queries: PlaneQuery[],
): PlaneQueryResult[] {
  return queries.map((query) => runPlaneQuery(planeDefinition, query));
}

export interface PlaneQueryApi {
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

export function createPlaneQuery(
  planeDefinition: PlaneDefinition,
): PlaneQueryApi {
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

export function colorAtPlanePoint(
  planeDefinition: PlaneDefinition,
  point: { x: number; y: number },
): Color {
  const plane = resolvePlaneDefinition(planeDefinition);
  return planeToColor(plane, point);
}
