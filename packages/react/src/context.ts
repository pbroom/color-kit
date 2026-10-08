import { createContext, useCallback, useContext } from 'react';
import { toCss, toHex, toHsl, toHsv, toOklch, toRgb } from '@color-kit/core';
import type { CssColorFormat } from '@color-kit/core';
import { getActiveDisplayedColor, type ColorState } from '@color-kit/driver';
import { useColorStoreSelector } from './color-store.js';
import type { UseColorReturn } from './use-color.js';

/** Value shared by a {@link Color} provider; the same shape {@link useColor} returns. */
export type ColorContextValue = UseColorReturn;

/**
 * React context that a {@link Color} provider fills with its shared color
 * state; `null` outside a provider.
 *
 * Prefer {@link useColorContext} to read it: the provider's value is not
 * reactive (children subscribe to its `store` instead), so reading the
 * context directly only gives a stable `store` and setters, not live
 * color fields.
 *
 * @example
 * ```tsx
 * import { useContext } from 'react';
 * import { ColorContext, useColorStoreSelector } from 'color-kit/react';
 *
 * function ActiveGamutBadge() {
 *   const context = useContext(ColorContext);
 *   const gamut = useColorStoreSelector(
 *     context?.store ?? null,
 *     (state) => state?.activeGamut ?? null,
 *   );
 *   return <span>{gamut ?? 'no provider'}</span>;
 * }
 * ```
 */
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
 * Returns the nearest {@link Color} provider's state as a live
 * {@link UseColorReturn} snapshot (requested/displayed colors, conversions
 * and setters).
 *
 * This hook intentionally subscribes to the complete `ColorState` because it
 * returns a complete snapshot: any state update rerenders the consumer.
 * Components that only need a slice should use
 * {@link useColorStoreSelector} on the context's `store` instead.
 *
 * @returns The provider's color state and setters.
 * @throws {Error} When called outside a `<Color>` provider.
 * @see {@link useColor}
 *
 * @example
 * ```tsx
 * import { Color, useColorContext } from 'color-kit/react';
 *
 * function Swatch() {
 *   const { displayedCss, setChannel } = useColorContext();
 *   return (
 *     <button
 *       style={{ background: displayedCss() }}
 *       onClick={() => setChannel('h', 30)}
 *     />
 *   );
 * }
 *
 * export const Picker = () => (
 *   <Color defaultColor="#3b82f6">
 *     <Swatch />
 *   </Color>
 * );
 * ```
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
    (format?: CssColorFormat) => {
      if (!requested) {
        throw new Error('Cannot format color outside a <Color> provider.');
      }
      return toCss(requested, format);
    },
    [requested],
  );
  const displayedCss = useCallback(
    (format?: CssColorFormat) => {
      if (!displayed) {
        throw new Error('Cannot format color outside a <Color> provider.');
      }
      return toCss(
        displayed,
        format ?? (activeGamut === 'display-p3' ? 'display-p3' : 'hex'),
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
