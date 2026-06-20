import { docsPageLoaders } from '../content/docs-registry.js';

/**
 * Route-level chunk loaders. These use the exact same dynamic-import specifiers
 * as the `lazy()` calls in `app.tsx`, so calling them ahead of time warms the
 * shared ES module cache. When the user actually navigates, the `lazy()`
 * component resolves from cache without a network/transform round-trip.
 */
const routeLoaders = {
  home: () => import('../routes/index.js'),
  docsLayout: () => import('../components/docs-layout.js'),
  docsPage: () => import('../routes/docs.js'),
  componentDoc: () => import('../routes/component-doc.js'),
  lab: () => import('../routes/lab.js'),
} as const;

const prefetched = new Set<string>();

function runLoader(key: string, loader: () => Promise<unknown>): void {
  if (prefetched.has(key)) {
    return;
  }
  prefetched.add(key);
  // Swallow errors: prefetch is best-effort and must never surface to the user.
  void Promise.resolve()
    .then(loader)
    .catch(() => {
      // Allow a later real navigation to retry the import.
      prefetched.delete(key);
    });
}

function prefetchDocsPage(path: string): void {
  const loader = docsPageLoaders[path];
  if (loader) {
    runLoader(`docs-page:${path}`, loader);
  }
}

/**
 * Warm every chunk required to render `href` so the transition feels instant.
 * Safe to call repeatedly; each chunk is only fetched once.
 */
export function prefetchHref(href: string): void {
  if (!href || href.startsWith('http') || href.startsWith('#')) {
    return;
  }

  // Strip query/hash to a clean pathname.
  const path = href.split(/[?#]/)[0];

  if (path === '/' || path === '') {
    runLoader('home', routeLoaders.home);
    return;
  }

  if (path.startsWith('/lab') || path.startsWith('/playground')) {
    runLoader('lab', routeLoaders.lab);
    return;
  }

  if (path.startsWith('/docs')) {
    // The docs shell (sidebar, rails) is shared across every docs route.
    runLoader('docs-layout', routeLoaders.docsLayout);

    if (path.startsWith('/docs/components/')) {
      runLoader('component-doc', routeLoaders.componentDoc);
      return;
    }

    runLoader('docs-page', routeLoaders.docsPage);
    const docsPath = path.replace(/^\/docs\//, '');
    if (docsPath) {
      prefetchDocsPage(docsPath);
    }
  }
}
