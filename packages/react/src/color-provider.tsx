import { type ReactNode } from 'react';
import { ColorContext } from './context.js';
import { useColor, type UseColorOptions } from './use-color.js';

export interface ColorProviderProps extends UseColorOptions {
  children: ReactNode;
}

/**
 * Provides shared color state to all child color components.
 *
 * @example
 * ```tsx
 * <ColorProvider defaultColor="#ff6600">
 *   <ColorArea />
 *   <ColorSlider channel="h" />
 *   <ColorInput model="oklch" channel="h" />
 *   <ColorStringInput format="oklch" />
 * </ColorProvider>
 * ```
 */
export function ColorProvider({
  children,
  ...colorOptions
}: ColorProviderProps) {
  // Provider stays stable while children subscribe to state$ slices.
  const colorState = useColor({
    ...colorOptions,
    reactive: false,
  } as UseColorOptions & { reactive: false });

  return (
    <ColorContext.Provider value={colorState}>{children}</ColorContext.Provider>
  );
}
