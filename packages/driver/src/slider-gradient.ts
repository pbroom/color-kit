import type { Color, Hct, Hsl, Hsv, Oklch, Rgb } from '@color-kit/core';
import {
  fromHct,
  fromHsl,
  fromHsv,
  fromOklch,
  fromRgb,
  maxChromaForHue,
  maxHctChromaForHue,
  toCss,
  toHct,
  toHsl,
  toHsv,
  toOklch,
  toP3Gamut,
  toRgb,
  toSrgbGamut,
} from '@color-kit/core';
import type { ColorSliderOrientation } from './color-slider.js';

const DEFAULT_STEPS = 64;

/** Color model whose channel a slider gradient varies. */
export type SliderColorModel = 'oklch' | 'hsl' | 'hsv' | 'rgb' | 'hct';
/**
 * Target color space for gradient stops: `'display-p3'` emits
 * `color(display-p3 …)` stops, `'srgb'` emits `rgb(…)` stops.
 */
export type SliderColorSpace = 'srgb' | 'display-p3';
/**
 * How a hue-channel gradient is colored. `'static'` draws a fixed
 * full-saturation hue ramp that ignores the base color's other channels;
 * `'selected-color'` varies only the hue of the base color.
 */
export type SliderHueGradientMode = 'static' | 'selected-color';

/** OKLCH channels: `l` 0..1, `c` 0..~0.4, `h` degrees, `alpha` 0..1. */
export type OklchSliderModelChannel = 'l' | 'c' | 'h' | 'alpha';
/** HSL channels: `h` degrees, `s` and `l` 0..100, `alpha` 0..1. */
export type HslSliderModelChannel = 'h' | 's' | 'l' | 'alpha';
/** HSV channels: `h` degrees, `s` and `v` 0..100, `alpha` 0..1. */
export type HsvSliderModelChannel = 'h' | 's' | 'v' | 'alpha';
/** RGB channels: `r`, `g`, `b` 0..255, `alpha` 0..1. */
export type RgbSliderModelChannel = 'r' | 'g' | 'b' | 'alpha';
/** HCT channels: only hue `h` (degrees) is supported. */
export type HctSliderModelChannel = 'h';

/** Any channel of any {@link SliderColorModel}. */
export type SliderModelChannel =
  | OklchSliderModelChannel
  | HslSliderModelChannel
  | HsvSliderModelChannel
  | RgbSliderModelChannel
  | HctSliderModelChannel;

interface SliderGradientBaseOptions {
  /**
   * Color whose other channels are held fixed while `channel` varies.
   * Ignored for hue in `'static'` hue mode.
   */
  baseColor: Color;
  /**
   * `[start, end]` channel values in the model's units; `start` is the
   * left (horizontal) or bottom (vertical) end of the gradient.
   */
  range: [number, number];
  /**
   * Number of equal intervals; the gradient has `steps + 1` stops.
   * Non-integers are rounded. Must be finite and at least 2.
   * @defaultValue 64
   */
  steps?: number;
  /**
   * Gradient direction: `'horizontal'` emits `to right`, `'vertical'`
   * emits `to top`.
   * @defaultValue 'horizontal'
   */
  orientation?: ColorSliderOrientation;
  /**
   * Target space for `activeColor` / `activeCss`.
   * @defaultValue 'display-p3'
   */
  colorSpace?: SliderColorSpace;
  /**
   * Hue-channel coloring; has no effect on other channels or the `'rgb'`
   * model.
   * @defaultValue 'static'
   */
  hueGradientMode?: SliderHueGradientMode;
}

interface OklchSliderGradientOptions extends SliderGradientBaseOptions {
  /** Sample in OKLCH. */
  model: 'oklch';
  /** OKLCH channel to vary. */
  channel: OklchSliderModelChannel;
}

interface HslSliderGradientOptions extends SliderGradientBaseOptions {
  /** Sample in HSL. */
  model: 'hsl';
  /** HSL channel to vary. */
  channel: HslSliderModelChannel;
}

interface HsvSliderGradientOptions extends SliderGradientBaseOptions {
  /** Sample in HSV. */
  model: 'hsv';
  /** HSV channel to vary. */
  channel: HsvSliderModelChannel;
}

