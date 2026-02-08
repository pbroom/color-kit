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
 *   <HueSlider />
 *   <ColorInput />
 * </ColorProvider>
 * ```
 */
export function ColorProvider({
  children,
  ...colorOptions
}: ColorProviderProps) {
  const { color, setColor } = useColor(colorOptions);

  return (
    <ColorContext.Provider value={{ color, setColor }}>
      {children}
    </ColorContext.Provider>
  );
}
