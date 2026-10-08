import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Color,
  CssColorFormat,
  Hsl,
  Hsv,
  Oklch,
  Rgb,
} from '@color-kit/core';
import {
  fromHsl,
  fromHsv,
  fromRgb,
  parse,
  toCss,
  toHex,
  toHsl,
  toHsv,
  toOklch,
  toRgb,
} from '@color-kit/core';
import {
  createColorState,
  getActiveDisplayedColor,
  hasExplicitOklchHue,
  resolveColorSource,
  setColorActiveGamut,
  setColorActiveView,
  setColorChannel,
  setColorRequested,
  type ColorChannel,
  type ColorInteraction,
  type ColorSource,
  type ColorState,
  type ColorUpdateEvent,
  type GamutTarget,
  type ViewModel,
} from '@color-kit/driver';
import {
  createColorStore,
  useColorStoreSelector,
  useLatestSnapshot,
  type ColorStore,
} from './color-store.js';

/** Options for {@link useColor} and the `<Color>` provider. */
export interface UseColorOptions {
  /**
   * Initial requested color in uncontrolled mode: any CSS color string
   * `parse` accepts, or an OKLCH `Color` object. Ignored when `state` is set.
   * @defaultValue `{ l: 0.6, c: 0.2, h: 250, alpha: 1 }`
   */
  defaultColor?: string | Color;
  /**
   * Controlled full state. When set, the hook renders this state and reports
   * updates through `onChange` instead of storing them.
   */
  state?: ColorState;
  /**
   * Called when a setter produces a new state. Fires synchronously inside the
   * setter call (i.e. in your event handler, before React re-renders) in both
   * controlled and uncontrolled modes, exactly once per effective update and
   * never for no-op updates. Several setter calls in one tick compose: each
   * `event.next` builds on the previous one, even in controlled mode before
   * the new `state` prop arrives. Once React re-renders, later calls start
   * from the `state` you committed, so an update you ignore is not carried
   * into the next one.
   */
  onChange?: (event: ColorUpdateEvent) => void;
  /**
   * Initial active display gamut in uncontrolled mode.
   * @defaultValue 'display-p3'
   */
  defaultGamut?: GamutTarget;
  /**
   * Initial active view model in uncontrolled mode.
   * @defaultValue 'oklch'
   */
  defaultView?: ViewModel;
}

/** Options for the {@link UseColorReturn} and {@link UseMultiColorReturn} setters. */
export interface SetRequestedOptions {
  /** Channel reported as `changedChannel` on the update event. */
  changedChannel?: ColorChannel;
  /**
   * Input that caused the update, reported on the update event.
   * @defaultValue 'programmatic' (`'text-input'` for `setFromString`)
   */
  interaction?: ColorInteraction;
  /**
   * Source recorded in `state.meta.source`. Defaults to `'user'` for pointer,
   * keyboard and text-input interactions and `'programmatic'` otherwise.
   */
  source?: ColorSource;
  /**
   * Whether the new color's hue is an OKLCH hue the caller stated. When
   * `false` and the new color is achromatic, the latest requested hue is
   * kept, so raising chroma later resumes it.
   *
   * Defaults to `true` for `setRequested` (an OKLCH object states its hue),
   * to whether the string is an `oklch()` with a hue other than `none` for
   * `setFromString`, and to `false` for `setFromRgb` / `setFromHsl` /
   * `setFromHsv`. Pass `true` to store the converted hue (`0` for grays).
   */
  explicitHue?: boolean;
}

