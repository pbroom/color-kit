// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import {
  createPlaneComputeScheduler,
  packPlaneQueryResults,
} from '@color-kit/core/compute';
import { useAdaptiveQuality } from '../src/use-adaptive-quality.js';
import { useChromaBand } from '../src/use-chroma-band.js';
import { useContrastRegion } from '../src/use-contrast-region.js';
import { useGamutBoundary } from '../src/use-gamut-boundary.js';
import type { PlaneQueryWorkerRequest } from '../src/workers/plane-query.worker.types.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * Worker stub that runs the real plane compute scheduler, like the shipped
 * worker. With `hold`, responses wait for `flush()`; `empty(id)` answers that
 * request with an empty line instead.
 */
function stubComputeWorker(
  options: { hold?: boolean; empty?: (id: number) => boolean } = {},
) {
  const scheduler = createPlaneComputeScheduler();
  const pending: Array<() => void> = [];
  let delivered = 0;
  class ComputeWorker {
    private listeners = new Set<(event: MessageEvent<unknown>) => void>();
    addEventListener(type: string, listener: EventListener): void {
      if (type === 'message') this.listeners.add(listener);
    }
    removeEventListener(type: string, listener: EventListener): void {
      if (type === 'message') this.listeners.delete(listener);
    }
    postMessage(message: PlaneQueryWorkerRequest): void {
      const query = message.queries[0];
      const hue = 'hue' in query && query.hue !== undefined ? query.hue : 0;
      const result = options.empty?.(message.id)
        ? packPlaneQueryResults([
            query.kind === 'chromaBand'
              ? { kind: 'chromaBand', hue, points: [] }
              : { kind: 'gamutBoundary', gamut: 'srgb', hue, points: [] },
          ])
        : scheduler.run({
            plane: message.plane,
            queries: message.queries,
            priority: message.priority,
            quality: message.quality,
            performanceProfile: message.performanceProfile,
          }).result;
      const deliver = () => {
        delivered += 1;
        for (const listener of this.listeners) {
          listener({
            data: { id: message.id, result },
          } as MessageEvent<unknown>);
        }
      };
      if (options.hold) pending.push(deliver);
      else queueMicrotask(deliver);
    }
    terminate(): void {}
  }
  vi.stubGlobal('Worker', ComputeWorker as unknown as typeof Worker);
  return {
    delivered: () => delivered,
    flush: () => {
      for (const deliver of pending.splice(0)) deliver();
    },
  };
}

type LinePoint = { l: number; c: number; x: number; y: number };

function expectSamePoints(actual: LinePoint[], expected: LinePoint[]) {
  expect(actual.length).toBe(expected.length);
  expect(actual.length).toBeGreaterThan(1);
  actual.forEach((point, index) => {
    expect(point.x).toBeCloseTo(expected[index].x, 6);
    expect(point.y).toBeCloseTo(expected[index].y, 6);
    expect(point.l).toBeCloseTo(expected[index].l, 6);
    expect(point.c).toBeCloseTo(expected[index].c, 6);
  });
}

describe.each([
  {
    name: 'useGamutBoundary',
    use: (color: Color, isDragging: boolean) =>
      useGamutBoundary({ color }, { gamut: 'srgb', isDragging }),
  },
  {
    name: 'useChromaBand',
    use: (color: Color, isDragging: boolean) =>
      useChromaBand({ color }, { gamut: 'srgb', isDragging }),
  },
])('$name while dragging', ({ use }) => {
  const at = (h: number): Color => ({ l: 0.6, c: 0.12, h, alpha: 1 });
  const syncResult = (color: Color) =>
    renderHook(() => use(color, false)).result.current;

  it('draws worker results in plane coordinates and clears on an empty result', async () => {
    const expected = syncResult(at(200));
    const worker = stubComputeWorker({ empty: (id) => id >= 3 });
    const { result, rerender } = renderHook(
      ({ color }: { color: Color }) => use(color, true),
      { initialProps: { color: at(250) } },
    );
    await waitFor(() => expect(worker.delivered()).toBe(1));

    // With a worker result in hand sync compute stops, so what follows is
    // the worker's geometry, y-flipped into plane coordinates.
    rerender({ color: at(200) });
    await waitFor(() => expect(worker.delivered()).toBe(2));
    await waitFor(() => expect(result.current.path).toBe(expected.path));
    expectSamePoints(result.current.points, expected.points);

    rerender({ color: at(150) });
    await waitFor(() => expect(result.current.points).toEqual([]));
    expect(result.current.path).toBe('');
  });

  it('starts the next drag from the latest idle result', async () => {
    const worker = stubComputeWorker({ hold: true });
    const { result, rerender } = renderHook(
      ({ color, dragging }: { color: Color; dragging: boolean }) =>
        use(color, dragging),
      { initialProps: { color: at(250), dragging: true } },
    );
    await act(async () => worker.flush());
    expect(worker.delivered()).toBe(1);

    rerender({ color: at(250), dragging: false });
    rerender({ color: at(200), dragging: false });
    await act(async () => {});
    const idle = result.current.path;
    expect(idle).toBe(syncResult(at(200)).path);

    // The second drag's request is still pending: keep the idle line, not
    // the first drag's worker line.
    rerender({ color: at(200), dragging: true });
    await act(async () => {});
    expect(result.current.path).toBe(idle);
  });
});

describe('useContrastRegion() source', () => {
  it('reports sync contours until the drag gets a worker result', async () => {
    const worker = stubComputeWorker({ hold: true });
    const color: Color = { l: 0.85, c: 0.08, h: 200, alpha: 1 };
    const { result, rerender } = renderHook(
      ({ dragging }: { dragging: boolean }) =>
        useContrastRegion(
          { color },
          { threshold: 4.5, initialSamples: 32, isDragging: dragging },
        ),
      { initialProps: { dragging: false } },
    );
    await act(async () => {});
    expect(result.current.paths.length).toBeGreaterThan(0);
    expect(result.current.source).toBe('sync');

    rerender({ dragging: true });
    await act(async () => {});
    expect(result.current.paths.length).toBeGreaterThan(0);
    expect(result.current.source).toBe('sync');

    await act(async () => worker.flush());
    await waitFor(() => expect(result.current.source).toBe('worker'));
  });
});

describe('useAdaptiveQuality() profile changes', () => {
  it('starts a revisited profile from its default level', () => {
    const slow = { updateDurationMs: 12, frameTimeMs: 24 };
    const { result, rerender } = renderHook(
      ({ profile }: { profile: 'auto' | 'quality' }) =>
        useAdaptiveQuality(profile),
      { initialProps: { profile: 'auto' as 'auto' | 'quality' } },
    );
    act(() => {
      result.current.reportFrame(slow);
    });
    act(() => {
      result.current.reportFrame(slow);
    });
    expect(result.current.quality).toBe('low');

    rerender({ profile: 'quality' });
    expect(result.current.quality).toBe('high');
    rerender({ profile: 'auto' });
    expect(result.current.quality).toBe('high');
  });
});
