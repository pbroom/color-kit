import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CanvasHTMLAttributes,
} from 'react';
import { parse, toRgb } from '@color-kit/core';
import { colorFromColorAreaPosition } from './api/color-area.js';
import {
  clamp01,
  inP3Linear,
  inSrgbLinear,
  oklchToLinearSrgb,
} from './color-plane-gamut-utils.js';
import { useColorAreaContext } from './color-area-context.js';

interface NormalizedRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ResolvedOutOfGamutLayerConfig {
  outOfP3Fill: NormalizedRgba;
  outOfSrgbFill: NormalizedRgba;
  dotPattern: {
    opacity: number;
    size: number;
    gap: number;
  };
}

export interface OutOfGamutLayerProps extends Omit<
  CanvasHTMLAttributes<HTMLCanvasElement>,
  'onChange'
> {
  /**
   * Fill color for colors outside Display-P3.
   * @default '#1f1f1f'
   */
  outOfP3FillColor?: string;
  /**
   * Fill opacity for colors outside Display-P3.
   * @default 0
   */
  outOfP3FillOpacity?: number;
  /**
   * Fill color for colors inside P3 but outside sRGB.
   * @default '#1f1f1f'
   */
  outOfSrgbFillColor?: string;
  /**
   * Fill opacity for colors inside P3 but outside sRGB.
   * @default 0
   */
  outOfSrgbFillOpacity?: number;
  /**
   * Dot pattern opacity for out-of-gamut overlays.
   * @default 0
   */
  dotPatternOpacity?: number;
  /**
   * Dot pattern square size in pixels.
   * @default 2
   */
  dotPatternSize?: number;
  /**
   * Dot pattern gap in pixels.
   * @default 2
   */
  dotPatternGap?: number;
  /**
   * Extra backing-store scale factor beyond DPR. @default 1
   */
  resolutionScale?: number;
}

function parseColorToRgba(
  color: string | undefined,
  fallback: NormalizedRgba,
): NormalizedRgba {
  if (!color) {
    return fallback;
  }

  try {
    const rgb = toRgb(parse(color));
    return {
      r: clamp01(rgb.r / 255),
      g: clamp01(rgb.g / 255),
      b: clamp01(rgb.b / 255),
      a: clamp01(rgb.alpha),
    };
  } catch {
    return fallback;
  }
}

function resolveConfig(
  config: OutOfGamutLayerProps,
): ResolvedOutOfGamutLayerConfig {
  const p3Color = parseColorToRgba(config.outOfP3FillColor, {
    r: 31 / 255,
    g: 31 / 255,
    b: 31 / 255,
    a: 1,
  });
  const srgbColor = parseColorToRgba(config.outOfSrgbFillColor, {
    r: 31 / 255,
    g: 31 / 255,
    b: 31 / 255,
    a: 1,
  });

  return {
    outOfP3Fill: {
      ...p3Color,
      a: clamp01(config.outOfP3FillOpacity ?? 0),
    },
    outOfSrgbFill: {
      ...srgbColor,
      a: clamp01(config.outOfSrgbFillOpacity ?? 0),
    },
    dotPattern: {
      opacity: clamp01(config.dotPatternOpacity ?? 0),
      size: Math.max(1, config.dotPatternSize ?? 2),
      gap: Math.max(0, config.dotPatternGap ?? 2),
    },
  };
}

