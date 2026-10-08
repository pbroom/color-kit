import { forwardRef } from 'react';
import { Layer, type LayerProps } from './layer.js';

/** Props for {@link Background}: {@link LayerProps} without `kind`. */
export interface BackgroundProps extends Omit<LayerProps, 'kind'> {
  /**
   * Paints a checkerboard (for showing transparency behind the plane).
   * @defaultValue false
   */
  checkerboard?: boolean;
  /**
   * Checker square size in px.
   * @defaultValue 12
   */
  checkerSize?: number;
}

/**
 * Non-interactive `background` {@link Layer}, optionally painted with a
 * checkerboard so translucent colors read as translucent.
 *
 * Always `kind="background"` and never interactive; a `style` prop is merged
 * over the checkerboard styles.
 *
 * @example
 * ```tsx
 * import { Background, Color, ColorArea, ColorPlane } from 'color-kit/react';
 *
 * export const Picker = () => (
 *   <Color defaultColor="oklch(0.7 0.15 250 / 0.6)">
 *     <ColorArea style={{ width: 240, height: 240 }}>
 *       <Background checkerboard checkerSize={8} />
 *       <ColorPlane />
 *     </ColorArea>
 *   </Color>
 * );
 * ```
 */
export const Background = forwardRef<HTMLDivElement, BackgroundProps>(
  function Background(
    { checkerboard = false, checkerSize = 12, style, ...props },
    ref,
  ) {
    const checkerStyle = checkerboard
      ? {
          backgroundImage:
            'linear-gradient(45deg, rgba(0, 0, 0, 0.22) 25%, transparent 25%), linear-gradient(-45deg, rgba(0, 0, 0, 0.22) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0, 0, 0, 0.22) 75%), linear-gradient(-45deg, transparent 75%, rgba(0, 0, 0, 0.22) 75%)',
          backgroundSize: `${checkerSize}px ${checkerSize}px`,
          backgroundPosition: `0 0, 0 ${checkerSize / 2}px, ${checkerSize / 2}px -${checkerSize / 2}px, -${checkerSize / 2}px 0`,
        }
      : undefined;

    return (
      <Layer
        {...props}
        ref={ref}
        kind="background"
        interactive={false}
        data-color-area-background=""
        style={{
          ...checkerStyle,
          ...style,
        }}
      />
    );
  },
);
