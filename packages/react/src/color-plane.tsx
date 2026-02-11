import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CanvasHTMLAttributes,
} from 'react';
import { useSelector } from '@legendapp/state/react';
import {
  toRgb,
  toP3Gamut,
  toSrgbGamut,
  type Color,
  type GamutTarget,
} from '@color-kit/core';
import { colorFromColorAreaPosition } from './api/color-area.js';
import {
  COLOR_PLANE_FRAGMENT_SHADER_SOURCE,
  COLOR_PLANE_VERTEX_SHADER_SOURCE,
} from './color-plane-shaders.js';
import { useColorAreaContext } from './color-area-context.js';
import { useOptionalColorContext } from './context.js';

export type ColorPlaneSource = 'requested' | 'displayed';
export type ColorPlaneRenderer = 'auto' | 'gpu' | 'cpu' | 'webgl' | 'canvas2d';

type ActiveColorPlaneRenderer = 'gpu' | 'cpu';
type ResolvedColorPlaneRenderer = 'gpu' | 'cpu';

let warnedWebglAlias = false;
let warnedCanvasAlias = false;

export const BENCHMARK_SELECTED_COLOR_PLANE_RENDERER: ActiveColorPlaneRenderer =
  'gpu';

export interface ColorPlaneProps extends Omit<
  CanvasHTMLAttributes<HTMLCanvasElement>,
  'onChange'
