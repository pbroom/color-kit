// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
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
import * as driver from '@color-kit/driver';
import { useAdaptiveQuality } from '../src/use-adaptive-quality.js';
import { useChromaBand } from '../src/use-chroma-band.js';
import {
  useContrastRegion,
  type UseContrastRegionOptions,
} from '../src/use-contrast-region.js';
import { useFallbackPoints } from '../src/use-fallback-points.js';
import { useGamutBoundary } from '../src/use-gamut-boundary.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type XY = { x: number; y: number };

function subpathsFromD(pathData: string): XY[][] {
  return pathData
    .split(/(?=M\s)/)
    .map((subpath) =>
      Array.from(
        subpath.matchAll(/(?:M|L)\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g),
      ).map((match) => ({ x: Number(match[1]), y: Number(match[2]) })),
    )
    .filter((points) => points.length >= 3);
}

function pointInPolygon(point: XY, polygon: XY[]): boolean {
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

function pathContainsPoint(pathData: string, point: XY): boolean {
  return subpathsFromD(pathData).some((subpath) =>
    pointInPolygon(point, subpath),
  );
}

function pathArea(pathData: string): number {
  return subpathsFromD(pathData).reduce((total, points) => {
    let doubleArea = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      doubleArea += current.x * next.y - next.x * current.y;
    }
    return total + Math.abs(doubleArea) * 0.5;
  }, 0);
}

/** Plane point (0–100 viewBox) of an l/c pair on the default axes. */
function lcToViewBox(l: number, c: number): XY {
  return { x: l * 100, y: (1 - c / 0.4) * 100 };
}

const SQUARE_BOUNDARY = [
  { l: 0, c: 0, x: 0, y: 1 },
  { l: 0, c: 1, x: 0, y: 0 },
  { l: 1, c: 1, x: 1, y: 0 },
  { l: 1, c: 0, x: 1, y: 1 },
];

function packContrastPaths(
  paths: Array<Array<{ l: number; c: number; x: number; y: number }>>,
) {
  return packPlaneQueryResults([
    {
      kind: 'contrastRegion',
      hue: 210,
      paths: paths.map((path) =>
        path.map((point) => ({ ...point, y: 1 - point.y })),
      ),
    },
  ]);
}

/** Worker stub answering every request with `respond(message)`. */
function stubWorker(respond: (message: { id: number }) => object) {
  const posted: unknown[] = [];
  class MockWorker {
    private listeners = new Set<(event: MessageEvent<unknown>) => void>();
    addEventListener(type: string, listener: EventListener): void {
      if (type === 'message') this.listeners.add(listener);
    }
    removeEventListener(type: string, listener: EventListener): void {
      if (type === 'message') this.listeners.delete(listener);
    }
    postMessage(message: { id: number }): void {
      posted.push(message);
      const payload = { id: message.id, ...respond(message) };
      queueMicrotask(() => {
        for (const listener of this.listeners) {
          listener({ data: payload } as MessageEvent<unknown>);
        }
      });
    }
    terminate(): void {}
  }
  vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
  return posted;
}

