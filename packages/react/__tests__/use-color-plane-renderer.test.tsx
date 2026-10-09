// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { inP3Gamut, inSrgbGamut, type Color } from '@color-kit/core';
import type { ColorAreaAxes } from '@color-kit/driver';
import {
  useColorPlaneRenderer,
  type UseColorPlaneRendererOptions,
} from '../src/use-color-plane-renderer.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function rect(size: number): DOMRect {
  return {
    left: 0,
    top: 0,
    width: size,
    height: size,
    right: size,
    bottom: size,
    x: 0,
    y: 0,
    toJSON: () => '',
  } as DOMRect;
}

function Plane({
  color,
  axes,
  options,
  keyed = true,
}: {
  color: Color;
  axes?: ColorAreaAxes;
  options?: UseColorPlaneRendererOptions;
  keyed?: boolean;
}) {
  const { ref, canvasKey, renderer, edgeBehavior } = useColorPlaneRenderer(
    { color, axes },
    options,
  );
  return (
    <canvas
      key={keyed ? canvasKey : undefined}
      ref={ref}
      data-plane=""
      data-renderer={renderer}
      data-edge-behavior={edgeBehavior}
    />
  );
}

function createFakeGl(canvas: HTMLCanvasElement) {
  return {
    canvas,
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLE_STRIP: 8,
    NO_ERROR: 0,
    drawingBufferWidth: 100,
    drawingBufferHeight: 100,
    isContextLost: () => false,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getUniformLocation: vi.fn(() => ({})),
    useProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    deleteShader: vi.fn(),
    deleteProgram: vi.fn(),
    deleteBuffer: vi.fn(),
    viewport: vi.fn(),
    uniform4f: vi.fn(),
    uniform2f: vi.fn(),
    uniform1f: vi.fn(),
    drawArrays: vi.fn(),
    getError: vi.fn(() => 0),
  };
}

type FakeGl = ReturnType<typeof createFakeGl>;

/**
 * Canvas mocks that lock each canvas to the first context kind requested
 * from it, as browsers do. `webgl: false` makes WebGL unavailable.
 */
function installCanvasMocks(
  options: {
    webgl?: boolean;
    size?: number;
    configureGl?: (gl: FakeGl) => void;
  } = {},
) {
  const { webgl = true, size = 100, configureGl } = options;
  const glByCanvas = new Map<HTMLCanvasElement, FakeGl>();
  const kindByCanvas = new Map<HTMLCanvasElement, string>();
  const putImageData = vi.fn();

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function getContext(this: HTMLCanvasElement, kind: string) {
      const existing = kindByCanvas.get(this);
      if (existing && existing !== kind) {
        return null;
      }
      if (kind === 'webgl') {
        if (!webgl) return null;
        kindByCanvas.set(this, kind);
        let gl = glByCanvas.get(this);
        if (!gl) {
          gl = createFakeGl(this);
          configureGl?.(gl);
          glByCanvas.set(this, gl);
        }
        return gl as unknown as RenderingContext;
      }
      if (kind === '2d') {
        kindByCanvas.set(this, kind);
        return {
          createImageData: (width: number, height: number) => ({
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height,
          }),
          putImageData,
        } as unknown as RenderingContext;
      }
      return null;
    },
  );
  vi.spyOn(
    HTMLCanvasElement.prototype,
    'getBoundingClientRect',
  ).mockReturnValue(rect(size));

  return { glByCanvas, putImageData };
}

function alphaCoverage(putImageData: ReturnType<typeof vi.fn>) {
  const imageData = putImageData.mock.calls.at(-1)?.[0] as ImageData;
  let transparent = false;
  let opaque = false;
  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] === 0) transparent = true;
    if (imageData.data[index] === 255) opaque = true;
  }
  return { transparent, opaque };
}

const BLUE: Color = { l: 0.5, c: 0.1, h: 250, alpha: 1 };
const VIVID_VIOLET: Color = { l: 0.72, c: 0.36, h: 293, alpha: 1 };

