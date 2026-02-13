'use client';

import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CanvasHTMLAttributes,
  type HTMLAttributes,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type SVGAttributes,
} from 'react';
import type { Color } from '@color-kit/core';
import {
  clamp,
  contrastRegionPaths,
  gamutBoundaryPath,
  toP3Gamut,
  toRgb,
  toSrgbGamut,
  type ContrastRegionLevel,
  type GamutTarget,
} from '@color-kit/core';
import { useOptionalColorContext } from '@/hooks/color-context';
import type { SetRequestedOptions } from '@/hooks/use-color';

export type ColorAreaChannel = 'l' | 'c' | 'h';
export type ColorAreaKey = 'ArrowRight' | 'ArrowLeft' | 'ArrowUp' | 'ArrowDown';

export interface ColorAreaAxis {
  channel: ColorAreaChannel;
  range?: [number, number];
}

export interface ColorAreaAxes {
  x: ColorAreaAxis;
  y: ColorAreaAxis;
}

interface ResolvedColorAreaAxis {
  channel: ColorAreaChannel;
  range: [number, number];
}

interface ResolvedColorAreaAxes {
  x: ResolvedColorAreaAxis;
  y: ResolvedColorAreaAxis;
}

const DEFAULT_RANGES: Record<ColorAreaChannel, [number, number]> = {
  l: [0, 1],
  c: [0, 0.4],
  h: [0, 360],
};

const DEFAULT_AXES: ResolvedColorAreaAxes = {
  x: { channel: 'l', range: DEFAULT_RANGES.l },
  y: { channel: 'c', range: DEFAULT_RANGES.c },
};

function resolveAxes(axes?: ColorAreaAxes): ResolvedColorAreaAxes {
  const next = axes ?? DEFAULT_AXES;
  return {
    x: {
      channel: next.x.channel,
      range: next.x.range ?? DEFAULT_RANGES[next.x.channel],
    },
    y: {
      channel: next.y.channel,
      range: next.y.range ?? DEFAULT_RANGES[next.y.channel],
    },
  };
}

function areAxesDistinct(axes: ResolvedColorAreaAxes): boolean {
  return axes.x.channel !== axes.y.channel;
}

function normalize(value: number, range: [number, number]): number {
  return clamp((value - range[0]) / (range[1] - range[0]), 0, 1);
}

function getThumbPosition(color: Color, axes: ResolvedColorAreaAxes) {
  return {
    x: normalize(color[axes.x.channel], axes.x.range),
    y: 1 - normalize(color[axes.y.channel], axes.y.range),
  };
}

function colorFromPosition(
  color: Color,
  axes: ResolvedColorAreaAxes,
  xNorm: number,
  yNorm: number,
): Color {
  const x = clamp(xNorm, 0, 1);
  const y = clamp(yNorm, 0, 1);

  const xRange = axes.x.range;
  const yRange = axes.y.range;

  const xValue = xRange[0] + x * (xRange[1] - xRange[0]);
  const yValue = yRange[0] + (1 - y) * (yRange[1] - yRange[0]);

  return {
    ...color,
    [axes.x.channel]: xValue,
    [axes.y.channel]: yValue,
  };
}

function colorFromKey(
  color: Color,
  axes: ResolvedColorAreaAxes,
  key: string,
  stepRatio: number,
): Color | null {
  const xRange = axes.x.range;
  const yRange = axes.y.range;
  const xStep = stepRatio * (xRange[1] - xRange[0]);
  const yStep = stepRatio * (yRange[1] - yRange[0]);

  switch (key as ColorAreaKey) {
    case 'ArrowRight':
      return {
        ...color,
        [axes.x.channel]: clamp(
          color[axes.x.channel] + xStep,
          xRange[0],
          xRange[1],
        ),
      };
    case 'ArrowLeft':
      return {
        ...color,
        [axes.x.channel]: clamp(
          color[axes.x.channel] - xStep,
          xRange[0],
          xRange[1],
        ),
      };
    case 'ArrowUp':
      return {
        ...color,
        [axes.y.channel]: clamp(
          color[axes.y.channel] + yStep,
          yRange[0],
          yRange[1],
        ),
      };
    case 'ArrowDown':
      return {
        ...color,
        [axes.y.channel]: clamp(
          color[axes.y.channel] - yStep,
          yRange[0],
          yRange[1],
        ),
      };
    default:
      return null;
  }
}

