// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react';
import { createRef } from 'react';
import type { Color } from '@color-kit/core';
import { ColorArea } from '../src/color-area.js';
import { ColorPlane } from '../src/color-plane.js';
import { ColorSlider } from '../src/color-slider.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const RECT = {
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  right: 100,
  bottom: 100,
  x: 0,
  y: 0,
  toJSON: () => '',
} as DOMRect;

function createFakeGl(canvas: HTMLCanvasElement) {
  let lost = false;
  const gl = {
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
    isContextLost: () => lost,
    loseContext: () => {
      lost = true;
    },
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
  return gl;
}

type FakeGl = ReturnType<typeof createFakeGl>;

/**
 * Emulates the browser rule that a canvas is locked to the first context kind
 * requested from it.
 */
function installCanvasMocks() {
  const glByCanvas = new Map<HTMLCanvasElement, FakeGl>();
  const kindByCanvas = new Map<HTMLCanvasElement, string>();
  const putImageData = vi.fn();
  const createProgram = vi.fn();

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function getContext(this: HTMLCanvasElement, kind: string) {
      const existing = kindByCanvas.get(this);
      if (existing && existing !== kind) {
        return null;
      }
      kindByCanvas.set(this, kind);
      if (kind === 'webgl') {
        let gl = glByCanvas.get(this);
        if (!gl) {
          gl = createFakeGl(this);
          gl.createProgram.mockImplementation(() => {
            createProgram(this);
            return {};
          });
          glByCanvas.set(this, gl);
        }
        return gl as unknown as RenderingContext;
      }
      if (kind === '2d') {
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
  ).mockReturnValue(RECT);

  return { glByCanvas, putImageData, createProgram };
}

/** jsdom's PointerEvent drops clientX/Y; build pointer events from MouseEvent. */
function dispatchPointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
) {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  act(() => {
    target.dispatchEvent(event);
  });
}

async function flushAnimationFrames(count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

describe('ColorPlane WebGL lifecycle', () => {
  it('keeps one WebGL program across re-renders and drag frames', async () => {
    const { glByCanvas, createProgram } = installCanvasMocks();
    const planeRef = createRef<HTMLCanvasElement>();

    const renderPlane = (requested: Color) => (
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ColorPlane ref={planeRef} renderer="gpu" />
      </ColorArea>
    );

    const { container, rerender } = render(
      renderPlane({ l: 0.5, c: 0.1, h: 120, alpha: 1 }),
    );

    const canvas = container.querySelector(
      '[data-color-area-plane]',
    ) as HTMLCanvasElement;
    await waitFor(() => {
      expect(glByCanvas.get(canvas)?.drawArrays).toHaveBeenCalledTimes(1);
    });

    const sameCanvas = container.querySelector('[data-color-area-plane]');
    expect(sameCanvas).toBe(canvas);
    expect(sameCanvas?.getAttribute('data-renderer')).toBe('gpu');
    expect(planeRef.current).toBe(canvas);

    for (let step = 1; step <= 5; step += 1) {
      rerender(renderPlane({ l: 0.5, c: 0.1, h: 120 + step * 10, alpha: 1 }));
      await flushAnimationFrames();
    }

    const gl = glByCanvas.get(canvas) as FakeGl;
    expect(createProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteProgram).not.toHaveBeenCalled();
    // Every hue change re-draws with the same program.
    expect(gl.drawArrays.mock.calls.length).toBeGreaterThanOrEqual(6);
    expect(container.querySelector('[data-color-area-plane]')).toBe(canvas);
    expect(planeRef.current).toBe(canvas);
  });

  it('falls back to the cpu path on context loss and rebuilds on restore', async () => {
    const { putImageData, createProgram } = installCanvasMocks();
    const requested: Color = { l: 0.5, c: 0.1, h: 120, alpha: 1 };
    const planeRef = createRef<HTMLCanvasElement>();

    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ColorPlane ref={planeRef} renderer="gpu" />
      </ColorArea>,
    );

    const gpuCanvas = container.querySelector(
      '[data-color-area-plane]',
    ) as HTMLCanvasElement;
    await waitFor(() => {
      expect(createProgram).toHaveBeenCalledTimes(1);
    });
    expect(putImageData).not.toHaveBeenCalled();

    const lostEvent = new Event('webglcontextlost', { cancelable: true });
    fireEvent(gpuCanvas, lostEvent);
    expect(lostEvent.defaultPrevented).toBe(true);

    await waitFor(() => {
      const plane = container.querySelector('[data-color-area-plane]');
      expect(plane?.getAttribute('data-renderer')).toBe('cpu');
      expect(plane).not.toBe(gpuCanvas);
    });
    expect(putImageData).toHaveBeenCalled();
    const cpuCanvas = container.querySelector('[data-color-area-plane]');
    expect(planeRef.current).toBe(cpuCanvas);

    fireEvent(gpuCanvas, new Event('webglcontextrestored'));

    await waitFor(() => {
      const plane = container.querySelector('[data-color-area-plane]');
      expect(plane?.getAttribute('data-renderer')).toBe('gpu');
      expect(plane).not.toBe(cpuCanvas);
    });
    expect(createProgram).toHaveBeenCalledTimes(2);
    expect(planeRef.current).toBe(
      container.querySelector('[data-color-area-plane]'),
    );
  });
});

describe('ColorArea node and listener stability', () => {
  it('does not detach and reattach the area node on re-render', () => {
    const observe = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        disconnect() {}
        unobserve() {}
      },
    );
    // A stable consumer callback ref must see the node exactly once.
    const areaRef = vi.fn<(node: HTMLDivElement | null) => void>();

    const renderArea = (hue: number) => (
      <ColorArea
        ref={areaRef}
        requested={{ l: 0.5, c: 0.1, h: hue, alpha: 1 }}
        onChangeRequested={() => {}}
      />
    );
    const { container, rerender } = render(renderArea(120));
    for (let step = 1; step <= 4; step += 1) {
      rerender(renderArea(120 + step));
    }

    const root = container.querySelector('[data-color-area]');
    expect(areaRef.mock.calls).toEqual([[root]]);
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it('attaches window listeners only while dragging', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const dragTypes = (spy: typeof addSpy) =>
      spy.mock.calls
        .map(([type]) => type)
        .filter((type) =>
          ['pointermove', 'pointerup', 'pointercancel', 'scroll'].includes(
            type,
          ),
        );

    const { container } = render(
      <ColorArea
        requested={{ l: 0.5, c: 0.1, h: 120, alpha: 1 }}
        onChangeRequested={() => {}}
      />,
    );
    expect(dragTypes(addSpy)).toEqual([]);

    const root = container.querySelector('[data-color-area]') as HTMLDivElement;
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(RECT);
    root.setPointerCapture = vi.fn();
    fireEvent.pointerDown(root, { pointerId: 3, clientX: 10, clientY: 10 });
    expect(dragTypes(addSpy).sort()).toEqual(
      ['pointercancel', 'pointermove', 'pointerup', 'scroll'].sort(),
    );

    fireEvent.pointerUp(root, { pointerId: 3, clientX: 10, clientY: 10 });
    expect(dragTypes(removeSpy).sort()).toEqual(
      ['pointercancel', 'pointermove', 'pointerup', 'scroll'].sort(),
    );
  });
});

