// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import {
  contrastRatio,
  inP3Gamut,
  inSrgbGamut,
  maxChromaAt,
  toP3Gamut,
  toSrgbGamut,
  type Color,
  type ContrastApcaPolarity,
  type GamutTarget,
} from '@color-kit/core';
import { packPlaneQueryResults } from '@color-kit/core/compute';
import * as colorAreaApi from '@color-kit/driver';
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

function packContrastRegionWorkerResult(
  paths: Array<Array<{ l: number; c: number; x: number; y: number }>>,
) {
  return packPlaneQueryResults([
    {
      kind: 'contrastRegion',
      hue: 210,
      paths: paths.map((path) =>
        path.map((point) => ({
          ...point,
          y: 1 - point.y,
        })),
      ),
    },
  ]);
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

interface FillCase {
  gamut: GamutTarget;
  margin: (sample: Color, reference: Color) => number;
  props: Partial<Parameters<typeof ContrastRegionLayer>[0]>;
}

/**
 * Renders the fill and checks it against the public contrast check (against
 * the gamut-mapped reference the layer measures from) on a grid of in-gamut
 * samples that clearly pass or fail, away from the contour and the gamut
 * edge. Returns the passing/failing sample counts.
 */
function expectFillMatchesCheck(
  reference: Color,
  { gamut, margin, props }: FillCase,
): { passing: number; failing: number } {
  const { container } = render(
    <ColorArea requested={reference} onChangeRequested={() => {}}>
      <ContrastRegionLayer gamut={gamut} {...props}>
        <ContrastRegionFill dotOpacity={0} />
      </ContrastRegionLayer>
    </ColorArea>,
  );
  const pathData =
    container
      .querySelector('[data-color-area-contrast-region-fill] path')
      ?.getAttribute('d') ?? '';
  expect(pathData.length).toBeGreaterThan(0);

  const mapped =
    gamut === 'display-p3' ? toP3Gamut(reference) : toSrgbGamut(reference);
  let passing = 0;
  let failing = 0;
  for (let l = 0.025; l < 1; l += 0.05) {
    const edge = maxChromaAt(l, reference.h, { gamut });
    for (let c = 0.005; c < edge * 0.9; c += 0.02) {
      const sample: Color = { l, c, h: reference.h, alpha: 1 };
      const value = margin(sample, mapped);
      if (Math.abs(value) < 0.15) continue;
      const point = { x: l * 100, y: (1 - c / 0.4) * 100 };
      expect(
        pathContainsPoint(pathData, point),
        `l=${l.toFixed(3)} c=${c.toFixed(3)} margin=${value.toFixed(3)}`,
      ).toBe(value > 0);
      if (value > 0) passing += 1;
      else failing += 1;
    }
  }
  return { passing, failing };
}

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

  it('runs contrast regions with the interactive solver defaults', () => {
    const spy = vi.spyOn(colorAreaApi, 'getColorAreaContrastRegionPaths');
    const requested: Color = { l: 0.6, c: 0.08, h: 150, alpha: 1 };
    render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer threshold={4.5} quality="high" />
      </ColorArea>,
    );

    expect(spy).toHaveBeenCalled();
    const options = spy.mock.calls[spy.mock.calls.length - 1][3] ?? {};
    expect(options).toMatchObject({
      lightnessSteps: 12,
      chromaSteps: 16,
      hybridMaxDepth: 3,
      hybridErrorTolerance: 0.003,
    });
    for (const removed of [
      'engine',
      'samplingMode',
      'edgeInterpolation',
      'adaptiveBaseSteps',
      'adaptiveMaxDepth',
    ]) {
      expect(options).not.toHaveProperty(removed);
    }
  });

  it('renders layer primitives with externally supplied plane geometry', () => {
    const requested: Color = { l: 0.7, c: 0.2, h: 240, alpha: 1 };
    const points = [
      { x: 0.1, y: 0.8 },
      { x: 0.5, y: 0.2 },
      { x: 0.9, y: 0.8 },
    ];
    const regionPath = [
      [
        { l: 0.4, c: 0.1, x: 0.2, y: 0.8 },
        { l: 0.45, c: 0.2, x: 0.5, y: 0.3 },
        { l: 0.5, c: 0.1, x: 0.8, y: 0.8 },
      ],
    ];
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <GamutBoundaryLayer points={points} />
        <ChromaBandLayer points={points} />
        <ContrastRegionLayer paths={regionPath} />
        <FallbackPointsLayer
          p3Point={{
            x: 0.2,
            y: 0.4,
            color: { l: 0.55, c: 0.2, h: 210, alpha: 1 },
          }}
          srgbPoint={{
            x: 0.85,
            y: 0.6,
            color: { l: 0.6, c: 0.15, h: 260, alpha: 1 },
          }}
        />
      </ColorArea>,
    );

    expect(
      container.querySelector('[data-color-area-gamut-boundary-layer]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-color-area-chroma-band-layer]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-color-area-contrast-region-layer]'),
    ).toBeTruthy();

    const p3Point = container.querySelector(
      '[data-color-area-fallback-point][data-gamut="display-p3"]',
    );
    const srgbPoint = container.querySelector(
      '[data-color-area-fallback-point][data-gamut="srgb"]',
    );
    expect(p3Point).toBeTruthy();
    expect(srgbPoint).toBeTruthy();
  });

  it('skips expensive sampling when external points are provided', () => {
    const requested: Color = { l: 0.7, c: 0.2, h: 240, alpha: 1 };
    const points = [
      { x: 0.1, y: 0.8 },
      { x: 0.5, y: 0.2 },
      { x: 0.9, y: 0.8 },
    ];
    const boundarySpy = vi.spyOn(
      colorAreaApi,
      'getColorAreaGamutBoundaryPoints',
    );
    const bandSpy = vi.spyOn(colorAreaApi, 'getColorAreaChromaBandPoints');

    render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <GamutBoundaryLayer points={points} />
        <ChromaBandLayer points={points} />
      </ColorArea>,
    );

    expect(boundarySpy).not.toHaveBeenCalled();
    expect(bandSpy).not.toHaveBeenCalled();
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

  it('renders non-empty contrast region lines', () => {
    const requested: Color = { l: 0.85, c: 0.08, h: 200, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer
          threshold={4.5}
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

  it('renders contrast region fill when paths are open', () => {
    const requested: Color = { l: 0.6953, c: 0.1316, h: 29, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer threshold={4.5}>
          <ContrastRegionFill dotOpacity={0.2} />
        </ContrastRegionLayer>
      </ColorArea>,
    );

    expect(
      container.querySelector('[data-color-area-contrast-region-fill]'),
    ).toBeTruthy();
  });

  it('keeps AAA fill non-degenerate near cusp transitions', () => {
    const requested: Color = { l: 0.878, c: 0.1621, h: 292.72, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer threshold={7}>
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
          <ContrastRegionLayer threshold={threshold}>
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
        <ContrastRegionLayer gamut="srgb" threshold={4.5}>
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

  // Out-of-gamut references map onto the gamut edge, where the reference
  // point cannot pick the fill side, so these exercise the fill scoring.
  it('fills the Display P3 side that passes the gamut-aware WCAG check', () => {
    const reference: Color = { l: 0.62, c: 0.36, h: 150, alpha: 1 };
    expect(inP3Gamut(reference)).toBe(false);

    const counts = expectFillMatchesCheck(reference, {
      gamut: 'display-p3',
      margin: (sample, ref) =>
        contrastRatio(sample, ref, { gamut: 'display-p3' }) / 3 - 1,
      props: { threshold: 3 },
    });
    expect(counts.passing).toBeGreaterThan(0);
    expect(counts.failing).toBeGreaterThan(0);
  });

  it.each<[ContrastApcaPolarity, 'dark' | 'light']>([
    ['positive', 'dark'],
    ['negative', 'light'],
  ])(
    'scores an ambiguous closure by APCA polarity (%s fills the %s side)',
    (polarity, expectedSide) => {
      // The contour splits the plotted boundary into a darker and a lighter
      // half, and the reference sits above both (higher chroma), so only the
      // fill scoring (APCA with polarity) can choose the side.
      const y = (c: number) => 1 - c / 0.4;
      vi.spyOn(colorAreaApi, 'getColorAreaGamutBoundaryPoints').mockReturnValue(
        [
          { l: 0.1, c: 0, x: 0.1, y: y(0) },
          { l: 0.1, c: 0.1, x: 0.1, y: y(0.1) },
          { l: 0.95, c: 0.1, x: 0.95, y: y(0.1) },
          { l: 0.95, c: 0, x: 0.95, y: y(0) },
        ],
      );
      vi.spyOn(colorAreaApi, 'getColorAreaContrastRegionPaths').mockReturnValue(
        [
          [
            { l: 0.55, c: 0, x: 0.55, y: y(0) },
            { l: 0.55, c: 0.1, x: 0.55, y: y(0.1) },
          ],
        ],
      );

      const reference: Color = { l: 0.55, c: 0.14, h: 250, alpha: 1 };
      expect(inSrgbGamut(reference)).toBe(true);
      const { container } = render(
        <ColorArea requested={reference} onChangeRequested={() => {}}>
          <ContrastRegionLayer
            metric="apca"
            threshold={0.15}
            apcaPolarity={polarity}
          >
            <ContrastRegionFill dotOpacity={0} />
          </ContrastRegionLayer>
        </ColorArea>,
      );

      const pathData =
        container
          .querySelector('[data-color-area-contrast-region-fill] path')
          ?.getAttribute('d') ?? '';
      const at = (l: number) => ({ x: l * 100, y: y(0.05) * 100 });
      expect(pathContainsPoint(pathData, at(0.3))).toBe(
        expectedSide === 'dark',
      );
      expect(pathContainsPoint(pathData, at(0.8))).toBe(
        expectedSide === 'light',
      );
    },
  );

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
          result: packContrastRegionWorkerResult(
            message.id === 1 ? firstResponsePaths : [],
          ),
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
        <ContrastRegionLayer threshold={4.5} />
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
        <ContrastRegionLayer threshold={4.5} />
      </ColorArea>,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('[data-color-area-line]').length).toBe(
        0,
      );
    });
  });

  it('emits worker scheduler observability metrics during drag', async () => {
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

    const postedMessages: unknown[] = [];
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
        postedMessages.push(message);
        const payload = {
          id: message.id,
          result: packContrastRegionWorkerResult([
            [
              { l: 0.2, c: 0.18, x: 0.2, y: 0.82 },
              { l: 0.5, c: 0.32, x: 0.5, y: 0.55 },
              { l: 0.8, c: 0.2, x: 0.8, y: 0.8 },
            ],
          ]),
          backend: 'js',
          schedule: {
            bucketKey: 'contrastRegion|drag',
            selectedBackend: 'js',
            reason: 'default-js',
          },
          schedulerTelemetry: {
            buckets: [
              {
                key: 'contrastRegion|drag',
                totalSamples: 5,
                lastUsedBackend: 'js',
                backends: {
                  js: {
                    sampleCount: 5,
                    averageTotalMs: 4.1,
                    lastTotalMs: 4.6,
                  },
                },
              },
            ],
          },
          computeTimeMs: 1.2,
          marshalTimeMs: 0.4,
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

    const requested: Color = { l: 0.36, c: 0.16, h: 210, alpha: 1 };
    const onMetrics = vi.fn();
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}}>
        <ContrastRegionLayer
          threshold={4.5}
          includeSchedulerTelemetry
          onMetrics={onMetrics}
        />
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
      pointerId: 7,
      clientX: 22,
      clientY: 78,
    });

    await waitFor(() => {
      const workerMetrics = onMetrics.mock.calls
        .map((call) => call[0])
        .filter((metric) => metric.source === 'worker');
      expect(workerMetrics.length).toBeGreaterThan(0);
    });

    const workerMetrics = onMetrics.mock.calls
      .map((call) => call[0])
      .filter((metric) => metric.source === 'worker');
    const latest = workerMetrics[workerMetrics.length - 1];

    expect(latest.source).toBe('worker');
    expect(latest.backend).toBe('js');
    expect(latest.scheduleReason).toBe('default-js');
    expect(latest.schedulerBucketCount).toBe(1);
    expect(latest.contrastMetric).toBe('wcag');
    expect(latest.hybridMaxDepth).toBeGreaterThanOrEqual(1);
    // Metrics report the sampling the solver was asked to run with.
    const findOption = (value: unknown, key: string): unknown => {
      if (value == null || typeof value !== 'object') return undefined;
      if (key in value) return (value as Record<string, unknown>)[key];
      for (const child of Object.values(value)) {
        const found = findOption(child, key);
        if (found !== undefined) return found;
      }
      return undefined;
    };
    const lastRequest = postedMessages[postedMessages.length - 1];
    expect(latest.hybridMaxDepth).toBe(
      findOption(lastRequest, 'hybridMaxDepth'),
    );
    expect(latest.lightnessSteps).toBe(
      findOption(lastRequest, 'lightnessSteps'),
    );
    expect(latest.chromaSteps).toBe(findOption(lastRequest, 'chromaSteps'));
  });

  it.each([
    {
      label: 'wcag',
      props: {
        threshold: 4.5,
      },
      expectedMetric: 'wcag',
    },
    {
      label: 'apca',
      props: {
        metric: 'apca' as const,
        threshold: 0.45,
        apcaPolarity: 'absolute' as const,
      },
      expectedMetric: 'apca',
    },
  ])(
    'reports %s worker metrics with the resolved contrast metric',
    async ({ props, expectedMetric }) => {
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

      class MetricWorker {
        private listeners = new Set<(event: MessageEvent<unknown>) => void>();

        addEventListener(
          type: string,
          listener: EventListenerOrEventListenerObject,
        ): void {
          if (type !== 'message' || typeof listener !== 'function') {
            return;
          }
          this.listeners.add(
            listener as (event: MessageEvent<unknown>) => void,
          );
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
            result: packContrastRegionWorkerResult([
              [
                { l: 0.2, c: 0.16, x: 0.2, y: 0.82 },
                { l: 0.5, c: 0.3, x: 0.5, y: 0.56 },
                { l: 0.8, c: 0.18, x: 0.8, y: 0.8 },
              ],
            ]),
            backend: 'js',
            schedule: {
              bucketKey: 'contrastRegion|drag',
              selectedBackend: 'js',
              reason: 'default-js',
            },
            computeTimeMs: 1,
            marshalTimeMs: 0.2,
          };
          queueMicrotask(() => {
            for (const listener of this.listeners) {
              listener({ data: payload } as MessageEvent<unknown>);
            }
          });
        }

        terminate(): void {}
      }

      vi.stubGlobal('Worker', MetricWorker as unknown as typeof Worker);

      const requested: Color = { l: 0.35, c: 0.14, h: 210, alpha: 1 };
      const onMetrics = vi.fn();
      const { container } = render(
        <ColorArea requested={requested} onChangeRequested={() => {}}>
          <ContrastRegionLayer {...props} onMetrics={onMetrics} />
        </ColorArea>,
      );

      const root = container.querySelector(
        '[data-color-area]',
      ) as HTMLDivElement;
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
        pointerId: 5,
        clientX: 18,
        clientY: 72,
      });

      await waitFor(() => {
        const workerMetrics = onMetrics.mock.calls
          .map((call) => call[0])
          .filter((metric) => metric.source === 'worker');
        expect(workerMetrics.length).toBeGreaterThan(0);
      });

      const workerMetrics = onMetrics.mock.calls
        .map((call) => call[0])
        .filter((metric) => metric.source === 'worker');
      const latest = workerMetrics[workerMetrics.length - 1];

      expect(latest.source).toBe('worker');
      expect(latest.scheduleReason).toBe('default-js');
      expect(latest.contrastMetric).toBe(expectedMetric);
    },
  );

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