function usesLightnessAndChroma(axes: ResolvedColorAreaAxes): boolean {
  return (
    (axes.x.channel === 'l' && axes.y.channel === 'c') ||
    (axes.x.channel === 'c' && axes.y.channel === 'l')
  );
}

function gamutBoundaryPoints(
  hue: number,
  axes: ResolvedColorAreaAxes,
  options: { gamut?: GamutTarget; steps?: number } = {},
) {
  if (!usesLightnessAndChroma(axes)) {
    return [];
  }

  const boundary = gamutBoundaryPath(hue, {
    gamut: options.gamut ?? 'srgb',
    steps: options.steps,
  });

  return boundary.map((point) => {
    const position = getThumbPosition(
      { l: point.l, c: point.c, h: hue, alpha: 1 },
      axes,
    );

    return {
      ...point,
      x: position.x,
      y: position.y,
    };
  });
}

function contrastPaths(
  reference: Color,
  hue: number,
  axes: ResolvedColorAreaAxes,
  options: {
    gamut?: GamutTarget;
    level?: ContrastRegionLevel;
    threshold?: number;
    lightnessSteps?: number;
    chromaSteps?: number;
    maxChroma?: number;
    tolerance?: number;
    maxIterations?: number;
    alpha?: number;
  } = {},
) {
  if (!usesLightnessAndChroma(axes)) {
    return [];
  }

  return contrastRegionPaths(reference, hue, options).map((path) =>
    path.map((point) => {
      const position = getThumbPosition(
        { l: point.l, c: point.c, h: hue, alpha: 1 },
        axes,
      );

      return {
        ...point,
        x: position.x,
        y: position.y,
      };
    }),
  );
}

interface AreaContextValue {
  areaRef: MutableRefObject<HTMLDivElement | null>;
  requested: Color;
  setRequested: (requested: Color, options?: SetRequestedOptions) => void;
  axes: ResolvedColorAreaAxes;
}

const AreaContext = createContext<AreaContextValue | null>(null);

function useAreaContext(): AreaContextValue {
  const context = useContext(AreaContext);
  if (!context) {
    throw new Error('ColorArea primitives must be used inside <ColorArea>.');
  }
  return context;
}

function isProductionEnvironment(): boolean {
  const maybeProcess = (
    globalThis as { process?: { env?: { NODE_ENV?: string } } }
  ).process;
  return maybeProcess?.env?.NODE_ENV === 'production';
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

    return cloneElement(
      child as ReactElement<{ children?: ReactNode }>,
      undefined,
      pruneExtraThumbs(nestedChildren, state),
    );
  });
}