interface RgbSliderGradientOptions extends SliderGradientBaseOptions {
  /** Sample in sRGB. */
  model: 'rgb';
  /** RGB channel to vary. */
  channel: RgbSliderModelChannel;
}

interface HctSliderGradientOptions extends SliderGradientBaseOptions {
  /** Sample in HCT. */
  model: 'hct';
  /** HCT channel to vary (hue only). */
  channel: HctSliderModelChannel;
}

/**
 * Options for {@link sampleSliderGradient} and
 * {@link getSliderGradientStyles}, discriminated by `model`: `channel` must
 * be a channel of that model, and `range` is in that channel's units.
 *
 * Shared fields: `baseColor`, `range`, `steps` (default 64 intervals),
 * `orientation` (default `'horizontal'`), `colorSpace` (default
 * `'display-p3'`) and `hueGradientMode` (default `'static'`).
 */
export type SampleSliderGradientOptions =
  | OklchSliderGradientOptions
  | HslSliderGradientOptions
  | HsvSliderGradientOptions
  | RgbSliderGradientOptions
  | HctSliderGradientOptions;

/** One sampled gradient stop; see {@link sampleSliderGradient}. */
export interface SliderGradientStop {
  /** Normalized position in [0, 1] */
  t: number;
  /** Channel value sampled at this stop */
  value: number;
  /** Sampled color before gamut mapping (OKLCH, may be out of gamut). */
  color: Color;
  /** `color` gamut-mapped into the requested `colorSpace`. */
  activeColor: Color;
  /** `color` gamut-mapped into sRGB; the fallback for non-P3 displays. */
  srgbColor: Color;
  /** CSS stop color in the requested space: `color(display-p3 …)` or `rgb(…)`. */
  activeCss: string;
  /** CSS stop color in sRGB (`rgb(...)`). */
  srgbCss: string;
}

/** CSS-ready gradient output of {@link getSliderGradientStyles}. */
export interface SliderGradientStyles {
  /** Resolved target color space of the active gradient. */
  colorSpace: SliderColorSpace;
  /** Resolved orientation. */
  orientation: ColorSliderOrientation;
  /** The sampled stops, as from {@link sampleSliderGradient}. */
  stops: SliderGradientStop[];
  /** `linear-gradient(…)` built from each stop's `activeCss`. */
  activeBackgroundImage: string;
  /** `linear-gradient(…)` built from each stop's `srgbCss`. */
  srgbBackgroundImage: string;
  /** First stop's `srgbCss`, as a solid `background-color` fallback. */
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

function resolveHueGradientMode(
  hueGradientMode?: SliderHueGradientMode,
): SliderHueGradientMode {
  return hueGradientMode ?? 'static';
}

function gradientDirection(orientation: ColorSliderOrientation): string {
  return orientation === 'vertical' ? 'to top' : 'to right';
}

function toStopPercent(t: number): string {
  return `${(t * 100).toFixed(3)}%`;
}

function sampleStaticHueColorFromModel(
  options: SampleSliderGradientOptions,
  value: number,
  colorSpace: SliderColorSpace,
): Color | null {
  if (options.channel !== 'h') {
    return null;
  }

  switch (options.model) {
    case 'oklch': {
      const cusp = maxChromaForHue(value, {
        gamut: colorSpace,
        method: 'lut',
      });
      const next: Oklch = {
        l: cusp.l,
        c: cusp.c,
        h: value,
        alpha: 1,
      };
      return fromOklch(next);
    }
    case 'hsl': {
      const next: Hsl = {
        h: value,
        s: 100,
        l: 50,
        alpha: 1,
      };
      return fromHsl(next);
    }
    case 'hsv': {
      const next: Hsv = {
        h: value,
        s: 100,
        v: 100,
        alpha: 1,
      };
      return fromHsv(next);
    }
    case 'hct': {
      const peak = maxHctChromaForHue(value, {
        method: 'lut',
      });
      const next: Hct = {
        h: value,
        c: peak.c,
        t: peak.t,
        alpha: 1,
      };
      return fromHct(next);
    }
  }

  return null;
}

function sampleColorFromModel(
  options: SampleSliderGradientOptions,
  value: number,
  colorSpace: SliderColorSpace,
  hueGradientMode: SliderHueGradientMode,
): Color {
  if (hueGradientMode === 'static') {
    const staticHueColor = sampleStaticHueColorFromModel(
      options,
      value,
      colorSpace,
    );
    if (staticHueColor) {
      return staticHueColor;
    }
  }

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
    case 'hct': {
      const hct = toHct(options.baseColor);
      const next: Hct = {
        ...hct,
        h: value,
      };
      return fromHct(next);
    }
  }
}

