import { createContext, useContext } from 'react';
import { toCss, toHex, toHsl, toHsv, toOklch, toRgb } from '@color-kit/core';
import { getActiveDisplayedColor, type ColorState } from '@color-kit/driver';
import { useColorStoreSelector } from './color-store.js';
import type { UseColorReturn } from './use-color.js';

export type ColorContextValue = UseColorReturn;

export const ColorContext = createContext<ColorContextValue | null>(null);

function withStateSnapshot(
  context: ColorContextValue,
  state: ColorState,
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
    requestedCss: (format?: string) => toCss(requested, format),
    displayedCss: (format?: string) =>
      toCss(
        displayed,
        format ?? (state.activeGamut === 'display-p3' ? 'p3' : 'hex'),
      ),
  };
}

/**
 * Access the nearest Color provider state.
 * Throws if used outside a Color.
 */
export function useColorContext(): ColorContextValue {
  const context = useContext(ColorContext);
  const state = useColorStoreSelector(
    context?.store ?? null,
    (snapshot) => snapshot,
  );

  if (!context || !state) {
    throw new Error(
      'useColorContext must be used within a <Color>. ' +
        'Wrap your color components in a <Color> to share color state.',
    );
  }

  return withStateSnapshot(context, state);
}

/**
 * Access the nearest Color provider state if present.
 * Returns null when used outside a Color.
 */
export function useOptionalColorContext(): ColorContextValue | null {
  return useContext(ColorContext);
}
