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

export interface UseColorOptions {
  /** Initial color value (CSS string, hex, or Color object) */
  defaultColor?: string | Color;
  /** Controlled full state value */
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
  /** Initial active display gamut in uncontrolled mode */
  defaultGamut?: GamutTarget;
  /** Initial active view model in uncontrolled mode */
  defaultView?: ViewModel;
}

export interface SetRequestedOptions {
  changedChannel?: ColorChannel;
  interaction?: ColorInteraction;
  source?: ColorSource;
}

export interface UseColorReturn {
  /** Subscribable store backing this hook; child components subscribe to slices. */
  store: ColorStore;
  state: ColorState;
  requested: Color;
  displayed: Color;
  displayedSrgb: Color;
  displayedP3: Color;
  activeGamut: GamutTarget;
  activeView: ViewModel;
  setRequested: (requested: Color, options?: SetRequestedOptions) => void;
  setChannel: (
    channel: ColorChannel,
    value: number,
    options?: Omit<SetRequestedOptions, 'changedChannel'>,
  ) => void;
  setFromString: (css: string, options?: SetRequestedOptions) => void;
  setFromRgb: (rgb: Rgb, options?: SetRequestedOptions) => void;
  setFromHsl: (hsl: Hsl, options?: SetRequestedOptions) => void;
  setFromHsv: (hsv: Hsv, options?: SetRequestedOptions) => void;
  setActiveGamut: (gamut: GamutTarget, source?: ColorSource) => void;
  setActiveView: (view: ViewModel, source?: ColorSource) => void;
  /** Requested color conversions; computed lazily on first access and cached per requested color. */
  hex: string;
  rgb: Rgb;
  hsl: Hsl;
  hsv: Hsv;
  oklch: Oklch;
  requestedCss: (format?: CssColorFormat) => string;
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
        (current) => setColorRequested(current, requested, source),
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
      });
    },
    [setRequested],
  );

  const setFromRgb = useCallback(
    (rgb: Rgb, options: SetRequestedOptions = {}) => {
      setRequested(fromRgb(rgb), options);
    },
    [setRequested],
  );

  const setFromHsl = useCallback(
    (hsl: Hsl, options: SetRequestedOptions = {}) => {
      setRequested(fromHsl(hsl), options);
    },
    [setRequested],
  );

  const setFromHsv = useCallback(
    (hsv: Hsv, options: SetRequestedOptions = {}) => {
      setRequested(fromHsv(hsv), options);
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
        format ?? (state.activeGamut === 'display-p3' ? 'p3' : 'hex'),
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
