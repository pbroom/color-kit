import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CanvasHTMLAttributes,
} from 'react';
import {
  toRgb,
  toP3Gamut,
  toSrgbGamut,
  type Color,
  type GamutTarget,
} from '@color-kit/core';
import { colorFromColorAreaPosition } from './api/color-area.js';
import { useColorAreaContext } from './color-area-context.js';

export type ColorPlaneSource = 'requested' | 'displayed';
export type ColorPlaneRenderer = 'auto' | 'canvas2d' | 'webgl';

type ActiveColorPlaneRenderer = 'canvas2d' | 'webgl';

export const BENCHMARK_SELECTED_COLOR_PLANE_RENDERER: ActiveColorPlaneRenderer =
  'canvas2d';

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

interface WebglState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
  buffer: WebGLBuffer;
  positionAttrib: number;
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
      data[offset] = Math.round(rgb.r * 255);
      data[offset + 1] = Math.round(rgb.g * 255);
      data[offset + 2] = Math.round(rgb.b * 255);
      data[offset + 3] = Math.round(color.alpha * 255);
    }
  }

  return data;
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

  const vertSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    void main() {
      gl_FragColor = texture2D(u_tex, vec2(v_uv.x, 1.0 - v_uv.y));
    }
  `;

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  const texture = gl.createTexture();
  const buffer = gl.createBuffer();

  if (!vertexShader || !fragmentShader || !program || !texture || !buffer) {
    return null;
  }

  gl.shaderSource(vertexShader, vertSource);
  gl.shaderSource(fragmentShader, fragSource);
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

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const textureUniform = gl.getUniformLocation(program, 'u_tex');
  gl.uniform1i(textureUniform, 0);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return {
    gl,
    program,
    texture,
    buffer,
    positionAttrib,
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

function drawWithWebgl(state: WebglState, pixels: Uint8ClampedArray): boolean {
  const { gl, texture } = state;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.drawingBufferWidth,
    gl.drawingBufferHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  );

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return gl.getError() === gl.NO_ERROR;
}

/**
 * Primary rasterized color surface for ColorArea.
 */
export const ColorPlane = forwardRef<HTMLCanvasElement, ColorPlaneProps>(
  function ColorPlane(
    {
      source = 'requested',
      displayGamut = 'display-p3',
      renderer = 'auto',
      resolutionScale = 1,
      style,
      ...props
    },
    ref,
  ) {
    const { requested, axes } = useColorAreaContext();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const webglStateRef = useRef<WebglState | null>(null);
    const [activeRenderer, setActiveRenderer] =
      useState<ActiveColorPlaneRenderer>(
        BENCHMARK_SELECTED_COLOR_PLANE_RENDERER,
      );

    const rootRenderer =
      renderer === 'auto' ? BENCHMARK_SELECTED_COLOR_PLANE_RENDERER : renderer;

    const planeSeed = useMemo(() => {
      const next: Color = {
        ...requested,
      };
      next[axes.x.channel] = 0;
      next[axes.y.channel] = 0;
      return next;
    }, [requested, axes.x.channel, axes.y.channel]);

    useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement, []);

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
      const scaledWidth = Math.max(
        1,
        Math.round(rect.width * dpr * resolutionScale),
      );
      const scaledHeight = Math.max(
        1,
        Math.round(rect.height * dpr * resolutionScale),
      );

      if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
      }

      const pixels = renderPixels(
        scaledWidth,
        scaledHeight,
        planeSeed,
        source,
        displayGamut,
        axes,
      );

      if (rootRenderer === 'webgl') {
        if (!webglStateRef.current) {
          webglStateRef.current = createWebglState(canvas);
        }

        if (
          webglStateRef.current &&
          drawWithWebgl(webglStateRef.current, pixels)
        ) {
          setActiveRenderer('webgl');
          return;
        }
      }

      const canvasOk = drawWithCanvas2d(canvas, pixels);
      if (canvasOk) {
        setActiveRenderer('canvas2d');
      }
    }, [axes, displayGamut, planeSeed, resolutionScale, rootRenderer, source]);

    useEffect(() => {
      renderPlane();

      const canvas = canvasRef.current;
      if (!canvas || typeof ResizeObserver === 'undefined') {
        return;
      }

      const observer = new ResizeObserver(() => {
        renderPlane();
      });

      observer.observe(canvas);
      return () => {
        observer.disconnect();
      };
    }, [renderPlane]);

    return (
      <canvas
        {...props}
        ref={(node) => {
          canvasRef.current = node;
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
