import type { Color, Hsl, Hsv, Oklch, Rgb } from '@color-kit/core';
import {
  fromHsl,
  fromHsv,
  fromOklch,
  fromRgb,
  toCss,
  toHsl,
  toHsv,
  toOklch,
  toP3Gamut,
  toRgb,
  toSrgbGamut,
} from '@color-kit/core';
import type { ColorSliderOrientation } from './color-slider.js';

const DEFAULT_STEPS = 64;

export type SliderColorModel = 'oklch' | 'hsl' | 'hsv' | 'rgb';
export type SliderColorSpace = 'srgb' | 'display-p3';

export type OklchSliderModelChannel = 'l' | 'c' | 'h' | 'alpha';
export type HslSliderModelChannel = 'h' | 's' | 'l' | 'alpha';
export type HsvSliderModelChannel = 'h' | 's' | 'v' | 'alpha';
export type RgbSliderModelChannel = 'r' | 'g' | 'b' | 'alpha';

export type SliderModelChannel =
  | OklchSliderModelChannel
  | HslSliderModelChannel
  | HsvSliderModelChannel
  | RgbSliderModelChannel;

interface SliderGradientBaseOptions {
  baseColor: Color;
  range: [number, number];
  steps?: number;
  orientation?: ColorSliderOrientation;
  colorSpace?: SliderColorSpace;
}

interface OklchSliderGradientOptions extends SliderGradientBaseOptions {
  model: 'oklch';
  channel: OklchSliderModelChannel;
}

interface HslSliderGradientOptions extends SliderGradientBaseOptions {
  model: 'hsl';
  channel: HslSliderModelChannel;
}

interface HsvSliderGradientOptions extends SliderGradientBaseOptions {
  model: 'hsv';
  channel: HsvSliderModelChannel;
}

interface RgbSliderGradientOptions extends SliderGradientBaseOptions {
  model: 'rgb';
  channel: RgbSliderModelChannel;
}

export type SampleSliderGradientOptions =
  | OklchSliderGradientOptions
  | HslSliderGradientOptions
  | HsvSliderGradientOptions
  | RgbSliderGradientOptions;

export interface SliderGradientStop {
  /** Normalized position in [0, 1] */
  t: number;
  /** Channel value sampled at this stop */
  value: number;
  /** Internal sampled color intent (OKLCH model). */
  color: Color;
  /** Gamut-mapped color in the requested target color space. */
  activeColor: Color;
  /** Deterministic sRGB fallback color for this stop. */
  srgbColor: Color;
  /** CSS stop color in requested color space (`p3` or `rgb`). */
  activeCss: string;
  /** CSS stop color in sRGB (`rgb(...)`). */
  srgbCss: string;
}

export interface SliderGradientStyles {
  colorSpace: SliderColorSpace;
  orientation: ColorSliderOrientation;
  stops: SliderGradientStop[];
  activeBackgroundImage: string;
  srgbBackgroundImage: string;
  srgbBackgroundColor: string;
}

function resolveSteps(steps?: number): number {
  const resolved = steps ?? DEFAULT_STEPS;

  if (!Number.isFinite(resolved) || resolved < 2) {
    throw new Error('sampleSliderGradient() requires steps >= 2');
  }

  return Math.round(resolved);
}

function resolveOrientation(
  orientation?: ColorSliderOrientation,
): ColorSliderOrientation {
  return orientation ?? 'horizontal';
}

function resolveColorSpace(colorSpace?: SliderColorSpace): SliderColorSpace {
  return colorSpace ?? 'display-p3';
}

function gradientDirection(orientation: ColorSliderOrientation): string {
  return orientation === 'vertical' ? 'to top' : 'to right';
}

function toStopPercent(t: number): string {
  return `${(t * 100).toFixed(3)}%`;
}

function sampleColorFromModel(
  options: SampleSliderGradientOptions,
  value: number,
): Color {
  switch (options.model) {
    case 'oklch': {
      const oklch = toOklch(options.baseColor);
      const next: Oklch = {
        ...oklch,
        [options.channel]: value,
      };
      return fromOklch(next);
    }
    case 'hsl': {
      const hsl = toHsl(options.baseColor);
      const next: Hsl = {
        ...hsl,
        [options.channel]: value,
      };
      return fromHsl(next);
    }
    case 'hsv': {
      const hsv = toHsv(options.baseColor);
      const next: Hsv = {
        ...hsv,
        [options.channel]: value,
      };
      return fromHsv(next);
    }
    case 'rgb': {
      const rgb = toRgb(options.baseColor);
      const next: Rgb = {
        ...rgb,
        [options.channel]: value,
      };
      return fromRgb(next);
    }
  }
}

function mapToColorSpace(color: Color, colorSpace: SliderColorSpace): Color {
  return colorSpace === 'display-p3' ? toP3Gamut(color) : toSrgbGamut(color);
}

function toActiveStopCss(color: Color, colorSpace: SliderColorSpace): string {
  if (colorSpace === 'display-p3') {
    return toCss(color, 'p3');
  }
  return toCss(color, 'rgb');
}

export function sampleSliderGradient(
  options: SampleSliderGradientOptions,
): SliderGradientStop[] {
  const steps = resolveSteps(options.steps);
  const colorSpace = resolveColorSpace(options.colorSpace);

  const stops: SliderGradientStop[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const value = options.range[0] + t * (options.range[1] - options.range[0]);

    const sampledColor = sampleColorFromModel(options, value);
    const activeColor = mapToColorSpace(sampledColor, colorSpace);
    const srgbColor = toSrgbGamut(sampledColor);

    stops.push({
      t,
      value,
      color: sampledColor,
      activeColor,
      srgbColor,
      activeCss: toActiveStopCss(activeColor, colorSpace),
      srgbCss: toCss(srgbColor, 'rgb'),
    });
  }

  return stops;
}

export function getSliderGradientStyles(
  options: SampleSliderGradientOptions,
): SliderGradientStyles {
  const orientation = resolveOrientation(options.orientation);
  const direction = gradientDirection(orientation);
  const colorSpace = resolveColorSpace(options.colorSpace);
  const stops = sampleSliderGradient(options);

  const activeStops = stops
    .map((stop) => `${stop.activeCss} ${toStopPercent(stop.t)}`)
    .join(', ');
  const srgbStops = stops
    .map((stop) => `${stop.srgbCss} ${toStopPercent(stop.t)}`)
    .join(', ');

  return {
    colorSpace,
    orientation,
    stops,
    activeBackgroundImage: `linear-gradient(${direction}, ${activeStops})`,
    srgbBackgroundImage: `linear-gradient(${direction}, ${srgbStops})`,
    srgbBackgroundColor: stops[0]?.srgbCss ?? 'rgb(0 0 0 / 0)',
  };
}