function mapToColorSpace(color: Color, colorSpace: SliderColorSpace): Color {
  return colorSpace === 'display-p3' ? toP3Gamut(color) : toSrgbGamut(color);
}

function toActiveStopCss(color: Color, colorSpace: SliderColorSpace): string {
  if (colorSpace === 'display-p3') {
    return toCss(color, 'display-p3');
  }
  return toCss(color, 'rgb');
}

/**
 * Samples `steps + 1` evenly spaced stops across `range` for one channel of a
 * color model, for painting a slider track.
 *
 * Each stop holds `baseColor` with `channel` set to the stop's value. For a
 * hue channel in the default `'static'` hue mode, `baseColor` is ignored and
 * each stop is the most saturated color for that hue instead: the OKLCH cusp
 * in `colorSpace` (`'oklch'`), `s 100 / l 50` (`'hsl'`), `s 100 / v 100`
 * (`'hsv'`) or the HCT peak-chroma tone (`'hct'`), always at alpha 1. Each
 * sampled color is then gamut-mapped twice: into `colorSpace` (`activeColor`,
 * `activeCss`) and into sRGB (`srgbColor`, `srgbCss`).
 *
 * @throws {Error} When `steps` is non-finite or below 2.
 * @see {@link getSliderGradientStyles}
 *
 * @example
 * ```ts
 * import { sampleSliderGradient } from 'color-kit/driver';
 *
 * const stops = sampleSliderGradient({
 *   model: 'oklch',
 *   channel: 'l',
 *   baseColor: { l: 0.7, c: 0.15, h: 30, alpha: 1 },
 *   range: [0, 1],
 *   steps: 4,
 * });
 * stops.map((stop) => stop.value); // → [0, 0.25, 0.5, 0.75, 1]
 * stops[2].srgbCss; // → 'rgb(168 55 42)'
 * stops[2].activeCss; // → 'color(display-p3 0.608 0.249 0.1917)'
 * ```
 */
export function sampleSliderGradient(
  options: SampleSliderGradientOptions,
): SliderGradientStop[] {
  const steps = resolveSteps(options.steps);
  const colorSpace = resolveColorSpace(options.colorSpace);
  const hueGradientMode = resolveHueGradientMode(options.hueGradientMode);

  const stops: SliderGradientStop[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const value = options.range[0] + t * (options.range[1] - options.range[0]);

    const sampledColor = sampleColorFromModel(
      options,
      value,
      colorSpace,
      hueGradientMode,
    );
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

/**
 * Samples a slider gradient (see {@link sampleSliderGradient}) and formats
 * it as CSS `linear-gradient()` strings.
 *
 * The direction is `to right` for horizontal sliders and `to top` for
 * vertical ones, so `range[0]` sits at the left or bottom. Stop positions are
 * percentages with three decimals. `activeBackgroundImage` uses the
 * `colorSpace` stops (`color(display-p3 …)` by default);
 * `srgbBackgroundImage` and `srgbBackgroundColor` are sRGB fallbacks for
 * browsers or displays without Display P3.
 *
 * @throws {Error} When `steps` is non-finite or below 2.
 *
 * @example
 * ```ts
 * import { getSliderGradientStyles } from 'color-kit/driver';
 *
 * const styles = getSliderGradientStyles({
 *   model: 'oklch',
 *   channel: 'l',
 *   baseColor: { l: 0.7, c: 0.15, h: 30, alpha: 1 },
 *   range: [0, 1],
 *   steps: 2,
 *   colorSpace: 'srgb',
 * });
 * styles.activeBackgroundImage;
 * // → 'linear-gradient(to right, rgb(0 0 0) 0.000%, rgb(168 55 42) 50.000%, rgb(255 255 255) 100.000%)'
 * styles.srgbBackgroundColor; // → 'rgb(0 0 0)'
 * ```
 */
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