function renderPixels(
  width: number,
  height: number,
  base: Parameters<typeof colorFromColorAreaPosition>[0],
  axes: Parameters<typeof colorFromColorAreaPosition>[1],
  config: ResolvedOutOfGamutLayerConfig,
  scaleX: number,
  scaleY: number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  const dotCell = config.dotPattern.size + config.dotPattern.gap;
  const dotRadius = config.dotPattern.size * 0.5;
  const safeScaleX = Math.max(1e-6, scaleX);
  const safeScaleY = Math.max(1e-6, scaleY);

  for (let y = 0; y < height; y += 1) {
    const yNorm = height <= 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const xNorm = width <= 1 ? 0 : x / (width - 1);
      const sampled = colorFromColorAreaPosition(base, axes, xNorm, yNorm);
      const rawLinear = oklchToLinearSrgb(sampled.l, sampled.c, sampled.h);
      const outOfP3 = !inP3Linear(rawLinear);
      const outOfSrgb = !outOfP3 && !inSrgbLinear(rawLinear);

      const fillColor = outOfP3
        ? config.outOfP3Fill
        : outOfSrgb
          ? config.outOfSrgbFill
          : null;
      const fillAlpha = fillColor ? clamp01(sampled.alpha * fillColor.a) : 0;

      let alpha = fillAlpha;
      let premulR = fillColor ? fillColor.r * fillAlpha : 0;
      let premulG = fillColor ? fillColor.g * fillAlpha : 0;
      let premulB = fillColor ? fillColor.b * fillAlpha : 0;

      if (
        (outOfP3 || outOfSrgb) &&
        config.dotPattern.opacity > 0 &&
        dotCell > 0
      ) {
        const cssX = (x + 0.5) / safeScaleX;
        const cssY = (y + 0.5) / safeScaleY;
        const localX = cssX - Math.floor(cssX / dotCell) * dotCell;
        const localY = cssY - Math.floor(cssY / dotCell) * dotCell;
        const distanceSq =
          (localX - dotRadius) * (localX - dotRadius) +
          (localY - dotRadius) * (localY - dotRadius);
        if (distanceSq <= dotRadius * dotRadius) {
          const dotAlpha = clamp01(sampled.alpha * config.dotPattern.opacity);
          // Dot pattern is rendered above fill using source-over compositing.
          premulR = dotAlpha + premulR * (1 - dotAlpha);
          premulG = dotAlpha + premulG * (1 - dotAlpha);
          premulB = dotAlpha + premulB * (1 - dotAlpha);
          alpha = dotAlpha + alpha * (1 - dotAlpha);
        }
      }

      const offset = (y * width + x) * 4;
      if (alpha <= 0) {
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 0;
        continue;
      }

      data[offset] = Math.round(clamp01(premulR / alpha) * 255);
      data[offset + 1] = Math.round(clamp01(premulG / alpha) * 255);
      data[offset + 2] = Math.round(clamp01(premulB / alpha) * 255);
      data[offset + 3] = Math.round(clamp01(alpha) * 255);
    }
  }

  return data;
}

function resolutionMultiplier(
  profile: 'auto' | 'quality' | 'balanced' | 'performance',
  quality: 'high' | 'medium' | 'low',
  isDragging: boolean,
): number {
  if (profile === 'quality') {
    return isDragging ? 0.96 : 1;
  }

  if (profile === 'performance') {
    const base = quality === 'high' ? 0.82 : quality === 'medium' ? 0.7 : 0.56;
    return isDragging ? base * 0.92 : base;
  }

  if (profile === 'balanced') {
    const base = quality === 'high' ? 0.94 : quality === 'medium' ? 0.8 : 0.64;
    return isDragging ? base * 0.95 : base;
  }

  const base = quality === 'high' ? 1 : quality === 'medium' ? 0.82 : 0.66;
  return isDragging ? base * 0.95 : base;
}

/**
 * Dedicated raster layer for out-of-gamut fills and optional dot overlays.
 */
export const OutOfGamutLayer = forwardRef<
  HTMLCanvasElement,
  OutOfGamutLayerProps
