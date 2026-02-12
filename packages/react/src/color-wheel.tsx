import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useSelector } from '@legendapp/state/react';
import type { Color } from '@color-kit/core';
import {
  inP3Gamut,
  inSrgbGamut,
  toCss,
  toP3Gamut,
  toSrgbGamut,
} from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  colorFromColorWheelKey,
  colorFromColorWheelPosition,
  getColorWheelThumbPosition,
  normalizeColorWheelPointer,
  resolveColorWheelChromaRange,
} from './api/color-wheel.js';
import type { GamutTarget } from './color-state.js';
import type { SetRequestedOptions } from './use-color.js';

export interface ColorWheelProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Chroma range controlled by radial distance from center.
   * @default [0, 0.4]
   */
  chromaRange?: [number, number];
  /** Standalone requested color (alternative to ColorProvider) */
  requested?: Color;
  /** Standalone change handler (alternative to ColorProvider) */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
  /**
   * Which state stream should feed visual variables and metadata.
   * @default 'displayed'
   */
  source?: 'requested' | 'displayed';
  /**
   * Display target when `source="displayed"`.
   * Falls back to ColorProvider active gamut.
   */
  displayGamut?: GamutTarget;
  /**
   * Maximum pointer-driven update frequency.
   * @default 60
   */
  maxUpdateHz?: number;
  /**
   * Skip pointer updates when normalized delta is smaller than this threshold.
   * @default 0.0005
   */
  dragEpsilon?: number;
  /**
   * Arrow-key hue step in degrees.
   * @default 1
   */
  hueStep?: number;
  /**
   * Shift+arrow hue step in degrees.
   * @default 10
   */
  shiftHueStep?: number;
  /**
   * Arrow-key chroma step as a ratio of chroma range.
   * @default 0.01
   */
  chromaStepRatio?: number;
  /**
   * Shift+arrow chroma step as a ratio of chroma range.
   * @default 0.1
   */
  shiftChromaStepRatio?: number;
}

function getChangedChannel(key: string): 'h' | 'c' | null {
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    return 'h';
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    return 'c';
  }
  return null;
}

function isUpdateBelowEpsilon(
  previous: { x: number; y: number } | null,
  next: { x: number; y: number },
  epsilon: number,
): boolean {
  if (!previous) {
    return false;
  }

  return (
    Math.abs(previous.x - next.x) <= epsilon &&
    Math.abs(previous.y - next.y) <= epsilon
  );
}

/**
 * A circular hue/chroma control.
 *
 * Geometry always represents requested state. Visual metadata defaults to displayed state.
 * Completely unstyled -- use data attributes and CSS to style it.
 *
 * Data attributes on root:
 * - `[data-color-wheel]` - always present
 * - `[data-source]` - requested or displayed
 * - `[data-gamut]` - srgb or display-p3
 * - `[data-dragging]` - present while pointer drag is active
 * - `[data-out-of-gamut]` - present when requested color exceeds active display gamut
 *
 * Data attributes on thumb (first child):
 * - `[data-color-wheel-thumb]` - always present
 * - `[data-x]` - normalized x position (0-1)
 * - `[data-y]` - normalized y position (0-1)
 * - `[data-radius]` - normalized chroma radius (0-1)
 */
