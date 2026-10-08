import type { Color, GamutMapMethod } from '@color-kit/core';
import {
  inP3Gamut,
  inSrgbGamut,
  isAchromatic,
  toP3Gamut,
  toSrgbGamut,
} from '@color-kit/core';

/**
 * Display gamut a color state renders in. The color-state, multi-color and
 * display helpers do not validate it: any value other than `'display-p3'`
 * (including the removed `'p3'` spelling) selects the sRGB color.
 */
export type GamutTarget = 'srgb' | 'display-p3';
/** Color model a picker shows its channels or text in. */
export type ViewModel = 'oklch' | 'oklab' | 'rgb' | 'hex' | 'hsl' | 'hsv';
/** OKLCH channel of a requested color. */
export type ColorChannel = 'l' | 'c' | 'h' | 'alpha';
/**
 * Who caused a state change: `'user'` (direct interaction), `'programmatic'`
 * (set by code, e.g. a controlled prop) or `'derived'` (computed from another
 * change). See {@link resolveColorSource}.
 */
export type ColorSource = 'user' | 'programmatic' | 'derived';
/** Input mechanism behind an update, reported on {@link ColorUpdateEvent}. */
export type ColorInteraction =
  | 'pointer'
  | 'keyboard'
  | 'text-input'
  | 'programmatic';

/**
 * Single-color picker state. `requested` is the OKLCH color the user or code
 * asked for, kept unclamped even when it lies outside every display gamut so
 * that later edits do not drift. `displayed` holds that color gamut-mapped
 * into sRGB and Display P3, which is what should be painted; `activeGamut`
 * picks which of the two the UI shows (see {@link getActiveDisplayedColor}).
 *
 * Create it with {@link createColorState} and update it with the
 * `setColor*` reducers, which return the same object for a no-op.
 */
export interface ColorState {
  /** Requested OKLCH color, possibly out of gamut. */
  requested: Color;
  /** `requested` mapped into each display gamut with `meta.gamutMapMethod`. */
  displayed: {
    /** `requested` mapped into sRGB. */
    srgb: Color;
    /** `requested` mapped into Display P3. */
    p3: Color;
  };
  /** Gamut whose displayed color the UI renders. */
  activeGamut: GamutTarget;
  /** Model the picker shows channels or text in. */
  activeView: ViewModel;
  /** Provenance and gamut status of the current state. */
  meta: {
    /** Source of the last change. */
    source: ColorSource;
    /** Whether `requested` lies outside each gamut (before mapping). */
    outOfGamut: {
      /** `requested` is outside sRGB. */
      srgb: boolean;
      /** `requested` is outside Display P3. */
      p3: boolean;
    };
    /**
     * Gamut mapping used to derive `displayed`. Updates that re-derive the
     * displayed colors reuse it unless they explicitly pass another method.
     */
    gamutMapMethod: GamutMapMethod;
  };
}

/** Change notification a single-color picker emits with its next state. */
export interface ColorUpdateEvent {
  /** State after the update. */
  next: ColorState;
  /**
   * OKLCH channel the update edited, when it edited exactly one (see
   * {@link getColorInputChangedChannel}).
   */
  changedChannel?: ColorChannel;
  /** Input mechanism that caused the update. */
  interaction: ColorInteraction;
}

/** Options for {@link createColorState}. */
export interface CreateColorStateOptions {
  /**
   * Gamut whose displayed color the UI renders.
   * @defaultValue 'display-p3'
   */
  activeGamut?: GamutTarget;
  /**
   * Model the picker shows channels or text in.
   * @defaultValue 'oklch'
   */
  activeView?: ViewModel;
  /**
   * Source recorded in `meta.source`.
   * @defaultValue 'programmatic'
   */
  source?: ColorSource;
  /**
   * Gamut mapping used for the displayed sRGB / P3 colors.
   * @defaultValue 'chroma-reduction'
   */
  gamutMapMethod?: GamutMapMethod;
}

