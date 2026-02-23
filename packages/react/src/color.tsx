import { type ReactNode } from 'react';
import { ColorContext } from './context.js';
import { useColor, type UseColorOptions } from './use-color.js';

export interface ColorProps extends UseColorOptions {
  children: ReactNode;
}

/**
 * Provides shared color state to all child color components.
 *
 * @example
 * ```tsx
 * <Color defaultColor="#ff6600">
 *   <ColorArea />
 *   <ColorSlider channel="h" />
 *   <ColorInput model="oklch" channel="h" />
 *   <ColorStringInput format="oklch" />
 * </Color>
 * ```
 */
export function Color({ children, ...colorOptions }: ColorProps) {
  // Provider stays stable while children subscribe to state$ slices.
  const colorState = useColor({
    ...colorOptions,
    reactive: false,
  } as UseColorOptions & { reactive: false });

  return (
    <ColorContext.Provider value={colorState}>{children}</ColorContext.Provider>
  );
}
