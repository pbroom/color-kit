import type { Color } from '@color-kit/core';
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
}

export function mapDisplayedColors(requested: Color): {
  srgb: Color;
  p3: Color;
  outOfGamut: {
    srgb: boolean;
    p3: boolean;
  };
} {
  const outOfSrgb = !inSrgbGamut(requested);
  const outOfP3 = !inP3Gamut(requested);

  return {
    srgb: toSrgbGamut(requested),
    p3: toP3Gamut(requested),
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
  } = options;
  const mapped = mapDisplayedColors(requested);

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
    },
  };
}

export function getActiveDisplayedColor(state: ColorState): Color {
  return state.activeGamut === 'display-p3'
    ? state.displayed.p3
    : state.displayed.srgb;
}