/** Color state, conversions and setters returned by {@link useColor} and {@link useColorContext}. */
export interface UseColorReturn {
  /** Subscribable store backing this hook; child components subscribe to slices. */
  store: ColorStore;
  /** The full current state. */
  state: ColorState;
  /** The requested (user-intended) OKLCH color; may be out of gamut. */
  requested: Color;
  /** The requested color gamut-mapped into `activeGamut`. */
  displayed: Color;
  /** The requested color gamut-mapped into sRGB. */
  displayedSrgb: Color;
  /** The requested color gamut-mapped into Display P3. */
  displayedP3: Color;
  /** Gamut that `displayed` and `displayedCss()` target. */
  activeGamut: GamutTarget;
  /** View model the UI is presenting (`oklch`, `rgb`, `hex`, ...). */
  activeView: ViewModel;
  /** Sets the requested OKLCH color. */
  setRequested: (requested: Color, options?: SetRequestedOptions) => void;
  /**
   * Sets one OKLCH channel (`l`, `c`, `h` or `alpha`) of the requested
   * color; reports `channel` as the event's `changedChannel`.
   */
  setChannel: (
    channel: ColorChannel,
    value: number,
    options?: Omit<SetRequestedOptions, 'changedChannel'>,
  ) => void;
  /**
   * Parses a CSS color and sets it as requested. Except for an `oklch()`
   * string with a hue, an achromatic color keeps the latest requested hue
   * (see `SetRequestedOptions.explicitHue`); the same applies to
   * `setFromRgb`, `setFromHsl` and `setFromHsv`.
   */
  setFromString: (css: string, options?: SetRequestedOptions) => void;
  /** Sets the requested color from sRGB channels (0-255, alpha 0-1). */
  setFromRgb: (rgb: Rgb, options?: SetRequestedOptions) => void;
  /** Sets the requested color from HSL. */
  setFromHsl: (hsl: Hsl, options?: SetRequestedOptions) => void;
  /** Sets the requested color from HSV. */
  setFromHsv: (hsv: Hsv, options?: SetRequestedOptions) => void;
  /** Sets the active display gamut; `source` defaults to `'user'`. */
  setActiveGamut: (gamut: GamutTarget, source?: ColorSource) => void;
  /** Sets the active view model; `source` defaults to `'user'`. */
  setActiveView: (view: ViewModel, source?: ColorSource) => void;
  /**
   * Requested color as hex. This and the other requested-color conversions
   * (`rgb`, `hsl`, `hsv`, `oklch`) are computed lazily on first access and
   * cached per requested color.
   */
  hex: string;
  /** Requested color as sRGB (computed lazily). */
  rgb: Rgb;
  /** Requested color as HSL (computed lazily). */
  hsl: Hsl;
  /** Requested color as HSV (computed lazily). */
  hsv: Hsv;
  /** Requested color as OKLCH (computed lazily). */
  oklch: Oklch;
  /** Formats the requested color as CSS; `format` defaults to `'hex'`. */
  requestedCss: (format?: CssColorFormat) => string;
  /**
   * Formats the displayed color as CSS. Defaults to `'display-p3'` when the
   * active gamut is Display P3 and `'hex'` otherwise.
   */
  displayedCss: (format?: CssColorFormat) => string;
}

/**
 * Requested-color conversions computed on first access. Instances are cached
 * per requested color object so non-reactive providers, and consumers that
 * never read these fields, skip the conversion work entirely.
 */
class ColorConversions {
  #hex?: string;
  #rgb?: Rgb;
  #hsl?: Hsl;
  #hsv?: Hsv;
  #oklch?: Oklch;

  constructor(private readonly color: Color) {}

