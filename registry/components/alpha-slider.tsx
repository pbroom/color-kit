'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { ColorSlider } from '@/components/color-slider';

export interface AlphaSliderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange' | 'color'
> {
  /**
   * Slider orientation.
   * @default "horizontal"
   */
  orientation?: 'horizontal' | 'vertical';
  /** Standalone color value (alternative to ColorProvider) */
  color?: Color;
  /** Standalone onChange (alternative to ColorProvider) */
  onChange?: (color: Color) => void;
}

/**
 * A convenience alpha/opacity slider pre-configured for the alpha channel.
 *
 * Renders a `<ColorSlider channel="alpha">` with sensible defaults.
 * Completely unstyled -- use data attributes and CSS to style it.
 *
 * Data attributes (in addition to those from ColorSlider):
 * - `[data-alpha-slider]` - always present
 */
export const AlphaSlider = forwardRef<HTMLDivElement, AlphaSliderProps>(
  function AlphaSlider(
    { orientation = 'horizontal', color, onChange, ...props },
    ref,
  ) {
    return (
      <ColorSlider
        {...props}
        ref={ref}
        channel="alpha"
        orientation={orientation}
        color={color}
        onChange={onChange}
        aria-label={props['aria-label'] ?? 'Opacity'}
        data-alpha-slider=""
      />
    );
  },
);
