import type { Color } from '@color-kit/core';
import {
  clamp,
  createPlaneQuery,
  plane,
  PLANE_DEFAULT_RANGES,
  toP3Gamut,
  toSrgbGamut,
  type ContrastApcaPolarity,
  type ContrastApcaPreset,
  type ContrastApcaRole,
  type ContrastMetric,
  type ChromaBandMode,
  type ContrastRegionLevel,
  type GamutTarget,
} from '@color-kit/core';

export type ColorAreaChannel = 'l' | 'c' | 'h';
export type ColorAreaKey = 'ArrowRight' | 'ArrowLeft' | 'ArrowUp' | 'ArrowDown';
const COLOR_AREA_PLANE_MODEL = 'oklch' as const;

export interface ColorAreaAxis {
  channel: ColorAreaChannel;
  range?: [number, number];
}

export interface ColorAreaAxes {
  x: ColorAreaAxis;
  y: ColorAreaAxis;
}

export interface ResolvedColorAreaAxis {
  channel: ColorAreaChannel;
  range: [number, number];
}

export interface ResolvedColorAreaAxes {
  x: ResolvedColorAreaAxis;
  y: ResolvedColorAreaAxis;
}

export const COLOR_AREA_DEFAULT_RANGES: Record<
  ColorAreaChannel,
  [number, number]
> = {
  l: [PLANE_DEFAULT_RANGES.l[0], PLANE_DEFAULT_RANGES.l[1]],
  // UI Y coordinates are flipped, so keep chroma ascending here.
  c: [PLANE_DEFAULT_RANGES.c[1], PLANE_DEFAULT_RANGES.c[0]],
  h: [PLANE_DEFAULT_RANGES.h[0], PLANE_DEFAULT_RANGES.h[1]],
};

const COLOR_AREA_DEFAULT_AXES: ResolvedColorAreaAxes = {
  x: {
    channel: 'l',
    range: COLOR_AREA_DEFAULT_RANGES.l,
  },
  y: {
    channel: 'c',
    range: COLOR_AREA_DEFAULT_RANGES.c,
  },
};

export interface ColorAreaGamutBoundaryPoint {
  l: number;
  c: number;
  x: number;
  y: number;
}

export interface ColorAreaGamutBoundaryOptions {
  gamut?: GamutTarget;
  steps?: number;
  /** RDP simplification tolerance in (l,c) space; omit to disable */
  simplifyTolerance?: number;
  /** 'uniform' (default) or 'adaptive' sampling */
  samplingMode?: 'uniform' | 'adaptive';
  adaptiveTolerance?: number;
  adaptiveMaxDepth?: number;
}

export interface ColorAreaContrastRegionPoint {
  l: number;
  c: number;
  x: number;
  y: number;
}

export interface ColorAreaFallbackPoint {
  x: number;
  y: number;
  color: Color;
  gamut: GamutTarget;
}

export interface ColorAreaContrastRegionOptions {
  gamut?: GamutTarget;
  metric?: ContrastMetric;
  level?: ContrastRegionLevel;
  threshold?: number;
  apcaPreset?: ContrastApcaPreset;
  apcaPolarity?: ContrastApcaPolarity;
  apcaRole?: ContrastApcaRole;
  lightnessSteps?: number;
  chromaSteps?: number;
  maxChroma?: number;
  tolerance?: number;
  maxIterations?: number;
  alpha?: number;
  edgeInterpolation?: 'linear' | 'midpoint';
  /** RDP simplification tolerance in (l,c) space; omit to disable */
  simplifyTolerance?: number;
  /** 'hybrid' (default), 'uniform', or 'adaptive' */
  samplingMode?: 'hybrid' | 'uniform' | 'adaptive';
  adaptiveBaseSteps?: number;
  adaptiveMaxDepth?: number;
  hybridMaxDepth?: number;
  hybridErrorTolerance?: number;
}

export interface ColorAreaChromaBandOptions {
  gamut?: GamutTarget;
  mode?: ChromaBandMode;
  steps?: number;
  /** 'uniform' (default) or 'adaptive' band sampling */
  samplingMode?: 'uniform' | 'adaptive';
  adaptiveTolerance?: number;
  adaptiveMaxDepth?: number;
  selectedLightness?: number;
  maxChroma?: number;
  tolerance?: number;
  maxIterations?: number;
  alpha?: number;
}

