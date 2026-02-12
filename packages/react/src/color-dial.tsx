import {
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  forwardRef,
} from 'react';
import { useSelector } from '@legendapp/state/react';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  colorFromColorDialKey,
  colorFromColorDialPosition,
  getColorDialLabel,
  getColorDialThumbPosition,
  normalizeColorDialPointer,
  resolveColorDialAngles,
  resolveColorDialRange,
  type ColorDialChannel,
} from './api/color-dial.js';
import type { SetRequestedOptions } from './use-color.js';

export interface ColorDialProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Which color channel the dial controls.
   */
  channel: ColorDialChannel;
  /**
   * Value range for the channel.
   * Defaults: l=[0,1], c=[0,0.4], h=[0,360], alpha=[0,1]
   */
  range?: [number, number];
  /**
   * Arc start angle in degrees.
   * @default -135
   */
  startAngle?: number;
  /**
   * Arc end angle in degrees.
   * @default 135
   */
  endAngle?: number;
  /**
   * Wrap channel values when stepping across boundaries.
   * @default true for hue, false otherwise
   */
  wrap?: boolean;
  /** Arrow-key movement step ratio of range. @default 0.01 */
  stepRatio?: number;
  /** Shift+arrow movement step ratio of range. @default 0.1 */
  shiftStepRatio?: number;
  /** PageUp/PageDown step ratio of range. @default 0.1 */
  pageStepRatio?: number;
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
  /** Standalone requested color value (alternative to ColorProvider) */
  requested?: Color;
  /** Standalone change handler (alternative to ColorProvider) */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatDialAriaValue(channel: ColorDialChannel, value: number): string {
  if (channel === 'h') {
    return `${Math.round(value)} degrees`;
  }
  if (channel === 'alpha') {
    return `${Math.round(value * 100)}%`;
  }
  if (channel === 'l') {
    return `${Math.round(value * 100)}% lightness`;
  }
  return value.toFixed(3);
}

/**
 * A radial color channel dial with keyboard and pointer support.
 *
 * Renders as a plain `<div>` with a positioned thumb (`<div>`).
 * Completely unstyled -- use data attributes and CSS to style it.
 */
