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
import { assignRef } from './assign-ref.js';
import { useColorStoreSelector } from './color-store.js';
import type { Color } from '@color-kit/core';
import { useOptionalColorContext } from './context.js';
import {
  areColorAreaAxesDistinct,
  colorFromColorAreaPosition,
  createPointerDragController,
  normalizeColorAreaPointer,
  resolveColorAreaAxes,
  type DragCommitInfo,
  type DragPoint,
  type ColorAreaAxes,
  type ResolvedColorAreaAxes,
} from '@color-kit/driver';
import {
  ColorAreaContext,
  type ColorAreaInteractionFrameStats,
  type ColorAreaPerformanceProfile,
} from './color-area-context.js';
import { useAdaptiveQuality } from './use-adaptive-quality.js';
import { Thumb } from './thumb.js';
import type { SetRequestedOptions } from './use-color.js';

function isProductionEnvironment(): boolean {
  const maybeProcess = (
    globalThis as { process?: { env?: { NODE_ENV?: string } } }
  ).process;
  return maybeProcess?.env?.NODE_ENV === 'production';
}

/** Props for {@link ColorArea}; other `div` attributes are forwarded. */
export interface ColorAreaProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /**
   * OKLCH channel and value range for each axis. The two channels must
   * differ (`l`, `c` or `h`); omitted ranges use the channel defaults
   * (`l` [0, 1], `c` [0, 0.4], `h` [0, 360]). Y values increase upward.
   * @defaultValue `{ x: { channel: 'l' }, y: { channel: 'c' } }`
   */
  axes?: ColorAreaAxes;
  /** Standalone requested color, used instead of a `<Color>` provider. */
  requested?: Color;
  /** Standalone change handler, used instead of a `<Color>` provider. */
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
  /**
   * Runtime quality/performance profile. Except for `'quality'`, the area
   * lowers its quality level (raster resolution and layer sampling) while
   * pointer updates are slow and raises it again when they recover.
   * @defaultValue 'auto'
   */
  performanceProfile?: ColorAreaPerformanceProfile;
  /**
   * Maximum pointer-driven update frequency while dragging (updates/second).
   * @defaultValue 60
   */
  maxUpdateHz?: number;
  /**
   * Skip pointer updates when the normalized delta is not larger than this.
   * @defaultValue 0.0005
   */
  dragEpsilon?: number;
  /**
   * Called after each committed pointer interaction frame with timing and
   * quality stats (for profiling).
   */
  onInteractionFrame?: (stats: ColorAreaInteractionFrameStats) => void;
  /**
   * Explicit thumb slot rendered as the top-most ColorArea child.
   *
   * Prefer this over nesting `<Thumb />` when a thumb is wrapped, memoized, or
   * supplied from another module boundary.
   */
  thumb?: ReactNode;
  /**
   * Render the default thumb when no explicit `thumb` prop or `<Thumb />` child
   * is provided.
   * @defaultValue true
   */
  showDefaultThumb?: boolean;
  /**
   * Disables pointer and keyboard interaction. The thumb leaves the tab order
   * and gets `aria-disabled`; the root and thumb get `data-disabled`.
   * @defaultValue false
   */
  disabled?: boolean;
}

