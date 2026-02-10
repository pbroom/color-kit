import { createContext, useContext } from 'react';
import type { UseColorReturn } from './use-color.js';

export type ColorContextValue = UseColorReturn;

export const ColorContext = createContext<ColorContextValue | null>(null);

/**
 * Access the nearest ColorProvider color state.
 * Throws if used outside a ColorProvider.
 */
export function useColorContext(): ColorContextValue {
  const ctx = useContext(ColorContext);
  if (!ctx) {
    throw new Error(
      'useColorContext must be used within a <ColorProvider>. ' +
        'Wrap your color components in a <ColorProvider> to share color state.',
    );
  }
  return ctx;
}

/**
 * Access the nearest ColorProvider color state if present.
 * Returns null when used outside a ColorProvider.
 */
export function useOptionalColorContext(): ColorContextValue | null {
  return useContext(ColorContext);
}