/** Options for {@link mapDisplayedColors} and the requested-color setters. */
export interface MapDisplayedColorsOptions {
  /**
   * Gamut mapping passed to `toSrgbGamut` / `toP3Gamut`. The setters default
   * to the state's current `meta.gamutMapMethod` instead.
   * @defaultValue 'chroma-reduction'
   */
  gamutMapMethod?: GamutMapMethod;
}

/**
 * Maps a requested color into both display gamuts and reports whether it was
 * outside each one. Gamut membership is tested on the unmapped color.
 *
 * @example
 * ```ts
 * import { toHex } from 'color-kit';
 * import { mapDisplayedColors } from 'color-kit/driver';
 *
 * const mapped = mapDisplayedColors({ l: 0.75, c: 0.22, h: 150, alpha: 1 });
 * toHex(mapped.srgb); // → '#00d061'
 * mapped.outOfGamut; // → { srgb: true, p3: false }
 * ```
 */
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

/**
 * Creates a {@link ColorState} from a requested OKLCH color: copies
 * `requested` as is (no clamping) and derives the displayed sRGB and P3
 * colors and out-of-gamut flags with {@link mapDisplayedColors}.
 *
 * @example
 * ```ts
 * import { createColorState } from 'color-kit/driver';
 *
 * const state = createColorState({ l: 0.75, c: 0.22, h: 150, alpha: 1 });
 * state.requested.c; // → 0.22
 * state.displayed.srgb.c.toFixed(3); // → '0.207'
 * state.meta.outOfGamut; // → { srgb: true, p3: false }
 * state.activeGamut; // → 'display-p3'
 * ```
 */
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

/**
 * Returns the displayed color for the state's active gamut: `displayed.p3`
 * for `'display-p3'`, otherwise `displayed.srgb`.
 *
 * @example
 * ```ts
 * import { toHex } from 'color-kit';
 * import {
 *   createColorState,
 *   getActiveDisplayedColor,
 *   setColorActiveGamut,
 * } from 'color-kit/driver';
 *
 * const state = createColorState({ l: 0.75, c: 0.22, h: 150, alpha: 1 });
 * getActiveDisplayedColor(state).c; // → 0.22 (inside P3, unchanged)
 * const srgb = setColorActiveGamut(state, 'srgb', 'user');
 * toHex(getActiveDisplayedColor(srgb)); // → '#00d061'
 * ```
 */
export function getActiveDisplayedColor(state: ColorState): Color {
  return state.activeGamut === 'display-p3'
    ? state.displayed.p3
    : state.displayed.srgb;
}

/**
 * Resolves the state source for an interaction. Explicit `source` wins;
 * otherwise programmatic interactions stay programmatic and everything else
 * counts as user intent.
 *
 * @example
 * ```ts
 * import { resolveColorSource } from 'color-kit/driver';
 *
 * resolveColorSource('pointer'); // → 'user'
 * resolveColorSource('programmatic'); // → 'programmatic'
 * resolveColorSource('keyboard', 'derived'); // → 'derived'
 * ```
 */
export function resolveColorSource(
  interaction: ColorInteraction,
  source?: ColorSource,
): ColorSource {
  if (source) return source;
  return interaction === 'programmatic' ? 'programmatic' : 'user';
}

/**
 * Channel-wise equality on OKLCH colors: true when `l`, `c`, `h` and `alpha`
 * each differ by at most `epsilon` (default `0`, exact). Hue is compared
 * numerically, without wrap-around (`0` and `360` differ).
 *
 * @example
 * ```ts
 * import { colorsEqual } from 'color-kit/driver';
 *
 * const a = { l: 0.5, c: 0.1, h: 200, alpha: 1 };
 * const b = { l: 0.5004, c: 0.1, h: 200, alpha: 1 };
 * colorsEqual(a, b); // → false
 * colorsEqual(a, b, 0.001); // → true
 * ```
 */