export const ColorWheel = forwardRef<HTMLDivElement, ColorWheelProps>(
  function ColorWheel(
    {
      chromaRange,
      requested: requestedProp,
      onChangeRequested: onChangeRequestedProp,
      source = 'displayed',
      displayGamut,
      maxUpdateHz = 60,
      dragEpsilon = 0.0005,
      hueStep = 1,
      shiftHueStep = 10,
      chromaStepRatio = 0.01,
      shiftChromaStepRatio = 0.1,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      style,
      ...props
    },
    ref,
  ) {
    const context = useOptionalColorContext();
    const contextRequested = useSelector(
      () => context?.state$.requested.get() ?? null,
    );
    const contextActiveGamut = useSelector(
      () => context?.state$.activeGamut.get() ?? 'display-p3',
    );

    const requested = requestedProp ?? contextRequested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorWheel requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const { minChroma, maxChroma } = useMemo(() => {
      const [min, max] = resolveColorWheelChromaRange(chromaRange);
      return {
        minChroma: min,
        maxChroma: max,
      };
    }, [chromaRange]);
    const wheelRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const activePointerIdRef = useRef<number | null>(null);
    const lastNormRef = useRef<{ x: number; y: number } | null>(null);
    const lastCommitTsRef = useRef(0);

    const effectiveGamut = displayGamut ?? contextActiveGamut;
    const renderedColor = useMemo(() => {
      if (source === 'requested') {
        return requested;
      }
      return effectiveGamut === 'display-p3'
        ? toP3Gamut(requested)
        : toSrgbGamut(requested);
    }, [effectiveGamut, requested, source]);

    const outOfGamut = useMemo(
      () =>
        effectiveGamut === 'display-p3'
          ? !inP3Gamut(requested)
          : !inSrgbGamut(requested),
      [effectiveGamut, requested],
    );

    const colorCss = useMemo(() => {
      if (source === 'requested') {
        return toCss(renderedColor, 'oklch');
      }
      return toCss(
        renderedColor,
        effectiveGamut === 'display-p3' ? 'p3' : 'rgb',
      );
    }, [effectiveGamut, renderedColor, source]);

    const {
      x: xNorm,
      y: yNorm,
      radius,
    } = getColorWheelThumbPosition(requested, [minChroma, maxChroma]);

    const updateFromPointer = useCallback(
      (clientX: number, clientY: number, force: boolean) => {
        const element = wheelRef.current;
        if (!element) {
          return;
        }

        const rect = element.getBoundingClientRect();
        const normalized = normalizeColorWheelPointer(
          clientX,
          clientY,
          rect.left,
          rect.top,
          rect.width,
          rect.height,
        );
        const epsilon = dragEpsilon >= 0 ? dragEpsilon : 0.0005;
        if (
          !force &&
          isUpdateBelowEpsilon(lastNormRef.current, normalized, epsilon)
        ) {
          return;
        }

        const now =
          typeof performance === 'undefined' ? Date.now() : performance.now();
        const safeMaxUpdateHz =
          Number.isFinite(maxUpdateHz) && maxUpdateHz > 0 ? maxUpdateHz : 60;
        const minDeltaMs = 1000 / safeMaxUpdateHz;
        if (
          !force &&
          lastCommitTsRef.current > 0 &&
          now < lastCommitTsRef.current + minDeltaMs
        ) {
          return;
        }

        lastNormRef.current = normalized;
        lastCommitTsRef.current = now;
        setRequested(
          colorFromColorWheelPosition(
            requested,
            normalized.x,
            normalized.y,
            [minChroma, maxChroma],
          ),
          {
            interaction: 'pointer',
          },
        );
      },
      [dragEpsilon, maxUpdateHz, maxChroma, minChroma, requested, setRequested],
    );

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        setIsDragging(true);
        activePointerIdRef.current = event.pointerId;
        lastNormRef.current = null;
        lastCommitTsRef.current = 0;
        if ('setPointerCapture' in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        updateFromPointer(event.clientX, event.clientY, true);
      },
      [onPointerDown, updateFromPointer],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerMove?.(event);
        if (
          event.defaultPrevented ||
          !isDragging ||
          event.pointerId !== activePointerIdRef.current
        ) {
          return;
        }

        updateFromPointer(event.clientX, event.clientY, false);
      },
      [isDragging, onPointerMove, updateFromPointer],
    );

    const endDrag = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>, canceled: boolean) => {
        if (event.pointerId !== activePointerIdRef.current) {
          return;
        }

        activePointerIdRef.current = null;
        setIsDragging(false);
        if (!canceled) {
          updateFromPointer(event.clientX, event.clientY, true);
        }
      },
      [updateFromPointer],
    );

    const handlePointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerUp?.(event);
        endDrag(event, false);
      },
      [endDrag, onPointerUp],
    );

    const handlePointerCancel = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerCancel?.(event);
        endDrag(event, true);
      },
      [endDrag, onPointerCancel],
    );

    const handleKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) {
          return;
        }

        const next = colorFromColorWheelKey(
          requested,
          event.key,
          event.shiftKey ? shiftHueStep : hueStep,
          event.shiftKey ? shiftChromaStepRatio : chromaStepRatio,
          [minChroma, maxChroma],
        );

        if (!next) {
          return;
        }

        event.preventDefault();
        const changedChannel = getChangedChannel(event.key);
        setRequested(next, {
          interaction: 'keyboard',
          changedChannel: changedChannel ?? undefined,
        });
      },
      [
        chromaStepRatio,
        hueStep,
        maxChroma,
        minChroma,
        onKeyDown,
        requested,
        setRequested,
        shiftChromaStepRatio,
        shiftHueStep,
      ],
    );

    const rootStyle = {
      position: 'relative',
      touchAction: 'none',
      '--ck-color-wheel-current': colorCss,
      ...style,
    } as CSSProperties;

    return (
      <div
        {...props}
        ref={(node) => {
          wheelRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        data-color-wheel=""
        data-source={source}
        data-gamut={effectiveGamut}
        data-dragging={isDragging || undefined}
        data-out-of-gamut={outOfGamut || undefined}
        role="slider"
        aria-label={props['aria-label'] ?? 'Color wheel'}
        aria-valuemin={minChroma}
        aria-valuemax={maxChroma}
        aria-valuenow={requested.c}
        aria-valuetext={
          props['aria-valuetext'] ??
          `Hue ${requested.h.toFixed(2)} degrees, Chroma ${requested.c.toFixed(4)}`
        }
        tabIndex={props.tabIndex ?? 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        style={rootStyle}
      >
        <div
          data-color-wheel-thumb=""
          data-x={xNorm.toFixed(4)}
          data-y={yNorm.toFixed(4)}
          data-radius={radius.toFixed(4)}
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
