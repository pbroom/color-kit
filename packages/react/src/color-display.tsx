import { forwardRef, type HTMLAttributes } from 'react';
import { useSelector } from '@legendapp/state/react';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  getColorDisplayHex,
  getColorDisplayStyles,
} from './api/color-display.js';
import type { GamutTarget } from './color-state.js';
import { createColorState, getActiveDisplayedColor } from './color-state.js';

export interface ColorDisplayProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'color'
> {
  /** Standalone requested color value (alternative to ColorProvider) */
  requested?: Color;
  /** Active gamut for standalone mode */
  gamut?: GamutTarget;
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
  function ColorDisplay(
    { requested: requestedProp, gamut = 'display-p3', style, ...props },
    ref,
  ) {
    const context = useOptionalColorContext();
    const contextState = useSelector(() => context?.state$.get() ?? null);

    const state = context
      ? contextState
      : requestedProp
        ? createColorState(requestedProp, {
            activeGamut: gamut,
            source: 'programmatic',
          })
        : null;

    if (!state) {
      throw new Error(
        'ColorDisplay requires either a <ColorProvider> ancestor or an explicit requested prop.',
      );
    }

    const displayed = getActiveDisplayedColor(state);
    const displayedSrgb = state.displayed.srgb;
    const displayedHex = getColorDisplayHex(displayedSrgb);
    const displayStyles = getColorDisplayStyles(
      displayed,
      displayedSrgb,
      state.activeGamut,
    );

    return (
      <div
        {...props}
        ref={ref}
        data-color-display=""
        data-color={displayedHex}
        data-gamut={state.activeGamut}
        data-out-of-gamut={
          state.meta.outOfGamut[
            state.activeGamut === 'display-p3' ? 'p3' : 'srgb'
          ] || undefined
        }
        role="img"
        aria-label={`Current displayed color: ${displayedHex}`}
        style={{
          ...displayStyles,
          ...style,
        }}
      />
    );
  },
);
