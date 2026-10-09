import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefCallback,
} from 'react';
import type { GamutTarget } from '@color-kit/core';
import { useColorStoreSelector } from './color-store.js';
import { useOptionalColorContext } from './context.js';
import {
  BENCHMARK_SELECTED_COLOR_PLANE_RENDERER,
  createWebglState,
  destroyWebglState,
  drawWithCanvas2d,
  drawWithWebgl,
  planeSeedFromColor,
  renderPlanePixels,
  resolutionMultiplier,
  WEBGL_CONTEXT_ATTRIBUTES,
  type ActiveColorPlaneRenderer,
  type CanvasContextKind,
  type ColorPlaneEdgeBehavior,
  type ColorPlaneSource,
  type WebglState,
} from './color-plane-raster.js';
import { useStablePlane, type ColorPlaneSpec } from './plane-spec.js';
import type {
  ColorPlanePerformanceProfile,
  ColorPlaneQualityLevel,
} from './use-adaptive-quality.js';

export type {
  ActiveColorPlaneRenderer,
  ColorPlaneEdgeBehavior,
  ColorPlaneSource,
} from './color-plane-raster.js';

/**
 * Rasterizer for {@link useColorPlaneRenderer}: `'gpu'` (WebGL), `'cpu'`
 * (2D canvas), or `'auto'` (WebGL with a CPU fallback).
 */
export type ColorPlaneRenderer = 'auto' | 'gpu' | 'cpu';

/** Options for {@link useColorPlaneRenderer}. */
export interface UseColorPlaneRendererOptions {
  /**
   * Paint the gamut-mapped `displayed` colors or the raw `requested` colors.
   * @defaultValue 'displayed'
   */
  source?: ColorPlaneSource;
  /**
   * Gamut the displayed pixels are mapped into. Defaults to the active gamut
   * of the nearest `<Color>` provider, or `'display-p3'` without one.
   */
  displayGamut?: GamutTarget;
  /**
   * Rasterizer. `'auto'` uses WebGL and falls back to the CPU renderer when
   * WebGL is unavailable, fails to set up, or loses its context.
   * @defaultValue 'auto'
   */
  renderer?: ColorPlaneRenderer;
  /**
   * Out-of-gamut behavior for displayed source pixels: `'clamp'` maps them
   * to the nearest in-gamut color, `'transparent'` leaves them transparent.
   * @defaultValue 'clamp'
   */
  edgeBehavior?: ColorPlaneEdgeBehavior;
  /**
   * Extra backing-store scale factor beyond the device pixel ratio
   * (non-positive or non-finite values count as 1). The effective scale,
   * including the quality multiplier, is clamped to [0.35, 2.5].
   * @defaultValue 1
   */
  resolutionScale?: number;
  /**
   * Detail level; lower levels render fewer pixels. Pass
   * {@link useAdaptiveQuality}'s `quality` to adapt it to frame cost.
   * @defaultValue 'high'
   */
  quality?: ColorPlaneQualityLevel;
  /**
   * Profile the resolution multiplier is read from.
   * @defaultValue 'auto'
   */
  performanceProfile?: ColorPlanePerformanceProfile;
  /**
   * Whether the plane is being dragged; renders slightly fewer pixels while
   * true.
   * @defaultValue false
   */
  isDragging?: boolean;
}

/**
 * Return value of {@link useColorPlaneRenderer}. Destructure it: passing
 * `handle.ref` straight to JSX makes the React Compiler treat the whole
 * handle as a ref, so reading `handle.renderer` in render is flagged.
 */
export interface ColorPlaneRendererHandle {
  /** Callback ref for the `<canvas>` element; stable across renders. */
  ref: RefCallback<HTMLCanvasElement>;
  /**
   * Pass as the canvas `key`. A canvas is locked to the first context kind
   * requested from it, so switching between WebGL and the CPU fallback
   * needs a fresh element; the hook bumps this value when it does.
   */
  canvasKey: number;
  /** Rasterizer currently painting the canvas. */
  renderer: ActiveColorPlaneRenderer;
  /** Resolved out-of-gamut behavior. */
  edgeBehavior: ColorPlaneEdgeBehavior;
}

let warnedMissingCanvasKey = false;

