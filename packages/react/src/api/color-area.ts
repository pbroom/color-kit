import type { Color } from '@color-kit/core';
import {
  clamp,
  contrastRegionPaths,
  gamutBoundaryPath,
  type ContrastRegionLevel,
  type GamutTarget,
} from '@color-kit/core';

export type ColorAreaChannel = 'l' | 'c' | 'h';
export type ColorAreaKey = 'ArrowRight' | 'ArrowLeft' | 'ArrowUp' | 'ArrowDown';

export const COLOR_AREA_DEFAULT_RANGES: Record<
  ColorAreaChannel,
  [number, number]
> = {
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
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
}

export function resolveColorAreaRange(
  channel: ColorAreaChannel,
  range?: [number, number],
): [number, number] {
  return range ?? COLOR_AREA_DEFAULT_RANGES[channel];
}

function normalize(value: number, range: [number, number]): number {
  return clamp((value - range[0]) / (range[1] - range[0]), 0, 1);
}

function usesLightnessAndChroma(channels: {
  x: ColorAreaChannel;
  y: ColorAreaChannel;
}): boolean {
  return (
    (channels.x === 'l' && channels.y === 'c') ||
    (channels.x === 'c' && channels.y === 'l')
  );
}

export function getColorAreaThumbPosition(
  color: Color,
  channels: { x: ColorAreaChannel; y: ColorAreaChannel },
  xRange: [number, number],
  yRange: [number, number],
): { x: number; y: number } {
  return {
    x: normalize(color[channels.x], xRange),
    y: 1 - normalize(color[channels.y], yRange),
  };
}

export function colorFromColorAreaPosition(
  color: Color,
  channels: { x: ColorAreaChannel; y: ColorAreaChannel },
  xNorm: number,
  yNorm: number,
  xRange: [number, number],
  yRange: [number, number],
): Color {
  const x = clamp(xNorm, 0, 1);
  const y = clamp(yNorm, 0, 1);

  const xValue = xRange[0] + x * (xRange[1] - xRange[0]);
  const yValue = yRange[0] + (1 - y) * (yRange[1] - yRange[0]);

  return {
    ...color,
    [channels.x]: xValue,
    [channels.y]: yValue,
  };
}

export function getColorAreaGamutBoundaryPoints(
  hue: number,
  channels: { x: ColorAreaChannel; y: ColorAreaChannel },
  xRange: [number, number],
  yRange: [number, number],
  options: ColorAreaGamutBoundaryOptions = {},
): ColorAreaGamutBoundaryPoint[] {
  if (!usesLightnessAndChroma(channels)) {
    return [];
  }

  const boundary = gamutBoundaryPath(hue, {
    gamut: options.gamut ?? 'srgb',
    steps: options.steps,
  });

  return boundary.map((point) => {
    const position = getColorAreaThumbPosition(
      { l: point.l, c: point.c, h: hue, alpha: 1 },
      channels,
      xRange,
      yRange,
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
  channels: { x: ColorAreaChannel; y: ColorAreaChannel },
  xRange: [number, number],
  yRange: [number, number],
  options: ColorAreaContrastRegionOptions = {},
): ColorAreaContrastRegionPoint[][] {
  if (!usesLightnessAndChroma(channels)) {
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
  });

  return paths.map((path) =>
    path.map((point) => {
      const position = getColorAreaThumbPosition(
        { l: point.l, c: point.c, h: hue, alpha: 1 },
        channels,
        xRange,
        yRange,
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

export function colorFromColorAreaKey(
  color: Color,
  channels: { x: ColorAreaChannel; y: ColorAreaChannel },
  key: string,
  stepRatio: number,
  xRange: [number, number],
  yRange: [number, number],
): Color | null {
  const xStep = stepRatio * (xRange[1] - xRange[0]);
  const yStep = stepRatio * (yRange[1] - yRange[0]);

  switch (key as ColorAreaKey) {
    case 'ArrowRight':
      return {
        ...color,
        [channels.x]: clamp(color[channels.x] + xStep, xRange[0], xRange[1]),
      };
    case 'ArrowLeft':
      return {
        ...color,
        [channels.x]: clamp(color[channels.x] - xStep, xRange[0], xRange[1]),
      };
    case 'ArrowUp':
      return {
        ...color,
        [channels.y]: clamp(color[channels.y] + yStep, yRange[0], yRange[1]),
      };
    case 'ArrowDown':
      return {
        ...color,
        [channels.y]: clamp(color[channels.y] - yStep, yRange[0], yRange[1]),
      };
    default:
      return null;
  }
}
