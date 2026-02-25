// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import {
  inP3Gamut,
  inSrgbGamut,
  toSrgbGamut,
  type Color,
} from '@color-kit/core';
import * as colorAreaApi from '../src/api/color-area.js';
import { ChromaBandLayer } from '../src/chroma-band-layer.js';
import { ColorArea } from '../src/color-area.js';
import { ColorPlane } from '../src/color-plane.js';
import {
  ContrastRegionLayer,
  ContrastRegionFill,
} from '../src/contrast-region-layer.js';
import { FallbackPointsLayer } from '../src/fallback-points-layer.js';
import { GamutBoundaryLayer } from '../src/gamut-boundary-layer.js';
import { OutOfGamutLayer } from '../src/out-of-gamut-layer.js';
import type { ColorPlaneOutOfGamutConfig } from '../src/index.js';

function pathAreaFromD(pathData: string): number {
  const matches = Array.from(
    pathData.matchAll(/(?:M|L)\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g),
  );
  const points = matches.map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
  if (points.length < 3) {
    return 0;
  }
  let doubleArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    doubleArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(doubleArea) * 0.5;
}

function pathSubpathsFromD(
  pathData: string,
): Array<Array<{ x: number; y: number }>> {
  return pathData
    .split(/(?=M\s)/)
    .map((subpath) =>
      Array.from(
        subpath.matchAll(/(?:M|L)\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g),
      ).map((match) => ({
        x: Number(match[1]),
        y: Number(match[2]),
      })),
    )
    .filter((points) => points.length >= 3);
}

