import {
  forwardRef,
  useCallback,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { Color } from '@color-kit/core';
import {
  createColorState,
  getActiveDisplayedColor,
  type GamutTarget,
} from './color-state.js';
import {
  getColorDisplayHex,
  getColorDisplayStyles,
} from './api/color-display.js';

export interface SwatchProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'color' | 'onSelect'
> {
  /** The color to display */
  color: Color;
  /** Display gamut used for rendering this swatch */
  gamut?: GamutTarget;
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
  {
    color,
    gamut = 'display-p3',
    isSelected,
    onSelect,
    style,
    onClick,
    onKeyDown,
    ...props
  },
  ref,
) {
  const displayState = createColorState(color, {
    activeGamut: gamut,
    source: 'programmatic',
  });
  const displayed = getActiveDisplayedColor(displayState);
  const displayedHex = getColorDisplayHex(displayState.displayed.srgb);
  const displayStyles = getColorDisplayStyles(
    displayed,
    displayState.displayed.srgb,
    displayState.activeGamut,
  );

  const handleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
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
      data-color={displayedHex}
      data-gamut={displayState.activeGamut}
      data-out-of-gamut={
        displayState.meta.outOfGamut[
          displayState.activeGamut === 'display-p3' ? 'p3' : 'srgb'
        ] || undefined
      }
      role={isInteractive ? 'button' : 'img'}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? undefined : `Color ${displayedHex}`}
      onClick={isInteractive ? handleClick : onClick}
      onKeyDown={isInteractive ? handleKeyDown : onKeyDown}
      style={{
        ...displayStyles,
        ...style,
      }}
    />
  );
});
