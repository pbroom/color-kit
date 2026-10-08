import { use } from 'react';
import type { RouteModuleProps } from '@/site/routes';
import { matchRoute } from '@/site/routes';
import { ApiMap } from './api-map';
import { loadMapEntries } from './map-data';
// Inlined into the page: the prerendered map is styled on first paint, and
// the route needs no separate stylesheet request.
import mapCss from './map.css?inline';

// On a direct load, fetch the entry data as soon as this chunk evaluates, so
// hydration waits on requests already in flight.
if (typeof window !== 'undefined') {
  if (matchRoute(window.location.pathname).kind === 'api-map') {
    loadMapEntries().catch(() => undefined);
  }
}

/**
 * `/api/map`: the whole surface as one tidy tree (d3-hierarchy layout drawn
 * as React SVG), fed by the generated entry data. The prerender ships the
 * first view (entry points closed) and the ledger; hydration adds pan, zoom,
 * filters and keyboard navigation.
 */
export default function ApiMapPage({ route }: RouteModuleProps) {
  const entries = use(loadMapEntries());
  const exports = entries.reduce((sum, entry) => sum + entry.symbols.length, 0);
  const reexports = entries.reduce(
    (sum, entry) => sum + entry.reexports.length,
    0,
  );
  return (
    <>
      <style>{mapCss}</style>
      <header className="doc-header">
        <p className="doc-eyebrow">API</p>
        <h1 className="doc-title">{route.title}</h1>
        <p className="doc-lede">{route.description}</p>
        <p className="entry-facts">
          <span>{entries.length} entry points</span>
          <span>{exports} exports</span>
          <span>{reexports} re-exports</span>
        </p>
      </header>
      <ApiMap entries={entries} />
    </>
  );
}
