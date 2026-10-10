import { type ReactNode } from 'react';
import { ColorContext } from './context.js';
import { useColor, type UseColorOptions } from './use-color.js';

/** Props for {@link Color}: the {@link UseColorOptions} plus children. */
export interface ColorProps extends UseColorOptions {
  /** Color components that share this provider's state. */
  children: ReactNode;
}

/**
 * Provides shared color state to every component inside it.
 *
 * Accepts the same options as {@link useColor} (uncontrolled `defaultColor`,
 * or controlled `state` + `onChange`). Descendants subscribe to the slices
 * of state they read, so an uncontrolled provider does not rerender on color
 * changes and a drag only rerenders the components that depend on it.
 * Read it with {@link useColorContext} or {@link useColorStoreSelector}.
 *
 * @see {@link useColorContext}
 *
 * @example
 * ```tsx
 * import { Color, useColorContext, useColorPlaneRenderer } from 'color-kit/react';
 *
 * function Plane() {
 *   const { requested } = useColorContext();
 *   const { ref, canvasKey } = useColorPlaneRenderer({ color: requested });
 *   return <canvas ref={ref} key={canvasKey} style={{ width: 240, height: 160 }} />;
 * }
 *
 * function Hue() {
 *   const { requested, setChannel } = useColorContext();
 *   return (
 *     <input
 *       type="range"
 *       aria-label="Hue"
 *       min={0}
 *       max={360}
 *       value={requested.h}
 *       onChange={(event) => setChannel('h', Number(event.currentTarget.value))}
 *     />
 *   );
 * }
 *
 * export const Picker = () => (
 *   <Color defaultColor="#ff6600">
 *     <Plane />
 *     <Hue />
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
