import { forwardRef, type HTMLAttributes } from 'react';
import { clamp } from '@color-kit/core';
import { getColorSliderNormFromValue } from '@color-kit/driver';
import { useColorSliderContext } from './color-slider-context.js';

/** Styling variant of a {@link SliderMarker}, exposed as `data-variant`. */
export type SliderMarkerVariant = 'dot' | 'mini-thumb';

/** Props for {@link SliderMarker}; other `div` attributes are forwarded. */
export interface SliderMarkerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Value in the slider channel range. */
  value?: number;
  /** Normalized marker position in [0,1]. Takes precedence over `value`. */
  norm?: number;
  /**
   * Marker semantic variant used for styling hooks.
   * @defaultValue 'dot'
   */
  variant?: SliderMarkerVariant;
}

/**
 * Decorative marker positioned on the enclosing {@link ColorSlider}'s rail
 * at a channel value or normalized position.
 *
 * The position is clamped to the rail and follows the slider's orientation
 * and `--ck-slider-position-inset`. Hidden from assistive technology and
 * pointer events; unstyled apart from positioning. Must be a child of a
 * ColorSlider.
 *
 * @throws {Error} When rendered outside a `<ColorSlider>`, or with neither
 *   `value` nor `norm`.
 *
 * @example
 * ```tsx
 * import { Color, ColorSlider, SliderMarker } from 'color-kit/react';
 *
 * export const HueSlider = () => (
 *   <Color defaultColor="#3b82f6">
 *     <ColorSlider channel="h" style={{ height: 16 }}>
 *       <SliderMarker value={120} style={{ width: 4, height: 4, background: '#fff' }} />
 *     </ColorSlider>
 *   </Color>
 * );
 * ```
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
