import { forwardRef, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { ColorSlider } from './color-slider.js';
import type { SetRequestedOptions } from './use-color.js';

export interface HueSliderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Slider orientation.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /** Standalone requested color (alternative to ColorProvider) */
  requested?: Color;
  /** Standalone change handler (alternative to ColorProvider) */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
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
    { orientation = 'horizontal', requested, onChangeRequested, ...props },
    ref,
  ) {
    return (
      <ColorSlider
        {...props}
        ref={ref}
        channel="h"
        orientation={orientation}
        requested={requested}
        onChangeRequested={onChangeRequested}
        aria-label={props['aria-label'] ?? 'Hue'}
        data-hue-slider=""
      />
    );
  },
);
