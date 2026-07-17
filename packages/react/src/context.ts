import { createContext, useCallback, useContext } from 'react';
import { toCss, toHex, toHsl, toHsv, toOklch, toRgb } from '@color-kit/core';
import { getActiveDisplayedColor, type ColorState } from '@color-kit/driver';
import { useColorStoreSelector } from './color-store.js';
import type { UseColorReturn } from './use-color.js';

export type ColorContextValue = UseColorReturn;

export const ColorContext = createContext<ColorContextValue | null>(null);

function withStateSnapshot(
  context: ColorContextValue,
  state: ColorState,
  requestedCss: ColorContextValue['requestedCss'],
  displayedCss: ColorContextValue['displayedCss'],
): ColorContextValue {
  const requested = state.requested;
  const displayed = getActiveDisplayedColor(state);

  return {
    ...context,
    state,
    requested,
    displayed,
    displayedSrgb: state.displayed.srgb,
    displayedP3: state.displayed.p3,
    activeGamut: state.activeGamut,
    activeView: state.activeView,
    hex: toHex(requested),
    rgb: toRgb(requested),
    hsl: toHsl(requested),
    hsv: toHsv(requested),
    oklch: toOklch(requested),
    requestedCss,
    displayedCss,
  };
}

/**
 * Access the nearest Color provider state.
 *
 * This hook intentionally subscribes to the complete ColorState because it
 * returns a complete UseColorReturn snapshot. Any state update may rerender
 * the consumer; component internals should prefer focused store selectors.
 *
 * Throws if used outside a Color.
 */
export function useColorContext(): ColorContextValue {
  const context = useContext(ColorContext);
  const state = useColorStoreSelector(
    context?.store ?? null,
    (snapshot) => snapshot,
  );
  const requested = state?.requested;
  const displayed = state ? getActiveDisplayedColor(state) : null;
  const activeGamut = state?.activeGamut;
  const requestedCss = useCallback(
    (format?: string) => {
      if (!requested) {
        throw new Error('Cannot format color outside a <Color> provider.');
      }
      return toCss(requested, format);
    },
    [requested],
  );
  const displayedCss = useCallback(
    (format?: string) => {
      if (!displayed) {
        throw new Error('Cannot format color outside a <Color> provider.');
      }
      return toCss(
        displayed,
        format ?? (activeGamut === 'display-p3' ? 'p3' : 'hex'),
      );
    },
    [activeGamut, displayed],
  );

  if (!context || !state) {
    throw new Error(
      'useColorContext must be used within a <Color>. ' +
        'Wrap your color components in a <Color> to share color state.',
    );
  }

  return withStateSnapshot(context, state, requestedCss, displayedCss);
}

/**
 * Access the nearest Color provider state if present.
 * Returns null when used outside a Color.
 */
export function useOptionalColorContext(): ColorContextValue | null {
  return useContext(ColorContext);
}
