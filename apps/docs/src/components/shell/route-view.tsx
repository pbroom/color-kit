import { use } from 'react';
import { loadRoute } from '@/site/route-loader';
import type { SiteRoute } from '@/site/routes';

/**
 * Renders the module for `route`. Route modules render their own `<h1>`;
 * content (MDX) routes arrive pre-wrapped by `withContentFrame`.
 */
export function RouteView({ route }: { route: SiteRoute }) {
  const { default: Page } = use(loadRoute(route));
  return <Page route={route} />;
}

/** Suspense fallback while a route chunk loads after client navigation. */
export function RouteSkeleton() {
  return (
    <div className="route-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}