export function resolveColorAreaRange(
  channel: ColorAreaChannel,
  range?: [number, number],
): [number, number] {
  return range ?? COLOR_AREA_DEFAULT_RANGES[channel];
}

export function resolveColorAreaAxes(
  axes?: ColorAreaAxes,
): ResolvedColorAreaAxes {
  const next = axes ?? COLOR_AREA_DEFAULT_AXES;
  return {
    x: {
      channel: next.x.channel,
      range: resolveColorAreaRange(next.x.channel, next.x.range),
    },
    y: {
      channel: next.y.channel,
      range: resolveColorAreaRange(next.y.channel, next.y.range),
    },
  };
}

export function areColorAreaAxesDistinct(axes: {
  x: { channel: ColorAreaChannel };
  y: { channel: ColorAreaChannel };
}): boolean {
  return axes.x.channel !== axes.y.channel;
}

function normalize(value: number, range: [number, number]): number {
  return clamp((value - range[0]) / (range[1] - range[0]), 0, 1);
}

function usesLightnessAndChroma(axes: {
  x: { channel: ColorAreaChannel };
  y: { channel: ColorAreaChannel };
}): boolean {
  return (
    (axes.x.channel === 'l' && axes.y.channel === 'c') ||
    (axes.x.channel === 'c' && axes.y.channel === 'l')
  );
}

function toPlaneDefinition(axes: ResolvedColorAreaAxes, reference: Color) {
  return plane({
    model: COLOR_AREA_PLANE_MODEL,
    x: {
      channel: axes.x.channel,
      range: axes.x.range,
    },
    y: {
      channel: axes.y.channel,
      range: axes.y.range,
    },
    fixed: {
      l: reference.l,
      c: reference.c,
      h: reference.h,
      alpha: reference.alpha,
    },
  });
}

function planeToUiPoint(point: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: point.x,
    y: 1 - point.y,
  };
}

export function getColorAreaThumbPosition(
  color: Color,
  axes: ResolvedColorAreaAxes,
): { x: number; y: number } {
  return {
    x: normalize(color[axes.x.channel], axes.x.range),
    y: 1 - normalize(color[axes.y.channel], axes.y.range),
  };
}

export function colorFromColorAreaPosition(
  color: Color,
  axes: ResolvedColorAreaAxes,
  xNorm: number,
  yNorm: number,
): Color {
  const x = clamp(xNorm, 0, 1);
  const y = clamp(yNorm, 0, 1);

  const xRange = axes.x.range;
  const yRange = axes.y.range;

  const xValue = xRange[0] + x * (xRange[1] - xRange[0]);
  const yValue = yRange[0] + (1 - y) * (yRange[1] - yRange[0]);

  return {
    ...color,
    [axes.x.channel]: xValue,
    [axes.y.channel]: yValue,
  };
}

export function getColorAreaGamutBoundaryPoints(
  hue: number,
  axes: ResolvedColorAreaAxes,
  options: ColorAreaGamutBoundaryOptions = {},
): ColorAreaGamutBoundaryPoint[] {
  if (!usesLightnessAndChroma(axes)) {
    return [];
  }

  const reference: Color = {
    l: 0.5,
    c: 0,
    h: hue,
    alpha: 1,
  };
  const boundary = createPlaneQuery(
    toPlaneDefinition(axes, reference),
  ).gamutBoundary({
    gamut: options.gamut ?? 'srgb',
    hue,
    steps: options.steps,
    simplifyTolerance: options.simplifyTolerance,
    samplingMode: options.samplingMode,
    adaptiveTolerance: options.adaptiveTolerance,
    adaptiveMaxDepth: options.adaptiveMaxDepth,
  });

  return boundary.points.map((point) => {
    const position = planeToUiPoint(point);
    return {
      l: point.l,
      c: point.c,
      x: position.x,
      y: position.y,
    };
  });
}

