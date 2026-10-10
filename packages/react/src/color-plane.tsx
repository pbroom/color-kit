import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CanvasHTMLAttributes,
} from 'react';
import { assignRef } from './assign-ref.js';
import { useColorStoreSelector } from './color-store.js';
import {
  linearToSrgbChannel,
  type Color,
  type GamutTarget,
} from '@color-kit/core';
import { colorFromColorAreaPosition } from '@color-kit/driver';
import {
  COLOR_PLANE_FRAGMENT_SHADER_SOURCE,
  COLOR_PLANE_VERTEX_SHADER_SOURCE,
} from './color-plane-shaders.js';
import {
  clamp01,
  inP3Linear,
  inSrgbLinear,
  mapToGamutLinear,
  oklchToLinearSrgb,
} from './color-plane-gamut-utils.js';
import { useColorAreaContext } from './color-area-context.js';
import { useOptionalColorContext } from './context.js';

/**
 * Which colors a {@link ColorPlane} paints: the raw `requested` plane colors
 * (each channel clipped to sRGB) or the `displayed` colors for the display
 * gamut.
 */
export type ColorPlaneSource = 'requested' | 'displayed';
/**
 * {@link ColorPlane} rasterizer: `'gpu'` (WebGL), `'cpu'` (2D canvas), or
 * `'auto'` (WebGL with a CPU fallback). `'canvas2d'` is a deprecated alias
 * of `'cpu'`.
 */
export type ColorPlaneRenderer = 'auto' | 'gpu' | 'cpu' | 'canvas2d';
/** How a `displayed` {@link ColorPlane} paints colors outside the display gamut. */
export type ColorPlaneEdgeBehavior = 'transparent' | 'clamp';

type ActiveColorPlaneRenderer = 'gpu' | 'cpu';
type ResolvedColorPlaneRenderer = 'gpu' | 'cpu';

let warnedCanvasAlias = false;

export const BENCHMARK_SELECTED_COLOR_PLANE_RENDERER: ActiveColorPlaneRenderer =
  'gpu';

/** Props for {@link ColorPlane}; other `canvas` attributes are forwarded. */
export interface ColorPlaneProps extends Omit<
  CanvasHTMLAttributes<HTMLCanvasElement>,
  'onChange'
> {
  /**
   * Paint the gamut-mapped `displayed` colors or the raw `requested` colors.
   * @defaultValue 'displayed'
   */
  source?: ColorPlaneSource;
  /**
   * Gamut the displayed pixels are mapped into. Defaults to the provider's
   * active gamut, or `'display-p3'` without a `<Color>` provider.
   */
  displayGamut?: GamutTarget;
  /**
   * Rasterizer. `'auto'` uses WebGL and falls back to the CPU renderer when
   * WebGL is unavailable or its context is lost.
   * @defaultValue 'auto'
   */
  renderer?: ColorPlaneRenderer;
  /**
   * Out-of-gamut behavior for displayed source pixels.
   * - 'transparent': keep out-of-gamut pixels transparent.
   * - 'clamp': clamp out-of-gamut pixels to the nearest in-gamut edge.
   * @defaultValue 'clamp'
   */
  edgeBehavior?: ColorPlaneEdgeBehavior;
  /**
   * Extra backing-store scale factor beyond DPR (non-positive or non-finite
   * values count as 1). The effective scale, including the performance
   * profile's multiplier, is clamped to [0.35, 2.5].
   * @defaultValue 1
   */
  resolutionScale?: number;
}

interface WebglUniforms {
  seed: WebGLUniformLocation;
  xRange: WebGLUniformLocation;
  yRange: WebGLUniformLocation;
  xChannel: WebGLUniformLocation;
  yChannel: WebGLUniformLocation;
  source: WebGLUniformLocation;
  gamut: WebGLUniformLocation;
  edgeBehavior: WebGLUniformLocation;
}

type CanvasContextKind = 'webgl' | '2d' | null;

const WEBGL_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  antialias: false,
  alpha: true,
  premultipliedAlpha: false,
  preserveDrawingBuffer: true,
};

