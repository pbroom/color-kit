import {
  useRef,
  useCallback,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  forwardRef,
  type HTMLAttributes,
} from 'react';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  colorFromColorAreaKey,
  colorFromColorAreaPosition,
  getColorAreaThumbPosition,
  resolveColorAreaRange,
  type ColorAreaChannel,
} from './api/color-area.js';
import type { SetRequestedOptions } from './use-color.js';

export interface ColorAreaProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Which color channels the X and Y axes control.
   * @default { x: 'c', y: 'l' }
   */
  channels?: {
    x: ColorAreaChannel;
    y: ColorAreaChannel;
  };
  /**
   * Range for each axis.
   * Defaults: l=[0,1], c=[0,0.4], h=[0,360]
   */
  xRange?: [number, number];
  yRange?: [number, number];
  /** Standalone requested color (alternative to ColorProvider) */
  requested?: Color;
  /** Standalone change handler (alternative to ColorProvider) */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
}

/**
 * A 2D color picker area.
 *
 * Renders as a plain `<div>` with a draggable thumb (`<div>`).
 * Completely unstyled -- use data attributes and CSS to style it.
 *
 * Data attributes on the root:
 * - `[data-color-area]` - always present
 * - `[data-dragging]` - present while the user is dragging
 *
 * Data attributes on the thumb (first child):
 * - `[data-color-area-thumb]` - always present
 * - `[data-x]` - normalized x position (0-1)
 * - `[data-y]` - normalized y position (0-1)
 */
export const ColorArea = forwardRef<HTMLDivElement, ColorAreaProps>(
  function ColorArea(
    {
      channels = { x: 'c', y: 'l' },
      xRange,
      yRange,
      requested: requestedProp,
      onChangeRequested: onChangeRequestedProp,
      ...props
    },
    ref,
  ) {
    const context = useOptionalColorContext();

    const requested = requestedProp ?? context?.requested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorArea requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const areaRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const xR = resolveColorAreaRange(channels.x, xRange);
    const yR = resolveColorAreaRange(channels.y, yRange);

    const { x: xNorm, y: yNorm } = getColorAreaThumbPosition(
      requested,
      channels,
      xR,
      yR,
    );

    const updateFromPosition = useCallback(
      (clientX: number, clientY: number) => {
        const el = areaRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;

        setRequested(
          colorFromColorAreaPosition(requested, channels, x, y, xR, yR),
          {
            interaction: 'pointer',
          },
        );
      },
      [requested, setRequested, channels, xR, yR],
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
        const newColor: Color | null = colorFromColorAreaKey(
          requested,
          channels,
          e.key,
          step,
          xR,
          yR,
        );

        if (newColor) {
          e.preventDefault();
          setRequested(newColor, {
            interaction: 'keyboard',
          });
        }
      },
      [requested, setRequested, channels, xR, yR],
    );

    return (
      <div
        {...props}
        ref={(node) => {
          (areaRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        data-color-area=""
        data-dragging={isDragging || undefined}
        role="slider"
        aria-label="Color area"
        aria-valuetext={`${channels.x}: ${requested[channels.x].toFixed(2)}, ${
          channels.y
        }: ${requested[channels.y].toFixed(2)}`}
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
          data-color-area-thumb=""
          data-x={xNorm.toFixed(4)}
          data-y={yNorm.toFixed(4)}
          style={{
            position: 'absolute',
            left: `${xNorm * 100}%`,
            top: `${yNorm * 100}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
        {props.children}
      </div>
    );
  },
);
