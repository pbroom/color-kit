import { forwardRef } from 'react';
import { Layer, type LayerProps } from './layer.js';

export interface BackgroundProps extends Omit<LayerProps, 'kind'> {
  /** Checkerboard background helper. @default false */
  checkerboard?: boolean;
  /** Checker square size in px. @default 12 */
  checkerSize?: number;
}

/**
 * Convenience wrapper for a non-interactive background layer.
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