export interface ColorAreaProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  axes?: ColorAreaAxes;
  requested?: Color;
  onChangeRequested?: (requested: Color, options?: SetRequestedOptions) => void;
}

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
      children,
      style,
      ...props
    },
    ref,
  ) {
    const colorContext = useOptionalColorContext();

    const requested = requestedProp ?? colorContext?.requested;
    const setRequested = onChangeRequestedProp ?? colorContext?.setRequested;

    if (!requested || !setRequested) {
      throw new Error(
        'ColorArea requires either a <ColorProvider> ancestor or explicit requested/onChangeRequested props.',
      );
    }

    const areaRef = useRef<HTMLDivElement>(null);
    const warnedMultiThumbRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);

    const resolvedAxes = useMemo(() => {
      const next = resolveAxes(axes);
      if (areAxesDistinct(next)) {
        return next;
      }

      if (!isProductionEnvironment()) {
        throw new Error('ColorArea requires distinct axis channels.');
      }

      return {
        ...next,
        y: {
          channel: next.x.channel === 'l' ? 'c' : 'l',
          range: next.y.range,
        },
      };
    }, [axes]);

    const updateFromPosition = useCallback(
      (clientX: number, clientY: number) => {
        const element = areaRef.current;
        if (!element) {
          return;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }

        const xNorm = (clientX - rect.left) / rect.width;
        const yNorm = (clientY - rect.top) / rect.height;

        setRequested(colorFromPosition(requested, resolvedAxes, xNorm, yNorm), {
          interaction: 'pointer',
        });
      },
      [requested, resolvedAxes, setRequested],
    );

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        setIsDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPosition(event.clientX, event.clientY);
      },
      [onPointerDown, updateFromPosition],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerMove?.(event);
        if (event.defaultPrevented || !isDragging) {
          return;
        }

        updateFromPosition(event.clientX, event.clientY);
      },
      [onPointerMove, isDragging, updateFromPosition],
    );

    const explicitThumbCount = useMemo(() => countThumbs(children), [children]);
    if (explicitThumbCount > 1 && !isProductionEnvironment()) {
      throw new Error('ColorArea allows only one <Thumb /> child.');
    }
    useEffect(() => {
      if (explicitThumbCount <= 1 || warnedMultiThumbRef.current) {
        return;
      }
      warnedMultiThumbRef.current = true;
      console.warn(
        'ColorArea allows one <Thumb />. Extra thumbs were ignored.',
      );
    }, [explicitThumbCount]);
    const resolvedChildren: ReactNode = useMemo(
      () =>
        explicitThumbCount > 1
          ? pruneExtraThumbs(children, { seenThumb: false })
          : children,
      [children, explicitThumbCount],
    );

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
      <AreaContext.Provider value={contextValue}>
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => {
            onPointerUp?.(event);
            setIsDragging(false);
          }}
          onPointerCancel={(event) => {
            onPointerCancel?.(event);
            setIsDragging(false);
          }}
          style={{
            position: 'relative',
            touchAction: 'none',
            ...style,
          }}
        >
          {resolvedChildren}
          {explicitThumbCount === 0 ? <Thumb /> : null}
        </div>
      </AreaContext.Provider>
    );
  },
);

export interface ThumbProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  stepRatio?: number;
  shiftStepRatio?: number;
}

export const Thumb = forwardRef<HTMLDivElement, ThumbProps>(function Thumb(
  {
    stepRatio = 0.01,
    shiftStepRatio = 0.1,
    onKeyDown,
    style,
    children,
    ...props
  },
  ref,
) {
  const { requested, setRequested, axes } = useAreaContext();
  const { x, y } = getThumbPosition(requested, axes);

  return (
    <div
      {...props}
      ref={ref}
      data-color-area-thumb=""
      data-x={x.toFixed(4)}
      data-y={y.toFixed(4)}
      role={props.role ?? 'slider'}
      aria-label={props['aria-label'] ?? 'Color area'}
      aria-valuetext={
        props['aria-valuetext'] ??
        `${axes.x.channel}: ${requested[axes.x.channel].toFixed(4)}, ${axes.y.channel}: ${requested[
          axes.y.channel
        ].toFixed(4)}`
      }
      tabIndex={props.tabIndex ?? 0}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) {
          return;
        }

        const next = colorFromKey(
          requested,
          axes,
          event.key,
          event.shiftKey ? shiftStepRatio : stepRatio,
        );

        if (!next) {
          return;
        }

        event.preventDefault();
        setRequested(next, { interaction: 'keyboard' });
      }}
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: 'translate(-50%, -50%)',
        touchAction: 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
});

export type LayerKind =
  | 'background'
  | 'plane'
  | 'overlay'
  | 'annotation'
  | 'ui';

export interface LayerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  kind?: LayerKind;
  zIndex?: number;
  interactive?: boolean;
}

export const Layer = forwardRef<HTMLDivElement, LayerProps>(function Layer(
  { kind = 'overlay', zIndex, interactive = false, style, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      data-color-area-layer=""
      data-layer-kind={kind}
      data-layer-interactive={interactive || undefined}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex,
        pointerEvents: interactive ? 'auto' : 'none',
        ...style,
      }}
    />
  );
});

export interface BackgroundProps extends Omit<LayerProps, 'kind'> {
  checkerboard?: boolean;
  checkerSize?: number;
}