interface WebglState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  positionAttrib: number;
  uniforms: WebglUniforms;
}

function planeSeedFromRequested(
  requested: Color,
  axes: Parameters<typeof colorFromColorAreaPosition>[1],
): Color {
  const xChannel = axes.x.channel;
  const yChannel = axes.y.channel;

  return {
    l: xChannel === 'l' || yChannel === 'l' ? 0 : requested.l,
    c: xChannel === 'c' || yChannel === 'c' ? 0 : requested.c,
    h: xChannel === 'h' || yChannel === 'h' ? 0 : requested.h,
    alpha: requested.alpha,
  };
}

function renderPixels(
  width: number,
  height: number,
  base: Color,
  source: ColorPlaneSource,
  gamut: GamutTarget,
  axes: Parameters<typeof colorFromColorAreaPosition>[1],
  edgeBehavior: ColorPlaneEdgeBehavior,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const yNorm = height <= 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const xNorm = width <= 1 ? 0 : x / (width - 1);
      const sampled = colorFromColorAreaPosition(base, axes, xNorm, yNorm);
      const rawLinear = oklchToLinearSrgb(sampled.l, sampled.c, sampled.h);
      const outOfP3 = !inP3Linear(rawLinear);
      const outOfSrgb = !outOfP3 && !inSrgbLinear(rawLinear);
      const targetOutOfGamut =
        gamut === 'display-p3' ? outOfP3 : outOfP3 || outOfSrgb;
      const shouldClampEdge =
        source === 'displayed' && edgeBehavior === 'clamp';
      const clipOutOfGamut =
        source === 'displayed' &&
        edgeBehavior === 'transparent' &&
        targetOutOfGamut;

      const renderLinear = shouldClampEdge
        ? mapToGamutLinear(sampled.l, sampled.c, sampled.h, gamut)
        : rawLinear;

      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = sampled.alpha;

      if (!clipOutOfGamut) {
        r = clamp01(linearToSrgbChannel(renderLinear.r));
        g = clamp01(linearToSrgbChannel(renderLinear.g));
        b = clamp01(linearToSrgbChannel(renderLinear.b));
      } else {
        alpha = 0;
      }

      const offset = (y * width + x) * 4;
      data[offset] = Math.round(r * 255);
      data[offset + 1] = Math.round(g * 255);
      data[offset + 2] = Math.round(b * 255);
      data[offset + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    }
  }

  return data;
}

function destroyWebglState(state: WebglState | null): void {
  if (!state) {
    return;
  }
  const { gl, program, buffer } = state;
  gl.deleteBuffer(buffer);
  gl.deleteProgram(program);
}

function channelIndex(channel: 'l' | 'c' | 'h'): number {
  if (channel === 'l') return 0;
  if (channel === 'c') return 1;
  return 2;
}

function resolveRenderer(
  renderer: ColorPlaneRenderer,
): ResolvedColorPlaneRenderer {
  if (renderer === 'canvas2d') {
    if (!warnedCanvasAlias) {
      warnedCanvasAlias = true;
      console.warn(
        '[ColorPlane] renderer="canvas2d" is deprecated; use renderer="cpu".',
      );
    }
    return 'cpu';
  }

  if (renderer === 'auto') {
    return BENCHMARK_SELECTED_COLOR_PLANE_RENDERER;
  }

  return renderer;
}