describe('useGamutBoundary()', () => {
  it('traces the boundary as points and a viewBox path', () => {
    const color: Color = { l: 0.6, c: 0.1, h: 250, alpha: 1 };
    const { result } = renderHook(() =>
      useGamutBoundary({ color }, { gamut: 'srgb' }),
    );
    const expected = driver.getColorAreaGamutBoundaryPoints(
      250,
      driver.resolveColorAreaAxes(),
      { gamut: 'srgb', steps: 48 },
    );
    expect(result.current.points).toEqual(expected);
    expect(result.current.path.startsWith('M 0.000 100.000 L')).toBe(true);
    expect(result.current.quality).toBe('high');
  });

  it('returns empty geometry off a lightness/chroma plane', () => {
    const { result } = renderHook(() =>
      useGamutBoundary({
        color: { l: 0.6, c: 0.1, h: 250, alpha: 1 },
        axes: { x: { channel: 'h' }, y: { channel: 'l' } },
      }),
    );
    expect(result.current.points).toEqual([]);
    expect(result.current.path).toBe('');
  });

  it('scales steps with quality and derives adaptive budgets from pixel size', () => {
    const spy = vi.spyOn(driver, 'getColorAreaGamutBoundaryPoints');
    const color: Color = { l: 0.6, c: 0.1, h: 250, alpha: 1 };
    const stepsAt = (quality: 'high' | 'medium' | 'low') => {
      spy.mockClear();
      renderHook(() => useGamutBoundary({ color }, { quality }));
      return spy.mock.calls.at(-1)?.[2]?.steps;
    };
    expect(stepsAt('high')).toBe(48);
    expect(stepsAt('medium')).toBe(35);
    expect(stepsAt('low')).toBe(24);

    spy.mockClear();
    renderHook(() =>
      useGamutBoundary(
        { color },
        { samplingMode: 'adaptive', pixelSize: { width: 480, height: 320 } },
      ),
    );
    const options = spy.mock.calls.at(-1)?.[2];
    expect(options?.adaptiveTolerance).toBeGreaterThan(0);
    expect(options?.adaptiveMaxDepth).toBeGreaterThanOrEqual(8);
  });

  it('keeps its result for an equal inline plane', () => {
    const spy = vi.spyOn(driver, 'getColorAreaGamutBoundaryPoints');
    const { result, rerender } = renderHook(() =>
      useGamutBoundary({
        color: { l: 0.6, c: 0.1, h: 250, alpha: 1 },
        axes: { x: { channel: 'l' }, y: { channel: 'c', range: [0, 0.37] } },
      }),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('useChromaBand()', () => {
  it('samples the band for lightness/chroma axes', () => {
    const spy = vi.spyOn(driver, 'getColorAreaChromaBandPoints');
    const color: Color = { l: 0.74, c: 0.2, h: 285, alpha: 1 };
    const { result } = renderHook(() =>
      useChromaBand({ color }, { mode: 'proportional', gamut: 'display-p3' }),
    );
    expect(result.current.points.length).toBeGreaterThan(1);
    expect(result.current.path).toMatch(/^M /);
    expect(spy.mock.calls.at(-1)?.[3]).toMatchObject({
      mode: 'proportional',
      gamut: 'display-p3',
      selectedLightness: 0.74,
    });
  });
});

describe('useFallbackPoints()', () => {
  it('places in-gamut colors at their own position', () => {
    const color: Color = { l: 0.6, c: 0.1, h: 250, alpha: 1 };
    const { result } = renderHook(() => useFallbackPoints({ color }));
    expect(result.current.srgb.x).toBeCloseTo(0.6, 6);
    expect(result.current.srgb.y).toBeCloseTo(0.75, 3);
    expect(result.current.p3.x).toBeCloseTo(0.6, 6);
  });

  it('maps out-of-gamut colors into each gamut', () => {
    const color: Color = { l: 0.8, c: 0.4, h: 145, alpha: 1 };
    const { result } = renderHook(() => useFallbackPoints({ color }));
    expect(result.current.srgb.gamut).toBe('srgb');
    expect(result.current.p3.gamut).toBe('display-p3');
    expect(inSrgbGamut(result.current.srgb.color)).toBe(true);
    expect(result.current.srgb.color.c).toBeLessThan(result.current.p3.color.c);
  });
});

describe('useContrastRegion()', () => {
  it('solves with the interactive sampling defaults', () => {
    const spy = vi.spyOn(driver, 'getColorAreaContrastRegionPaths');
    renderHook(() =>
      useContrastRegion(
        { color: { l: 0.6, c: 0.08, h: 150, alpha: 1 } },
        { threshold: 4.5 },
      ),
    );
    expect(spy.mock.calls.at(-1)?.[3]).toMatchObject({
      initialSamples: 8,
      maxDepth: 3,
      errorTolerance: 0.004,
    });
  });

  it('scales sampling with quality', () => {
    const spy = vi.spyOn(driver, 'getColorAreaContrastRegionPaths');
    const color: Color = { l: 0.6, c: 0.08, h: 150, alpha: 1 };
    const optionsAt = (quality: 'high' | 'medium' | 'low') => {
      spy.mockClear();
      const { unmount } = renderHook(() =>
        useContrastRegion(
          { color },
          { threshold: 4.5, quality, initialSamples: 20 },
        ),
      );
      unmount();
      return spy.mock.calls.at(-1)?.[3];
    };
    expect(optionsAt('high')).toMatchObject({
      initialSamples: 20,
      maxDepth: 3,
    });
    expect(optionsAt('medium')).toMatchObject({
      initialSamples: 14,
      maxDepth: 2,
    });
    expect(optionsAt('low')).toMatchObject({ initialSamples: 9, maxDepth: 1 });
  });

  it('requests and reports the sampling clamped as the solver clamps it', async () => {
    const spy = vi.spyOn(driver, 'getColorAreaContrastRegionPaths');
    const onMetrics = vi.fn();
    renderHook(() =>
      useContrastRegion(
        { color: { l: 0.6, c: 0.08, h: 150, alpha: 1 } },
        {
          threshold: 4.5,
          initialSamples: 1000,
          maxDepth: 20,
          errorTolerance: 1e-9,
          onMetrics,
        },
      ),
    );
    const clamped = { initialSamples: 512, maxDepth: 12, errorTolerance: 1e-6 };
    expect(spy.mock.calls.at(-1)?.[3]).toMatchObject(clamped);
    await waitFor(() => expect(onMetrics).toHaveBeenCalled());
    expect(onMetrics.mock.calls.at(-1)?.[0]).toMatchObject({
      ...clamped,
      source: 'sync',
      contrastMetric: 'wcag',
    });
  });

  it('does not re-solve for an equal inline reference', () => {
    const spy = vi.spyOn(driver, 'getColorAreaContrastRegionPaths');
    const { rerender } = renderHook(() =>
      useContrastRegion(
        { color: { l: 0.6, c: 0.08, h: 150, alpha: 1 } },
        { reference: { l: 1, c: 0, h: 0, alpha: 1 } },
      ),
    );
    rerender();
    rerender();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('returns contour and fill paths', () => {
    const { result } = renderHook(() =>
      useContrastRegion(
        { color: { l: 0.85, c: 0.08, h: 200, alpha: 1 } },
        { threshold: 4.5, initialSamples: 32 },
      ),
    );
    expect(result.current.paths.length).toBeGreaterThan(0);
    expect(result.current.path).toMatch(/^M /);
    expect(result.current.fillPaths.length).toBeGreaterThan(0);
    expect(result.current.fillPath).toMatch(/Z$/);
    expect(result.current.source).toBe('sync');
  });

  it('keeps AAA fill non-degenerate near cusp transitions', () => {
    const { result } = renderHook(() =>
      useContrastRegion(
        { color: { l: 0.878, c: 0.1621, h: 292.72, alpha: 1 } },
        { threshold: 7 },
      ),
    );
    expect(pathArea(result.current.fillPath)).toBeGreaterThan(50);
  });

  it.each([3, 4.5])(
    'keeps hue-zero fill off the reference point (threshold %s)',
    (threshold) => {
      const color: Color = { l: 0.4959, c: 0.0902, h: 0, alpha: 1 };
      const { result } = renderHook(() =>
        useContrastRegion({ color }, { threshold }),
      );
      expect(result.current.fillPath.length).toBeGreaterThan(0);
      expect(
        pathContainsPoint(
          result.current.fillPath,
          lcToViewBox(color.l, color.c),
        ),
      ).toBe(false);
    },
  );

  it('keeps an out-of-gamut reference fallback outside the fill', () => {
    const color: Color = { l: 0.62, c: 0.33, h: 9, alpha: 1 };
    expect(inSrgbGamut(color)).toBe(false);
    const { result } = renderHook(() =>
      useContrastRegion({ color }, { gamut: 'srgb', threshold: 4.5 }),
    );
    const fallback = toSrgbGamut(color);
    expect(
      pathContainsPoint(
        result.current.fillPath,
        lcToViewBox(fallback.l, fallback.c),
      ),
    ).toBe(false);
  });

  it.each<{ gamut: GamutTarget; threshold: number }>([
    { gamut: 'display-p3', threshold: 3 },
    { gamut: 'srgb', threshold: 4.5 },
  ])(
    'fills the side that passes the $gamut WCAG check',
    ({ gamut, threshold }) => {
      // An out-of-gamut reference maps onto the gamut edge, where the
      // reference point cannot pick the fill side, so this exercises scoring.
      const reference: Color = { l: 0.62, c: 0.36, h: 150, alpha: 1 };
      expect(inP3Gamut(reference)).toBe(false);
      const options: UseContrastRegionOptions = { gamut, threshold };
      const { result } = renderHook(() =>
        useContrastRegion({ color: reference }, options),
      );
      const mapped =
        gamut === 'display-p3' ? toP3Gamut(reference) : toSrgbGamut(reference);
      let passing = 0;
      let failing = 0;
      for (let l = 0.025; l < 1; l += 0.05) {
        const edge = maxChromaAt(l, reference.h, { gamut });
        for (let c = 0.005; c < edge * 0.9; c += 0.02) {
          const sample: Color = { l, c, h: reference.h, alpha: 1 };
          const margin =
            contrastRatio(sample, mapped, { gamut }) / threshold - 1;
          if (Math.abs(margin) < 0.15) continue;
          expect(
            pathContainsPoint(result.current.fillPath, lcToViewBox(l, c)),
            `l=${l.toFixed(3)} c=${c.toFixed(3)}`,
          ).toBe(margin > 0);
          if (margin > 0) passing += 1;
          else failing += 1;
        }
      }
      expect(passing).toBeGreaterThan(0);
      expect(failing).toBeGreaterThan(0);
    },
  );

  it.each<[ContrastApcaPolarity, 'dark' | 'light']>([
    ['positive', 'dark'],
    ['negative', 'light'],
  ])(
    'scores an ambiguous closure by APCA polarity (%s fills the %s side)',
    (polarity, expectedSide) => {
      const y = (c: number) => 1 - c / 0.4;
      vi.spyOn(driver, 'getColorAreaGamutBoundaryPoints').mockReturnValue([
        { l: 0.1, c: 0, x: 0.1, y: y(0) },
        { l: 0.1, c: 0.1, x: 0.1, y: y(0.1) },
        { l: 0.95, c: 0.1, x: 0.95, y: y(0.1) },
        { l: 0.95, c: 0, x: 0.95, y: y(0) },
      ]);
      vi.spyOn(driver, 'getColorAreaContrastRegionPaths').mockReturnValue([
        [
          { l: 0.55, c: 0, x: 0.55, y: y(0) },
          { l: 0.55, c: 0.1, x: 0.55, y: y(0.1) },
        ],
      ]);
      const reference: Color = { l: 0.55, c: 0.14, h: 250, alpha: 1 };
      const { result } = renderHook(() =>
        useContrastRegion(
          { color: reference },
          { metric: 'apca', threshold: 0.15, apcaPolarity: polarity },
        ),
      );
      const at = (l: number) => ({ x: l * 100, y: y(0.05) * 100 });
      expect(pathContainsPoint(result.current.fillPath, at(0.3))).toBe(
        expectedSide === 'dark',
      );
      expect(pathContainsPoint(result.current.fillPath, at(0.8))).toBe(
        expectedSide === 'light',
      );
    },
  );

  it('closes a right-edge arc without a corner kink', () => {
    vi.spyOn(driver, 'getColorAreaGamutBoundaryPoints').mockReturnValue(
      SQUARE_BOUNDARY,
    );
    vi.spyOn(driver, 'getColorAreaContrastRegionPaths').mockReturnValue([
      [
        { l: 1, c: 0.2, x: 1, y: 0.8 },
        { l: 0.7, c: 0.5, x: 0.7, y: 0.5 },
        { l: 1, c: 0.8, x: 1, y: 0.2 },
      ],
    ]);
    const { result } = renderHook(() =>
      useContrastRegion(
        { color: { l: 0.3, c: 0.2, h: 210, alpha: 1 } },
        { threshold: 4.5 },
      ),
    );
    expect(result.current.fillPath).not.toContain('L 100.000 0.000');
    expect(result.current.fillPath).not.toContain('L 100.000 100.000');
  });

  it('fills both sides when both contrast regions exist', () => {
    vi.spyOn(driver, 'getColorAreaGamutBoundaryPoints').mockReturnValue(
      SQUARE_BOUNDARY,
    );
    vi.spyOn(driver, 'getColorAreaContrastRegionPaths').mockReturnValue([
      [
        { l: 0.2, c: 0, x: 0.2, y: 1 },
        { l: 0.4, c: 1, x: 0.4, y: 0 },
      ],
      [
        { l: 0.6, c: 1, x: 0.6, y: 0 },
        { l: 0.8, c: 0, x: 0.8, y: 1 },
      ],
    ]);
    const { result } = renderHook(() =>
      useContrastRegion(
        { color: { l: 0.55, c: 0.12, h: 210, alpha: 1 } },
        { threshold: 4.5 },
      ),
    );
    expect(result.current.fillPaths.length).toBe(2);
    expect(result.current.fillPath.match(/\bM\b/g)?.length).toBe(2);
  });

  it('solves in the worker while dragging and reports worker metrics', async () => {
    vi.spyOn(driver, 'getColorAreaGamutBoundaryPoints').mockReturnValue(
      SQUARE_BOUNDARY,
    );
    vi.spyOn(driver, 'getColorAreaContrastRegionPaths').mockReturnValue([]);
    const posted = stubWorker(() => ({
      result: packContrastPaths([
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
      schedulerTelemetry: { buckets: [{ key: 'contrastRegion|drag' }] },
      computeTimeMs: 1.2,
      marshalTimeMs: 0.4,
    }));
    const onMetrics = vi.fn();
    const { result } = renderHook(() =>
      useContrastRegion(
        { color: { l: 0.36, c: 0.16, h: 210, alpha: 1 } },
        {
          threshold: 4.5,
          isDragging: true,
          includeSchedulerTelemetry: true,
          onMetrics,
        },
      ),
    );

    await waitFor(() => {
      expect(result.current.paths.length).toBe(1);
    });
    expect(result.current.source).toBe('worker');
    const workerMetrics = onMetrics.mock.calls
      .map((call) => call[0])
      .filter((metric) => metric.source === 'worker');
    const latest = workerMetrics.at(-1);
    expect(latest).toMatchObject({
      backend: 'js',
      scheduleReason: 'default-js',
      schedulerBucketCount: 1,
      contrastMetric: 'wcag',
      isDragging: true,
    });
    expect(posted.length).toBeGreaterThan(0);
  });

  it('clears the drag result when the latest worker response is empty', async () => {
    vi.spyOn(driver, 'getColorAreaGamutBoundaryPoints').mockReturnValue(
      SQUARE_BOUNDARY,
    );
    vi.spyOn(driver, 'getColorAreaContrastRegionPaths').mockReturnValue([]);
    stubWorker((message) => ({
      result: packContrastPaths(
        message.id === 1
          ? [
              [
                { l: 0.2, c: 0.2, x: 0.2, y: 0.8 },
                { l: 0.5, c: 0.5, x: 0.5, y: 0.5 },
                { l: 0.8, c: 0.2, x: 0.8, y: 0.8 },
              ],
            ]
          : [],
      ),
      computeTimeMs: 1,
    }));

    const { result, rerender } = renderHook(
      ({ color }: { color: Color }) =>
        useContrastRegion({ color }, { threshold: 4.5, isDragging: true }),
      { initialProps: { color: { l: 0.35, c: 0.16, h: 210, alpha: 1 } } },
    );
    await waitFor(() => expect(result.current.paths.length).toBe(1));

    rerender({ color: { l: 0.66, c: 0.08, h: 210, alpha: 1 } });
    await waitFor(() => expect(result.current.paths.length).toBe(0));
  });
});

describe('useAdaptiveQuality()', () => {
  const slow = { updateDurationMs: 12, frameTimeMs: 24 };
  const fast = { updateDurationMs: 1, frameTimeMs: 8 };

  it('steps down while frames are slow and back up once they recover', () => {
    const { result } = renderHook(() => useAdaptiveQuality('auto'));
    expect(result.current.quality).toBe('high');

    act(() => {
      result.current.reportFrame(slow);
    });
    expect(result.current.quality).toBe('medium');
    act(() => {
      result.current.reportFrame(slow);
    });
    expect(result.current.quality).toBe('low');

    act(() => {
      result.current.reset();
      result.current.reportFrame(fast);
    });
    expect(result.current.quality).toBe('medium');
  });

  it('never degrades the quality profile', () => {
    const { result } = renderHook(() => useAdaptiveQuality('quality'));
    act(() => {
      expect(result.current.reportFrame(slow)).toBe('high');
    });
    expect(result.current.quality).toBe('high');
  });

  it('starts the performance profile at medium and resets on profile change', () => {
    const { result, rerender } = renderHook(
      ({ profile }: { profile: 'performance' | 'auto' }) =>
        useAdaptiveQuality(profile),
      { initialProps: { profile: 'performance' as 'performance' | 'auto' } },
    );
    expect(result.current.quality).toBe('medium');
    act(() => {
      result.current.reportFrame(slow);
    });
    expect(result.current.quality).toBe('low');
    rerender({ profile: 'auto' });
    expect(result.current.quality).toBe('high');
  });
});