>(function OutOfGamutLayer(
  {
    outOfP3FillColor,
    outOfP3FillOpacity,
    outOfSrgbFillColor,
    outOfSrgbFillOpacity,
    dotPatternOpacity,
    dotPatternSize,
    dotPatternGap,
    resolutionScale = 1,
    style,
    ...props
  },
  ref,
) {
  const { requested, axes, qualityLevel, performanceProfile, isDragging } =
    useColorAreaContext();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null);
  const lastRenderKeyRef = useRef<string | null>(null);

  const resolvedConfig = useMemo(
    () =>
      resolveConfig({
        outOfP3FillColor,
        outOfP3FillOpacity,
        outOfSrgbFillColor,
        outOfSrgbFillOpacity,
        dotPatternOpacity,
        dotPatternSize,
        dotPatternGap,
      }),
    [
      dotPatternGap,
      dotPatternOpacity,
      dotPatternSize,
      outOfP3FillColor,
      outOfP3FillOpacity,
      outOfSrgbFillColor,
      outOfSrgbFillOpacity,
    ],
  );

  const effectiveScale = useMemo(() => {
    const baseScale =
      Number.isFinite(resolutionScale) && resolutionScale > 0
        ? resolutionScale
        : 1;
    const profileScale = resolutionMultiplier(
      performanceProfile,
      qualityLevel,
      isDragging,
    );
    return Math.max(0.35, Math.min(2.5, baseScale * profileScale));
  }, [resolutionScale, performanceProfile, qualityLevel, isDragging]);

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const dpr =
      typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const scaledWidth = Math.max(
      1,
      Math.round(rect.width * dpr * effectiveScale),
    );
    const scaledHeight = Math.max(
      1,
      Math.round(rect.height * dpr * effectiveScale),
    );

    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      lastRenderKeyRef.current = null;
    }

    return {
      width: scaledWidth,
      height: scaledHeight,
      cssWidth: rect.width,
      cssHeight: rect.height,
    };
  }, [effectiveScale]);

  const renderLayer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const size = syncCanvasSize();
    if (!size) {
      return;
    }

    const renderKey = [
      size.width,
      size.height,
      axes.x.channel,
      axes.x.range[0],
      axes.x.range[1],
      axes.y.channel,
      axes.y.range[0],
      axes.y.range[1],
      requested.l,
      requested.c,
      requested.h,
      requested.alpha,
      resolvedConfig.outOfP3Fill.r,
      resolvedConfig.outOfP3Fill.g,
      resolvedConfig.outOfP3Fill.b,
      resolvedConfig.outOfP3Fill.a,
      resolvedConfig.outOfSrgbFill.r,
      resolvedConfig.outOfSrgbFill.g,
      resolvedConfig.outOfSrgbFill.b,
      resolvedConfig.outOfSrgbFill.a,
      resolvedConfig.dotPattern.opacity,
      resolvedConfig.dotPattern.size,
      resolvedConfig.dotPattern.gap,
    ].join('|');
    if (lastRenderKeyRef.current === renderKey) {
      return;
    }
    lastRenderKeyRef.current = renderKey;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const base = {
      l: axes.x.channel === 'l' || axes.y.channel === 'l' ? 0 : requested.l,
      c: axes.x.channel === 'c' || axes.y.channel === 'c' ? 0 : requested.c,
      h: axes.x.channel === 'h' || axes.y.channel === 'h' ? 0 : requested.h,
      alpha: requested.alpha,
    };
    const scaleX = size.cssWidth > 0 ? size.width / size.cssWidth : size.width;
    const scaleY =
      size.cssHeight > 0 ? size.height / size.cssHeight : size.height;
    const pixels = renderPixels(
      size.width,
      size.height,
      base,
      axes,
      resolvedConfig,
      scaleX,
      scaleY,
    );
    const imageData = ctx.createImageData(size.width, size.height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }, [axes, requested, resolvedConfig, syncCanvasSize]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      renderLayer();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [renderLayer]);

  useEffect(() => {
    if (!canvasNode || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncCanvasSize();
      renderLayer();
    });
    observer.observe(canvasNode);
    return () => {
      observer.disconnect();
    };
  }, [canvasNode, renderLayer, syncCanvasSize]);

  return (
    <canvas
      {...props}
      ref={(node) => {
        if (canvasRef.current !== node) {
          lastRenderKeyRef.current = null;
        }
        canvasRef.current = node;
        setCanvasNode(node);
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      data-color-area-out-of-gamut-layer=""
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
});
