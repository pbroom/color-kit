import type { Color } from '@color-kit/core';
import {
  chromaBand,
  clamp,
  contrastRegionPaths,
  gamutBoundaryPath,
  type ChromaBandMode,
  type ContrastRegionLevel,
  type GamutTarget,
} from '@color-kit/core';

export type ColorAreaChannel = 'l' | 'c' | 'h';
export type ColorAreaKey = 'ArrowRight' | 'ArrowLeft' | 'ArrowUp' | 'ArrowDown';

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
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
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
}

export interface ColorAreaContrastRegionPoint {
  l: number;
  c: number;
  x: number;
  y: number;
}

export interface ColorAreaContrastRegionOptions {
  gamut?: GamutTarget;
  level?: ContrastRegionLevel;
  threshold?: number;
  lightnessSteps?: number;
  chromaSteps?: number;
  maxChroma?: number;
  tolerance?: number;
  maxIterations?: number;
  alpha?: number;
  edgeInterpolation?: 'linear' | 'midpoint';
}

export interface ColorAreaChromaBandOptions {
  gamut?: GamutTarget;
  mode?: ChromaBandMode;
  steps?: number;
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

  const boundary = gamutBoundaryPath(hue, {
    gamut: options.gamut ?? 'srgb',
    steps: options.steps,
  });

  return boundary.map((point) => {
    const position = getColorAreaThumbPosition(
      { l: point.l, c: point.c, h: hue, alpha: 1 },
      axes,
    );

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

  const paths = contrastRegionPaths(reference, hue, {
    gamut: options.gamut ?? 'srgb',
    level: options.level,
    threshold: options.threshold,
    lightnessSteps: options.lightnessSteps,
    chromaSteps: options.chromaSteps,
    maxChroma: options.maxChroma,
    tolerance: options.tolerance,
    maxIterations: options.maxIterations,
    alpha: options.alpha,
    edgeInterpolation: options.edgeInterpolation,
  });

  return paths.map((path) =>
    path.map((point) => {
      const position = getColorAreaThumbPosition(
        { l: point.l, c: point.c, h: hue, alpha: 1 },
        axes,
      );

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

  const colors = chromaBand(hue, reference.c, {
    gamut: options.gamut ?? 'srgb',
    mode: options.mode ?? 'clamped',
    steps: options.steps,
    selectedLightness: options.selectedLightness ?? reference.l,
    maxChroma: options.maxChroma,
    tolerance: options.tolerance,
    maxIterations: options.maxIterations,
    alpha: options.alpha ?? reference.alpha,
  });

  return colors.map((sample) => {
    const position = getColorAreaThumbPosition(sample, axes);
    return {
      l: sample.l,
      c: sample.c,
      x: position.x,
      y: position.y,
    };
  });
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
