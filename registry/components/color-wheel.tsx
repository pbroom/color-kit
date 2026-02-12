'use client';

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
  clamp,
  inP3Gamut,
  inSrgbGamut,
  normalizeHue,
  toCss,
  toP3Gamut,
  toSrgbGamut,
} from '@color-kit/core';
import { useOptionalColorContext } from '@/hooks/color-context';
import type { SetRequestedOptions } from '@/hooks/use-color';

type GamutTarget = 'srgb' | 'display-p3';

type ColorWheelKey = 'ArrowRight' | 'ArrowLeft' | 'ArrowUp' | 'ArrowDown';

const HUE_PRESERVE_RADIUS_EPSILON = 0.0005;
const DEFAULT_CHROMA_RANGE: [number, number] = [0, 0.4];

function resolveChromaRange(range?: [number, number]): [number, number] {
  if (!range) {
    return DEFAULT_CHROMA_RANGE;
  }

  const [min, max] = range;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return DEFAULT_CHROMA_RANGE;
  }
  return [min, max];
}

function chromaSpan(range: [number, number]): number {
  return Math.max(0, range[1] - range[0]);
}

function normalizePointer(
  pointerX: number,
  pointerY: number,
  rect: DOMRect,
): { x: number; y: number } {
  if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return { x: 0.5, y: 0.5 };
  }

  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0.5, y: 0.5 };
  }

  const radius = Math.min(rect.width, rect.height) / 2;
  if (radius <= 0) {
    return { x: 0.5, y: 0.5 };
  }

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  let dx = (pointerX - centerX) / radius;
  let dy = (pointerY - centerY) / radius;
  const distance = Math.hypot(dx, dy);

  if (distance > 1) {
    dx /= distance;
    dy /= distance;
  }

  return {
    x: clamp(0.5 + dx * 0.5, 0, 1),
    y: clamp(0.5 + dy * 0.5, 0, 1),
  };
}

function colorFromPosition(
  color: Color,
  xNorm: number,
  yNorm: number,
  range: [number, number],
): Color {
  const resolved = resolveChromaRange(range);
  const span = chromaSpan(resolved);
  const safeX = Number.isFinite(xNorm) ? xNorm : 0.5;
  const safeY = Number.isFinite(yNorm) ? yNorm : 0.5;

  let dx = (clamp(safeX, 0, 1) - 0.5) * 2;
  let dy = (clamp(safeY, 0, 1) - 0.5) * 2;
  const distance = Math.hypot(dx, dy);

  if (distance > 1) {
    dx /= distance;
    dy /= distance;
  }

  const radius = clamp(distance, 0, 1);
  const nextHue =
    radius <= HUE_PRESERVE_RADIUS_EPSILON
      ? color.h
      : normalizeHue((Math.atan2(dy, dx) * 180) / Math.PI);
  const nextChroma =
    span === 0
      ? resolved[0]
      : clamp(resolved[0] + radius * span, resolved[0], resolved[1]);

  return {
    ...color,
    h: nextHue,
    c: nextChroma,
  };
}

function colorFromKey(
  color: Color,
  key: string,
  hueStep: number,
  chromaStepRatio: number,
  range: [number, number],
): Color | null {
  const resolved = resolveChromaRange(range);
  const span = chromaSpan(resolved);
  const safeHueStep = Number.isFinite(hueStep) ? Math.max(0, hueStep) : 0;
  const safeChromaRatio = Number.isFinite(chromaStepRatio)
    ? Math.max(0, chromaStepRatio)
    : 0;
  const chromaStep = span * safeChromaRatio;

  switch (key as ColorWheelKey) {
    case 'ArrowRight':
      return { ...color, h: normalizeHue(color.h + safeHueStep) };
    case 'ArrowLeft':
      return { ...color, h: normalizeHue(color.h - safeHueStep) };
    case 'ArrowUp':
      return {
        ...color,
        c: clamp(color.c + chromaStep, resolved[0], resolved[1]),
      };
    case 'ArrowDown':
      return {
        ...color,
        c: clamp(color.c - chromaStep, resolved[0], resolved[1]),
      };
    default:
      return null;
  }
}

function thumbPosition(
  color: Color,
  range: [number, number],
): { x: number; y: number; radius: number } {
  const resolved = resolveChromaRange(range);
  const span = chromaSpan(resolved);
  const radius = span === 0 ? 0 : clamp((color.c - resolved[0]) / span, 0, 1);
  const angle = (normalizeHue(color.h) * Math.PI) / 180;

  return {
    x: clamp(0.5 + Math.cos(angle) * radius * 0.5, 0, 1),
    y: clamp(0.5 + Math.sin(angle) * radius * 0.5, 0, 1),
    radius,
  };
}