describe('ColorSlider handler composition', () => {
  const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 0.5 };

  function setupSlider(element: HTMLElement) {
    element.setPointerCapture = vi.fn();
    return vi
      .spyOn(element, 'getBoundingClientRect')
      .mockReturnValue({ ...RECT, height: 10, bottom: 10 } as DOMRect);
  }

  it('calls consumer pointer and key handlers alongside its own', () => {
    const onChangeRequested = vi.fn();
    const handlers = {
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
      onPointerCancel: vi.fn(),
      onLostPointerCapture: vi.fn(),
      onKeyDown: vi.fn(),
    };

    const { getByRole } = render(
      <ColorSlider
        channel="alpha"
        requested={requested}
        onChangeRequested={onChangeRequested}
        {...handlers}
      />,
    );
    const slider = getByRole('slider');
    setupSlider(slider);

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 20, clientY: 5 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 30, clientY: 5 });
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 30, clientY: 5 });
    fireEvent.pointerCancel(slider, { pointerId: 1 });
    fireEvent.lostPointerCapture(slider, { pointerId: 1 });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    for (const handler of Object.values(handlers)) {
      expect(handler).toHaveBeenCalledTimes(1);
    }
    // pointerdown commit + keyboard commit
    expect(onChangeRequested).toHaveBeenCalledTimes(2);
    expect(onChangeRequested.mock.calls[1][1]).toEqual({
      changedChannel: 'alpha',
      interaction: 'keyboard',
    });
  });

  it('skips built-in behavior when a consumer prevents default', () => {
    const onChangeRequested = vi.fn();
    const { getByRole, container } = render(
      <ColorSlider
        channel="alpha"
        requested={requested}
        onChangeRequested={onChangeRequested}
        onPointerDown={(event) => event.preventDefault()}
        onKeyDown={(event) => event.preventDefault()}
      />,
    );
    const slider = getByRole('slider');
    setupSlider(slider);

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 20, clientY: 5 });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(onChangeRequested).not.toHaveBeenCalled();
    expect(
      container
        .querySelector('[data-color-slider]')
        ?.hasAttribute('data-dragging'),
    ).toBe(false);
  });

  it('reads the inset style once per drag and the rect once per frame', async () => {
    const onChangeRequested = vi.fn();
    const { getByRole } = render(
      <ColorSlider
        channel="alpha"
        requested={requested}
        onChangeRequested={onChangeRequested}
        maxPointerRate={1000}
      />,
    );
    const slider = getByRole('slider');
    const rectSpy = setupSlider(slider);
    const styleSpy = vi.spyOn(window, 'getComputedStyle');

    dispatchPointer(slider, 'pointerdown', 10, 5);
    const afterDown = rectSpy.mock.calls.length;
    // Several moves inside one frame are coalesced into one rect read.
    for (const batch of [
      [20, 40, 60],
      [70, 80, 90],
    ]) {
      for (const clientX of batch) {
        dispatchPointer(slider, 'pointermove', clientX, 5);
      }
      await flushAnimationFrames(3);
    }
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 90, clientY: 5 });

    expect(onChangeRequested.mock.calls.length).toBeGreaterThan(2);
    expect(rectSpy.mock.calls.length - afterDown).toBe(2);
    expect(
      styleSpy.mock.calls.filter(([element]) => element === slider),
    ).toHaveLength(1);
  });

  it('tracks a rail that moves without resizing during a drag', async () => {
    const onChangeRequested = vi.fn();
    const { getByRole } = render(
      <ColorSlider
        channel="alpha"
        requested={requested}
        onChangeRequested={onChangeRequested}
        maxPointerRate={1000}
      />,
    );
    const slider = getByRole('slider');
    slider.setPointerCapture = vi.fn();
    let left = 0;
    vi.spyOn(slider, 'getBoundingClientRect').mockImplementation(
      () => ({ ...RECT, left, height: 10, bottom: 10 }) as DOMRect,
    );

    dispatchPointer(slider, 'pointerdown', 50, 5);
    expect(onChangeRequested.mock.lastCall?.[0].alpha).toBeCloseTo(0.5, 6);

    // An ancestor transform shifts the rail by 100px without resizing it, so
    // neither ResizeObserver nor a scroll event fires.
    left = 100;
    dispatchPointer(slider, 'pointermove', 175, 5);
    await flushAnimationFrames(3);
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 175, clientY: 5 });

    expect(onChangeRequested.mock.lastCall?.[0].alpha).toBeCloseTo(0.75, 6);
  });
});