> {
  source?: ColorPlaneSource;
  displayGamut?: GamutTarget;
  renderer?: ColorPlaneRenderer;
  /**
   * Extra backing-store scale factor beyond DPR. @default 1
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
}

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

function sampleColor(
  base: Color,
  xNorm: number,
  yNorm: number,
  source: ColorPlaneSource,
  gamut: GamutTarget,
  axes: Parameters<typeof colorFromColorAreaPosition>[1],
): Color {
  const sampled = colorFromColorAreaPosition(base, axes, xNorm, yNorm);
  if (source === 'requested') {
    return sampled;
  }
  return gamut === 'display-p3' ? toP3Gamut(sampled) : toSrgbGamut(sampled);
}

function renderPixels(
  width: number,
  height: number,
  base: Color,
  source: ColorPlaneSource,
  gamut: GamutTarget,
  axes: Parameters<typeof colorFromColorAreaPosition>[1],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const yNorm = height <= 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const xNorm = width <= 1 ? 0 : x / (width - 1);
      const color = sampleColor(base, xNorm, yNorm, source, gamut, axes);
      const rgb = toRgb(color);

      const offset = (y * width + x) * 4;
      data[offset] = Math.round(rgb.r);
      data[offset + 1] = Math.round(rgb.g);
      data[offset + 2] = Math.round(rgb.b);
      data[offset + 3] = Math.round((rgb.alpha ?? color.alpha) * 255);
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
  if (renderer === 'webgl') {
    if (!warnedWebglAlias) {
      warnedWebglAlias = true;
      console.warn(
        '[ColorPlane] renderer="webgl" is deprecated; use renderer="gpu".',
      );
    }
    return 'gpu';
  }

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

function createWebglState(canvas: HTMLCanvasElement): WebglState | null {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });

  if (!gl) {
    return null;
  }

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();

  if (!vertexShader || !fragmentShader || !program || !buffer) {
    return null;
  }

  gl.shaderSource(vertexShader, COLOR_PLANE_VERTEX_SHADER_SOURCE);
  gl.shaderSource(fragmentShader, COLOR_PLANE_FRAGMENT_SHADER_SOURCE);
  gl.compileShader(vertexShader);
  gl.compileShader(fragmentShader);

  if (
    !gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS) ||
    !gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)
  ) {
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return null;
  }

  const seed = gl.getUniformLocation(program, 'u_seed');
  const xRange = gl.getUniformLocation(program, 'u_x_range');
  const yRange = gl.getUniformLocation(program, 'u_y_range');
  const xChannel = gl.getUniformLocation(program, 'u_x_channel');
  const yChannel = gl.getUniformLocation(program, 'u_y_channel');
  const source = gl.getUniformLocation(program, 'u_source');
  const gamut = gl.getUniformLocation(program, 'u_gamut');

  if (
    !seed ||
    !xRange ||
    !yRange ||
    !xChannel ||
    !yChannel ||
    !source ||
    !gamut
  ) {
    return null;
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
 * Primary rasterized color surface for ColorArea.
 */
export const ColorPlane = forwardRef<HTMLCanvasElement, ColorPlaneProps>(
  function ColorPlane(
    {
      source = 'displayed',
      displayGamut: displayGamutProp,
      renderer = 'auto',
      resolutionScale = 1,
      style,
      ...props
    },
    ref,
  ) {
    const { requested, axes, qualityLevel, performanceProfile, isDragging } =
      useColorAreaContext();
    const colorContext = useOptionalColorContext();
    const contextDisplayGamut = useSelector(
      () => colorContext?.state$.activeGamut.get() ?? 'display-p3',
    );
    const displayGamut = displayGamutProp ?? contextDisplayGamut;
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(
      null,
    );
    const webglStateRef = useRef<WebglState | null>(null);
    const gpuUnavailableRef = useRef(false);
    const lastRenderKeyRef = useRef<string | null>(null);
    const drawPlaneRef = useRef<() => void>(() => {});
    const syncCanvasSizeRef =
      useRef<() => { width: number; height: number } | null>(null);
    const [activeRenderer, setActiveRenderer] =
      useState<ActiveColorPlaneRenderer>(
        BENCHMARK_SELECTED_COLOR_PLANE_RENDERER,
      );

    const resolvedRenderer = useMemo(
      () => resolveRenderer(renderer),
      [renderer],
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
      };
    }, [effectiveScale]);

    syncCanvasSizeRef.current = syncCanvasSize;

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
      lastRenderKeyRef.current = renderKey;

      if (resolvedRenderer === 'gpu' && !gpuUnavailableRef.current) {
        if (!webglStateRef.current) {
          webglStateRef.current = createWebglState(canvas);
        }

        if (
          webglStateRef.current &&
          drawWithWebgl(webglStateRef.current, {
            source,
            gamut: displayGamut,
            axes,
            seed: planeSeed,
          })
        ) {
          setActiveRenderer('gpu');
          return;
        }

        gpuUnavailableRef.current = true;
      }

      const pixels = renderPixels(
        size.width,
        size.height,
        planeSeed,
        source,
        displayGamut,
        axes,
      );

      const canvasOk = drawWithCanvas2d(canvas, pixels);
      if (canvasOk) {
        setActiveRenderer('cpu');
      }
    }, [
      axes,
      displayGamut,
      requested,
      resolvedRenderer,
      source,
      syncCanvasSize,
    ]);

    drawPlaneRef.current = renderPlane;

    useEffect(() => {
      renderPlane();
    }, [renderPlane]);

    useEffect(() => {
      if (!canvasNode || typeof ResizeObserver === 'undefined') {
        return;
      }

      const observer = new ResizeObserver(() => {
        syncCanvasSizeRef.current?.();
        drawPlaneRef.current();
      });
      observer.observe(canvasNode);
      return () => {
        observer.disconnect();
      };
    }, [canvasNode]);

    useEffect(() => {
      return () => {
        destroyWebglState(webglStateRef.current);
        webglStateRef.current = null;
      };
    }, []);

    return (
      <canvas
        {...props}
        ref={(node) => {
          if (canvasRef.current !== node) {
            lastRenderKeyRef.current = null;
            destroyWebglState(webglStateRef.current);
            webglStateRef.current = null;
            gpuUnavailableRef.current = false;
          }
          canvasRef.current = node;
          setCanvasNode(node);
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        data-color-area-plane=""
        data-source={source}
        data-renderer={activeRenderer}
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