function createWebglState(gl: WebGLRenderingContext): WebglState | null {
  if (gl.isContextLost()) {
    return null;
  }

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();

  // Free whatever was created when setup fails part way, so a compile or
  // link failure (or a missing uniform) does not leak GPU objects.
  const release = (): null => {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    if (program) gl.deleteProgram(program);
    if (buffer) gl.deleteBuffer(buffer);
    return null;
  };

  if (!vertexShader || !fragmentShader || !program || !buffer) {
    return release();
  }

  gl.shaderSource(vertexShader, COLOR_PLANE_VERTEX_SHADER_SOURCE);
  gl.shaderSource(fragmentShader, COLOR_PLANE_FRAGMENT_SHADER_SOURCE);
  gl.compileShader(vertexShader);
  gl.compileShader(fragmentShader);

  if (
    !gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS) ||
    !gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)
  ) {
    return release();
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return release();
  }

  const seed = gl.getUniformLocation(program, 'u_seed');
  const xRange = gl.getUniformLocation(program, 'u_x_range');
  const yRange = gl.getUniformLocation(program, 'u_y_range');
  const xChannel = gl.getUniformLocation(program, 'u_x_channel');
  const yChannel = gl.getUniformLocation(program, 'u_y_channel');
  const source = gl.getUniformLocation(program, 'u_source');
  const gamut = gl.getUniformLocation(program, 'u_gamut');
  const edgeBehavior = gl.getUniformLocation(program, 'u_edge_behavior');

  if (
    !seed ||
    !xRange ||
    !yRange ||
    !xChannel ||
    !yChannel ||
    !source ||
    !gamut ||
    !edgeBehavior
  ) {
    return release();
  }

  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const positionAttrib = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionAttrib);
  gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, 0, 0);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return {
    gl,
    program,
    buffer,
    positionAttrib,
    uniforms: {
      seed,
      xRange,
      yRange,
      xChannel,
      yChannel,
      source,
      gamut,
      edgeBehavior,
    },
  };
}

function drawWithCanvas2d(
  canvas: HTMLCanvasElement,
  pixels: Uint8ClampedArray,
): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return false;
  }

  const imageData = ctx.createImageData(canvas.width, canvas.height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  return true;
}

