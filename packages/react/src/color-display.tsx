import { forwardRef, useMemo, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  getColorDisplayBackground,
  getColorDisplayHex,
} from './api/color-display.js';

export interface ColorDisplayProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'color'
> {
  /** Standalone color value (alternative to ColorProvider) */
  color?: Color;
}

/**
 * Shows the current color as a visual preview. Purely presentational.
 *
 * Renders as a `<div>` with the background color set to the current color.
 * Completely unstyled — use data attributes and CSS to style it.
 *
 * Data attributes:
 * - `[data-color-display]` — always present
 * - `[data-color]` — hex string of the current color
 */
export const ColorDisplay = forwardRef<HTMLDivElement, ColorDisplayProps>(
  function ColorDisplay({ color: colorProp, style, ...props }, ref) {
    const context = useOptionalColorContext();

    const color = colorProp ?? context?.color;

    if (!color) {
      throw new Error(
        'ColorDisplay requires either a <ColorProvider> ancestor or an explicit color prop.',
      );
    }

    const hex = useMemo(() => getColorDisplayHex(color), [color]);
    const backgroundColor = useMemo(
      () => getColorDisplayBackground(color, hex),
      [color, hex],
    );

    return (
      <div
        {...props}
        ref={ref}
        data-color-display=""
        data-color={hex}
        role="img"
        aria-label={`Current color: ${hex}`}
        style={{
          backgroundColor,
          ...style,
        }}
      />
    );
  },
);
