'use client';

import {
  forwardRef,
  useCallback,
  useMemo,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { Color } from '@color-kit/core';
import { toHex } from '@color-kit/core';

export interface SwatchProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'color'
> {
  /** The color to display */
  color: Color;
  /** Whether this swatch is currently selected */
  isSelected?: boolean;
  /** Called when the swatch is clicked/selected. Makes the swatch interactive. */
  onSelect?: (color: Color) => void;
}

/**
 * A single color swatch that displays a color.
 *
 * Renders as a plain `<div>` — completely unstyled.
 * Use data attributes and CSS to style it.
 *
 * Data attributes:
 * - `[data-swatch]` — always present
 * - `[data-selected]` — present when `isSelected` is true
 * - `[data-interactive]` — present when `onSelect` is provided
 * - `[data-color]` — hex value string of the color
 */
export const Swatch = forwardRef<HTMLDivElement, SwatchProps>(function Swatch(
  { color, isSelected, onSelect, style, onClick, onKeyDown, ...props },
  ref,
) {
  const hex = useMemo(() => toHex(color), [color]);

  const handleClick = useCallback(
    (e: ReactMouseEvent) => {
      onSelect?.(color);
      onClick?.(e);
    },
    [color, onSelect, onClick],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect?.(color);
      }
      onKeyDown?.(e);
    },
    [color, onSelect, onKeyDown],
  );

  const isInteractive = !!onSelect;

  return (
    <div
      {...props}
      ref={ref}
      data-swatch=""
      data-selected={isSelected || undefined}
      data-interactive={isInteractive || undefined}
      data-color={hex}
      role={isInteractive ? 'button' : 'img'}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? undefined : `Color ${hex}`}
      onClick={isInteractive ? handleClick : onClick}
      onKeyDown={isInteractive ? handleKeyDown : onKeyDown}
      style={{
        backgroundColor: hex,
        ...style,
      }}
    />
  );
});