  get hex(): string {
    return (this.#hex ??= toHex(this.color));
  }
  get rgb(): Rgb {
    return (this.#rgb ??= toRgb(this.color));
  }
  get hsl(): Hsl {
    return (this.#hsl ??= toHsl(this.color));
  }
  get hsv(): Hsv {
    return (this.#hsv ??= toHsv(this.color));
  }
  get oklch(): Oklch {
    return (this.#oklch ??= toOklch(this.color));
  }
}

const conversionCache = new WeakMap<Color, ColorConversions>();

function getColorConversions(color: Color): ColorConversions {
  let conversions = conversionCache.get(color);
  if (!conversions) {
    conversions = new ColorConversions(color);
    conversionCache.set(color, conversions);
  }
  return conversions;
}

function resolveInitialColor(defaultColor?: string | Color): Color {
  if (!defaultColor) {
    return { l: 0.6, c: 0.2, h: 250, alpha: 1 };
  }
  if (typeof defaultColor === 'string') {
    return parse(defaultColor);
  }
  return defaultColor;
}

/**
 * Holds one color as requested/displayed state and returns it with
 * conversions and setters.
 *
 * `requested` is the exact OKLCH color the user asked for and may be out of
 * gamut; `displayed` is that color gamut-mapped into the active gamut
 * (`displayedSrgb` / `displayedP3` hold both). Works uncontrolled
 * (`defaultColor`) or controlled (`state` + `onChange`). Setters always build
 * on the latest state, so several calls in one event handler compose. To
 * share the state with color components, use the `<Color>` provider
 * instead.
 *
 * @param options - Initial or controlled state and the change callback.
 * @returns The current state, derived conversions and setters.
 * @see {@link useMultiColor}
 *
 * @example
 * ```tsx
 * import { useColor } from 'color-kit/react';
 *
 * function Swatch() {
 *   const color = useColor({ defaultColor: '#3b82f6' });
 *   color.hex; // → '#3b82f6'
 *   color.requestedCss('oklch'); // → 'oklch(0.6231 0.188 259.81)'
 *
 *   return (
 *     <button
 *       style={{ background: color.displayedCss() }}
 *       onClick={() => color.setChannel('h', 30)}
 *     />
 *   );
 * }
 * ```
 */
export function useColor(options: UseColorOptions = {}): UseColorReturn {
  const {
    defaultColor,
    state: controlledState,
    onChange,
    defaultGamut = 'display-p3',
    defaultView = 'oklch',
    reactive = true,
  } = options as UseColorOptions & { reactive?: boolean };

  const [baseStore] = useState<ColorStore>(() =>
    createColorStore(
      controlledState ??
        createColorState(resolveInitialColor(defaultColor), {
          activeGamut: defaultGamut,
          activeView: defaultView,
          source: 'programmatic',
        }),
    ),
  );

  const isControlled = controlledState !== undefined;
  const store = useMemo<ColorStore>(() => {
    if (controlledState === undefined) {
      return baseStore;
    }
    return {
      get: () => controlledState,
      set: baseStore.set,
      subscribe: baseStore.subscribe,
    };
  }, [baseStore, controlledState]);
  const subscribedState = useColorStoreSelector(
    reactive ? store : null,
    (state) => state,
  );
  // Controlled mode: updates emitted in one tick compose on this pending
  // snapshot until the next commit, then restart from the `state` prop.
  const controlledSnapshot = useLatestSnapshot(controlledState);

  useEffect(() => {
    if (isControlled && controlledState) {
      baseStore.set(controlledState);
    }
  }, [baseStore, controlledState, isControlled]);
  const state = isControlled
    ? (controlledState as ColorState)
    : (subscribedState ?? store.get());

  /**
   * Applies a driver reducer to the latest state (not the render-time value)
   * and notifies `onChange` synchronously. Uncontrolled updates commit to the
   * store immediately; controlled updates are recorded as pending so later
   * updates in the same tick build on them.
   */
  const applyUpdate = useCallback(
    (
      reduce: (current: ColorState) => ColorState,
      changedChannel: ColorChannel | undefined,
      interaction: ColorInteraction,
    ) => {
      const current = isControlled
        ? (controlledSnapshot.read() ?? baseStore.get())
        : baseStore.get();
      const next = reduce(current);
      if (next === current) {
        return;
      }

      if (isControlled) {
        controlledSnapshot.write(next);
      } else {
        baseStore.set(next);
      }
      onChange?.({
        next,
        changedChannel,
        interaction,
      });
    },
    [baseStore, controlledSnapshot, isControlled, onChange],
  );

  const setRequested = useCallback(
    (requested: Color, options: SetRequestedOptions = {}) => {
      const interaction = options.interaction ?? 'programmatic';
      const source = resolveColorSource(interaction, options.source);
      applyUpdate(
        (current) =>
          setColorRequested(current, requested, source, {
            explicitHue: options.explicitHue,
          }),
        options.changedChannel,
        interaction,
      );
    },
    [applyUpdate],
  );

  const setChannel = useCallback(
    (
      channel: ColorChannel,
      value: number,
      options: Omit<SetRequestedOptions, 'changedChannel'> = {},
    ) => {
      const interaction = options.interaction ?? 'programmatic';
      const source = resolveColorSource(interaction, options.source);
      applyUpdate(
        (current) => setColorChannel(current, channel, value, source),
        channel,
        interaction,
      );
    },
    [applyUpdate],
  );

  const setFromString = useCallback(
    (css: string, options: SetRequestedOptions = {}) => {
      setRequested(parse(css), {
        interaction: options.interaction ?? 'text-input',
        source: options.source,
        changedChannel: options.changedChannel,
        explicitHue: options.explicitHue ?? hasExplicitOklchHue(css),
      });
    },
    [setRequested],
  );

  const setFromRgb = useCallback(
    (rgb: Rgb, options: SetRequestedOptions = {}) => {
      setRequested(fromRgb(rgb), {
        ...options,
        explicitHue: options.explicitHue ?? false,
      });
    },
    [setRequested],
  );

  const setFromHsl = useCallback(
    (hsl: Hsl, options: SetRequestedOptions = {}) => {
      setRequested(fromHsl(hsl), {
        ...options,
        explicitHue: options.explicitHue ?? false,
      });
    },
    [setRequested],
  );

  const setFromHsv = useCallback(
    (hsv: Hsv, options: SetRequestedOptions = {}) => {
      setRequested(fromHsv(hsv), {
        ...options,
        explicitHue: options.explicitHue ?? false,
      });
    },
    [setRequested],
  );

  const setActiveGamut = useCallback(
    (gamut: GamutTarget, source: ColorSource = 'user') => {
      applyUpdate(
        (current) => setColorActiveGamut(current, gamut, source),
        undefined,
        'programmatic',
      );
    },
    [applyUpdate],
  );

  const setActiveView = useCallback(
    (view: ViewModel, source: ColorSource = 'user') => {
      applyUpdate(
        (current) => setColorActiveView(current, view, source),
        undefined,
        'programmatic',
      );
    },
    [applyUpdate],
  );

  const requested = state.requested;
  const displayed = getActiveDisplayedColor(state);
  const displayedSrgb = state.displayed.srgb;
  const displayedP3 = state.displayed.p3;
  const conversions = useMemo(
    () => getColorConversions(requested),
    [requested],
  );

  const requestedCss = useCallback(
    (format?: CssColorFormat) => toCss(requested, format),
    [requested],
  );

  const displayedCss = useCallback(
    (format?: CssColorFormat) =>
      toCss(
        displayed,
        format ?? (state.activeGamut === 'display-p3' ? 'display-p3' : 'hex'),
      ),
    [displayed, state.activeGamut],
  );

  return {
    store,
    state,
    requested,
    displayed,
    displayedSrgb,
    displayedP3,
    activeGamut: state.activeGamut,
    activeView: state.activeView,
    setRequested,
    setChannel,
    setFromString,
    setFromRgb,
    setFromHsl,
    setFromHsv,
    setActiveGamut,
    setActiveView,
    get hex() {
      return conversions.hex;
    },
    get rgb() {
      return conversions.rgb;
    },
    get hsl() {
      return conversions.hsl;
    },
    get hsv() {
      return conversions.hsv;
    },
    get oklch() {
      return conversions.oklch;
    },
    requestedCss,
    displayedCss,
  };
}
