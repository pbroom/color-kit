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
        // Allow a later navigation to retry a failed chunk.
        cache.delete(route.source);
      },
    );
    cache.set(route.source, tracked);
    promise = tracked;
  }
  return promise;
}

/** Best-effort warm-up on hover/focus; never throws. */
export function preloadRoute(route: SiteRoute): void {
  loadRoute(route).catch(() => {
    // Swallowed: the real navigation surfaces the error.
  });
}
