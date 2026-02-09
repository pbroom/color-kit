'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { ColorSlider } from '@/components/color-slider';

export interface HueSliderProps extends Omit<
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
 * A convenience hue slider pre-configured for the hue channel.
 *
 * Renders a `<ColorSlider channel="h">` with sensible defaults.
 * Completely unstyled -- use data attributes and CSS to style it.
 *
 * Data attributes (in addition to those from ColorSlider):
 * - `[data-hue-slider]` - always present
 */
export const HueSlider = forwardRef<HTMLDivElement, HueSliderProps>(
  function HueSlider(
    { orientation = 'horizontal', color, onChange, ...props },
    ref,
  ) {
    return (
      <ColorSlider
        {...props}
        ref={ref}
        channel="h"
        orientation={orientation}
        color={color}
        onChange={onChange}
        aria-label={props['aria-label'] ?? 'Hue'}
        data-hue-slider=""
      />
    );
  },
);
