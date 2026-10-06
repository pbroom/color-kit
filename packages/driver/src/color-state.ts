import type { Color, GamutMapMethod } from '@color-kit/core';
import {
  inP3Gamut,
  inSrgbGamut,
  toP3Gamut,
  toSrgbGamut,
} from '@color-kit/core';

export type GamutTarget = 'srgb' | 'display-p3';
export type ViewModel = 'oklch' | 'oklab' | 'rgb' | 'hex' | 'hsl' | 'hsv';
export type ColorChannel = 'l' | 'c' | 'h' | 'alpha';
export type ColorSource = 'user' | 'programmatic' | 'derived';
export type ColorInteraction =
  | 'pointer'
  | 'keyboard'
  | 'text-input'
  | 'programmatic';

export interface ColorState {
  requested: Color;
  displayed: {
    srgb: Color;
    p3: Color;
  };
  activeGamut: GamutTarget;
  activeView: ViewModel;
  meta: {
    source: ColorSource;
    outOfGamut: {
      srgb: boolean;
      p3: boolean;
    };
    /**
     * Gamut mapping used to derive `displayed`. Updates that re-derive the
     * displayed colors reuse it unless they explicitly pass another method.
     */
    gamutMapMethod: GamutMapMethod;
  };
}

export interface ColorUpdateEvent {
  next: ColorState;
  changedChannel?: ColorChannel;
  interaction: ColorInteraction;
}

export interface CreateColorStateOptions {
  activeGamut?: GamutTarget;
  activeView?: ViewModel;
  source?: ColorSource;
  /**
   * Gamut mapping used for the displayed sRGB / P3 colors.
   * @default 'chroma-reduction'
   */
  gamutMapMethod?: GamutMapMethod;
}

export interface MapDisplayedColorsOptions {
  /**
   * Gamut mapping passed to `toSrgbGamut` / `toP3Gamut`.
   * @default 'chroma-reduction'
   */
  gamutMapMethod?: GamutMapMethod;
}

export function mapDisplayedColors(
  requested: Color,
  options: MapDisplayedColorsOptions = {},
): {
  srgb: Color;
  p3: Color;
  outOfGamut: {
    srgb: boolean;
    p3: boolean;
  };
} {
  const outOfSrgb = !inSrgbGamut(requested);
  const outOfP3 = !inP3Gamut(requested);

  const mapOptions = { method: options.gamutMapMethod };

  return {
    srgb: toSrgbGamut(requested, mapOptions),
    p3: toP3Gamut(requested, mapOptions),
    outOfGamut: {
      srgb: outOfSrgb,
      p3: outOfP3,
    },
  };
}

export function createColorState(
  requested: Color,
  options: CreateColorStateOptions = {},
): ColorState {
  const {
    activeGamut = 'display-p3',
    activeView = 'oklch',
    source = 'programmatic',
    gamutMapMethod = 'chroma-reduction',
  } = options;
  const mapped = mapDisplayedColors(requested, { gamutMapMethod });

  return {
    requested: { ...requested },
    displayed: {
      srgb: mapped.srgb,
      p3: mapped.p3,
    },
    activeGamut,
    activeView,
    meta: {
      source,
      outOfGamut: mapped.outOfGamut,
      gamutMapMethod,
    },
  };
}

export function getActiveDisplayedColor(state: ColorState): Color {
  return state.activeGamut === 'display-p3'
    ? state.displayed.p3
    : state.displayed.srgb;
}

/**
 * Resolves the state source for an interaction. Explicit `source` wins;
 * otherwise programmatic interactions stay programmatic and everything else
 * counts as user intent.
 */
export function resolveColorSource(
  interaction: ColorInteraction,
  source?: ColorSource,
): ColorSource {
  if (source) return source;
  return interaction === 'programmatic' ? 'programmatic' : 'user';
}

/** Channel-wise equality on OKLCH colors with an optional tolerance. */
export function colorsEqual(a: Color, b: Color, epsilon: number = 0): boolean {
  return (
    Math.abs(a.l - b.l) <= epsilon &&
    Math.abs(a.c - b.c) <= epsilon &&
    Math.abs(a.h - b.h) <= epsilon &&
    Math.abs(a.alpha - b.alpha) <= epsilon
  );
}