function pointInPolygon(
  point: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
): boolean {
  let inside = false;
  for (
    let index = 0, prev = polygon.length - 1;
    index < polygon.length;
    prev = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[prev];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y + 1e-12) +
          current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pathContainsPoint(
  pathData: string,
  point: { x: number; y: number },
): boolean {
  return pathSubpathsFromD(pathData).some((subpath) =>
    pointInPolygon(point, subpath),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ColorArea primitives', () => {
  it('renders a default thumb when no explicit thumb child is provided', () => {
    const requested: Color = { l: 0.4, c: 0.2, h: 200, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}} />,
    );

    expect(container.querySelectorAll('[data-color-area-thumb]')).toHaveLength(
      1,
    );
  });

  it('renders fallback P3 and sRGB markers', () => {
    const requested: Color = { l: 0.8, c: 0.4, h: 145, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <FallbackPointsLayer />
      </ColorArea>,
    );

    const p3Point = container.querySelector(
      '[data-color-area-fallback-point][data-gamut="display-p3"]',
    );
    const srgbPoint = container.querySelector(
      '[data-color-area-fallback-point][data-gamut="srgb"]',
    );

    expect(p3Point).toBeTruthy();
    expect(srgbPoint).toBeTruthy();
    expect(p3Point?.getAttribute('data-color')).toMatch(/^#/);
    expect(srgbPoint?.getAttribute('data-color')).toMatch(/^#/);
  });

  it('renders chroma band paths for lightness/chroma axes', () => {
    const requested: Color = { l: 0.74, c: 0.2, h: 285, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ChromaBandLayer gamut="srgb" mode="percentage" />
      </ColorArea>,
    );

    expect(
      container.querySelector('[data-color-area-chroma-band-layer]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-color-area-line]')).toBeTruthy();
  });

  it('renders gamut and contrast wrappers as line overlays', () => {
    const requested: Color = { l: 0.72, c: 0.24, h: 220, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ChromaBandLayer gamut="srgb" mode="closest" />
        <GamutBoundaryLayer gamut="srgb" />
        <ContrastRegionLayer threshold={4.5} />
      </ColorArea>,
    );

    expect(
      container.querySelector('[data-color-area-chroma-band-layer]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-color-area-gamut-boundary-layer]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-color-area-contrast-region-layer]'),
    ).toBeTruthy();
    expect(
      container.querySelectorAll('[data-color-area-line]').length,
    ).toBeGreaterThan(0);
  });

  it('renders sampled vector points for gamut and contrast overlays', () => {
    const requested: Color = { l: 0.72, c: 0.24, h: 220, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <GamutBoundaryLayer gamut="srgb" showPathPoints />
        <ContrastRegionLayer threshold={4.5} showPathPoints />
      </ColorArea>,
    );

    const gamutPoints = container.querySelector(
      '[data-color-area-gamut-boundary-points]',
    );
    const contrastPoints = container.querySelector(
      '[data-color-area-contrast-region-points]',
    );

    expect(gamutPoints).toBeTruthy();
    expect(contrastPoints).toBeTruthy();
    expect(
      gamutPoints?.querySelectorAll('[data-color-area-path-point]').length,
    ).toBeGreaterThan(0);
    expect(
      contrastPoints?.querySelectorAll('[data-color-area-path-point]').length,
    ).toBeGreaterThan(0);
  });

  it('renders contrast regions with ContrastRegionFill child (filled region + pattern overlay)', () => {
    const requested: Color = { l: 0.68, c: 0.22, h: 245, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer
          threshold={4.5}
          samplingMode="uniform"
          lightnessSteps={32}
          chromaSteps={32}
          showPathPoints
        >
          <ContrastRegionFill
            fillColor="#88aaff"
            fillOpacity={0.2}
            dotOpacity={0.2}
            dotSize={2}
            dotGap={2}
          />
        </ContrastRegionLayer>
      </ColorArea>,
    );

    expect(
      container.querySelector('[data-color-area-contrast-region-layer]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-color-area-contrast-region-points]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-color-area-contrast-region-fill]'),
    ).toBeTruthy();
  });

  it('renders non-empty contrast region lines with adaptive sampling', () => {
    const requested: Color = { l: 0.85, c: 0.08, h: 200, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer
          threshold={4.5}
          samplingMode="adaptive"
          lightnessSteps={32}
          chromaSteps={32}
        />
      </ColorArea>,
    );

    const layer = container.querySelector(
      '[data-color-area-contrast-region-layer]',
    );
    expect(layer).toBeTruthy();
    const lines = container.querySelectorAll('[data-color-area-line]');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders contrast region fill when adaptive paths are open', () => {
    const requested: Color = { l: 0.6953, c: 0.1316, h: 29, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer threshold={4.5} samplingMode="adaptive">
          <ContrastRegionFill dotOpacity={0.2} />
        </ContrastRegionLayer>
      </ColorArea>,
    );

    expect(
      container.querySelector('[data-color-area-contrast-region-fill]'),
    ).toBeTruthy();
  });

  it('keeps AAA adaptive fill non-degenerate near cusp transitions', () => {
    const requested: Color = { l: 0.878, c: 0.1621, h: 292.72, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer threshold={7} samplingMode="adaptive">
          <ContrastRegionFill dotOpacity={0} />
        </ContrastRegionLayer>
      </ColorArea>,
    );

    const fillPath = container.querySelector(
      '[data-color-area-contrast-region-fill] path',
    );
    expect(fillPath).toBeTruthy();

    const pathData = fillPath?.getAttribute('d') ?? '';
    expect(pathData.length).toBeGreaterThan(0);
    expect(pathAreaFromD(pathData)).toBeGreaterThan(50);
  });

  it.each([3, 4.5])(
    'keeps hue-zero fill off the reference point (threshold %s)',
    (threshold) => {
      const requested: Color = { l: 0.4959, c: 0.0902, h: 0, alpha: 1 };
      const { container } = render(
        <ColorArea requested={requested} onChangeRequested={() => {}}>
          <ContrastRegionLayer threshold={threshold} samplingMode="adaptive">
            <ContrastRegionFill dotOpacity={0} />
          </ContrastRegionLayer>
        </ColorArea>,
      );

      const fillPath = container.querySelector(
        '[data-color-area-contrast-region-fill] path',
      );
      expect(fillPath).toBeTruthy();
      const pathData = fillPath?.getAttribute('d') ?? '';
      const thumbPoint = {
        x: requested.l * 100,
        y: (1 - requested.c / 0.4) * 100,
      };
      expect(pathContainsPoint(pathData, thumbPoint)).toBe(false);
    },
  );

  it('keeps out-of-gamut reference fallback outside filled region', () => {
    const requested: Color = { l: 0.62, c: 0.33, h: 9, alpha: 1 };
    expect(inSrgbGamut(requested)).toBe(false);

    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer
          gamut="srgb"
          threshold={4.5}
          samplingMode="adaptive"
        >
          <ContrastRegionFill dotOpacity={0} />
        </ContrastRegionLayer>
      </ColorArea>,
    );

    const fillPath = container.querySelector(
      '[data-color-area-contrast-region-fill] path',
    );
    expect(fillPath).toBeTruthy();
    const pathData = fillPath?.getAttribute('d') ?? '';
    const fallback = toSrgbGamut(requested);
    const fallbackPoint = {
      x: fallback.l * 100,
      y: (1 - fallback.c / 0.4) * 100,
    };
    expect(pathContainsPoint(pathData, fallbackPoint)).toBe(false);
  });

  it('closes right-edge arc without vertex kink on boundary', () => {
    const boundary = [
      { l: 0, c: 0, x: 0, y: 1 },
      { l: 0, c: 1, x: 0, y: 0 },
      { l: 1, c: 1, x: 1, y: 0 },
      { l: 1, c: 0, x: 1, y: 1 },
    ];
    vi.spyOn(colorAreaApi, 'getColorAreaGamutBoundaryPoints').mockReturnValue(
      boundary,
    );
    vi.spyOn(colorAreaApi, 'getColorAreaContrastRegionPaths').mockReturnValue([
      [
        { l: 1, c: 0.2, x: 1, y: 0.8 },
        { l: 0.7, c: 0.5, x: 0.7, y: 0.5 },
        { l: 1, c: 0.8, x: 1, y: 0.2 },
      ],
    ]);

    const requested: Color = { l: 0.3, c: 0.2, h: 210, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer threshold={4.5}>
          <ContrastRegionFill dotOpacity={0} />
        </ContrastRegionLayer>
      </ColorArea>,
    );

    const fillPath = container.querySelector(
      '[data-color-area-contrast-region-fill] path',
    );
    expect(fillPath).toBeTruthy();
    const pathData = fillPath?.getAttribute('d') ?? '';
    expect(pathData).not.toContain('L 100.000 0.000');
    expect(pathData).not.toContain('L 100.000 100.000');
  });

  it('renders multiple fill subpaths when both contrast sides exist', () => {
    const boundary = [
      { l: 0, c: 0, x: 0, y: 1 },
      { l: 0, c: 1, x: 0, y: 0 },
      { l: 1, c: 1, x: 1, y: 0 },
      { l: 1, c: 0, x: 1, y: 1 },
    ];
    vi.spyOn(colorAreaApi, 'getColorAreaGamutBoundaryPoints').mockReturnValue(
      boundary,
    );
    vi.spyOn(colorAreaApi, 'getColorAreaContrastRegionPaths').mockReturnValue([
      [
        { l: 0.2, c: 0, x: 0.2, y: 1 },
        { l: 0.4, c: 1, x: 0.4, y: 0 },
      ],
      [
        { l: 0.6, c: 1, x: 0.6, y: 0 },
        { l: 0.8, c: 0, x: 0.8, y: 1 },
      ],
    ]);

    const requested: Color = { l: 0.55, c: 0.12, h: 210, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer threshold={4.5}>
          <ContrastRegionFill dotOpacity={0} />
        </ContrastRegionLayer>
      </ColorArea>,
    );

    const fillPath = container.querySelector(
      '[data-color-area-contrast-region-fill] path',
    );
    expect(fillPath).toBeTruthy();
    const pathData = fillPath?.getAttribute('d') ?? '';
    const moveCommandCount = pathData.match(/\bM\b/g)?.length ?? 0;
    expect(moveCommandCount).toBeGreaterThan(1);
  });

  it('clears drag overlay when the latest worker response is empty', async () => {
    const boundary = [
      { l: 0, c: 0, x: 0, y: 1 },
      { l: 0, c: 1, x: 0, y: 0 },
      { l: 1, c: 1, x: 1, y: 0 },
      { l: 1, c: 0, x: 1, y: 1 },
    ];
    vi.spyOn(colorAreaApi, 'getColorAreaGamutBoundaryPoints').mockReturnValue(
      boundary,
    );
    vi.spyOn(colorAreaApi, 'getColorAreaContrastRegionPaths').mockReturnValue(
      [],
    );

    const firstResponsePaths = [
      [
        { l: 0.2, c: 0.2, x: 0.2, y: 0.8 },
        { l: 0.5, c: 0.5, x: 0.5, y: 0.5 },
        { l: 0.8, c: 0.2, x: 0.8, y: 0.8 },
      ],
    ];

    class MockWorker {
      private listeners = new Set<(event: MessageEvent<unknown>) => void>();

      addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
      ): void {
        if (type !== 'message' || typeof listener !== 'function') {
          return;
        }
        this.listeners.add(listener as (event: MessageEvent<unknown>) => void);
      }

      removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
      ): void {
        if (type !== 'message' || typeof listener !== 'function') {
          return;
        }
        this.listeners.delete(
          listener as (event: MessageEvent<unknown>) => void,
        );
      }

      postMessage(message: { id: number }): void {
        const payload = {
          id: message.id,
          paths: message.id === 1 ? firstResponsePaths : [],
          computeTimeMs: 1,
        };
        queueMicrotask(() => {
          for (const listener of this.listeners) {
            listener({ data: payload } as MessageEvent<unknown>);
          }
        });
      }

      terminate(): void {}
    }

    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);

    const requestedA: Color = { l: 0.35, c: 0.16, h: 210, alpha: 1 };
    const requestedB: Color = { l: 0.66, c: 0.08, h: 210, alpha: 1 };
    const onChangeRequested = vi.fn();
    const { container, rerender } = render(
      <ColorArea requested={requestedA} onChangeRequested={onChangeRequested}>
        <ContrastRegionLayer threshold={4.5} samplingMode="adaptive" />
      </ColorArea>,
    );

    const root = container.querySelector('[data-color-area]') as HTMLDivElement;
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    fireEvent.pointerDown(root, {
      pointerId: 1,
      clientX: 20,
      clientY: 80,
    });

    await waitFor(() => {
      expect(container.querySelectorAll('[data-color-area-line]').length).toBe(
        1,
      );
    });

    rerender(
      <ColorArea requested={requestedB} onChangeRequested={onChangeRequested}>
        <ContrastRegionLayer threshold={4.5} samplingMode="adaptive" />
      </ColorArea>,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('[data-color-area-line]').length).toBe(
        0,
      );
    });
  });

  it('falls back to cpu when gpu renderer is unavailable', async () => {
    const requested: Color = { l: 0.6, c: 0.2, h: 250, alpha: 1 };

    const createImageData = vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }));
    const putImageData = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function getContext(this: HTMLCanvasElement, kind: string) {
        if (kind === 'webgl') {
          return null;
        }
        if (kind === '2d') {
          return {
            createImageData,
            putImageData,
          } as unknown as RenderingContext;
        }
        return null;
      },
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ColorPlane renderer="gpu" edgeBehavior="transparent" />
      </ColorArea>,
    );

    await waitFor(() => {
      const plane = container.querySelector('[data-color-area-plane]');
      expect(plane?.getAttribute('data-renderer')).toBe('cpu');
      expect(createImageData).toHaveBeenCalled();
      expect(putImageData).toHaveBeenCalled();
    });
  });

  it('clips out-of-gamut pixels when edge behavior is transparent', async () => {
    const requested: Color = { l: 0.72, c: 0.36, h: 293, alpha: 1 };

    const createImageData = vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }));
    const putImageData = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function getContext(this: HTMLCanvasElement, kind: string) {
        if (kind === '2d') {
          return {
            createImageData,
            putImageData,
          } as unknown as RenderingContext;
        }
        return null;
      },
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ColorPlane renderer="cpu" edgeBehavior="transparent" />
      </ColorArea>,
    );

    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled();
    });

    const latestCall = putImageData.mock.calls.at(-1);
    const imageData = latestCall?.[0] as ImageData | undefined;
    expect(imageData).toBeTruthy();

    const pixels = imageData?.data ?? new Uint8ClampedArray();
    let hasTransparentPixel = false;
    let hasOpaquePixel = false;

    for (let index = 3; index < pixels.length; index += 4) {
      const alpha = pixels[index];
      if (alpha === 0) {
        hasTransparentPixel = true;
      }
      if (alpha === 255) {
        hasOpaquePixel = true;
      }
      if (hasTransparentPixel && hasOpaquePixel) {
        break;
      }
    }

    expect(hasTransparentPixel).toBe(true);
    expect(hasOpaquePixel).toBe(true);
  });

  it('keeps legacy default behavior clamped when edge behavior is omitted', async () => {
    const requested: Color = { l: 0.72, c: 0.36, h: 293, alpha: 1 };

    const createImageData = vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }));
    const putImageData = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function getContext(this: HTMLCanvasElement, kind: string) {
        if (kind === '2d') {
          return {
            createImageData,
            putImageData,
          } as unknown as RenderingContext;
        }
        return null;
      },
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ColorPlane renderer="cpu" />
      </ColorArea>,
    );

    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled();
    });

    const latestCall = putImageData.mock.calls.at(-1);
    const imageData = latestCall?.[0] as ImageData | undefined;
    expect(imageData).toBeTruthy();

    const pixels = imageData?.data ?? new Uint8ClampedArray();
    let hasTransparentPixel = false;
    let hasOpaquePixel = false;

    for (let index = 3; index < pixels.length; index += 4) {
      const alpha = pixels[index];
      if (alpha === 0) {
        hasTransparentPixel = true;
      }
      if (alpha === 255) {
        hasOpaquePixel = true;
      }
      if (hasTransparentPixel && hasOpaquePixel) {
        break;
      }
    }

    expect(hasOpaquePixel).toBe(true);
    expect(hasTransparentPixel).toBe(false);
  });

  it('maps legacy outOfGamut config to edge behavior', async () => {
    const requested: Color = { l: 0.72, c: 0.36, h: 293, alpha: 1 };
    const legacyTransparent: ColorPlaneOutOfGamutConfig = {
      repeatEdgePixels: false,
    };

    const createImageData = vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }));
    const putImageData = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function getContext(this: HTMLCanvasElement, kind: string) {
        if (kind === '2d') {
          return {
            createImageData,
            putImageData,
          } as unknown as RenderingContext;
        }
        return null;
      },
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ColorPlane renderer="cpu" outOfGamut={legacyTransparent} />
      </ColorArea>,
    );

    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled();
    });

    const latestCall = putImageData.mock.calls.at(-1);
    const imageData = latestCall?.[0] as ImageData | undefined;
    expect(imageData).toBeTruthy();

    const pixels = imageData?.data ?? new Uint8ClampedArray();
    let hasTransparentPixel = false;
    let hasOpaquePixel = false;

    for (let index = 3; index < pixels.length; index += 4) {
      const alpha = pixels[index];
      if (alpha === 0) {
        hasTransparentPixel = true;
      }
      if (alpha === 255) {
        hasOpaquePixel = true;
      }
      if (hasTransparentPixel && hasOpaquePixel) {
        break;
      }
    }

    expect(hasTransparentPixel).toBe(true);
    expect(hasOpaquePixel).toBe(true);
  });

  it('clamps out-of-gamut pixels when edge behavior is clamp', async () => {
    const requested: Color = { l: 0.72, c: 0.36, h: 293, alpha: 1 };

    const createImageData = vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }));
    const putImageData = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function getContext(this: HTMLCanvasElement, kind: string) {
        if (kind === '2d') {
          return {
            createImageData,
            putImageData,
          } as unknown as RenderingContext;
        }
        return null;
      },
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ColorPlane renderer="cpu" edgeBehavior="clamp" />
      </ColorArea>,
    );

    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled();
    });

    const latestCall = putImageData.mock.calls.at(-1);
    const imageData = latestCall?.[0] as ImageData | undefined;
    expect(imageData).toBeTruthy();

    const pixels = imageData?.data ?? new Uint8ClampedArray();
    let hasTransparentPixel = false;
    let hasOpaquePixel = false;

    for (let index = 3; index < pixels.length; index += 4) {
      const alpha = pixels[index];
      if (alpha === 0) {
        hasTransparentPixel = true;
      }
      if (alpha === 255) {
        hasOpaquePixel = true;
      }
      if (hasTransparentPixel && hasOpaquePixel) {
        break;
      }
    }

    expect(hasOpaquePixel).toBe(true);
    expect(hasTransparentPixel).toBe(false);
  });

  it('does not clip P3-only colors when display gamut is display-p3', async () => {
    const requested: Color = {
      l: 0.5,
      c: 0.22809734908482968,
      h: 24.864352050672835,
      alpha: 1,
    };

    expect(inP3Gamut(requested)).toBe(true);
    expect(inSrgbGamut(requested)).toBe(false);

    const createImageData = vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }));
    const putImageData = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function getContext(this: HTMLCanvasElement, kind: string) {
        if (kind === '2d') {
          return {
            createImageData,
            putImageData,
          } as unknown as RenderingContext;
        }
        return null;
      },
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    render(
      <ColorArea
        requested={requested}
        onChangeRequested={() => {}}
        axes={{
          x: { channel: 'l', range: [requested.l, requested.l + 0.0001] },
          y: { channel: 'c', range: [requested.c, requested.c + 0.0001] },
        }}
      >
        <ColorPlane
          renderer="cpu"
          displayGamut="display-p3"
          edgeBehavior="transparent"
        />
      </ColorArea>,
    );

    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled();
    });

    const latestCall = putImageData.mock.calls.at(-1);
    const imageData = latestCall?.[0] as ImageData | undefined;
    expect(imageData).toBeTruthy();

    const pixels = imageData?.data ?? new Uint8ClampedArray();
    let hasTransparentPixel = false;
    let hasOpaquePixel = false;

    for (let index = 3; index < pixels.length; index += 4) {
      const alpha = pixels[index];
      if (alpha === 0) {
        hasTransparentPixel = true;
      }
      if (alpha === 255) {
        hasOpaquePixel = true;
      }
      if (hasTransparentPixel && hasOpaquePixel) {
        break;
      }
    }

    expect(hasOpaquePixel).toBe(true);
    expect(hasTransparentPixel).toBe(false);
  });

  it('renders out-of-gamut overlay fills and dot pattern in dedicated layer', async () => {
    const requested: Color = { l: 0.72, c: 0.36, h: 293, alpha: 1 };

    const createImageData = vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }));
    const putImageData = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function getContext(this: HTMLCanvasElement, kind: string) {
        if (kind === '2d') {
          return {
            createImageData,
            putImageData,
          } as unknown as RenderingContext;
        }
        return null;
      },
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <OutOfGamutLayer
          outOfP3FillColor="#1f1f1f"
          outOfP3FillOpacity={0.35}
          dotPatternOpacity={0.3}
          dotPatternSize={2}
          dotPatternGap={2}
        />
      </ColorArea>,
    );

    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled();
    });

    expect(
      container.querySelector('[data-color-area-out-of-gamut-layer]'),
    ).toBeTruthy();
    const latestCall = putImageData.mock.calls.at(-1);
    const imageData = latestCall?.[0] as ImageData | undefined;
    expect(imageData).toBeTruthy();

    const pixels = imageData?.data ?? new Uint8ClampedArray();
    let hasTransparentPixel = false;
    let hasOverlayPixel = false;
    let hasPatternHighlight = false;

    for (let index = 0; index < pixels.length; index += 4) {
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const alpha = pixels[index + 3];
      if (alpha === 0) {
        hasTransparentPixel = true;
      }
      if (alpha > 0) {
        hasOverlayPixel = true;
      }
      if (alpha > 0 && r > 220 && g > 220 && b > 220) {
        hasPatternHighlight = true;
      }
      if (hasTransparentPixel && hasOverlayPixel && hasPatternHighlight) {
        break;
      }
    }

    expect(hasTransparentPixel).toBe(true);
    expect(hasOverlayPixel).toBe(true);
    expect(hasPatternHighlight).toBe(true);
  });

  it('accepts legacy renderer aliases for backward compatibility', async () => {
    const requested: Color = { l: 0.6, c: 0.2, h: 250, alpha: 1 };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function getContext(this: HTMLCanvasElement, kind: string) {
        if (kind === 'webgl') {
          return null;
        }
        if (kind === '2d') {
          return {
            createImageData: (width: number, height: number) => ({
              data: new Uint8ClampedArray(width * height * 4),
              width,
              height,
            }),
            putImageData: () => {},
          } as unknown as RenderingContext;
        }
        return null;
      },
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ColorPlane renderer="webgl" />
      </ColorArea>,
    );

    await waitFor(() => {
      const plane = container.querySelector('[data-color-area-plane]');
      expect(plane?.getAttribute('data-renderer')).toBe('cpu');
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[ColorPlane] renderer="webgl" is deprecated; use renderer="gpu".',
    );
  });
});