export const Background = forwardRef<HTMLDivElement, BackgroundProps>(
  function Background(
    { checkerboard = false, checkerSize = 12, style, ...props },
    ref,
  ) {
    const checkerStyle = checkerboard
      ? {
          backgroundImage:
            'linear-gradient(45deg, rgba(0, 0, 0, 0.22) 25%, transparent 25%), linear-gradient(-45deg, rgba(0, 0, 0, 0.22) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0, 0, 0, 0.22) 75%), linear-gradient(-45deg, transparent 75%, rgba(0, 0, 0, 0.22) 75%)',
          backgroundSize: `${checkerSize}px ${checkerSize}px`,
          backgroundPosition: `0 0, 0 ${checkerSize / 2}px, ${checkerSize / 2}px -${checkerSize / 2}px, -${checkerSize / 2}px 0`,
        }
      : undefined;

    return (
      <Layer
        {...props}
        ref={ref}
        kind="background"
        interactive={false}
        data-color-area-background=""
        style={{
          ...checkerStyle,
          ...style,
        }}
      />
    );
  },
);

export interface ColorPlaneProps extends Omit<
  CanvasHTMLAttributes<HTMLCanvasElement>,
  'onChange'
> {
  source?: 'requested' | 'displayed';
  displayGamut?: GamutTarget;
}

export const ColorPlane = forwardRef<HTMLCanvasElement, ColorPlaneProps>(
  function ColorPlane(
    { source = 'displayed', displayGamut: displayGamutProp, style, ...props },
    ref,
  ) {
    const { requested, axes } = useAreaContext();
    const colorContext = useOptionalColorContext();
    const displayGamut =
      displayGamutProp ?? colorContext?.activeGamut ?? 'display-p3';
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const base = useMemo(() => {
      const next = { ...requested };
      next[axes.x.channel] = 0;
      next[axes.y.channel] = 0;
      return next;
    }, [requested, axes]);

    const renderPlane = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const dpr =
        typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      const imageData = context.createImageData(width, height);
      const data = imageData.data;

      for (let y = 0; y < height; y += 1) {
        const yNorm = height <= 1 ? 0 : y / (height - 1);
        for (let x = 0; x < width; x += 1) {
          const xNorm = width <= 1 ? 0 : x / (width - 1);
          const sampled = colorFromPosition(base, axes, xNorm, yNorm);
          const mapped =
            source === 'requested'
              ? sampled
              : displayGamut === 'display-p3'
                ? toP3Gamut(sampled)
                : toSrgbGamut(sampled);
          const rgb = toRgb(mapped);

          const offset = (y * width + x) * 4;
          data[offset] = Math.round(rgb.r);
          data[offset + 1] = Math.round(rgb.g);
          data[offset + 2] = Math.round(rgb.b);
          data[offset + 3] = Math.round((rgb.alpha ?? mapped.alpha) * 255);
        }
      }

      context.putImageData(imageData, 0, 0);
    }, [axes, base, displayGamut, source]);

    return (
      <canvas
        {...props}
        ref={(node) => {
          canvasRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }

          if (node) {
            renderPlane();
          }
        }}
        data-color-area-plane=""
        data-source={source}
        data-renderer="canvas2d"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          ...style,
        }}
      />
    );
  },
);

export interface PointProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  x: number;
  y: number;
}

export const Point = forwardRef<HTMLDivElement, PointProps>(function Point(
  { x, y, style, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      data-color-area-point=""
      data-x={x.toFixed(4)}
      data-y={y.toFixed(4)}
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: 'translate(-50%, -50%)',
        ...style,
      }}
    />
  );
});

export interface LineProps extends Omit<
  SVGAttributes<SVGSVGElement>,
  'children'
> {
  points?: Array<{ x: number; y: number }>;
  d?: string;
  pathProps?: SVGAttributes<SVGPathElement>;
}

function toPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) {
    return '';
  }

  return points
    .map((point, index) => {
      const x = (point.x * 100).toFixed(3);
      const y = (point.y * 100).toFixed(3);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

export const Line = forwardRef<SVGSVGElement, LineProps>(function Line(
  { points, d, pathProps, viewBox = '0 0 100 100', style, ...props },
  ref,
) {
  const path = d ?? (points ? toPath(points) : '');
  if (!path) {
    return null;
  }

  return (
    <svg
      {...props}
      ref={ref}
      data-color-area-line=""
      viewBox={viewBox}
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <path d={path} {...pathProps} />
    </svg>
  );
});

export interface GamutBoundaryLayerProps extends Omit<LayerProps, 'children'> {
  gamut?: GamutTarget;
  hue?: number;
  steps?: number;
  pathProps?: SVGAttributes<SVGPathElement>;
}

export function GamutBoundaryLayer({
  gamut = 'srgb',
  hue,
  steps = 48,
  pathProps,
  ...props
}: GamutBoundaryLayerProps) {
  const { requested, axes } = useAreaContext();
  const points = useMemo(
    () => gamutBoundaryPoints(hue ?? requested.h, axes, { gamut, steps }),
    [hue, requested.h, axes, gamut, steps],
  );

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-gamut-boundary-layer=""
    >
      <Line points={points} pathProps={{ fill: 'none', ...pathProps }} />
    </Layer>
  );
}

export interface ContrastRegionLayerProps extends Omit<LayerProps, 'children'> {
  reference?: Color;
  hue?: number;
  gamut?: GamutTarget;
  threshold?: number;
  level?: ContrastRegionLevel;
  lightnessSteps?: number;
  chromaSteps?: number;
  maxChroma?: number;
  tolerance?: number;
  maxIterations?: number;
  alpha?: number;
  pathProps?: SVGAttributes<SVGPathElement>;
}

export function ContrastRegionLayer({
  reference,
  hue,
  gamut = 'srgb',
  threshold,
  level,
  lightnessSteps,
  chromaSteps,
  maxChroma,
  tolerance,
  maxIterations,
  alpha,
  pathProps,
  ...props
}: ContrastRegionLayerProps) {
  const { requested, axes } = useAreaContext();
  const paths = useMemo(
    () =>
      contrastPaths(reference ?? requested, hue ?? requested.h, axes, {
        gamut,
        threshold,
        level,
        lightnessSteps,
        chromaSteps,
        maxChroma,
        tolerance,
        maxIterations,
        alpha,
      }),
    [
      reference,
      requested,
      hue,
      axes,
      gamut,
      threshold,
      level,
      lightnessSteps,
      chromaSteps,
      maxChroma,
      tolerance,
      maxIterations,
      alpha,
    ],
  );

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'overlay'}
      interactive={props.interactive ?? false}
      data-color-area-contrast-region-layer=""
    >
      {paths.map((points, index) => (
        <Line
          key={index}
          points={points}
          pathProps={{ fill: 'none', ...pathProps }}
        />
      ))}
    </Layer>
  );
}

export interface FallbackPointsLayerProps extends Omit<LayerProps, 'children'> {
  showSrgb?: boolean;
  showP3?: boolean;
  srgbPointProps?: Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;
  p3PointProps?: Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;
}

export function FallbackPointsLayer({
  showSrgb = true,
  showP3 = true,
  srgbPointProps,
  p3PointProps,
  ...props
}: FallbackPointsLayerProps) {
  const { requested, axes } = useAreaContext();

  const srgb = useMemo(() => toSrgbGamut(requested), [requested]);
  const p3 = useMemo(() => toP3Gamut(requested), [requested]);

  const srgbPos = getThumbPosition(srgb, axes);
  const p3Pos = getThumbPosition(p3, axes);

  return (
    <Layer
      {...props}
      kind={props.kind ?? 'annotation'}
      interactive={props.interactive ?? false}
      data-color-area-fallback-points-layer=""
    >
      {showP3 ? (
        <Point
          {...p3PointProps}
          x={p3Pos.x}
          y={p3Pos.y}
          data-color-area-fallback-point=""
          data-gamut="display-p3"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: '#40f5d2',
            border: '1px solid rgba(0,0,0,0.6)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.55)',
            pointerEvents: 'none',
            ...p3PointProps?.style,
          }}
        />
      ) : null}
      {showSrgb ? (
        <Point
          {...srgbPointProps}
          x={srgbPos.x}
          y={srgbPos.y}
          data-color-area-fallback-point=""
          data-gamut="srgb"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: '#ffd447',
            border: '1px solid rgba(0,0,0,0.65)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.55)',
            pointerEvents: 'none',
            ...srgbPointProps?.style,
          }}
        />
      ) : null}
    </Layer>
  );
}
