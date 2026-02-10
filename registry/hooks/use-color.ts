'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Color, Hsl, Hsv, Oklch, Rgb } from '@color-kit/core';
import {
  fromHsl,
  fromHsv,
  fromRgb,
  inP3Gamut,
  inSrgbGamut,
  parse,
  toCss,
  toHex,
  toHsl,
  toHsv,
  toOklch,
  toP3Gamut,
  toRgb,
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

export interface UseColorOptions {
  /** Initial color value (CSS string, hex, or Color object) */
  defaultColor?: string | Color;
  /** Controlled full state value */
  state?: ColorState;
  /** Callback when state changes */
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
  hex: string;
  rgb: Rgb;
  hsl: Hsl;
  hsv: Hsv;
  oklch: Oklch;
  requestedCss: (format?: string) => string;
  displayedCss: (format?: string) => string;
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

function resolveInitialColor(defaultColor?: string | Color): Color {
  if (!defaultColor) {
    return { l: 0.6, c: 0.2, h: 250, alpha: 1 };
  }
  if (typeof defaultColor === 'string') {
    return parse(defaultColor);
  }
  return defaultColor;
}

function resolveSource(
  interaction: ColorInteraction,
  source?: ColorSource,
): ColorSource {
  if (source) return source;
  return interaction === 'programmatic' ? 'programmatic' : 'user';
}

export function useColor(options: UseColorOptions = {}): UseColorReturn {
  const {
    defaultColor,
    state: controlledState,
    onChange,
    defaultGamut = 'display-p3',
    defaultView = 'oklch',
  } = options;

  const [internalState, setInternalState] = useState<ColorState>(() =>
    createColorState(resolveInitialColor(defaultColor), {
      activeGamut: defaultGamut,
      activeView: defaultView,
      source: 'programmatic',
    }),
  );

  const isControlled = controlledState !== undefined;
  const state = isControlled ? controlledState : internalState;

  const commitState = useCallback(
    (
      nextState: ColorState,
      changedChannel: ColorChannel | undefined,
      interaction: ColorInteraction,
    ) => {
      if (!isControlled) {
        setInternalState(nextState);
      }
      onChange?.({
        next: nextState,
        changedChannel,
        interaction,
      });
    },
    [isControlled, onChange],
  );

  const setRequested = useCallback(
    (requested: Color, options: SetRequestedOptions = {}) => {
      const interaction = options.interaction ?? 'programmatic';
      const source = resolveSource(interaction, options.source);
      const nextState = createColorState(requested, {
        activeGamut: state.activeGamut,
        activeView: state.activeView,
        source,
      });

      commitState(nextState, options.changedChannel, interaction);
    },
    [state.activeGamut, state.activeView, commitState],
  );

  const setChannel = useCallback(
    (
      channel: ColorChannel,
      value: number,
      options: Omit<SetRequestedOptions, 'changedChannel'> = {},
    ) => {
      const nextRequested: Color = {
        ...state.requested,
        [channel]: value,
      };
      setRequested(nextRequested, {
        ...options,
        changedChannel: channel,
      });
    },
    [state.requested, setRequested],
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
      const nextState: ColorState = {
        ...state,
        activeGamut: gamut,
        meta: {
          ...state.meta,
          source,
        },
      };
      commitState(nextState, undefined, 'programmatic');
    },
    [state, commitState],
  );

  const setActiveView = useCallback(
    (view: ViewModel, source: ColorSource = 'user') => {
      const nextState: ColorState = {
        ...state,
        activeView: view,
        meta: {
          ...state.meta,
          source,
        },
      };
      commitState(nextState, undefined, 'programmatic');
    },
    [state, commitState],
  );

  const requested = state.requested;
  const displayed = getActiveDisplayedColor(state);
  const displayedSrgb = state.displayed.srgb;
  const displayedP3 = state.displayed.p3;

  const hex = useMemo(() => toHex(requested), [requested]);
  const rgb = useMemo(() => toRgb(requested), [requested]);
  const hsl = useMemo(() => toHsl(requested), [requested]);
  const hsv = useMemo(() => toHsv(requested), [requested]);
  const oklch = useMemo(() => toOklch(requested), [requested]);

  const requestedCss = useCallback(
    (format?: string) => toCss(requested, format),
    [requested],
  );

  const displayedCss = useCallback(
    (format?: string) =>
      toCss(
        displayed,
        format ?? (state.activeGamut === 'display-p3' ? 'p3' : 'hex'),
      ),
    [displayed, state.activeGamut],
  );

  return {
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
    hex,
    rgb,
    hsl,
    hsv,
    oklch,
    requestedCss,
    displayedCss,
  };
}