describe('useColorPlaneRenderer()', () => {
  it('draws with one WebGL program across plane changes', async () => {
    const { glByCanvas } = installCanvasMocks();
    const { container, rerender } = render(
      <Plane color={BLUE} options={{ renderer: 'gpu' }} />,
    );
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => {
      expect(glByCanvas.get(canvas)?.drawArrays).toHaveBeenCalledTimes(1);
    });
    expect(canvas.getAttribute('data-renderer')).toBe('gpu');

    for (let step = 1; step <= 4; step += 1) {
      rerender(
        <Plane
          color={{ ...BLUE, h: 250 + step * 10 }}
          options={{ renderer: 'gpu' }}
        />,
      );
      await waitFor(() => {
        expect(glByCanvas.get(canvas)?.drawArrays).toHaveBeenCalledTimes(
          step + 1,
        );
      });
    }

    const gl = glByCanvas.get(canvas) as FakeGl;
    expect(gl.createProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteProgram).not.toHaveBeenCalled();
    expect(container.querySelector('canvas')).toBe(canvas);
  });

  it('skips the redraw when only an axis channel moves', async () => {
    const { glByCanvas } = installCanvasMocks();
    const { container, rerender } = render(<Plane color={BLUE} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => {
      expect(glByCanvas.get(canvas)?.drawArrays).toHaveBeenCalledTimes(1);
    });

    // Default axes are l × c, so moving l and c keeps the same pixels.
    rerender(<Plane color={{ ...BLUE, l: 0.7, c: 0.2 }} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(glByCanvas.get(canvas)?.drawArrays).toHaveBeenCalledTimes(1);
  });

  it('frees GPU resources on unmount', async () => {
    const { glByCanvas } = installCanvasMocks();
    const { container, unmount } = render(<Plane color={BLUE} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => {
      expect(glByCanvas.get(canvas)?.drawArrays).toHaveBeenCalled();
    });
    unmount();
    const gl = glByCanvas.get(canvas) as FakeGl;
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(1);
  });

  it('falls back to the cpu renderer when WebGL is unavailable', async () => {
    const { putImageData } = installCanvasMocks({ webgl: false });
    const { container } = render(<Plane color={BLUE} />);
    await waitFor(() => {
      expect(
        container.querySelector('canvas')?.getAttribute('data-renderer'),
      ).toBe('cpu');
    });
    expect(putImageData).toHaveBeenCalled();
  });

  it('frees partially created GL objects and remounts the canvas for the cpu path', async () => {
    const { glByCanvas, putImageData } = installCanvasMocks({
      configureGl: (gl) => gl.getShaderParameter.mockReturnValue(false),
    });
    const { container } = render(
      <Plane color={BLUE} options={{ renderer: 'gpu' }} />,
    );
    const gpuCanvas = container.querySelector('canvas') as HTMLCanvasElement;

    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas?.getAttribute('data-renderer')).toBe('cpu');
      expect(canvas).not.toBe(gpuCanvas);
    });
    expect(putImageData).toHaveBeenCalled();

    const gl = glByCanvas.get(gpuCanvas) as FakeGl;
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(1);
  });

  it('warns when the caller drops canvasKey and the canvas cannot switch', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    installCanvasMocks({
      configureGl: (gl) => gl.getShaderParameter.mockReturnValue(false),
    });
    render(<Plane color={BLUE} options={{ renderer: 'gpu' }} keyed={false} />);
    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('canvasKey'));
    });
  });

  it('renders through the cpu path while the context is lost and returns to gpu on restore', async () => {
    const { glByCanvas, putImageData } = installCanvasMocks();
    const { container } = render(<Plane color={BLUE} />);
    const gpuCanvas = container.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => {
      expect(glByCanvas.get(gpuCanvas)?.drawArrays).toHaveBeenCalled();
    });

    const lost = new Event('webglcontextlost', { cancelable: true });
    fireEvent(gpuCanvas, lost);
    expect(lost.defaultPrevented).toBe(true);

    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas?.getAttribute('data-renderer')).toBe('cpu');
      expect(canvas).not.toBe(gpuCanvas);
    });
    expect(putImageData).toHaveBeenCalled();
    const cpuCanvas = container.querySelector('canvas');

    fireEvent(gpuCanvas, new Event('webglcontextrestored'));
    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas?.getAttribute('data-renderer')).toBe('gpu');
      expect(canvas).not.toBe(cpuCanvas);
    });
  });

  it('sizes the backing store from CSS size, DPR, scale and quality', async () => {
    installCanvasMocks({ webgl: false, size: 100 });
    vi.stubGlobal('devicePixelRatio', 2);
    const { container, rerender } = render(
      <Plane color={BLUE} options={{ resolutionScale: 1.5 }} />,
    );
    const canvas = () => container.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => {
      expect(canvas().width).toBe(300);
    });

    rerender(
      <Plane color={BLUE} options={{ resolutionScale: 1.5, quality: 'low' }} />,
    );
    await waitFor(() => {
      expect(canvas().width).toBe(Math.round(100 * 2 * 1.5 * 0.66));
    });
  });

  it('clips out-of-gamut pixels with edgeBehavior transparent', async () => {
    const { putImageData } = installCanvasMocks({ webgl: false, size: 120 });
    render(
      <Plane
        color={VIVID_VIOLET}
        options={{ renderer: 'cpu', edgeBehavior: 'transparent' }}
      />,
    );
    await waitFor(() => expect(putImageData).toHaveBeenCalled());
    expect(alphaCoverage(putImageData)).toEqual({
      transparent: true,
      opaque: true,
    });
  });

  it('clamps out-of-gamut pixels by default', async () => {
    const { putImageData } = installCanvasMocks({ webgl: false, size: 120 });
    const { container } = render(
      <Plane color={VIVID_VIOLET} options={{ renderer: 'cpu' }} />,
    );
    await waitFor(() => expect(putImageData).toHaveBeenCalled());
    expect(alphaCoverage(putImageData)).toEqual({
      transparent: false,
      opaque: true,
    });
    expect(
      container.querySelector('canvas')?.getAttribute('data-edge-behavior'),
    ).toBe('clamp');
  });

  it('keeps P3-only colors when the display gamut is display-p3', async () => {
    const color: Color = {
      l: 0.5,
      c: 0.22809734908482968,
      h: 24.864352050672835,
      alpha: 1,
    };
    expect(inP3Gamut(color)).toBe(true);
    expect(inSrgbGamut(color)).toBe(false);

    const { putImageData } = installCanvasMocks({ webgl: false, size: 120 });
    render(
      <Plane
        color={color}
        axes={{
          x: { channel: 'l', range: [color.l, color.l + 0.0001] },
          y: { channel: 'c', range: [color.c, color.c + 0.0001] },
        }}
        options={{
          renderer: 'cpu',
          displayGamut: 'display-p3',
          edgeBehavior: 'transparent',
        }}
      />,
    );
    await waitFor(() => expect(putImageData).toHaveBeenCalled());
    expect(alphaCoverage(putImageData)).toEqual({
      transparent: false,
      opaque: true,
    });
  });

  it('throws when both axes use the same channel', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <Plane
          color={BLUE}
          axes={{ x: { channel: 'l' }, y: { channel: 'l' } }}
        />,
      ),
    ).toThrow(/distinct channels/);
  });
});
