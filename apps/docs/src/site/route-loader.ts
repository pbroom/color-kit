import type { RouteModule, SiteRoute } from './routes';

type TrackedPromise = Promise<RouteModule> & {
  status?: 'pending' | 'fulfilled' | 'rejected';
  value?: RouteModule;
  reason?: unknown;
};

const cache = new Map<string, TrackedPromise>();

/**
 * Load (once) the module that renders `route`. The returned promise carries
 * React's thenable `status`/`value` fields, so once it settles `use()` reads
 * it synchronously. `main.tsx` awaits the current route before
 * `hydrateRoot`, so hydration never suspends on the route chunk and the
 * prerendered markup is adopted as-is.
 */
export function loadRoute(route: SiteRoute): Promise<RouteModule> {
  let promise = cache.get(route.source);
  if (!promise) {
    const tracked: TrackedPromise = route.load();
    tracked.status = 'pending';
    tracked.then(
      (value) => {
        tracked.status = 'fulfilled';
        tracked.value = value;
      },
      (reason: unknown) => {
        tracked.status = 'rejected';
        tracked.reason = reason;
      },
    );
    cache.set(route.source, tracked);
    promise = tracked;
  }
  return promise;
}

/**
 * Best-effort warm-up on hover/focus; never throws. This user intent, not
 * render, is what retries a chunk that failed earlier.
 */
export function preloadRoute(route: SiteRoute): void {
  if (cache.get(route.source)?.status === 'rejected') {
    cache.delete(route.source);
  }
  loadRoute(route).catch(() => {
    // Swallowed: the real navigation surfaces the error.
  });
}