export const ColorDial = forwardRef<HTMLDivElement, ColorDialProps>(
  function ColorDial(
    {
      channel,
      range,
      startAngle = -135,
      endAngle = 135,
      wrap: wrapProp,
      stepRatio = 0.01,
      shiftStepRatio = 0.1,
      pageStepRatio = 0.1,
      maxUpdateHz = 60,
      dragEpsilon = 0.0005,
      requested: requestedProp,
      onChangeRequested: onChangeRequestedProp,
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

    const requested = requestedProp ?? contextRequested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorDial requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const wrap = wrapProp ?? channel === 'h';
    const dialRef = useRef<HTMLDivElement>(null);
    const rectRef = useRef<DOMRect | null>(null);
    const pendingRef = useRef<{ clientX: number; clientY: number } | null>(
      null,
    );
    const rafRef = useRef<number | null>(null);
    const activePointerIdRef = useRef<number | null>(null);
    const lastNormRef = useRef<number | null>(null);
    const lastCommitTsRef = useRef(0);
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);

    const resolvedRange = useMemo(
      () => resolveColorDialRange(channel, range),
      [channel, range],
    );
    const resolvedAngles = useMemo(
      () => resolveColorDialAngles(startAngle, endAngle),
      [startAngle, endAngle],
    );

    const { norm, angle } = getColorDialThumbPosition(
      requested,
      channel,
      resolvedRange,
      resolvedAngles,
    );

    const refreshRect = useCallback((): DOMRect | null => {
      const node = dialRef.current;
      if (!node) {
        rectRef.current = null;
        return null;
      }

      const nextRect = node.getBoundingClientRect();
      rectRef.current = nextRect;
      return nextRect;
    }, []);

    const commitFromPointer = useCallback(
      (clientX: number, clientY: number, options: { force?: boolean } = {}) => {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
          return;
        }

        const rect = rectRef.current ?? refreshRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
          return;
        }

        const nextNorm = normalizeColorDialPointer(
          clientX,
          clientY,
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          resolvedAngles,
        );
        const previousNorm = lastNormRef.current;
        const epsilon = dragEpsilon >= 0 ? dragEpsilon : 0.0005;

        if (
          !options.force &&
          previousNorm !== null &&
          Math.abs(previousNorm - nextNorm) <= epsilon
        ) {
          return;
        }

        const now =
          typeof performance === 'undefined' ? Date.now() : performance.now();
        const safeMaxUpdateHz =
          Number.isFinite(maxUpdateHz) && maxUpdateHz > 0 ? maxUpdateHz : 60;
        const minDeltaMs = 1000 / safeMaxUpdateHz;

        if (
          !options.force &&
          lastCommitTsRef.current > 0 &&
          now < lastCommitTsRef.current + minDeltaMs
        ) {
          return;
        }

        setRequested(
          colorFromColorDialPosition(
            requested,
            channel,
            nextNorm,
            resolvedRange,
          ),
          {
            changedChannel: channel,
            interaction: 'pointer',
          },
        );
        lastNormRef.current = nextNorm;
        lastCommitTsRef.current = now;
      },
      [
        channel,
        dragEpsilon,
        maxUpdateHz,
        refreshRect,
        requested,
        resolvedAngles,
        resolvedRange,
        setRequested,
      ],
    );

    const flushPendingPointer = useCallback(
      (force: boolean = false) => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        const pending = pendingRef.current;
        if (!pending) {
          return;
        }

        pendingRef.current = null;
        commitFromPointer(pending.clientX, pending.clientY, { force });
      },
      [commitFromPointer],
    );

    const queuePointer = useCallback(
      (clientX: number, clientY: number) => {
        pendingRef.current = { clientX, clientY };
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            flushPendingPointer(false);
          });
        }
      },
      [flushPendingPointer],
    );

    useEffect(
      () => () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
      },
      [],
    );

    const onRootPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        isDraggingRef.current = true;
        setIsDragging(true);
        activePointerIdRef.current = event.pointerId;
        lastNormRef.current = null;
        lastCommitTsRef.current = 0;
        refreshRect();
        if ('setPointerCapture' in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }

        const native = event.nativeEvent as Partial<PointerEvent>;
        const clientX =
          asFiniteNumber(event.clientX) ?? asFiniteNumber(native.clientX) ?? 0;
        const clientY =
          asFiniteNumber(event.clientY) ?? asFiniteNumber(native.clientY) ?? 0;

        commitFromPointer(clientX, clientY, { force: true });
      },
      [commitFromPointer, onPointerDown, refreshRect],
    );

    const onRootPointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerMove?.(event);
        if (
          event.defaultPrevented ||
          !isDraggingRef.current ||
          event.pointerId !== activePointerIdRef.current
        ) {
          return;
        }

        const native = event.nativeEvent as PointerEvent;
        const coalesced =
          typeof native.getCoalescedEvents === 'function'
            ? native.getCoalescedEvents()
            : [];
        const latest =
          coalesced.length > 0 ? coalesced[coalesced.length - 1] : native;
        const clientX =
          asFiniteNumber(latest.clientX) ?? asFiniteNumber(native.clientX) ?? 0;
        const clientY =
          asFiniteNumber(latest.clientY) ?? asFiniteNumber(native.clientY) ?? 0;

        queuePointer(clientX, clientY);
      },
      [onPointerMove, queuePointer],
    );

    const onRootPointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerUp?.(event);
        if (event.pointerId !== activePointerIdRef.current) {
          return;
        }

        activePointerIdRef.current = null;
        isDraggingRef.current = false;
        setIsDragging(false);
        flushPendingPointer(true);
      },
      [flushPendingPointer, onPointerUp],
    );

    const onRootPointerCancel = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerCancel?.(event);
        if (event.pointerId !== activePointerIdRef.current) {
          return;
        }

        activePointerIdRef.current = null;
        isDraggingRef.current = false;
        setIsDragging(false);
        flushPendingPointer(true);
      },
      [flushPendingPointer, onPointerCancel],
    );

    const onRootKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) {
          return;
        }

        const ratio =
          event.key === 'PageUp' || event.key === 'PageDown'
            ? pageStepRatio
            : event.shiftKey
              ? shiftStepRatio
              : stepRatio;
        const next = colorFromColorDialKey(
          requested,
          channel,
          event.key,
          ratio,
          resolvedRange,
          { wrap },
        );

        if (!next) {
          return;
        }

        event.preventDefault();
        setRequested(next, {
          changedChannel: channel,
          interaction: 'keyboard',
        });
      },
      [
        channel,
        onKeyDown,
        pageStepRatio,
        requested,
        resolvedRange,
        setRequested,
        shiftStepRatio,
        stepRatio,
        wrap,
      ],
    );

    const radians = (angle * Math.PI) / 180;
    const thumbX = 0.5 + 0.5 * Math.cos(radians);
    const thumbY = 0.5 + 0.5 * Math.sin(radians);
    const defaultLabel = `${getColorDialLabel(channel)} dial`;

    return (
      <div
        {...props}
        ref={(node) => {
          (dialRef as MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        data-color-dial=""
        data-channel={channel}
        data-dragging={isDragging || undefined}
        data-wrap={wrap || undefined}
        data-value={norm.toFixed(4)}
        data-angle={angle.toFixed(2)}
        role="slider"
        aria-label={props['aria-label'] ?? defaultLabel}
        aria-valuemin={resolvedRange[0]}
        aria-valuemax={resolvedRange[1]}
        aria-valuenow={requested[channel]}
        aria-valuetext={
          props['aria-valuetext'] ??
          formatDialAriaValue(channel, requested[channel])
        }
        tabIndex={props.tabIndex ?? 0}
        onPointerDown={onRootPointerDown}
        onPointerMove={onRootPointerMove}
        onPointerUp={onRootPointerUp}
        onPointerCancel={onRootPointerCancel}
        onKeyDown={onRootKeyDown}
        style={
          {
            position: 'relative',
            touchAction: 'none',
            '--color-dial-value': norm.toString(),
            '--color-dial-angle': `${angle.toFixed(2)}deg`,
            ...style,
          } as CSSProperties
        }
      >
        <div
          data-color-dial-thumb=""
          data-value={norm.toFixed(4)}
          data-angle={angle.toFixed(2)}
          style={{
            position: 'absolute',
            left: `${thumbX * 100}%`,
            top: `${thumbY * 100}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
        {props.children}
      </div>
    );
  },
);
