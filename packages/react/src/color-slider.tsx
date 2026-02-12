import {
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
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
import {
  ColorSliderContext,
  type ColorSliderContextValue,
} from './color-slider-context.js';

interface PointerSnapshot {
  clientX: number;
  clientY: number;
}

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
  /**
   * Minimum normalized movement before committing another pointer update.
   * @default 0.0005
   */
  dragEpsilon?: number;
  /**
   * Maximum pointer update rate during drag interactions.
   * @default 60
   */
  maxPointerRate?: number;
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
      dragEpsilon = 0.0005,
      maxPointerRate = 60,
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
    const requestedRef = useRef(requested);
    requestedRef.current = requested;

    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);

    const pointerFrameRef = useRef<number | null>(null);
    const pendingPointerRef = useRef<PointerSnapshot | null>(null);
    const lastPointerCommitTsRef = useRef(0);

    const r = resolveColorSliderRange(channel, range);
    const rangeRef = useRef(r);
    rangeRef.current = r;

    const norm = getColorSliderThumbPosition(requested, channel, r);
    const lastCommittedNormRef = useRef(norm);

    useEffect(() => {
      lastCommittedNormRef.current = norm;
    }, [norm]);

    const resolvePointerNorm = useCallback(
      (clientX: number, clientY: number): number | null => {
        const element = sliderRef.current;
        if (!element) return null;

        const rect = element.getBoundingClientRect();

        return normalizeColorSliderPointer(
          orientation,
          orientation === 'horizontal' ? clientX : clientY,
          orientation === 'horizontal' ? rect.left : rect.top,
          orientation === 'horizontal' ? rect.width : rect.height,
        );
      },
      [orientation],
    );

    const commitNorm = useCallback(
      (nextNorm: number, interaction: 'pointer' | 'keyboard') => {
        const nextColor = colorFromColorSliderPosition(
          requestedRef.current,
          channel,
          nextNorm,
          rangeRef.current,
        );

        setRequested(nextColor, {
          changedChannel: channel,
          interaction,
        });
      },
      [channel, setRequested],
    );

    const stopPointerFrame = useCallback(() => {
      if (pointerFrameRef.current !== null) {
        cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = null;
      }
      pendingPointerRef.current = null;
    }, []);

    const processPendingPointer = useCallback(
      (frameTime: number) => {
        pointerFrameRef.current = null;

        if (!isDraggingRef.current) {
          pendingPointerRef.current = null;
          return;
        }

        const pending = pendingPointerRef.current;
        if (!pending) {
          return;
        }

        const clampedRate = Math.max(1, maxPointerRate);
        const minFrameDelta = 1000 / clampedRate;

        if (
          lastPointerCommitTsRef.current > 0 &&
          frameTime >= lastPointerCommitTsRef.current &&
          frameTime - lastPointerCommitTsRef.current < minFrameDelta
        ) {
          pointerFrameRef.current = requestAnimationFrame(
            processPendingPointer,
          );
          return;
        }

        pendingPointerRef.current = null;

        const nextNorm = resolvePointerNorm(pending.clientX, pending.clientY);
        if (nextNorm === null) {
          return;
        }

        if (Math.abs(nextNorm - lastCommittedNormRef.current) >= dragEpsilon) {
          commitNorm(nextNorm, 'pointer');
          lastCommittedNormRef.current = nextNorm;
          lastPointerCommitTsRef.current = frameTime;
        }

        if (pendingPointerRef.current) {
          pointerFrameRef.current = requestAnimationFrame(
            processPendingPointer,
          );
        }
      },
      [commitNorm, dragEpsilon, maxPointerRate, resolvePointerNorm],
    );

    const queuePointerUpdate = useCallback(
      (clientX: number, clientY: number) => {
        pendingPointerRef.current = { clientX, clientY };
        if (pointerFrameRef.current === null) {
          pointerFrameRef.current = requestAnimationFrame(
            processPendingPointer,
          );
        }
      },
      [processPendingPointer],
    );

    const beginDragging = useCallback(() => {
      setIsDragging(true);
      isDraggingRef.current = true;
    }, []);

    const endDragging = useCallback(() => {
      setIsDragging(false);
      isDraggingRef.current = false;
      stopPointerFrame();
    }, [stopPointerFrame]);

    const onPointerDown = useCallback(
      (event: ReactPointerEvent) => {
        event.preventDefault();
        beginDragging();

        event.currentTarget.setPointerCapture(event.pointerId);

        const nextNorm = resolvePointerNorm(event.clientX, event.clientY);
        if (nextNorm === null) {
          return;
        }

        commitNorm(nextNorm, 'pointer');
        lastCommittedNormRef.current = nextNorm;
        lastPointerCommitTsRef.current = performance.now();
      },
      [beginDragging, commitNorm, resolvePointerNorm],
    );

    const onPointerMove = useCallback(
      (event: ReactPointerEvent) => {
        if (!isDraggingRef.current) return;
        queuePointerUpdate(event.clientX, event.clientY);
      },
      [queuePointerUpdate],
    );

    const onKeyDown = useCallback(
      (event: ReactKeyboardEvent) => {
        const step = event.shiftKey ? 0.1 : 0.01;
        const newColor: Color | null = colorFromColorSliderKey(
          requestedRef.current,
          channel,
          event.key,
          step,
          rangeRef.current,
        );

        if (newColor) {
          event.preventDefault();
          setRequested(newColor, {
            changedChannel: channel,
            interaction: 'keyboard',
          });
        }
      },
      [channel, setRequested],
    );

    const setRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        sliderRef.current = node;

        if (typeof ref === 'function') {
          ref(node);
          return;
        }

        if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    useEffect(() => {
      return () => {
        stopPointerFrame();
      };
    }, [stopPointerFrame]);

    const isHorizontal = orientation === 'horizontal';
    const defaultLabel = `${getColorSliderLabel(channel)} slider`;
    const sliderPositionInset = 'var(--ck-slider-position-inset, 0px)';
    const sliderPositionSpan = `calc(100% - (${sliderPositionInset} * 2))`;

    const contextValue = useMemo<ColorSliderContextValue>(
      () => ({
        channel,
        orientation,
        range: r,
        requested,
        thumbNorm: norm,
      }),
      [channel, orientation, requested, r, norm],
    );

    return (
      <ColorSliderContext.Provider value={contextValue}>
        <div
          {...props}
          ref={setRootRef}
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
          onPointerUp={endDragging}
          onPointerCancel={endDragging}
          onLostPointerCapture={endDragging}
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
                    left: `calc(${sliderPositionInset} + (${sliderPositionSpan} * ${norm}))`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                  }
                : {
                    left: '50%',
                    top: `calc(${sliderPositionInset} + (${sliderPositionSpan} * ${1 - norm}))`,
                    transform: 'translate(-50%, -50%)',
                  }),
              pointerEvents: 'none',
            }}
          />
          {props.children}
        </div>
      </ColorSliderContext.Provider>
    );
  },
);
