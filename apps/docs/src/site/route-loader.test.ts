import { describe, expect, it, vi } from 'vitest';
import { loadRoute, preloadRoute } from './route-loader';
import type { RouteModule, SiteRoute } from './routes';

function failingRoute(source: string) {
  const load = vi.fn(() =>
    Promise.reject<RouteModule>(new Error('chunk unavailable')),
  );
  return { route: { source, load } as unknown as SiteRoute, load };
}

describe('route loader', () => {
  it('keeps a failed chunk rejected so render reaches the error boundary', async () => {
    const { route, load } = failingRoute('failed-render.tsx');
    const first = loadRoute(route);
    await expect(first).rejects.toThrow('chunk unavailable');
    // A retry render must read the same settled promise, not a new pending one.
    const again = loadRoute(route);
    expect(again).toBe(first);
    expect(again).toMatchObject({ status: 'rejected' });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries a failed chunk on preload intent', async () => {
    const { route, load } = failingRoute('failed-preload.tsx');
    await expect(loadRoute(route)).rejects.toThrow();
    preloadRoute(route);
    expect(load).toHaveBeenCalledTimes(2);
    await expect(loadRoute(route)).rejects.toThrow();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
