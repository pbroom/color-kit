import {
  useRef,
  useCallback,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  forwardRef,
  type HTMLAttributes,
} from 'react';
import { useSelector } from '@legendapp/state/react';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  colorFromColorSliderKey,
  colorFromColorSliderPosition,
  getColorSliderLabel,
  getColorSliderThumbPosition,
  normalizeColorSliderPointer,
  resolveColorSliderRange,
  type ColorSliderChannel,
  type ColorSliderOrientation,
} from './api/color-slider.js';
import type { SetRequestedOptions } from './use-color.js';

export interface ColorSliderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Which color channel the slider controls.
   */
  channel: ColorSliderChannel;
  /**
   * Value range for the channel.
   * Defaults: l=[0,1], c=[0,0.4], h=[0,360], alpha=[0,1]
   */
  range?: [number, number];
  /**
   * Slider orientation.
   * @default 'horizontal'
   */
  orientation?: ColorSliderOrientation;
  /** Standalone requested color value (alternative to ColorProvider) */
  requested?: Color;
  /** Standalone change handler (alternative to ColorProvider) */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
}

/**
 * A 1D color slider for a single color channel.
 *
 * Renders as a plain `<div>` with a draggable thumb (`<div>`).
 * Completely unstyled -- use data attributes and CSS to style it.
 *
 * Data attributes on the root:
 * - `[data-color-slider]` - always present
 * - `[data-channel]` - the channel name (l, c, h, alpha)
 * - `[data-orientation]` - horizontal or vertical
 * - `[data-dragging]` - present while the user is dragging
 *
 * Data attributes on the thumb (first child):
 * - `[data-color-slider-thumb]` - always present
 * - `[data-value]` - normalized position (0-1)
 */
export const ColorSlider = forwardRef<HTMLDivElement, ColorSliderProps>(
  function ColorSlider(
    {
      channel,
      range,
      orientation = 'horizontal',
      requested: requestedProp,
      onChangeRequested: onChangeRequestedProp,
      ...props
    },
    ref,
  ) {
    const context = useOptionalColorContext();
    const contextRequested = useSelector(
      () => context?.state$.requested.get() ?? null,
    );

    const requested = requestedProp ?? contextRequested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorSlider requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const sliderRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const r = resolveColorSliderRange(channel, range);

    const norm = getColorSliderThumbPosition(requested, channel, r);

    const updateFromPosition = useCallback(
      (clientX: number, clientY: number) => {
        const el = sliderRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const t = normalizeColorSliderPointer(
          orientation,
          orientation === 'horizontal' ? clientX : clientY,
          orientation === 'horizontal' ? rect.left : rect.top,
          orientation === 'horizontal' ? rect.width : rect.height,
        );

        setRequested(colorFromColorSliderPosition(requested, channel, t, r), {
          changedChannel: channel,
          interaction: 'pointer',
        });
      },
      [requested, setRequested, channel, r, orientation],
    );

    const onPointerDown = useCallback(
      (e: ReactPointerEvent) => {
        e.preventDefault();
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromPosition(e.clientX, e.clientY);
      },
      [updateFromPosition],
    );

    const onPointerMove = useCallback(
      (e: ReactPointerEvent) => {
        if (!isDragging) return;
        updateFromPosition(e.clientX, e.clientY);
      },
      [isDragging, updateFromPosition],
    );

    const onPointerUp = useCallback(() => {
      setIsDragging(false);
    }, []);

    const onKeyDown = useCallback(
      (e: ReactKeyboardEvent) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        const newColor: Color | null = colorFromColorSliderKey(
          requested,
          channel,
          e.key,
          step,
          r,
        );

        if (newColor) {
          e.preventDefault();
          setRequested(newColor, {
            changedChannel: channel,
            interaction: 'keyboard',
          });
        }
      },
      [requested, setRequested, channel, r],
    );

    const isHorizontal = orientation === 'horizontal';
    const defaultLabel = `${getColorSliderLabel(channel)} slider`;

    return (
      <div
        {...props}
        ref={(node) => {
          (sliderRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        data-color-slider=""
        data-channel={channel}
        data-orientation={orientation}
        data-dragging={isDragging || undefined}
        role="slider"
        aria-label={props['aria-label'] ?? defaultLabel}
        aria-valuemin={r[0]}
        aria-valuemax={r[1]}
        aria-valuenow={requested[channel]}
        aria-orientation={orientation}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        style={{
          position: 'relative',
          touchAction: 'none',
          ...props.style,
        }}
      >
        <div
          data-color-slider-thumb=""
          data-value={norm.toFixed(4)}
          style={{
            position: 'absolute',
            ...(isHorizontal
              ? {
                  left: `${norm * 100}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }
              : {
                  left: '50%',
                  top: `${(1 - norm) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }),
            pointerEvents: 'none',
          }}
        />
        {props.children}
      </div>
    );
  },
);