function drawWithWebgl(
  state: WebglState,
  params: {
    source: ColorPlaneSource;
    gamut: GamutTarget;
    axes: Parameters<typeof colorFromColorAreaPosition>[1];
    seed: Color;
    edgeBehavior: ColorPlaneEdgeBehavior;
  },
): boolean {
  const { gl, uniforms } = state;

  gl.useProgram(state.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
  gl.enableVertexAttribArray(state.positionAttrib);
  gl.vertexAttribPointer(state.positionAttrib, 2, gl.FLOAT, false, 0, 0);

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

  gl.uniform4f(
    uniforms.seed,
    params.seed.l,
    params.seed.c,
    params.seed.h,
    params.seed.alpha,
  );
  gl.uniform2f(uniforms.xRange, params.axes.x.range[0], params.axes.x.range[1]);
  gl.uniform2f(uniforms.yRange, params.axes.y.range[0], params.axes.y.range[1]);
  gl.uniform1f(uniforms.xChannel, channelIndex(params.axes.x.channel));
  gl.uniform1f(uniforms.yChannel, channelIndex(params.axes.y.channel));
  gl.uniform1f(uniforms.source, params.source === 'requested' ? 0 : 1);
  gl.uniform1f(uniforms.gamut, params.gamut === 'display-p3' ? 1 : 0);
  gl.uniform1f(uniforms.edgeBehavior, params.edgeBehavior === 'clamp' ? 1 : 0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return gl.getError() === gl.NO_ERROR;
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
 * Canvas that rasterizes the {@link ColorArea}'s color plane: every pixel is
 * the requested color with the two axis channels set to that position.
 *
 * Renders with WebGL by default and falls back to a CPU renderer. With the
 * default `source="displayed"`, pixels are mapped into the display gamut
 * (`edgeBehavior` decides whether out-of-gamut pixels clamp or turn
 * transparent). Resolution follows the device pixel ratio, `resolutionScale`
 * and the area's adaptive quality level; the canvas fills the area and
 * ignores pointer events. `data-renderer` reports the renderer in use
 * (`gpu` or `cpu`). Must be rendered inside a ColorArea.
 *
 * @throws {Error} When rendered outside a `<ColorArea>`.
 * @see {@link OutOfGamutLayer}
 *
 * @example
 * ```tsx
 * import { Color, ColorArea, ColorPlane } from 'color-kit/react';
 *
 * export const Picker = () => (
 *   <Color defaultColor="#3b82f6" defaultGamut="srgb">
 *     <ColorArea style={{ width: 240, height: 240 }}>
 *       <ColorPlane edgeBehavior="transparent" />
 *     </ColorArea>
 *   </Color>
 * );
 * ```
 */
export const ColorPlane = forwardRef<HTMLCanvasElement, ColorPlaneProps>(
  function ColorPlane(
    {
      source = 'displayed',
      displayGamut: displayGamutProp,
      renderer = 'auto',
      edgeBehavior,
      resolutionScale = 1,
      style,
      ...props
    },
    ref,
  ) {
    const { requested, axes, qualityLevel, performanceProfile, isDragging } =
      useColorAreaContext();
    const colorContext = useOptionalColorContext();
    const contextDisplayGamut = useColorStoreSelector(
      colorContext?.store ?? null,
      (state) => state?.activeGamut ?? 'display-p3',
    );
    const displayGamut = displayGamutProp ?? contextDisplayGamut;
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(
      null,
    );
    // Memoized callback ref: an inline ref is detached and reattached on every
    // commit, which used to tear down the WebGL program on each drag frame.
    // Per-canvas resources live in effects keyed on `canvasNode` instead.
    const setCanvasRef = useCallback(
      (node: HTMLCanvasElement | null) => {
        canvasRef.current = node;
        setCanvasNode(node);
        const detachForwarded = assignRef(ref, node);
        return () => {
          canvasRef.current = null;
          setCanvasNode(null);
          detachForwarded();
        };
      },
      [ref],
    );
    const webglStateRef = useRef<WebglState | null>(null);
    const gpuUnavailableRef = useRef(false);
    const lastRenderKeyRef = useRef<string | null>(null);
    /**
     * A canvas is locked to the first context kind requested from it, so the
     * cpu fallback cannot draw into a canvas that already holds a WebGL
     * context (and vice versa). Switching paths remounts the canvas element.
     */
    const canvasContextKindRef = useRef<CanvasContextKind>(null);
    const [canvasGeneration, setCanvasGeneration] = useState(0);
    /** Canvas whose WebGL context is lost; cpu renders until it is restored. */
    const [lostCanvas, setLostCanvas] = useState<HTMLCanvasElement | null>(
      null,
    );
    const [activeRenderer, setActiveRenderer] =
      useState<ActiveColorPlaneRenderer>(
        BENCHMARK_SELECTED_COLOR_PLANE_RENDERER,
      );

    const resolvedRenderer = useMemo(
      () => resolveRenderer(renderer),
      [renderer],
    );
    const resolvedEdgeBehavior: ColorPlaneEdgeBehavior =
      edgeBehavior === 'transparent' ? 'transparent' : 'clamp';

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
      };
    }, [effectiveScale]);

    const renderPlane = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const size = syncCanvasSize();
      if (!size) {
        return;
      }

      const planeSeed = planeSeedFromRequested(requested, axes);
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
        // The canvas is locked to the other context kind; remount a fresh
        // canvas element and render into it on the next pass.
        destroyWebglState(webglStateRef.current);
        webglStateRef.current = null;
        setCanvasGeneration((generation) => generation + 1);
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
          destroyWebglState(webglStateRef.current);
          webglStateRef.current = null;
          lastRenderKeyRef.current = null;
          setCanvasGeneration((generation) => generation + 1);
          return;
        }
      }

      const pixels = renderPixels(
        size.width,
        size.height,
        planeSeed,
        source,
        displayGamut,
        axes,
        resolvedEdgeBehavior,
      );

      const canvasOk = drawWithCanvas2d(canvas, pixels);
      if (canvasOk) {
        canvasContextKindRef.current = '2d';
        setActiveRenderer('cpu');
      }
    }, [
      axes,
      displayGamut,
      lostCanvas,
      requested,
      resolvedRenderer,
      resolvedEdgeBehavior,
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
        lostCanvas.removeEventListener(
          'webglcontextrestored',
          onContextRestored,
        );
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

    return (
      <canvas
        {...props}
        key={canvasGeneration}
        ref={setCanvasRef}
        data-color-area-plane=""
        data-source={source}
        data-renderer={activeRenderer}
        data-edge-behavior={resolvedEdgeBehavior}
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
  },
);
