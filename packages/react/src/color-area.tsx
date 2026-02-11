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
import { ColorAreaContext } from './color-area-context.js';
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
    const warnedMultiThumbRef = useRef(false);
    const warnedAxesRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const rafRef = useRef<number | null>(null);
    const pendingPositionRef = useRef<{
      clientX: number;
      clientY: number;
    } | null>(null);

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

    const updateFromPosition = useCallback(
      (clientX: number, clientY: number) => {
        const el = areaRef.current;
        if (!el) {
          return;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }

        const xNorm = (clientX - rect.left) / rect.width;
        const yNorm = (clientY - rect.top) / rect.height;

        setRequested(
          colorFromColorAreaPosition(requested, resolvedAxes, xNorm, yNorm),
          {
            interaction: 'pointer',
          },
        );
      },
      [requested, resolvedAxes, setRequested],
    );

    const updateFromPositionRef = useRef(updateFromPosition);
    updateFromPositionRef.current = updateFromPosition;

    const flushPendingPosition = useCallback(() => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const pending = pendingPositionRef.current;
      if (pending) {
        pendingPositionRef.current = null;
        updateFromPositionRef.current(pending.clientX, pending.clientY);
      }
    }, []);

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
        setIsDragging(true);
        if ('setPointerCapture' in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        updateFromPosition(event.clientX, event.clientY);
      },
      [onPointerDown, updateFromPosition],
    );

    const onRootPointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerMove?.(event);
        if (event.defaultPrevented || !isDragging) {
          return;
        }

        pendingPositionRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
        };
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            flushPendingPosition();
          });
        }
      },
      [onPointerMove, isDragging, flushPendingPosition],
    );

    const onRootPointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerUp?.(event);
        setIsDragging(false);
        flushPendingPosition();
      },
      [onPointerUp, flushPendingPosition],
    );

    const onRootPointerCancel = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerCancel?.(event);
        setIsDragging(false);
        flushPendingPosition();
      },
      [onPointerCancel, flushPendingPosition],
    );

    const explicitThumbCount = countThumbs(children);
    let resolvedChildren: ReactNode = children;

    if (explicitThumbCount > 1) {
      if (!isProductionEnvironment()) {
        throw new Error('ColorArea allows only one <Thumb /> child.');
      }

      if (!warnedMultiThumbRef.current) {
        warnedMultiThumbRef.current = true;
        console.warn(
          'ColorArea allows one <Thumb />. Extra thumbs were ignored.',
        );
      }

      resolvedChildren = pruneExtraThumbs(children, { seenThumb: false });
    }

    const contextValue = useMemo(
      () => ({
        areaRef,
        requested,
        setRequested,
        axes: resolvedAxes,
      }),
      [requested, setRequested, resolvedAxes],
    );

    return (
      <ColorAreaContext.Provider value={contextValue}>
        <div
          {...props}
          ref={(node) => {
            areaRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          data-color-area=""
          data-dragging={isDragging || undefined}
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
