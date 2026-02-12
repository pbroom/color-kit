// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { ChromaBandLayer } from '../src/chroma-band-layer.js';
import { ColorArea } from '../src/color-area.js';
import { ColorPlane } from '../src/color-plane.js';
import { ContrastRegionLayer } from '../src/contrast-region-layer.js';
import { FallbackPointsLayer } from '../src/fallback-points-layer.js';
import { GamutBoundaryLayer } from '../src/gamut-boundary-layer.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

  it('renders contrast regions in filled region mode with pattern overlay', () => {
    const requested: Color = { l: 0.68, c: 0.22, h: 245, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer
          threshold={4.5}
          renderMode="region"
          regionFillColor="#88aaff"
          regionFillOpacity={0.2}
          regionDotOpacity={0.2}
          regionDotSize={2}
          regionDotGap={2}
        />
      </ColorArea>,
    );

    expect(
      container.querySelector('[data-color-area-contrast-region-layer]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-color-area-contrast-region-fill]'),
    ).toBeTruthy();
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
        <ColorPlane
          renderer="gpu"
          outOfGamut={{
            repeatEdgePixels: false,
            outOfP3FillColor: '#1f1f1f',
            outOfP3FillOpacity: 0.45,
            outOfSrgbFillColor: '#0a0a0a',
            outOfSrgbFillOpacity: 0.35,
            dotPatternOpacity: 0.2,
            dotPatternSize: 2,
            dotPatternGap: 2,
          }}
        />
      </ColorArea>,
    );

    await waitFor(() => {
      const plane = container.querySelector('[data-color-area-plane]');
      expect(plane?.getAttribute('data-renderer')).toBe('cpu');
      expect(createImageData).toHaveBeenCalled();
      expect(putImageData).toHaveBeenCalled();
    });
  });

  it('clips out-of-gamut pixels when repeat edge pixels is disabled', async () => {
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
        <ColorPlane
          renderer="cpu"
          outOfGamut={{
            repeatEdgePixels: false,
            outOfP3FillOpacity: 0,
            outOfSrgbFillOpacity: 0,
            dotPatternOpacity: 0,
          }}
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

    expect(hasTransparentPixel).toBe(true);
    expect(hasOpaquePixel).toBe(true);
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
