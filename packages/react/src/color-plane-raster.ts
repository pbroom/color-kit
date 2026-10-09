import {
  linearToSrgbChannel,
  type Color,
  type GamutTarget,
} from '@color-kit/core';
import {
  colorFromColorAreaPosition,
  type ResolvedColorAreaAxes,
} from '@color-kit/driver';
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
import type {
  ColorPlanePerformanceProfile,
  ColorPlaneQualityLevel,
} from './use-adaptive-quality.js';

/**
 * Which colors {@link useColorPlaneRenderer} paints: the raw `requested`
 * plane colors (each channel clipped to sRGB) or the `displayed` colors for
 * the display gamut.
 */
export type ColorPlaneSource = 'requested' | 'displayed';

/** How a `displayed` plane paints colors outside the display gamut. */
export type ColorPlaneEdgeBehavior = 'transparent' | 'clamp';

/** Rasterizer actually in use: WebGL (`'gpu'`) or a 2D canvas (`'cpu'`). */
export type ActiveColorPlaneRenderer = 'gpu' | 'cpu';

/** Renderer `'auto'` resolves to, chosen from the renderer benchmarks. */
export const BENCHMARK_SELECTED_COLOR_PLANE_RENDERER: ActiveColorPlaneRenderer =
  'gpu';

export type CanvasContextKind = 'webgl' | '2d' | null;

export const WEBGL_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  antialias: false,
  alpha: true,
  premultipliedAlpha: false,
  preserveDrawingBuffer: true,
};

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

export interface WebglState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  positionAttrib: number;
  uniforms: WebglUniforms;
}

/**
 * The plane's seed color: the axis channels are zeroed (each pixel sets
 * them), so the seed only changes when a non-axis channel does.
 */
export function planeSeedFromColor(
  color: Color,
  axes: ResolvedColorAreaAxes,
): Color {
  const xChannel = axes.x.channel;
  const yChannel = axes.y.channel;

  return {
    l: xChannel === 'l' || yChannel === 'l' ? 0 : color.l,
    c: xChannel === 'c' || yChannel === 'c' ? 0 : color.c,
    h: xChannel === 'h' || yChannel === 'h' ? 0 : color.h,
    alpha: color.alpha,
  };
}

/** CPU rasterizer: RGBA8 pixels for a `width` × `height` plane. */
export function renderPlanePixels(
  width: number,
  height: number,
  base: Color,
  source: ColorPlaneSource,
  gamut: GamutTarget,
  axes: ResolvedColorAreaAxes,
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

export function destroyWebglState(state: WebglState | null): void {
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

/**
 * Compiles the plane shaders into a program with its quad buffer. Returns
 * `null` (after freeing whatever was created) when the context is lost or
 * any setup step fails.
 */
export function createWebglState(gl: WebGLRenderingContext): WebglState | null {
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

export function drawWithCanvas2d(
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

export function drawWithWebgl(
  state: WebglState,
  params: {
    source: ColorPlaneSource;
    gamut: GamutTarget;
    axes: ResolvedColorAreaAxes;
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

/**
 * Backing-store scale for a performance profile and quality level; drags
 * shave a little more resolution off.
 */
export function resolutionMultiplier(
  profile: ColorPlanePerformanceProfile,
  quality: ColorPlaneQualityLevel,
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
