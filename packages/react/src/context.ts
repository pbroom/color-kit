import { createContext, useContext } from 'react';
import type { UseColorReturn } from './use-color.js';

export type ColorContextValue = UseColorReturn;

export const ColorContext = createContext<ColorContextValue | null>(null);

/**
 * Access the nearest Color provider state.
 * Throws if used outside a Color.
 */
export function useColorContext(): ColorContextValue {
  const ctx = useContext(ColorContext);
  if (!ctx) {
    throw new Error(
      'useColorContext must be used within a <Color>. ' +
        'Wrap your color components in a <Color> to share color state.',
    );
  }
  return ctx;
}

/**
 * Access the nearest Color provider state if present.
 * Returns null when used outside a Color.
 */
export function useOptionalColorContext(): ColorContextValue | null {
  return useContext(ColorContext);
}
