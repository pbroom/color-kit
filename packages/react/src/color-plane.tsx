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
  parse,
  toRgb,
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

export interface ColorPlaneOutOfGamutConfig {
  /**
   * Keep mapping out-of-gamut samples to their nearest in-gamut edge.
   * @default true
   */
  repeatEdgePixels?: boolean;
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
}

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
  /**
   * Optional out-of-gamut visualization controls.
   */
  outOfGamut?: ColorPlaneOutOfGamutConfig;
}

interface WebglUniforms {
  seed: WebGLUniformLocation;
  xRange: WebGLUniformLocation;
  yRange: WebGLUniformLocation;
  xChannel: WebGLUniformLocation;
  yChannel: WebGLUniformLocation;
  source: WebGLUniformLocation;
  gamut: WebGLUniformLocation;
  repeatEdgePixels: WebGLUniformLocation;
  outP3Fill: WebGLUniformLocation;
  outSrgbFill: WebGLUniformLocation;
  dotPattern: WebGLUniformLocation;
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

interface LinearSrgb {
  r: number;
  g: number;
  b: number;
}

interface NormalizedRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ResolvedOutOfGamutConfig {
  repeatEdgePixels: boolean;
  outOfP3Fill: NormalizedRgba;
  outOfSrgbFill: NormalizedRgba;
  dotPattern: {
    opacity: number;
    size: number;
    gap: number;
  };
}

const GAMUT_EPSILON = 0.000075;
const GAMUT_ITERS = 14;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function transferLinearToSrgbChannel(value: number): number {
  const absValue = Math.abs(value);
  const srgb =
    absValue <= 0.0031308
      ? 12.92 * absValue
      : 1.055 * Math.pow(absValue, 1 / 2.4) - 0.055;
  return clamp01(Math.sign(value) * srgb);
}

function oklchToLinearSrgb(lightness: number, chroma: number, hue: number): LinearSrgb {
  const hueRad = (((hue % 360) + 360) % 360) * (Math.PI / 180);
  const a = chroma * Math.cos(hueRad);
  const b = chroma * Math.sin(hueRad);

  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;

  const l = lPrime * lPrime * lPrime;
  const m = mPrime * mPrime * mPrime;
  const s = sPrime * sPrime * sPrime;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function linearSrgbToLinearP3(linearSrgb: LinearSrgb): LinearSrgb {
  return {
    r: 0.8224621724 * linearSrgb.r + 0.1775378276 * linearSrgb.g,
    g: 0.033194198 * linearSrgb.r + 0.966805802 * linearSrgb.g,
    b:
      0.0170826307 * linearSrgb.r +
      0.0723974407 * linearSrgb.g +
      0.9105199286 * linearSrgb.b,
  };
}

function inSrgbLinear(linearSrgb: LinearSrgb): boolean {
  return (
    linearSrgb.r >= -GAMUT_EPSILON &&
    linearSrgb.r <= 1 + GAMUT_EPSILON &&
    linearSrgb.g >= -GAMUT_EPSILON &&
    linearSrgb.g <= 1 + GAMUT_EPSILON &&
    linearSrgb.b >= -GAMUT_EPSILON &&
    linearSrgb.b <= 1 + GAMUT_EPSILON
  );
}

function inP3Linear(linearSrgb: LinearSrgb): boolean {
  const linearP3 = linearSrgbToLinearP3(linearSrgb);
  return (
    linearP3.r >= -GAMUT_EPSILON &&
    linearP3.r <= 1 + GAMUT_EPSILON &&
    linearP3.g >= -GAMUT_EPSILON &&
    linearP3.g <= 1 + GAMUT_EPSILON &&
    linearP3.b >= -GAMUT_EPSILON &&
    linearP3.b <= 1 + GAMUT_EPSILON
  );
}

function inTargetGamut(linearSrgb: LinearSrgb, gamut: GamutTarget): boolean {
  return gamut === 'display-p3' ? inP3Linear(linearSrgb) : inSrgbLinear(linearSrgb);
}

function mapToGamutLinear(
  lightness: number,
  chroma: number,
  hue: number,
  gamut: GamutTarget,
): LinearSrgb {
  const rawLinear = oklchToLinearSrgb(lightness, chroma, hue);
  if (inTargetGamut(rawLinear, gamut)) {
    return rawLinear;
  }

  let lo = 0;
  let hi = Math.max(chroma, 0);
  let mapped = 0;

  for (let index = 0; index < GAMUT_ITERS; index += 1) {
    const mid = (lo + hi) * 0.5;
    const testLinear = oklchToLinearSrgb(lightness, mid, hue);
    if (inTargetGamut(testLinear, gamut)) {
      lo = mid;
      mapped = mid;
    } else {
      hi = mid;
    }
  }

  return oklchToLinearSrgb(lightness, mapped, hue);
}

function blend(base: number, overlay: number, opacity: number): number {
  return base * (1 - opacity) + overlay * opacity;
}

function parseColorToRgba(color: string | undefined, fallback: NormalizedRgba): NormalizedRgba {
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

function resolveOutOfGamutConfig(
  config?: ColorPlaneOutOfGamutConfig,
): ResolvedOutOfGamutConfig {
  const p3Color = parseColorToRgba(config?.outOfP3FillColor, {
    r: 31 / 255,
    g: 31 / 255,
    b: 31 / 255,
    a: 1,
  });
  const srgbColor = parseColorToRgba(config?.outOfSrgbFillColor, {
    r: 31 / 255,
    g: 31 / 255,
    b: 31 / 255,
    a: 1,
  });

  return {
    repeatEdgePixels: config?.repeatEdgePixels ?? true,
    outOfP3Fill: {
      ...p3Color,
      a: clamp01(config?.outOfP3FillOpacity ?? 0),
    },
    outOfSrgbFill: {
      ...srgbColor,
      a: clamp01(config?.outOfSrgbFillOpacity ?? 0),
    },
    dotPattern: {
      opacity: clamp01(config?.dotPatternOpacity ?? 0),
      size: Math.max(1, config?.dotPatternSize ?? 2),
      gap: Math.max(0, config?.dotPatternGap ?? 2),
    },
  };
}

function renderPixels(
  width: number,
  height: number,
  base: Color,
  source: ColorPlaneSource,
  gamut: GamutTarget,
  axes: Parameters<typeof colorFromColorAreaPosition>[1],
  outOfGamut: ResolvedOutOfGamutConfig,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  const dotCell = outOfGamut.dotPattern.size + outOfGamut.dotPattern.gap;

  for (let y = 0; y < height; y += 1) {
    const yNorm = height <= 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const xNorm = width <= 1 ? 0 : x / (width - 1);
      const sampled = colorFromColorAreaPosition(base, axes, xNorm, yNorm);
      const rawLinear = oklchToLinearSrgb(sampled.l, sampled.c, sampled.h);
      const outOfP3 = !inP3Linear(rawLinear);
      const outOfSrgb = !outOfP3 && !inSrgbLinear(rawLinear);

      const renderLinear =
        source === 'displayed' && outOfGamut.repeatEdgePixels
          ? mapToGamutLinear(sampled.l, sampled.c, sampled.h, gamut)
          : rawLinear;

      let r = transferLinearToSrgbChannel(renderLinear.r);
      let g = transferLinearToSrgbChannel(renderLinear.g);
      let b = transferLinearToSrgbChannel(renderLinear.b);

      if (outOfP3 && outOfGamut.outOfP3Fill.a > 0) {
        r = blend(r, outOfGamut.outOfP3Fill.r, outOfGamut.outOfP3Fill.a);
        g = blend(g, outOfGamut.outOfP3Fill.g, outOfGamut.outOfP3Fill.a);
        b = blend(b, outOfGamut.outOfP3Fill.b, outOfGamut.outOfP3Fill.a);
      }

      if (outOfSrgb && outOfGamut.outOfSrgbFill.a > 0) {
        r = blend(r, outOfGamut.outOfSrgbFill.r, outOfGamut.outOfSrgbFill.a);
        g = blend(g, outOfGamut.outOfSrgbFill.g, outOfGamut.outOfSrgbFill.a);
        b = blend(b, outOfGamut.outOfSrgbFill.b, outOfGamut.outOfSrgbFill.a);
      }

      if (
        (outOfP3 || outOfSrgb) &&
        outOfGamut.dotPattern.opacity > 0 &&
        dotCell > 0
      ) {
        const localX = x % dotCell;
        const localY = y % dotCell;
        if (
          localX < outOfGamut.dotPattern.size &&
          localY < outOfGamut.dotPattern.size
        ) {
          r = blend(r, 1, outOfGamut.dotPattern.opacity);
          g = blend(g, 1, outOfGamut.dotPattern.opacity);
          b = blend(b, 1, outOfGamut.dotPattern.opacity);
        }
      }

      const offset = (y * width + x) * 4;
      data[offset] = Math.round(clamp01(r) * 255);
      data[offset + 1] = Math.round(clamp01(g) * 255);
      data[offset + 2] = Math.round(clamp01(b) * 255);
      data[offset + 3] = Math.round(clamp01(sampled.alpha) * 255);
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
  const repeatEdgePixels = gl.getUniformLocation(program, 'u_repeat_edge_pixels');
  const outP3Fill = gl.getUniformLocation(program, 'u_out_p3_fill');
  const outSrgbFill = gl.getUniformLocation(program, 'u_out_srgb_fill');
  const dotPattern = gl.getUniformLocation(program, 'u_dot_pattern');

  if (
    !seed ||
    !xRange ||
    !yRange ||
    !xChannel ||
    !yChannel ||
    !source ||
    !gamut ||
    !repeatEdgePixels ||
    !outP3Fill ||
    !outSrgbFill ||
    !dotPattern
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
      repeatEdgePixels,
      outP3Fill,
      outSrgbFill,
      dotPattern,
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
    outOfGamut: ResolvedOutOfGamutConfig;
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
  gl.uniform1f(
    uniforms.repeatEdgePixels,
    params.outOfGamut.repeatEdgePixels ? 1 : 0,
  );
  gl.uniform4f(
    uniforms.outP3Fill,
    params.outOfGamut.outOfP3Fill.r,
    params.outOfGamut.outOfP3Fill.g,
    params.outOfGamut.outOfP3Fill.b,
    params.outOfGamut.outOfP3Fill.a,
  );
  gl.uniform4f(
    uniforms.outSrgbFill,
    params.outOfGamut.outOfSrgbFill.r,
    params.outOfGamut.outOfSrgbFill.g,
    params.outOfGamut.outOfSrgbFill.b,
    params.outOfGamut.outOfSrgbFill.a,
  );
  gl.uniform3f(
    uniforms.dotPattern,
    params.outOfGamut.dotPattern.opacity,
    params.outOfGamut.dotPattern.size,
    params.outOfGamut.dotPattern.gap,
  );

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
      outOfGamut,
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
    const resolvedOutOfGamut = useMemo(
      () => resolveOutOfGamutConfig(outOfGamut),
      [outOfGamut],
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
        resolvedOutOfGamut.repeatEdgePixels ? 1 : 0,
        resolvedOutOfGamut.outOfP3Fill.r,
        resolvedOutOfGamut.outOfP3Fill.g,
        resolvedOutOfGamut.outOfP3Fill.b,
        resolvedOutOfGamut.outOfP3Fill.a,
        resolvedOutOfGamut.outOfSrgbFill.r,
        resolvedOutOfGamut.outOfSrgbFill.g,
        resolvedOutOfGamut.outOfSrgbFill.b,
        resolvedOutOfGamut.outOfSrgbFill.a,
        resolvedOutOfGamut.dotPattern.opacity,
        resolvedOutOfGamut.dotPattern.size,
        resolvedOutOfGamut.dotPattern.gap,
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
            outOfGamut: resolvedOutOfGamut,
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
        resolvedOutOfGamut,
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
      resolvedOutOfGamut,
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
