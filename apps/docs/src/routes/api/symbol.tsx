import { use } from 'react';
import { loadSymbol, loadSymbolDoc, preloadSymbol } from '@/api/data';
import { SymbolReference } from '@/components/api/symbol-reference';
import { matchRoute, type RouteModuleProps } from '@/site/routes';

// On a direct load, start fetching this page's data as soon as the route
// chunk evaluates (before hydration) so hydration waits one small request.
if (typeof window !== 'undefined') {
  const current = matchRoute(window.location.pathname);
  if (current.kind === 'api-symbol' && current.entry && current.symbol) {
    preloadSymbol(current.entry, current.symbol);
  }
}

/**
 * `/api/:entry/:symbol`: one generated reference page per canonical export,
 * plus `content/api/<entry>/<Symbol>.mdx` notes when present.
 */
export default function ApiSymbolPage({ route }: RouteModuleProps) {
  const entry = route.entry ?? '';
  const name = route.symbol ?? route.title;
  const symbol = use(loadSymbol(entry, name));
  const Notes = use(loadSymbolDoc(entry, name));
  return <SymbolReference symbol={symbol} Notes={Notes} />;
}
