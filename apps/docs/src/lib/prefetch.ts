import { preloadRoute } from '../site/route-loader';
import { matchRoute } from '../site/routes';

/**
 * Warm the chunk that renders `href` so the transition feels instant. Safe to
 * call repeatedly; each route module is only fetched once. External links,
 * hash links and unknown paths are ignored.
 */
export function prefetchHref(href: string): void {
  if (!href || !href.startsWith('/') || href.startsWith('//')) {
    return;
  }
  const route = matchRoute(href);
  if (route.kind !== 'not-found') {
    preloadRoute(route);
  }
}
