import { forwardRef, type HTMLAttributes } from 'react';
import type { Color } from '@color-kit/core';
import { ColorSlider } from './color-slider.js';
import type { SetRequestedOptions } from './use-color.js';

export interface AlphaSliderProps extends Omit<
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
    { orientation = 'horizontal', requested, onChangeRequested, ...props },
    ref,
  ) {
    return (
      <ColorSlider
        {...props}
        ref={ref}
        channel="alpha"
        orientation={orientation}
        requested={requested}
        onChangeRequested={onChangeRequested}
        aria-label={props['aria-label'] ?? 'Opacity'}
        data-alpha-slider=""
      />
    );
  },
);