export function colorsEqual(a: Color, b: Color, epsilon: number = 0): boolean {
  return (
    Math.abs(a.l - b.l) <= epsilon &&
    Math.abs(a.c - b.c) <= epsilon &&
    Math.abs(a.h - b.h) <= epsilon &&
    Math.abs(a.alpha - b.alpha) <= epsilon
  );
}

/** Options for {@link resolveIncomingRequested}. */
export interface ResolveIncomingRequestedOptions {
  /**
   * Whether `incoming.h` is an OKLCH hue the caller stated: an OKLCH color
   * object, or an `oklch()` string whose hue is not `none` (see
   * {@link hasExplicitOklchHue}). Colors converted from another model (hex,
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
 * import { parse } from 'color-kit';
 * import { resolveIncomingRequested } from 'color-kit/driver';
 *
 * const gray = resolveIncomingRequested(
 *   { l: 0.6, c: 0.15, h: 250, alpha: 1 },
 *   parse('#808080'), // h: 0
 *   { explicitHue: false },
 * );
 * gray.h; // → 250
 * gray.l.toFixed(2); // → '0.60'
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

/** Options for {@link setColorRequested}. */
export interface SetColorRequestedOptions extends MapDisplayedColorsOptions {
  /**
   * Whether `requested.h` is an OKLCH hue the caller stated. When `false`
   * and `requested` is achromatic, the state's current requested hue is kept
   * (see {@link resolveIncomingRequested}). Pass `false` for colors converted
   * from hex, RGB, HSL, HSV or any non-OKLCH string.
   * @defaultValue true
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
 * {@link resolveIncomingRequested}). No-op (returns `state`) when the
 * resolved requested color, source and gamut mapping method are unchanged.
 *
 * @param state - Current state.
 * @param incoming - New requested OKLCH color; stored unclamped.
 * @param source - Source recorded in `meta.source`.
 *
 * @example
 * ```ts
 * import { parse, toHex } from 'color-kit';
 * import { createColorState, setColorRequested } from 'color-kit/driver';
 *
 * const state = createColorState(parse('#3b82f6'));
 * const gray = parse('#808080');
 * const next = setColorRequested(state, gray, 'user', { explicitHue: false });
 * toHex(next.requested); // → '#808080'
 * next.requested.h === state.requested.h; // → true (blue hue kept)
 * setColorRequested(next, gray, 'user', { explicitHue: false }) === next; // → true
 * ```
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
 * stored method; a source-only change is therefore dropped. `options` is
 * forwarded to {@link setColorRequested} (with `explicitHue` left at `true`).
 * `value` is not clamped.
 *
 * @example
 * ```ts
 * import { parse, toHex } from 'color-kit';
 * import { createColorState, setColorChannel } from 'color-kit/driver';
 *
 * const state = createColorState(parse('#3b82f6'));
 * const next = setColorChannel(state, 'l', 0.4, 'user');
 * toHex(next.requested); // → '#003baa'
 * setColorChannel(next, 'l', 0.4, 'programmatic') === next; // → true
 * ```
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
 * values. No-op when both gamut and source are unchanged. `gamut` is not
 * validated (see {@link GamutTarget}).
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { createColorState, setColorActiveGamut } from 'color-kit/driver';
 *
 * const state = createColorState(parse('#3b82f6'));
 * const next = setColorActiveGamut(state, 'srgb', 'user');
 * next.activeGamut; // → 'srgb'
 * next.requested === state.requested; // → true
 * ```
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
 *
 * @example
 * ```ts
 * import { parse } from 'color-kit';
 * import { createColorState, setColorActiveView } from 'color-kit/driver';
 *
 * const state = createColorState(parse('#3b82f6'));
 * const next = setColorActiveView(state, 'hsl', 'user');
 * next.activeView; // → 'hsl'
 * next.meta.source; // → 'user'
 * ```
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