/**
 * Rasterizes a color plane into a `<canvas>` you render: every pixel is the
 * plane's color with the two axis channels set to that position.
 *
 * The hook owns no DOM. Attach `ref` and `canvasKey` to a canvas, size it
 * with CSS, and the hook keeps its backing store at the CSS size × device
 * pixel ratio × `resolutionScale` (scaled down at lower `quality`), redrawing
 * on resize and when the plane changes. It renders with WebGL by default and
 * falls back to a CPU renderer when WebGL is unavailable or its context is
 * lost, returning to WebGL once the context is restored; GPU resources are
 * freed on unmount. Redraws are coalesced to one per animation frame and
 * skipped when nothing that affects the pixels changed (moving along an axis
 * channel does not repaint). With the default `source: 'displayed'`, pixels
 * are mapped into the display gamut and `edgeBehavior` decides whether
 * out-of-gamut pixels clamp or turn transparent.
 *
 * @param plane - Color and axes of the plane.
 * @param options - Rendering options; see {@link UseColorPlaneRendererOptions}.
 * @returns A {@link ColorPlaneRendererHandle} to spread onto the canvas.
 * @throws {Error} When both axes use the same channel.
 *
 * @example
 * ```tsx
 * import { useColor, useColorPlaneRenderer } from 'color-kit/react';
 *
 * export function Plane() {
 *   const { requested } = useColor({ defaultColor: '#3b82f6' });
 *   const { ref, canvasKey } = useColorPlaneRenderer(
 *     { color: requested, axes: { x: { channel: 'l' }, y: { channel: 'c' } } },
 *     { displayGamut: 'srgb', edgeBehavior: 'transparent' },
 *   );
 *   return <canvas ref={ref} key={canvasKey} style={{ width: 240, height: 160 }} />;
 * }
 * ```
 */