interface PointerSnapshot {
  clientX: number;
  clientY: number;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/** Latest (coalesced) pointer position plus the number of merged samples. */
function latestPointerSnapshot(event: PointerEvent): {
  snapshot: PointerSnapshot;
  coalescedCount: number;
} {
  const coalesced =
    typeof event.getCoalescedEvents === 'function'
      ? event.getCoalescedEvents()
      : [];
  const latest = coalesced.length > 0 ? coalesced[coalesced.length - 1] : event;
  return {
    snapshot: {
      clientX:
        asFiniteNumber(latest.clientX) ?? asFiniteNumber(event.clientX) ?? 0,
      clientY:
        asFiniteNumber(latest.clientY) ?? asFiniteNumber(event.clientY) ?? 0,
    },
    coalescedCount: coalesced.length,
  };
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

function hasRenderableThumbSlot(thumb: ReactNode): boolean {
  return isValidElement(thumb);
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

function findFirstThumb(children: ReactNode): ReactElement | null {
  const nodes = Children.toArray(children);
  for (const node of nodes) {
    if (!isValidElement(node)) {
      continue;
    }

    if (node.type === Thumb) {
      return node;
    }

    const nestedChildren = (node.props as { children?: ReactNode }).children;
    if (nestedChildren !== undefined) {
      const nestedThumb = findFirstThumb(nestedChildren);
      if (nestedThumb) {
        return nestedThumb;
      }
    }
  }

  return null;
}

function pruneAllThumbs(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }

    if (child.type === Thumb) {
      return null;
    }

    const nestedChildren = (child.props as { children?: ReactNode }).children;
    if (nestedChildren === undefined) {
      return child;
    }

    const nextChildren = pruneAllThumbs(nestedChildren);
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
 * Interactive 2D color picker surface that maps two OKLCH channels (by
 * default lightness on x and chroma on y) to a rectangle.
 *
 * ColorArea owns geometry and pointer interaction: dragging anywhere sets
 * the two axis channels of the requested color and keeps the third. Child
 * primitives render visuals and semantics: {@link ColorPlane} rasterizes the
 * color plane, layers such as {@link GamutBoundaryLayer} draw overlays, and
 * a single {@link Thumb} (rendered by default) provides keyboard and screen
 * reader access. Reads and writes the nearest `<Color>` provider, or
 * the standalone `requested` / `onChangeRequested` props. Give it a size;
 * it is otherwise unstyled.
 *
 * Styling hooks on the root: `data-color-area`, `data-dragging`,
 * `data-disabled`, `data-performance-profile`, `data-quality-level`.
 *
 * @throws {Error} When there is neither a `<Color>` ancestor nor both
 *   `requested` and `onChangeRequested`. Outside production builds, also
 *   when both axes use the same channel or more than one thumb is supplied
 *   (production builds fall back to distinct axes and a single thumb, with
 *   a console warning).
 *
 * @example
 * ```tsx
 * import {
 *   Background,
 *   Color,
 *   ColorArea,
 *   ColorPlane,
 *   GamutBoundaryLayer,
 *   Thumb,
 * } from 'color-kit/react';
 *
 * export const Picker = () => (
 *   <Color defaultColor="#3b82f6">
 *     <ColorArea
 *       axes={{ x: { channel: 'l' }, y: { channel: 'c', range: [0, 0.37] } }}
 *       style={{ width: 280, height: 200, borderRadius: 8 }}
 *     >
 *       <Background checkerboard />
 *       <ColorPlane />
 *       <GamutBoundaryLayer
 *         gamut="srgb"
 *         pathProps={{ stroke: '#fff', vectorEffect: 'non-scaling-stroke' }}
 *       />
 *       <Thumb style={{ width: 14, height: 14, borderRadius: 7, border: '2px solid #fff' }} />
 *     </ColorArea>
 *   </Color>
 * );
 * ```
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
      thumb,
      showDefaultThumb = true,
      disabled = false,
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
    const contextRequested = useColorStoreSelector(
      context?.store ?? null,
      (state) => state?.requested ?? null,
    );

    const requested = requestedProp ?? contextRequested;
    const setRequested = onChangeRequestedProp ?? context?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorArea requires either a <Color> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const areaRef = useRef<HTMLDivElement>(null);
    const [areaNode, setAreaNode] = useState<HTMLDivElement | null>(null);
    // Memoized callback ref: an inline ref is detached and reattached on
    // every commit, churning `areaNode` state and consumer refs each render.
    const setAreaRef = useCallback(
      (node: HTMLDivElement | null) => {
        areaRef.current = node;
        setAreaNode(node);
        const detachForwarded = assignRef(ref, node);
        return () => {
          areaRef.current = null;
          setAreaNode(null);
          detachForwarded();
        };
      },
      [ref],
    );
    const detachWindowListenersRef = useRef<(() => void) | null>(null);
    const warnedMultiThumbRef = useRef(false);
    const warnedAxesRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    // Disabling mid-drag ends the drag (the refs and listeners are released
    // in an effect).
    if (disabled && isDragging) {
      setIsDragging(false);
    }
    const adaptiveQuality = useAdaptiveQuality(performanceProfile);
    const qualityLevel = adaptiveQuality.quality;
    const activePointerIdRef = useRef<number | null>(null);
    const rectRef = useRef<DOMRect | null>(null);
    const lastFrameTsRef = useRef(0);

    const requestedAxes = useMemo(() => resolveColorAreaAxes(axes), [axes]);
    const hasDuplicateAxes = useMemo(
      () => !areColorAreaAxesDistinct(requestedAxes),
      [requestedAxes],
    );

    const resolvedAxes = useMemo(() => {
      if (!hasDuplicateAxes) {
        return requestedAxes;
      }

      if (!isProductionEnvironment()) {
        throw new Error(
          'ColorArea requires distinct axis channels. Received the same channel for both x and y.',
        );
      }

      return normalizeAxesForProdFallback(requestedAxes);
    }, [hasDuplicateAxes, requestedAxes]);

    useEffect(() => {
      if (!hasDuplicateAxes || warnedAxesRef.current) {
        return;
      }
      warnedAxesRef.current = true;
      console.warn(
        'ColorArea received duplicate axis channels. Falling back to distinct production-safe axes.',
      );
    }, [hasDuplicateAxes]);

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

    const reportQualityFrame = adaptiveQuality.reportFrame;
    const resetQualityWindow = adaptiveQuality.reset;

    const commitPoint = useCallback(
      (point: DragPoint, info: DragCommitInfo) => {
        const start = nowMs();
        setRequested(
          colorFromColorAreaPosition(requested, resolvedAxes, point.x, point.y),
          {
            interaction: 'pointer',
          },
        );

        const end = nowMs();
        const updateDurationMs = end - start;
        const frameTimeMs =
          lastFrameTsRef.current > 0
            ? start - lastFrameTsRef.current
            : end - start;
        lastFrameTsRef.current = start;

        const nextQualityLevel = reportQualityFrame({
          updateDurationMs,
          frameTimeMs,
        });
        onInteractionFrame?.({
          frameTimeMs,
          updateDurationMs,
          droppedFrame: frameTimeMs > 16.67,
          longTask: updateDurationMs > 50,
          qualityLevel: nextQualityLevel,
          coalescedCount: info.coalescedCount,
        });
      },
      [
        onInteractionFrame,
        reportQualityFrame,
        requested,
        resolvedAxes,
        setRequested,
      ],
    );

    const normalizePointer = useCallback(
      ({ clientX, clientY }: PointerSnapshot) => {
        const rect = rectRef.current ?? refreshRect();
        return rect ? normalizeColorAreaPointer(clientX, clientY, rect) : null;
      },
      [refreshRect],
    );

    // Shared driver drag controller: rAF coalescing, dragEpsilon, maxUpdateHz.
    const [dragController] = useState(() =>
      createPointerDragController<PointerSnapshot>({
        normalize: () => null,
        commit: () => {},
      }),
    );

    useEffect(() => {
      dragController.configure({
        normalize: normalizePointer,
        commit: commitPoint,
        maxUpdateHz,
        dragEpsilon,
      });
    }, [
      commitPoint,
      dragController,
      dragEpsilon,
      maxUpdateHz,
      normalizePointer,
    ]);

    useEffect(() => () => dragController.cancel(), [dragController]);

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

    const stopWindowTracking = useCallback(() => {
      const detach = detachWindowListenersRef.current;
      detachWindowListenersRef.current = null;
      detach?.();
    }, []);

    /**
     * Window listeners are attached only for the lifetime of a drag so idle
     * areas cost nothing per pointer move or scroll anywhere on the page.
     */
    const startWindowTracking = useCallback(() => {
      stopWindowTracking();
      if (typeof window === 'undefined') {
        return;
      }

      const onScroll = () => {
        refreshRect();
      };

      const onWindowPointerMove = (event: PointerEvent) => {
        if (!dragController.isActive()) {
          return;
        }
        const activePointerId = activePointerIdRef.current;
        if (
          activePointerId !== null &&
          Number.isFinite(event.pointerId) &&
          event.pointerId !== activePointerId
        ) {
          return;
        }

        const area = areaRef.current;
        if (
          area &&
          event.target instanceof Node &&
          area.contains(event.target)
        ) {
          return;
        }

        const { snapshot, coalescedCount } = latestPointerSnapshot(event);
        dragController.move(snapshot, coalescedCount);
      };

      const endWindowDrag = (event: PointerEvent) => {
        const activePointerId = activePointerIdRef.current;
        if (
          activePointerId !== null &&
          Number.isFinite(event.pointerId) &&
          event.pointerId !== activePointerId
        ) {
          return;
        }

        const area = areaRef.current;
        if (
          area &&
          event.target instanceof Node &&
          area.contains(event.target)
        ) {
          return;
        }

        activePointerIdRef.current = null;
        setIsDragging(false);
        stopWindowTracking();
        dragController.end();
      };

      window.addEventListener('pointermove', onWindowPointerMove, {
        passive: true,
      });
      window.addEventListener('pointerup', endWindowDrag, {
        passive: true,
      });
      window.addEventListener('pointercancel', endWindowDrag, {
        passive: true,
      });
      window.addEventListener('scroll', onScroll, true);

      detachWindowListenersRef.current = () => {
        window.removeEventListener('pointermove', onWindowPointerMove);
        window.removeEventListener('pointerup', endWindowDrag);
        window.removeEventListener('pointercancel', endWindowDrag);
        window.removeEventListener('scroll', onScroll, true);
      };
    }, [dragController, refreshRect, stopWindowTracking]);

    useEffect(() => stopWindowTracking, [stopWindowTracking]);

    // Cancel an active drag when the area becomes disabled: drop the pending
    // update (without the release commit `end()` would make) and the drag
    // listeners so its value cannot change while disabled.
    useEffect(() => {
      if (!disabled) return;
      dragController.cancel();
      activePointerIdRef.current = null;
      stopWindowTracking();
    }, [disabled, dragController, stopWindowTracking]);

    const onRootPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || disabled) {
          return;
        }

        // preventDefault suppresses the compatibility mousedown (and with it
        // the default focus), so move focus to the thumb explicitly.
        event.preventDefault();
        const thumbNode = event.currentTarget.querySelector<HTMLElement>(
          '[data-color-area-thumb]',
        );
        thumbNode?.focus({ preventScroll: true });
        setIsDragging(true);
        activePointerIdRef.current = event.pointerId;
        resetQualityWindow();
        lastFrameTsRef.current = 0;
        refreshRect();
        startWindowTracking();
        if ('setPointerCapture' in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        const native = event.nativeEvent as Partial<PointerEvent>;
        const clientX =
          asFiniteNumber(event.clientX) ?? asFiniteNumber(native.clientX) ?? 0;
        const clientY =
          asFiniteNumber(event.clientY) ?? asFiniteNumber(native.clientY) ?? 0;

        dragController.start({ clientX, clientY });
      },
      [
        disabled,
        dragController,
        onPointerDown,
        refreshRect,
        resetQualityWindow,
        startWindowTracking,
      ],
    );

