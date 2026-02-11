import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useSelector } from '@legendapp/state/react';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  areColorAreaAxesDistinct,
  colorFromColorAreaPosition,
  resolveColorAreaAxes,
  type ColorAreaAxes,
  type ResolvedColorAreaAxes,
} from './api/color-area.js';
import {
  ColorAreaContext,
  type ColorAreaInteractionFrameStats,
  type ColorAreaPerformanceProfile,
  type ColorAreaQualityLevel,
} from './color-area-context.js';
import { Thumb } from './thumb.js';
import type { SetRequestedOptions } from './use-color.js';

function isProductionEnvironment(): boolean {
  const maybeProcess = (
    globalThis as { process?: { env?: { NODE_ENV?: string } } }
  ).process;
  return maybeProcess?.env?.NODE_ENV === 'production';
}

export interface ColorAreaProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * Axis descriptors for the color plane.
   * @default { x: { channel: 'l' }, y: { channel: 'c' } }
   */
  axes?: ColorAreaAxes;
  /** Standalone requested color (alternative to ColorProvider) */
  requested?: Color;
  /** Standalone change handler (alternative to ColorProvider) */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
  /**
   * Runtime quality/performance profile.
   * @default 'auto'
   */
  performanceProfile?: ColorAreaPerformanceProfile;
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
   * Called after each committed pointer interaction frame.
   */
  onInteractionFrame?: (stats: ColorAreaInteractionFrameStats) => void;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

const UPDATE_RATE_SLOP_MS = 1;

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function lowerQuality(level: ColorAreaQualityLevel): ColorAreaQualityLevel {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'low';
  return 'low';
}

function raiseQuality(level: ColorAreaQualityLevel): ColorAreaQualityLevel {
  if (level === 'low') return 'medium';
  if (level === 'medium') return 'high';
  return 'high';
}

function profileDefaultQuality(
  profile: ColorAreaPerformanceProfile,
): ColorAreaQualityLevel {
  if (profile === 'performance') return 'medium';
  return 'high';
}

function normalizeAxesForProdFallback(
  axes: ResolvedColorAreaAxes,
): ResolvedColorAreaAxes {
  if (axes.x.channel !== axes.y.channel) {
    return axes;
  }

  const nextYChannel = axes.x.channel === 'l' ? 'c' : 'l';
  return {
    ...axes,
    y: {
      channel: nextYChannel,
      range: axes.y.range,
    },
  };
}

function countThumbs(children: ReactNode): number {
  let count = 0;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    if (child.type === Thumb) {
      count += 1;
      return;
    }

    const nestedChildren = (child.props as { children?: ReactNode }).children;
    if (nestedChildren !== undefined) {
      count += countThumbs(nestedChildren);
    }
  });

  return count;
}

function pruneExtraThumbs(
  children: ReactNode,
  state: { seenThumb: boolean },
): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }

    if (child.type === Thumb) {
      if (state.seenThumb) {
        return null;
      }
      state.seenThumb = true;
      return child;
    }

    const nestedChildren = (child.props as { children?: ReactNode }).children;
    if (nestedChildren === undefined) {
      return child;
    }

    const nextChildren = pruneExtraThumbs(nestedChildren, state);
    if (nextChildren === nestedChildren) {
      return child;
    }

    return cloneElement(
      child as ReactElement<{ children?: ReactNode }>,
      undefined,
      nextChildren,
    );
  });
}

/**
 * A bounded, interactive 2D color UI plane host.
 *
 * ColorArea owns geometry and pointer interaction. Child primitives render visuals and semantics.
 */