export function getColorAreaContrastRegionPaths(
  reference: Color,
  hue: number,
  axes: ResolvedColorAreaAxes,
  options: ColorAreaContrastRegionOptions = {},
): ColorAreaContrastRegionPoint[][] {
  if (!usesLightnessAndChroma(axes)) {
    return [];
  }

  const region = createPlaneQuery(
    toPlaneDefinition(axes, reference),
  ).contrastRegion({
    reference,
    gamut: options.gamut ?? 'srgb',
    hue,
    metric: options.metric,
    level: options.level,
    threshold: options.threshold,
    apcaPreset: options.apcaPreset,
    apcaPolarity: options.apcaPolarity,
    apcaRole: options.apcaRole,
    lightnessSteps: options.lightnessSteps,
    chromaSteps: options.chromaSteps,
    maxChroma: options.maxChroma,
    tolerance: options.tolerance,
    maxIterations: options.maxIterations,
    alpha: options.alpha,
    edgeInterpolation: options.edgeInterpolation,
    simplifyTolerance: options.simplifyTolerance,
    samplingMode: options.samplingMode,
    adaptiveBaseSteps: options.adaptiveBaseSteps,
    adaptiveMaxDepth: options.adaptiveMaxDepth,
    hybridMaxDepth: options.hybridMaxDepth,
    hybridErrorTolerance: options.hybridErrorTolerance,
  });

  return region.paths.map((path) =>
    path.map((point) => {
      const position = planeToUiPoint(point);

      return {
        l: point.l,
        c: point.c,
        x: position.x,
        y: position.y,
      };
    }),
  );
}

export function getColorAreaChromaBandPoints(
  reference: Color,
  hue: number,
  axes: ResolvedColorAreaAxes,
  options: ColorAreaChromaBandOptions = {},
): ColorAreaGamutBoundaryPoint[] {
  if (!usesLightnessAndChroma(axes)) {
    return [];
  }

  const band = createPlaneQuery(toPlaneDefinition(axes, reference)).chromaBand({
    requestedChroma: reference.c,
    gamut: options.gamut ?? 'srgb',
    hue,
    mode: options.mode ?? 'clamped',
    steps: options.steps,
    samplingMode: options.samplingMode,
    adaptiveTolerance: options.adaptiveTolerance,
    adaptiveMaxDepth: options.adaptiveMaxDepth,
    selectedLightness: options.selectedLightness ?? reference.l,
    maxChroma: options.maxChroma,
    tolerance: options.tolerance,
    maxIterations: options.maxIterations,
    alpha: options.alpha ?? reference.alpha,
  });

  return band.points.map((point) => {
    const position = planeToUiPoint(point);
    return {
      l: point.l,
      c: point.c,
      x: position.x,
      y: position.y,
    };
  });
}

export function getColorAreaFallbackPoint(
  axes: ResolvedColorAreaAxes,
  query: {
    color: Color;
    gamut: GamutTarget;
  },
): ColorAreaFallbackPoint {
  const mapped =
    query.gamut === 'display-p3'
      ? toP3Gamut(query.color)
      : toSrgbGamut(query.color);
  const point = getColorAreaThumbPosition(mapped, axes);
  return {
    x: point.x,
    y: point.y,
    color: mapped,
    gamut: query.gamut,
  };
}

export function colorFromColorAreaKey(
  color: Color,
  axes: ResolvedColorAreaAxes,
  key: string,
  stepRatio: number,
): Color | null {
  const xRange = axes.x.range;
  const yRange = axes.y.range;
  const xStep = stepRatio * (xRange[1] - xRange[0]);
  const yStep = stepRatio * (yRange[1] - yRange[0]);

  switch (key as ColorAreaKey) {
    case 'ArrowRight':
      return {
        ...color,
        [axes.x.channel]: clamp(
          color[axes.x.channel] + xStep,
          xRange[0],
          xRange[1],
        ),
      };
    case 'ArrowLeft':
      return {
        ...color,
        [axes.x.channel]: clamp(
          color[axes.x.channel] - xStep,
          xRange[0],
          xRange[1],
        ),
      };
    case 'ArrowUp':
      return {
        ...color,
        [axes.y.channel]: clamp(
          color[axes.y.channel] + yStep,
          yRange[0],
          yRange[1],
        ),
      };
    case 'ArrowDown':
      return {
        ...color,
        [axes.y.channel]: clamp(
          color[axes.y.channel] - yStep,
          yRange[0],
          yRange[1],
        ),
      };
    default:
      return null;
  }
}
