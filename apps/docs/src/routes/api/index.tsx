import { ApiLink } from '@/components/api/api-link';
import { routes, type RouteModuleProps, type SiteRoute } from '@/site/routes';

const VALUE_KINDS = new Set([
  'function',
  'component',
  'class',
  'const',
  'variable',
  'enum',
  'namespace',
]);

interface EntryFacts {
  route: SiteRoute;
  symbols: number;
  values: number;
  domains: string[];
}

function entryFacts(): EntryFacts[] {
  return routes
    .filter((route) => route.kind === 'api-entry')
    .map((route) => {
      const symbols = routes.filter(
        (item) => item.kind === 'api-symbol' && item.entry === route.entry,
      );
      const domains: string[] = [];
      for (const symbol of symbols) {
        if (symbol.group && !domains.includes(symbol.group)) {
          domains.push(symbol.group);
        }
      }
      return {
        route,
        symbols: symbols.length,
        values: symbols.filter((symbol) =>
          VALUE_KINDS.has(symbol.symbolKind ?? ''),
        ).length,
        domains,
      };
    });
}

/**
 * `/api`: every entry point in package order with what it holds. Reads the
 * route registry only, so it needs no API data chunk.
 */
export default function ApiIndexPage({ route }: RouteModuleProps) {
  const entries = entryFacts();
  const total = entries.reduce((sum, entry) => sum + entry.symbols, 0);
  return (
    <>
      <header className="doc-header">
        <p className="doc-eyebrow">API</p>
        <h1 className="doc-title">{route.title}</h1>
        <p className="doc-lede">{route.description}</p>
        {total > 0 ? (
          <p className="entry-facts">
            <span>{total} documented exports</span>
            <span>{entries.length} entry points</span>
            <span>generated from source</span>
          </p>
        ) : null}
      </header>
      <div className="prose">
        <ol className="entry-index breakout">
          {entries.map(({ route: entry, symbols, values, domains }) => (
            <li key={entry.path}>
              <ApiLink to={entry.path} className="entry-index__link">
                <code className="entry-index__name">{entry.title}</code>
                <span className="entry-index__text">{entry.description}</span>
                <span className="entry-index__meta">
                  {symbols > 0 ? (
                    <>
                      <span>{symbols} exports</span>
                      <span>
                        {values} values · {symbols - values} types
                      </span>
                    </>
                  ) : null}
                </span>
                {domains.length > 0 ? (
                  <span className="entry-index__domains">
                    {domains.join(' · ').replace(/-/g, ' ')}
                  </span>
                ) : null}
              </ApiLink>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
