import { forwardRef, type HTMLAttributes } from 'react';
import { clamp } from '@color-kit/core';
import { getColorSliderNormFromValue } from './api/color-slider.js';
import { useColorSliderContext } from './color-slider-context.js';

export type SliderMarkerVariant = 'dot' | 'mini-thumb';

export interface SliderMarkerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Value in the slider channel range. */
  value?: number;
  /** Normalized marker position in [0,1]. Takes precedence over `value`. */
  norm?: number;
  /** Marker semantic variant used for styling hooks. */
  variant?: SliderMarkerVariant;
}

/**
 * Decorative marker primitive anchored to a ColorSlider rail.
 */
export const SliderMarker = forwardRef<HTMLDivElement, SliderMarkerProps>(
  function SliderMarker(
    { value, norm, variant = 'dot', style, ...props },
    ref,
  ) {
    const slider = useColorSliderContext();

    const normalized = clamp(
      norm ??
        (value !== undefined
          ? getColorSliderNormFromValue(value, slider.range)
          : Number.NaN),
      0,
      1,
    );

    if (!Number.isFinite(normalized)) {
      throw new Error('SliderMarker requires either a `norm` or `value` prop.');
    }

    const isHorizontal = slider.orientation === 'horizontal';
    const sliderPositionInset = 'var(--ck-slider-position-inset, 0px)';
    const sliderPositionSpan = `calc(100% - (${sliderPositionInset} * 2))`;

    return (
      <div
        {...props}
        ref={ref}
        data-color-slider-marker=""
        data-variant={variant}
        data-norm={normalized.toFixed(4)}
        data-value={value?.toString()}
        aria-hidden={props['aria-hidden'] ?? true}
        style={{
          position: 'absolute',
          ...(isHorizontal
            ? {
                left: `calc(${sliderPositionInset} + (${sliderPositionSpan} * ${normalized}))`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }
            : {
                left: '50%',
                top: `calc(${sliderPositionInset} + (${sliderPositionSpan} * ${1 - normalized}))`,
                transform: 'translate(-50%, -50%)',
              }),
          pointerEvents: 'none',
          ...style,
        }}
      />
    );
  },
);