function changedChannel(key: string): 'h' | 'c' | null {
  if (key === 'ArrowLeft' || key === 'ArrowRight') return 'h';
  if (key === 'ArrowUp' || key === 'ArrowDown') return 'c';
  return null;
}

function belowDelta(
  previous: { x: number; y: number } | null,
  next: { x: number; y: number },
  epsilon: number,
): boolean {
  if (!previous) return false;
  return (
    Math.abs(previous.x - next.x) <= epsilon &&
    Math.abs(previous.y - next.y) <= epsilon
  );
}

export interface ColorWheelProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  chromaRange?: [number, number];
  requested?: Color;
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
  source?: 'requested' | 'displayed';
  displayGamut?: GamutTarget;
  maxUpdateHz?: number;
  dragEpsilon?: number;
  hueStep?: number;
  shiftHueStep?: number;
  chromaStepRatio?: number;
  shiftChromaStepRatio?: number;
}

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
      const [min, max] = resolveChromaRange(chromaRange);
      return {
        minChroma: min,
        maxChroma: max,
      };
    }, [chromaRange]);
    const [isDragging, setIsDragging] = useState(false);
    const wheelRef = useRef<HTMLDivElement>(null);
    const activePointerIdRef = useRef<number | null>(null);
    const lastNormRef = useRef<{ x: number; y: number } | null>(null);
    const lastCommitTsRef = useRef(0);

    const gamut = displayGamut ?? contextActiveGamut;
    const rendered = useMemo(() => {
      if (source === 'requested') return requested;
      return gamut === 'display-p3'
        ? toP3Gamut(requested)
        : toSrgbGamut(requested);
    }, [gamut, requested, source]);

    const outOfGamut = useMemo(
      () =>
        gamut === 'display-p3'
          ? !inP3Gamut(requested)
          : !inSrgbGamut(requested),
      [gamut, requested],
    );

    const cssColor = useMemo(
      () =>
        source === 'requested'
          ? toCss(rendered, 'oklch')
          : toCss(rendered, gamut === 'display-p3' ? 'p3' : 'rgb'),
      [gamut, rendered, source],
    );

    const { x, y, radius } = thumbPosition(requested, [minChroma, maxChroma]);

    const updateFromPointer = useCallback(
      (clientX: number, clientY: number, force: boolean) => {
        const element = wheelRef.current;
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const norm = normalizePointer(clientX, clientY, rect);
        const epsilon = dragEpsilon >= 0 ? dragEpsilon : 0.0005;
        if (!force && belowDelta(lastNormRef.current, norm, epsilon)) {
          return;
        }

        const now =
          typeof performance === 'undefined' ? Date.now() : performance.now();
        const safeMaxHz =
          Number.isFinite(maxUpdateHz) && maxUpdateHz > 0 ? maxUpdateHz : 60;
        const minDeltaMs = 1000 / safeMaxHz;
        if (
          !force &&
          lastCommitTsRef.current > 0 &&
          now < lastCommitTsRef.current + minDeltaMs
        ) {
          return;
        }

        lastNormRef.current = norm;
        lastCommitTsRef.current = now;
        setRequested(
          colorFromPosition(requested, norm.x, norm.y, [minChroma, maxChroma]),
          {
            interaction: 'pointer',
          },
        );
      },
      [dragEpsilon, maxChroma, maxUpdateHz, minChroma, requested, setRequested],
    );

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        if (event.defaultPrevented) return;

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
        if (event.pointerId !== activePointerIdRef.current) return;
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
        if (event.defaultPrevented) return;

        const next = colorFromKey(
          requested,
          event.key,
          event.shiftKey ? shiftHueStep : hueStep,
          event.shiftKey ? shiftChromaStepRatio : chromaStepRatio,
          [minChroma, maxChroma],
        );
        if (!next) return;

        event.preventDefault();
        const channel = changedChannel(event.key);
        setRequested(next, {
          interaction: 'keyboard',
          changedChannel: channel ?? undefined,
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
      '--ck-color-wheel-current': cssColor,
      ...style,
    } as CSSProperties;

    return (
      <div
        {...props}
        ref={(node) => {
          wheelRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        data-color-wheel=""
        data-source={source}
        data-gamut={gamut}
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
          data-x={x.toFixed(4)}
          data-y={y.toFixed(4)}
          data-radius={radius.toFixed(4)}
          style={{
            position: 'absolute',
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
        {props.children}
      </div>
    );
  },
);
