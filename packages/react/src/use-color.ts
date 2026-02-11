import { useEffect } from 'react';
import type { Observable } from '@legendapp/state';
import { useObservable, useSelector } from '@legendapp/state/react';
import type { Color, Hsl, Hsv, Oklch, Rgb } from '@color-kit/core';
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
  type ColorChannel,
  type ColorInteraction,
  type ColorSource,
  type ColorState,
  type ColorUpdateEvent,
  type GamutTarget,
  type ViewModel,
} from './color-state.js';

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
  state$: Observable<ColorState>;
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
    reactive = true,
  } = options as UseColorOptions & { reactive?: boolean };

  const state$ = useObservable<ColorState>(() =>
    createColorState(resolveInitialColor(defaultColor), {
      activeGamut: defaultGamut,
      activeView: defaultView,
      source: 'programmatic',
    }),
  );

  const isControlled = controlledState !== undefined;
  const subscribedState = useSelector(() => (reactive ? state$.get() : null));

  useEffect(() => {
    if (isControlled && controlledState) {
      state$.set(controlledState);
    }
  }, [controlledState, isControlled, state$]);

  const state = isControlled
    ? (controlledState as ColorState)
    : reactive
      ? (subscribedState as ColorState)
      : state$.peek();

  const getCurrentState = (): ColorState => {
    return isControlled && controlledState ? controlledState : state$.peek();
  };

  const commitState = (
    nextState: ColorState,
    changedChannel: ColorChannel | undefined,
    interaction: ColorInteraction,
  ) => {
    if (!isControlled) {
      state$.set(nextState);
    }
    onChange?.({
      next: nextState,
      changedChannel,
      interaction,
    });
  };

  const setRequested = (
    requested: Color,
    options: SetRequestedOptions = {},
  ) => {
    const interaction = options.interaction ?? 'programmatic';
    const source = resolveSource(interaction, options.source);
    const currentState = getCurrentState();
    const nextState = createColorState(requested, {
      activeGamut: currentState.activeGamut,
      activeView: currentState.activeView,
      source,
    });

    commitState(nextState, options.changedChannel, interaction);
  };

  const setChannel = (
    channel: ColorChannel,
    value: number,
    options: Omit<SetRequestedOptions, 'changedChannel'> = {},
  ) => {
    const currentState = getCurrentState();
    const nextRequested: Color = {
      ...currentState.requested,
      [channel]: value,
    };
    setRequested(nextRequested, {
      ...options,
      changedChannel: channel,
    });
  };

  const setFromString = (css: string, options: SetRequestedOptions = {}) => {
    setRequested(parse(css), {
      interaction: options.interaction ?? 'text-input',
      source: options.source,
      changedChannel: options.changedChannel,
    });
  };

  const setFromRgb = (rgb: Rgb, options: SetRequestedOptions = {}) => {
    setRequested(fromRgb(rgb), options);
  };

  const setFromHsl = (hsl: Hsl, options: SetRequestedOptions = {}) => {
    setRequested(fromHsl(hsl), options);
  };

  const setFromHsv = (hsv: Hsv, options: SetRequestedOptions = {}) => {
    setRequested(fromHsv(hsv), options);
  };

  const setActiveGamut = (gamut: GamutTarget, source: ColorSource = 'user') => {
    const currentState = getCurrentState();
    if (
      currentState.activeGamut === gamut &&
      currentState.meta.source === source
    ) {
      return;
    }

    commitState(
      {
        ...currentState,
        activeGamut: gamut,
        meta: {
          ...currentState.meta,
          source,
        },
      },
      undefined,
      'programmatic',
    );
  };

  const setActiveView = (view: ViewModel, source: ColorSource = 'user') => {
    const currentState = getCurrentState();
    if (
      currentState.activeView === view &&
      currentState.meta.source === source
    ) {
      return;
    }

    commitState(
      {
        ...currentState,
        activeView: view,
        meta: {
          ...currentState.meta,
          source,
        },
      },
      undefined,
      'programmatic',
    );
  };

  const requested = state.requested;
  const displayed = getActiveDisplayedColor(state);
  const displayedSrgb = state.displayed.srgb;
  const displayedP3 = state.displayed.p3;

  const hex = toHex(requested);
  const rgb = toRgb(requested);
  const hsl = toHsl(requested);
  const hsv = toHsv(requested);
  const oklch = toOklch(requested);

  const requestedCss = (format?: string) => toCss(requested, format);

  const displayedCss = (format?: string) =>
    toCss(
      displayed,
      format ?? (state.activeGamut === 'display-p3' ? 'p3' : 'hex'),
    );

  return {
    state$,
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