    const onRootPointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerMove?.(event);
        if (
          event.defaultPrevented ||
          event.pointerId !== activePointerIdRef.current
        ) {
          return;
        }

        const { snapshot, coalescedCount } = latestPointerSnapshot(
          event.nativeEvent,
        );
        dragController.move(snapshot, coalescedCount);
      },
      [dragController, onPointerMove],
    );

    const onRootPointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerUp?.(event);
        if (event.pointerId !== activePointerIdRef.current) {
          return;
        }
        activePointerIdRef.current = null;
        setIsDragging(false);
        stopWindowTracking();
        dragController.end();
      },
      [dragController, onPointerUp, stopWindowTracking],
    );

    const onRootPointerCancel = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerCancel?.(event);
        if (event.pointerId !== activePointerIdRef.current) {
          return;
        }
        activePointerIdRef.current = null;
        setIsDragging(false);
        stopWindowTracking();
        dragController.end();
      },
      [dragController, onPointerCancel, stopWindowTracking],
    );

    const { explicitThumbCount, resolvedThumb, resolvedChildren } =
      useMemo(() => {
        const childThumbCount = countThumbs(children);
        const thumbSlotCount = hasRenderableThumbSlot(thumb) ? 1 : 0;
        const thumbCount = childThumbCount + thumbSlotCount;
        const childThumb = findFirstThumb(children);
        const nextChildren =
          childThumbCount > 0 ? pruneAllThumbs(children) : children;

        if (thumbCount > 1 && !isProductionEnvironment()) {
          throw new Error(
            'ColorArea allows only one thumb. Use either the thumb prop or one <Thumb /> child.',
          );
        }

        return {
          explicitThumbCount: thumbCount,
          resolvedThumb:
            thumbSlotCount > 0 ? (
              thumb
            ) : childThumbCount > 0 ? (
              childThumb
            ) : showDefaultThumb ? (
              <Thumb />
            ) : null,
          resolvedChildren: nextChildren,
        };
      }, [children, showDefaultThumb, thumb]);

    useEffect(() => {
      if (explicitThumbCount <= 1 || warnedMultiThumbRef.current) {
        return;
      }
      warnedMultiThumbRef.current = true;
      console.warn('ColorArea allows one thumb. Extra thumbs were ignored.');
    }, [explicitThumbCount]);

    const contextValue = useMemo(
      () => ({
        areaRef,
        requested,
        setRequested,
        axes: resolvedAxes,
        performanceProfile,
        qualityLevel,
        isDragging,
        disabled,
      }),
      [
        disabled,
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
          ref={setAreaRef}
          data-color-area=""
          data-dragging={isDragging || undefined}
          data-disabled={disabled || undefined}
          data-performance-profile={performanceProfile}
          data-quality-level={qualityLevel}
          onPointerDown={onRootPointerDown}
          onPointerMove={onRootPointerMove}
          onPointerUp={onRootPointerUp}
          onPointerCancel={onRootPointerCancel}
          style={{
            position: 'relative',
            touchAction: 'none',
            overflow: 'visible',
            isolation: 'isolate',
            ...style,
          }}
        >
          {resolvedChildren}
          {resolvedThumb}
        </div>
      </ColorAreaContext.Provider>
    );
  },
);
