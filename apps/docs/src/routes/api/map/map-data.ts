import { loadEntry } from '@/api/data';
import type { ApiEntry } from '@/api/model';
import { routes } from '@/site/routes';

type Tracked<T> = Promise<T> & {
  status?: 'pending' | 'fulfilled' | 'rejected';
  value?: T;
  reason?: unknown;
};

let cached: Tracked<ApiEntry[]> | null = null;

/** Entry slugs in package order, from the route registry. */
export function entrySlugs(): string[] {
  return routes
    .filter((route) => route.kind === 'api-entry' && route.entry)
    .map((route) => route.entry!);
}

/**
 * Every entry's generated page data (`generated/api/entries/*.json`), the
 * same chunks the entry pages load. Cached with React's thenable fields, so
 * `use()` reads a settled result synchronously (prerender, warm visits).
 */
export function loadMapEntries(): Promise<ApiEntry[]> {
  if (!cached) {
    const next: Tracked<ApiEntry[]> = Promise.all(
      entrySlugs().map((slug) => loadEntry(slug)),
    );
    next.status = 'pending';
    next.then(
      (value) => {
        next.status = 'fulfilled';
        next.value = value;
      },
      (reason: unknown) => {
        next.status = 'rejected';
        next.reason = reason;
        cached = null;
      },
    );
    cached = next;
  }
  return cached;
}
