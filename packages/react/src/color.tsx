import { type ReactNode } from 'react';
import { ColorContext } from './context.js';
import { useColor, type UseColorOptions } from './use-color.js';

/** Props for {@link Color}: the {@link UseColorOptions} plus children. */
export interface ColorProps extends UseColorOptions {
  /** Color components that share this provider's state. */
  children: ReactNode;
}

/**
 * Provides shared color state to all descendant color components.
 *
 * Accepts the same options as {@link useColor} (uncontrolled `defaultColor`,
 * or controlled `state` + `onChange`). Descendants subscribe to the slices
 * of state they read, so an uncontrolled provider does not rerender on color
 * changes and a drag only rerenders the components that depend on it.
 *
 * @see {@link useColorContext}
 *
 * @example
 * ```tsx
 * import { Color, ColorArea, ColorSlider, ColorStringInput } from 'color-kit/react';
 *
 * export const Picker = () => (
 *   <Color defaultColor="#ff6600">
 *     <ColorArea style={{ width: 240, height: 240 }} />
 *     <ColorSlider channel="h" />
 *     <ColorStringInput format="oklch" />
 *   </Color>
 * );
 * ```
 */
export function Color({ children, ...colorOptions }: ColorProps) {
  // Provider stays stable while children subscribe to store slices.
  const colorState = useColor({
    ...colorOptions,
    reactive: false,
  } as UseColorOptions & { reactive: false });

  return (
    <ColorContext.Provider value={colorState}>{children}</ColorContext.Provider>
  );
}