export function useColorPlaneRenderer(
  plane: ColorPlaneSpec,
  options: UseColorPlaneRendererOptions = {},
): ColorPlaneRendererHandle {
  const {
    source = 'displayed',
    displayGamut: displayGamutOption,
    renderer = 'auto',
    edgeBehavior,
    resolutionScale = 1,
    quality = 'high',
    performanceProfile = 'auto',
    isDragging = false,
  } = options;
  const { color, axes } = useStablePlane(plane);
  const colorContext = useOptionalColorContext();
  const contextDisplayGamut = useColorStoreSelector(
    colorContext?.store ?? null,
    (state) => state?.activeGamut ?? 'display-p3',
  );
  const displayGamut = displayGamutOption ?? contextDisplayGamut;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null);
  // Stable callback ref: an inline ref is detached and reattached on every
  // commit, which would tear down the WebGL program on each drag frame.
  // Per-canvas resources live in effects keyed on `canvasNode` instead.
  const ref = useCallback<RefCallback<HTMLCanvasElement>>((node) => {
    canvasRef.current = node;
    setCanvasNode(node);
    return () => {
      canvasRef.current = null;
      setCanvasNode(null);
    };
  }, []);
  const webglStateRef = useRef<WebglState | null>(null);
  const gpuUnavailableRef = useRef(false);
  const lastRenderKeyRef = useRef<string | null>(null);
  /**
   * A canvas is locked to the first context kind requested from it, so the
   * cpu fallback cannot draw into a canvas that already holds a WebGL
   * context (and vice versa). Switching paths asks for a new element.
   */
  const canvasContextKindRef = useRef<CanvasContextKind>(null);
  const remountedFromRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  /** Canvas whose WebGL context is lost; cpu renders until it is restored. */
  const [lostCanvas, setLostCanvas] = useState<HTMLCanvasElement | null>(null);
  const [activeRenderer, setActiveRenderer] =
    useState<ActiveColorPlaneRenderer>(BENCHMARK_SELECTED_COLOR_PLANE_RENDERER);

  const resolvedRenderer: ActiveColorPlaneRenderer =
    renderer === 'auto' ? BENCHMARK_SELECTED_COLOR_PLANE_RENDERER : renderer;
  const resolvedEdgeBehavior: ColorPlaneEdgeBehavior =
    edgeBehavior === 'transparent' ? 'transparent' : 'clamp';

  const effectiveScale = useMemo(() => {
    const baseScale =
      Number.isFinite(resolutionScale) && resolutionScale > 0
        ? resolutionScale
        : 1;
    const profileScale = resolutionMultiplier(
      performanceProfile,
      quality,
      isDragging,
    );
    return Math.max(0.35, Math.min(2.5, baseScale * profileScale));
  }, [resolutionScale, performanceProfile, quality, isDragging]);

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
    };
  }, [effectiveScale]);

  const requestRemount = useCallback((canvas: HTMLCanvasElement) => {
    destroyWebglState(webglStateRef.current);
    webglStateRef.current = null;
    lastRenderKeyRef.current = null;
    remountedFromRef.current = canvas;
    setCanvasKey((key) => key + 1);
  }, []);

  const renderPlane = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const size = syncCanvasSize();
    if (!size) {
      return;
    }

    const planeSeed = planeSeedFromColor(color, axes);
    const renderKey = [
      size.width,
      size.height,
      source,
      displayGamut,
      resolvedRenderer,
      resolvedEdgeBehavior,
      axes.x.channel,
      axes.x.range[0],
      axes.x.range[1],
      axes.y.channel,
      axes.y.range[0],
      axes.y.range[1],
      planeSeed.l,
      planeSeed.c,
      planeSeed.h,
      planeSeed.alpha,
    ].join('|');

    if (lastRenderKeyRef.current === renderKey) {
      return;
    }

    const wantsGpu =
      resolvedRenderer === 'gpu' &&
      !gpuUnavailableRef.current &&
      lostCanvas === null;
    const requiredKind: CanvasContextKind = wantsGpu ? 'webgl' : '2d';
    if (
      canvasContextKindRef.current !== null &&
      canvasContextKindRef.current !== requiredKind
    ) {
      // The canvas is locked to the other context kind; render into a fresh
      // canvas element on the next pass.
      requestRemount(canvas);
      return;
    }
    lastRenderKeyRef.current = renderKey;

    if (wantsGpu) {
      if (!webglStateRef.current) {
        const gl = canvas.getContext('webgl', WEBGL_CONTEXT_ATTRIBUTES);
        if (gl) {
          canvasContextKindRef.current = 'webgl';
          webglStateRef.current = createWebglState(gl);
        }
      }

      if (
        webglStateRef.current &&
        drawWithWebgl(webglStateRef.current, {
          source,
          gamut: displayGamut,
          axes,
          seed: planeSeed,
          edgeBehavior: resolvedEdgeBehavior,
        })
      ) {
        setActiveRenderer('gpu');
        return;
      }

      gpuUnavailableRef.current = true;
      if (canvasContextKindRef.current === 'webgl') {
        requestRemount(canvas);
        return;
      }
    }

    const pixels = renderPlanePixels(
      size.width,
      size.height,
      planeSeed,
      source,
      displayGamut,
      axes,
      resolvedEdgeBehavior,
    );

    if (drawWithCanvas2d(canvas, pixels)) {
      canvasContextKindRef.current = '2d';
      setActiveRenderer('cpu');
    }
  }, [
    axes,
    color,
    displayGamut,
    lostCanvas,
    requestRemount,
    resolvedEdgeBehavior,
    resolvedRenderer,
    source,
    syncCanvasSize,
  ]);

  // Per-canvas lifecycle, keyed on the mounted element (not on renders):
  // reset render bookkeeping for a new canvas, watch for WebGL context loss,
  // and free GPU resources when the element goes away.
  useEffect(() => {
    if (!canvasNode) {
      return;
    }

    canvasContextKindRef.current = null;
    lastRenderKeyRef.current = null;

    const onContextLost = (event: Event) => {
      // Opt in to restoration; without this the context stays lost.
      event.preventDefault();
      // GPU resources died with the context.
      webglStateRef.current = null;
      lastRenderKeyRef.current = null;
      setLostCanvas(canvasNode);
    };

    canvasNode.addEventListener('webglcontextlost', onContextLost);
    return () => {
      canvasNode.removeEventListener('webglcontextlost', onContextLost);
      const state = webglStateRef.current;
      if (state && state.gl.canvas === canvasNode) {
        destroyWebglState(state);
        webglStateRef.current = null;
      }
    };
  }, [canvasNode]);

  // A remount request that did not produce a new element means the caller
  // dropped `canvasKey`; the fallback cannot paint into the locked canvas.
  // Ref callbacks run before effects, so `canvasRef` already holds the
  // element committed with the new key.
  useEffect(() => {
    const from = remountedFromRef.current;
    const current = canvasRef.current;
    if (!from || !current) {
      return;
    }
    remountedFromRef.current = null;
    if (from === current && !warnedMissingCanvasKey) {
      warnedMissingCanvasKey = true;
      console.warn(
        '[useColorPlaneRenderer] Pass `canvasKey` as the canvas `key` so the renderer can switch between WebGL and the CPU fallback.',
      );
    }
  }, [canvasKey]);

  // While the context is lost the plane renders through the cpu path on a
  // fresh canvas. Once the browser restores it, return to the gpu path.
  useEffect(() => {
    if (!lostCanvas) {
      return;
    }

    const onContextRestored = () => {
      gpuUnavailableRef.current = false;
      lastRenderKeyRef.current = null;
      setLostCanvas(null);
    };

    lostCanvas.addEventListener('webglcontextrestored', onContextRestored);
    return () => {
      lostCanvas.removeEventListener('webglcontextrestored', onContextRestored);
    };
  }, [lostCanvas]);

  useEffect(() => {
    if (!canvasNode) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      renderPlane();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [canvasNode, renderPlane]);

  useEffect(() => {
    if (!canvasNode || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncCanvasSize();
      renderPlane();
    });
    observer.observe(canvasNode);
    return () => {
      observer.disconnect();
    };
  }, [canvasNode, renderPlane, syncCanvasSize]);

  return useMemo(
    () => ({
      ref,
      canvasKey,
      renderer: activeRenderer,
      edgeBehavior: resolvedEdgeBehavior,
    }),
    [activeRenderer, canvasKey, ref, resolvedEdgeBehavior],
  );
}