export const ColorArea = forwardRef<HTMLDivElement, ColorAreaProps>(
  function ColorArea(
    {
      axes,
      requested: requestedProp,
      onChangeRequested: onChangeRequestedProp,
      performanceProfile = 'auto',
      maxUpdateHz = 60,
      dragEpsilon = 0.0005,
      onInteractionFrame,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      style,
      children,
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
        'ColorArea requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const areaRef = useRef<HTMLDivElement>(null);
    const [areaNode, setAreaNode] = useState<HTMLDivElement | null>(null);
    const warnedMultiThumbRef = useRef(false);
    const warnedAxesRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const [qualityLevel, setQualityLevel] = useState<ColorAreaQualityLevel>(
      profileDefaultQuality(performanceProfile),
    );
    const qualityLevelRef = useRef(qualityLevel);
    const rafRef = useRef<number | null>(null);
    const pendingPositionRef = useRef<{
      clientX: number;
      clientY: number;
      coalescedCount: number;
    } | null>(null);
    const rectRef = useRef<DOMRect | null>(null);
    const lastNormRef = useRef<{ x: number; y: number } | null>(null);
    const lastCommitTsRef = useRef(0);
    const lastFrameTsRef = useRef(0);
    const rollingUpdateMsRef = useRef<number[]>([]);
    const rollingFrameMsRef = useRef<number[]>([]);

    const resolvedAxes = useMemo(() => {
      const resolved = resolveColorAreaAxes(axes);

      if (areColorAreaAxesDistinct(resolved)) {
        return resolved;
      }

      if (!isProductionEnvironment()) {
        throw new Error(
          'ColorArea requires distinct axis channels. Received the same channel for both x and y.',
        );
      }

      if (!warnedAxesRef.current) {
        warnedAxesRef.current = true;
        console.warn(
          'ColorArea received duplicate axis channels. Falling back to distinct production-safe axes.',
        );
      }

      return normalizeAxesForProdFallback(resolved);
    }, [axes]);

    const refreshRect = useCallback(() => {
      const element = areaRef.current;
      if (!element) {
        rectRef.current = null;
        return null;
      }
      const nextRect = element.getBoundingClientRect();
      rectRef.current = nextRect;
      return nextRect;
    }, []);

    const updateAdaptiveQuality = useCallback(
      (updateDurationMs: number, frameTimeMs: number) => {
        if (performanceProfile === 'quality') {
          if (qualityLevelRef.current !== 'high') {
            qualityLevelRef.current = 'high';
            setQualityLevel('high');
          }
          return;
        }

        const updates = rollingUpdateMsRef.current;
        updates.push(updateDurationMs);
        if (updates.length > 12) {
          updates.shift();
        }
        const frames = rollingFrameMsRef.current;
        frames.push(frameTimeMs);
        if (frames.length > 12) {
          frames.shift();
        }

        const avgUpdate =
          updates.reduce((acc, value) => acc + value, 0) / updates.length;
        const avgFrame =
          frames.reduce((acc, value) => acc + value, 0) / frames.length;

        const degradeThreshold =
          performanceProfile === 'performance'
            ? { update: 7.4, frame: 15.5 }
            : performanceProfile === 'balanced'
              ? { update: 8.8, frame: 18.5 }
              : { update: 10, frame: 20 };
        const recoverThreshold =
          performanceProfile === 'performance'
            ? { update: 4.3, frame: 11.5 }
            : performanceProfile === 'balanced'
              ? { update: 5.2, frame: 12.5 }
              : { update: 5.7, frame: 13 };

        let nextQuality = qualityLevelRef.current;
        if (
          avgUpdate >= degradeThreshold.update ||
          avgFrame >= degradeThreshold.frame
        ) {
          nextQuality = lowerQuality(nextQuality);
        } else if (
          avgUpdate <= recoverThreshold.update &&
          avgFrame <= recoverThreshold.frame
        ) {
          nextQuality = raiseQuality(nextQuality);
        }

        if (nextQuality !== qualityLevelRef.current) {
          qualityLevelRef.current = nextQuality;
          setQualityLevel(nextQuality);
        }
      },
      [performanceProfile],
    );

    const commitFromPosition = useCallback(
      (
        clientX: number,
        clientY: number,
        options: { force?: boolean; coalescedCount?: number } = {},
      ) => {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
          return;
        }

        const rect = rectRef.current ?? refreshRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
          return;
        }

        const xNormRaw = (clientX - rect.left) / rect.width;
        const yNormRaw = (clientY - rect.top) / rect.height;
        if (!Number.isFinite(xNormRaw) || !Number.isFinite(yNormRaw)) {
          return;
        }

        const xNorm = clamp01(xNormRaw);
        const yNorm = clamp01(yNormRaw);
        const previousNorm = lastNormRef.current;
        const epsilon = dragEpsilon >= 0 ? dragEpsilon : 0.0005;

        if (
          !options.force &&
          previousNorm &&
          Math.abs(previousNorm.x - xNorm) <= epsilon &&
          Math.abs(previousNorm.y - yNorm) <= epsilon
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
          now + UPDATE_RATE_SLOP_MS < lastCommitTsRef.current + minDeltaMs
        ) {
          return;
        }

        const start =
          typeof performance === 'undefined' ? Date.now() : performance.now();
        setRequested(
          colorFromColorAreaPosition(requested, resolvedAxes, xNorm, yNorm),
          {
            interaction: 'pointer',
          },
        );

        const end =
          typeof performance === 'undefined' ? Date.now() : performance.now();
        const updateDurationMs = end - start;
        const frameTimeMs =
          lastFrameTsRef.current > 0
            ? start - lastFrameTsRef.current
            : end - start;
        lastFrameTsRef.current = start;
        lastCommitTsRef.current = start;
        lastNormRef.current = { x: xNorm, y: yNorm };

        updateAdaptiveQuality(updateDurationMs, frameTimeMs);
        onInteractionFrame?.({
          frameTimeMs,
          updateDurationMs,
          droppedFrame: frameTimeMs > 16.67,
          longTask: updateDurationMs > 50,
          qualityLevel: qualityLevelRef.current,
          coalescedCount: options.coalescedCount ?? 1,
        });
      },
      [
        dragEpsilon,
        maxUpdateHz,
        onInteractionFrame,
        refreshRect,
        requested,
        resolvedAxes,
        setRequested,
        updateAdaptiveQuality,
      ],
    );

    const flushPendingPosition = useCallback(
      (force: boolean = false) => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        const pending = pendingPositionRef.current;
        if (pending) {
          pendingPositionRef.current = null;
          commitFromPosition(pending.clientX, pending.clientY, {
            force,
            coalescedCount: pending.coalescedCount,
          });
        }
      },
      [commitFromPosition],
    );

    useEffect(
      () => () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
      },
      [],
    );

    useEffect(() => {
      const defaultLevel = profileDefaultQuality(performanceProfile);
      qualityLevelRef.current = defaultLevel;
      setQualityLevel(defaultLevel);
      rollingUpdateMsRef.current = [];
      rollingFrameMsRef.current = [];
    }, [performanceProfile]);

    useEffect(() => {
      qualityLevelRef.current = qualityLevel;
    }, [qualityLevel]);

    useEffect(() => {
      isDraggingRef.current = isDragging;
    }, [isDragging]);

    useEffect(() => {
      if (!areaNode || typeof ResizeObserver === 'undefined') {
        return;
      }

      const observer = new ResizeObserver(() => {
        refreshRect();
      });
      observer.observe(areaNode);
      return () => {
        observer.disconnect();
      };
    }, [areaNode, refreshRect]);

    useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }
      const onScroll = () => {
        if (isDraggingRef.current) {
          refreshRect();
        }
      };
      window.addEventListener('scroll', onScroll, true);
      return () => {
        window.removeEventListener('scroll', onScroll, true);
      };
    }, [refreshRect]);

    const onRootPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        isDraggingRef.current = true;
        setIsDragging(true);
        rollingUpdateMsRef.current = [];
        rollingFrameMsRef.current = [];
        lastFrameTsRef.current = 0;
        lastCommitTsRef.current = 0;
        lastNormRef.current = null;
        refreshRect();
        if ('setPointerCapture' in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        const native = event.nativeEvent as Partial<PointerEvent>;
        const clientX =
          asFiniteNumber(event.clientX) ?? asFiniteNumber(native.clientX) ?? 0;
        const clientY =
          asFiniteNumber(event.clientY) ?? asFiniteNumber(native.clientY) ?? 0;

        commitFromPosition(clientX, clientY, { force: true });
      },
      [commitFromPosition, onPointerDown, refreshRect],
    );

    const onRootPointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerMove?.(event);
        if (event.defaultPrevented || !isDraggingRef.current) {
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

        pendingPositionRef.current = {
          clientX,
          clientY,
          coalescedCount: Math.max(1, coalesced.length),
        };
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            flushPendingPosition(false);
          });
        }
      },
      [onPointerMove, flushPendingPosition],
    );

    const onRootPointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerUp?.(event);
        isDraggingRef.current = false;
        setIsDragging(false);
        flushPendingPosition(true);
      },
      [onPointerUp, flushPendingPosition],
    );

    const onRootPointerCancel = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerCancel?.(event);
        isDraggingRef.current = false;
        setIsDragging(false);
        flushPendingPosition(true);
      },
      [onPointerCancel, flushPendingPosition],
    );

    const { explicitThumbCount, resolvedChildren } = useMemo(() => {
      const thumbCount = countThumbs(children);
      let nextChildren = children;

      if (thumbCount > 1) {
        if (!isProductionEnvironment()) {
          throw new Error('ColorArea allows only one <Thumb /> child.');
        }

        if (!warnedMultiThumbRef.current) {
          warnedMultiThumbRef.current = true;
          console.warn(
            'ColorArea allows one <Thumb />. Extra thumbs were ignored.',
          );
        }

        nextChildren = pruneExtraThumbs(children, { seenThumb: false });
      }

      return {
        explicitThumbCount: thumbCount,
        resolvedChildren: nextChildren,
      };
    }, [children]);

    const contextValue = useMemo(
      () => ({
        areaRef,
        requested,
        setRequested,
        axes: resolvedAxes,
        performanceProfile,
        qualityLevel,
        isDragging,
      }),
      [
        requested,
        setRequested,
        resolvedAxes,
        performanceProfile,
        qualityLevel,
        isDragging,
      ],
    );

    return (
      <ColorAreaContext.Provider value={contextValue}>
        <div
          {...props}
          ref={(node) => {
            areaRef.current = node;
            setAreaNode(node);
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          data-color-area=""
          data-dragging={isDragging || undefined}
          data-performance-profile={performanceProfile}
          data-quality-level={qualityLevel}
          onPointerDown={onRootPointerDown}
          onPointerMove={onRootPointerMove}
          onPointerUp={onRootPointerUp}
          onPointerCancel={onRootPointerCancel}
          style={{
            position: 'relative',
            touchAction: 'none',
            ...style,
          }}
        >
          {resolvedChildren}
          {explicitThumbCount === 0 ? <Thumb /> : null}
        </div>
      </ColorAreaContext.Provider>
    );
  },
);
