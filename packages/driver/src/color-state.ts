import type { Color, GamutMapMethod } from '@color-kit/core';
import {
  inP3Gamut,
  inSrgbGamut,
  isAchromatic,
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

export interface ResolveIncomingRequestedOptions {
  /**
   * Whether `incoming.h` is an OKLCH hue the caller stated: an OKLCH color
   * object, or an `oklch()` string whose hue is not `none` (see
   * `hasExplicitOklchHue`). Colors converted from another model (hex,
   * `rgb()`, `hsl()`, `hwb()`, `lch()`, HSV, ...) have no OKLCH hue once
   * they are achromatic, so pass `false` for them.
   */
  explicitHue: boolean;
}

/**
 * Resolves a new requested color against the previous one so an achromatic
 * input does not discard the hue.
 *
 * When `incoming` is achromatic (chroma at or below
 * `ACHROMATIC_CHROMA_THRESHOLD`) and its hue is not explicit (or is not
 * finite), the result keeps `previous.h`; lightness, chroma and alpha stay as
 * converted. Raising chroma afterwards therefore resumes the previous hue
 * instead of jumping to the canonical achromatic hue `0` that conversions
 * report. Chromatic inputs and explicit hues are returned unchanged (same
 * reference), as is `incoming` when it already holds `previous.h`.
 *
 * @example
 * ```ts
 * resolveIncomingRequested(
 *   { l: 0.6, c: 0.15, h: 250, alpha: 1 },
 *   parse('#808080'), // h: 0
 *   { explicitHue: false },
 * ); // gray (l ≈ 0.6, c ≈ 0) with h: 250
 * ```
 */
export function resolveIncomingRequested(
  previous: Color,
  incoming: Color,
  options: ResolveIncomingRequestedOptions,
): Color {
  if (!isAchromatic(incoming.c)) return incoming;
  if (options.explicitHue && Number.isFinite(incoming.h)) return incoming;
  if (!Number.isFinite(previous.h) || incoming.h === previous.h) {
    return incoming;
  }
  return { ...incoming, h: previous.h };
}

export interface SetColorRequestedOptions extends MapDisplayedColorsOptions {
  /**
   * Whether `requested.h` is an OKLCH hue the caller stated. When `false`
   * and `requested` is achromatic, the state's current requested hue is kept
   * (see `resolveIncomingRequested`). Pass `false` for colors converted from
   * hex, RGB, HSL, HSV or any non-OKLCH string.
   * @default true
   */
  explicitHue?: boolean;
}

// Single-color reducers. Each returns the input state unchanged (same
// reference) when the operation is a no-op, so callers can cheaply skip
// redundant commits and change notifications.

/**
 * Replaces the requested color, re-deriving displayed colors and gamut flags
 * while keeping the active gamut/view and gamut mapping method
 * (`state.meta.gamutMapMethod`, unless `options.gamutMapMethod` overrides it).
 * An achromatic `requested` keeps the current hue when
 * `options.explicitHue` is `false` or its hue is not finite (see
 * `resolveIncomingRequested`). No-op when the resolved requested color,
 * source and gamut mapping method are unchanged.
 */
export function setColorRequested(
  state: ColorState,
  incoming: Color,
  source: ColorSource,
  options: SetColorRequestedOptions = {},
): ColorState {
  const requested = resolveIncomingRequested(state.requested, incoming, {
    explicitHue: options.explicitHue ?? true,
  });
  const gamutMapMethod = options.gamutMapMethod ?? state.meta.gamutMapMethod;
  if (
    colorsEqual(state.requested, requested, 0) &&
    state.meta.source === source &&
    gamutMapMethod === state.meta.gamutMapMethod
  ) {
    return state;
  }

  return createColorState(requested, {
    activeGamut: state.activeGamut,
    activeView: state.activeView,
    source,
    gamutMapMethod,
  });
}

/**
 * Sets one requested channel. No-op when the channel already holds `value`
 * (regardless of source) and `options.gamutMapMethod` does not change the
 * stored method. `options` is forwarded to `setColorRequested`.
 */
export function setColorChannel(
  state: ColorState,
  channel: ColorChannel,
  value: number,
  source: ColorSource,
  options: MapDisplayedColorsOptions = {},
): ColorState {
  if (
    state.requested[channel] === value &&
    (options.gamutMapMethod === undefined ||
      options.gamutMapMethod === state.meta.gamutMapMethod)
  ) {
    return state;
  }

  return setColorRequested(
    state,
    { ...state.requested, [channel]: value },
    source,
    options,
  );
}

/**
 * Switches the active display gamut without touching requested/displayed
 * values. No-op when both gamut and source are unchanged.
 */
export function setColorActiveGamut(
  state: ColorState,
  gamut: GamutTarget,
  source: ColorSource,
): ColorState {
  if (state.activeGamut === gamut && state.meta.source === source) {
    return state;
  }

  return {
    ...state,
    activeGamut: gamut,
    meta: { ...state.meta, source },
  };
}

/**
 * Switches the active view model without touching requested/displayed
 * values. No-op when both view and source are unchanged.
 */
export function setColorActiveView(
  state: ColorState,
  view: ViewModel,
  source: ColorSource,
): ColorState {
  if (state.activeView === view && state.meta.source === source) {
    return state;
  }

  return {
    ...state,
    activeView: view,
    meta: { ...state.meta, source },
  };
}
