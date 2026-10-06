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
import { assignRef } from './assign-ref.js';
import { useColorStoreSelector } from './color-store.js';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  colorFromColorSliderKey,
  colorFromColorSliderPosition,
  getColorSliderLabel,
  getColorSliderThumbPosition,
  getColorSliderValueText,
  normalizeColorSliderPointer,
  resolveColorSliderRange,
  type ColorSliderChannel,
  type ColorSliderOrientation,
} from '@color-kit/driver';
import type { SetRequestedOptions } from './use-color.js';
import { useFocusVisible } from './use-focus-visible.js';
import {
  ColorSliderContext,
  type ColorSliderContextValue,
} from './color-slider-context.js';

interface PointerSnapshot {
  clientX: number;
  clientY: number;
}

interface SliderGeometry {
  rect: DOMRect;
  positionInset: number;
}

function getSliderPositionInset(element: HTMLElement): number {
  const rawInset = getComputedStyle(element)
    .getPropertyValue('--ck-slider-position-inset')
    .trim();
  const inset = Number.parseFloat(rawInset);

  return Number.isFinite(inset) ? inset : 0;
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
  /** Standalone requested color value (alternative to Color) */
  requested?: Color;
  /** Standalone change handler (alternative to Color) */
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
  /**
   * Arrow-key step as a ratio of the range.
   * @default 0.01
   */
  stepRatio?: number;
  /**
   * PageUp/PageDown and Shift+Arrow step as a ratio of the range.
   * @default 0.1
   */
  largeStepRatio?: number;
  /**
   * Wrap keyboard steps around the range ends instead of clamping.
   * @default true for `h`, false otherwise
   */
  wrap?: boolean;
  /**
   * Disables pointer and keyboard interaction and removes the slider from the
   * tab order. Sets `aria-disabled` and `data-disabled`.
   */
  disabled?: boolean;
  /**
   * Formats `aria-valuetext`. Defaults to channel name plus a unit-aware
   * value, e.g. "Hue 213°", "Lightness 60%", "Opacity 50%".
   */
  getValueText?: (value: number, channel: ColorSliderChannel) => string;
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
 * - `[data-disabled]` - present when `disabled`
 * - `[data-focus-visible]` - present while focused via keyboard
 *
 * Keyboard: Arrow keys step by `stepRatio` (Shift: `largeStepRatio`),
 * PageUp/PageDown by `largeStepRatio`, Home/End jump to the range ends.
 * Hue wraps around by default.
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
      stepRatio = 0.01,
      largeStepRatio = 0.1,
      wrap,
      disabled = false,
      getValueText,
      onFocus: onFocusProp,
      onBlur: onBlurProp,
      onPointerDown: onPointerDownProp,
      onPointerMove: onPointerMoveProp,
      onPointerUp: onPointerUpProp,
      onPointerCancel: onPointerCancelProp,
      onLostPointerCapture: onLostPointerCaptureProp,
      onKeyDown: onKeyDownProp,
      ...props
    },
    ref,
  ) {
    const context = useOptionalColorContext();
    const contextRequested = useColorStoreSelector(
      context?.store ?? null,
      (state) => state?.requested ?? null,
    );

    const requested = requestedProp ?? contextRequested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorSlider requires either a <Color> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const sliderRef = useRef<HTMLDivElement>(null);
    const [sliderNode, setSliderNode] = useState<HTMLDivElement | null>(null);
    const setRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        sliderRef.current = node;
        setSliderNode(node);
        const detachForwarded = assignRef(ref, node);
        return () => {
          sliderRef.current = null;
          setSliderNode(null);
          detachForwarded();
        };
      },
      [ref],
    );
    /**
     * `getComputedStyle` (the position inset) is read once per drag and on
     * resize/scroll. The rect is re-read in `resolvePointerNorm`, which runs
     * once per processed frame rather than per pointer event, so an ancestor
     * reflow or transform that moves the rail mid-drag is still tracked.
     */
    const geometryRef = useRef<SliderGeometry | null>(null);
    const detachScrollListenerRef = useRef<(() => void) | null>(null);

    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);

    const pointerFrameRef = useRef<number | null>(null);
    const pendingPointerRef = useRef<PointerSnapshot | null>(null);
    const processPendingPointerRef = useRef<(frameTime: number) => void>(
      () => {},
    );
    const lastPointerCommitTsRef = useRef(0);

    const r = resolveColorSliderRange(channel, range);

    const norm = getColorSliderThumbPosition(requested, channel, r);
    const lastCommittedNormRef = useRef(norm);

    useEffect(() => {
      lastCommittedNormRef.current = norm;
    }, [norm]);

    const refreshGeometry = useCallback((): SliderGeometry | null => {
      const element = sliderRef.current;
      if (!element) {
        geometryRef.current = null;
        return null;
      }

      const geometry: SliderGeometry = {
        rect: element.getBoundingClientRect(),
        positionInset: getSliderPositionInset(element),
      };
      geometryRef.current = geometry;
      return geometry;
    }, []);

    const resolvePointerNorm = useCallback(
      (clientX: number, clientY: number): number | null => {
        const element = sliderRef.current;
        const geometry = geometryRef.current ?? refreshGeometry();
        if (!element || !geometry) return null;

        const rect = element.getBoundingClientRect();
        const { positionInset } = geometry;

        return normalizeColorSliderPointer(
          orientation,
          orientation === 'horizontal' ? clientX : clientY,
          orientation === 'horizontal' ? rect.left : rect.top,
          orientation === 'horizontal' ? rect.width : rect.height,
          positionInset,
        );
      },
      [orientation, refreshGeometry],
    );

    const commitNorm = useCallback(
      (nextNorm: number, interaction: 'pointer' | 'keyboard') => {
        const nextColor = colorFromColorSliderPosition(
          requested,
          channel,
          nextNorm,
          r,
        );

        setRequested(nextColor, {
          changedChannel: channel,
          interaction,
        });
      },
      [channel, requested, r, setRequested],
    );

    const stopPointerFrame = useCallback(() => {
      if (pointerFrameRef.current !== null) {
        cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = null;
      }
      pendingPointerRef.current = null;
    }, []);

    const schedulePendingPointerFrame = useCallback(() => {
      pointerFrameRef.current = requestAnimationFrame((frameTime: number) => {
        processPendingPointerRef.current(frameTime);
      });
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
          schedulePendingPointerFrame();
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
          schedulePendingPointerFrame();
        }
      },
      [
        commitNorm,
        dragEpsilon,
        maxPointerRate,
        resolvePointerNorm,
        schedulePendingPointerFrame,
      ],
    );

    useEffect(() => {
      processPendingPointerRef.current = processPendingPointer;
    }, [processPendingPointer]);

    const queuePointerUpdate = useCallback(
      (clientX: number, clientY: number) => {
        pendingPointerRef.current = { clientX, clientY };
        if (pointerFrameRef.current === null) {
          schedulePendingPointerFrame();
        }
      },
      [schedulePendingPointerFrame],
    );

    const stopScrollTracking = useCallback(() => {
      const detach = detachScrollListenerRef.current;
      detachScrollListenerRef.current = null;
      detach?.();
    }, []);

    const beginDragging = useCallback(() => {
      setIsDragging(true);
      isDraggingRef.current = true;
      refreshGeometry();

      stopScrollTracking();
      if (typeof window !== 'undefined') {
        // Scrolling moves the slider under a captured pointer; re-measure.
        const onScroll = () => {
          refreshGeometry();
        };
        window.addEventListener('scroll', onScroll, true);
        detachScrollListenerRef.current = () => {
          window.removeEventListener('scroll', onScroll, true);
        };
      }
    }, [refreshGeometry, stopScrollTracking]);

    const endDragging = useCallback(() => {
      setIsDragging(false);
      isDraggingRef.current = false;
      stopPointerFrame();
      stopScrollTracking();
    }, [stopPointerFrame, stopScrollTracking]);

    useEffect(() => {
      if (!sliderNode || typeof ResizeObserver === 'undefined') {
        return;
      }

      const observer = new ResizeObserver(() => {
        geometryRef.current = null;
      });
      observer.observe(sliderNode);
      return () => {
        observer.disconnect();
      };
    }, [sliderNode]);

    const onPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerDownProp?.(event);
        if (event.defaultPrevented || disabled) {
          return;
        }

        // preventDefault suppresses the compatibility mousedown (and with it
        // the default focus), so focus explicitly.
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
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
      [
        beginDragging,
        commitNorm,
        disabled,
        onPointerDownProp,
        resolvePointerNorm,
      ],
    );

    const onPointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerMoveProp?.(event);
        if (event.defaultPrevented || !isDraggingRef.current) return;
        queuePointerUpdate(event.clientX, event.clientY);
      },
      [onPointerMoveProp, queuePointerUpdate],
    );

    // Drag end always runs so a consumer handler can never strand a drag.
    const onPointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerUpProp?.(event);
        endDragging();
      },
      [endDragging, onPointerUpProp],
    );

    const onPointerCancel = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerCancelProp?.(event);
        endDragging();
      },
      [endDragging, onPointerCancelProp],
    );

    const onLostPointerCapture = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onLostPointerCaptureProp?.(event);
        endDragging();
      },
      [endDragging, onLostPointerCaptureProp],
    );

    const { focusVisible, onFocus, onBlur, markKeyboardInteraction } =
      useFocusVisible<HTMLDivElement>(onFocusProp, onBlurProp);

    const onKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLDivElement>) => {
        onKeyDownProp?.(event);
        markKeyboardInteraction(event);
        if (event.defaultPrevented || disabled) {
          return;
        }

        const step = event.shiftKey ? largeStepRatio : stepRatio;
        const newColor: Color | null = colorFromColorSliderKey(
          requested,
          channel,
          event.key,
          step,
          r,
          { largeStepRatio, wrap },
        );

        if (newColor) {
          event.preventDefault();
          setRequested(newColor, {
            changedChannel: channel,
            interaction: 'keyboard',
          });
        }
      },
      [
        channel,
        disabled,
        largeStepRatio,
        markKeyboardInteraction,
        onKeyDownProp,
        requested,
        r,
        setRequested,
        stepRatio,
        wrap,
      ],
    );

    useEffect(() => {
      return () => {
        stopPointerFrame();
        stopScrollTracking();
      };
    }, [stopPointerFrame, stopScrollTracking]);

    const isHorizontal = orientation === 'horizontal';
    const defaultLabel = `${getColorSliderLabel(channel)} slider`;
    const value = requested[channel];
    const valueText =
      props['aria-valuetext'] ??
      (getValueText
        ? getValueText(value, channel)
        : getColorSliderValueText(channel, value));
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
          data-disabled={disabled || undefined}
          data-focus-visible={focusVisible || undefined}
          role="slider"
          aria-label={props['aria-label'] ?? defaultLabel}
          aria-valuemin={Math.min(r[0], r[1])}
          aria-valuemax={Math.max(r[0], r[1])}
          aria-valuenow={value}
          aria-valuetext={valueText}
          aria-orientation={orientation}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? undefined : (props.tabIndex ?? 0)}
          onFocus={onFocus}
          onBlur={onBlur}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onLostPointerCapture}
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
