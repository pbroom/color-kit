import { Suspense, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { RouteErrorBoundary } from './components/error-pages';
import { PageOutline } from './components/shell/page-outline';
import { RouteSkeleton, RouteView } from './components/shell/route-view';
import { SiteFooter } from './components/shell/site-footer';
import { SiteHeader } from './components/shell/site-header';
import { SiteNav } from './components/shell/site-nav';
import { documentTitle, matchRoute, type SiteRoute } from './site/routes';
import { useThemeSync } from './site/theme';

/**
 * After client-side navigation: scroll to the top (or the hash target) and
 * move focus to `<main>` so keyboard and screen-reader users start at the new
 * content. Skipped on the initial load, where the browser owns both.
 */
function useNavigationFocus(pathname: string, hash: string) {
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (previous.current === null) {
      previous.current = pathname;
      return;
    }
    if (previous.current === pathname) {
      return;
    }
    previous.current = pathname;
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) {
      target.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname, hash]);
}

function DocsLayout({ route }: { route: SiteRoute }) {
  const articleRef = useRef<HTMLElement>(null);
  const indexable = route.kind !== 'not-found';
  return (
    <div className="docs-layout">
      <div className="docs-layout__nav">
        <SiteNav currentPath={route.path} />
      </div>
      <main id="main" tabIndex={-1} className="docs-layout__main">
        <article
          ref={articleRef}
          className="doc"
          data-kind={route.kind}
          data-pagefind-body={indexable ? '' : undefined}
        >
          <Suspense fallback={<RouteSkeleton />}>
            <RouteView route={route} />
          </Suspense>
        </article>
      </main>
      <PageOutline articleRef={articleRef} pathname={route.path} />
    </div>
  );
}

export function App() {
  const { pathname, hash } = useLocation();
  const route = matchRoute(pathname);
  useThemeSync();
  useNavigationFocus(pathname, hash);
  useEffect(() => {
    document.title = documentTitle(route);
  }, [route]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader currentPath={route.path} />
      <RouteErrorBoundary>
        {route.kind === 'home' ? (
          <main
            id="main"
            tabIndex={-1}
            className="home-main"
            data-pagefind-body=""
          >
            <Suspense fallback={<RouteSkeleton />}>
              <RouteView route={route} />
            </Suspense>
          </main>
        ) : (
          <DocsLayout route={route} />
        )}
      </RouteErrorBoundary>
      <SiteFooter />
    </>
  );
}
