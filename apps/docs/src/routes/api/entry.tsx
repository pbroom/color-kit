import { use } from 'react';
import type { ApiEntry, ApiReexport, ApiSymbolSummary } from '@/api/model';
import { symbolHref } from '@/api/model';
import {
  loadEntry,
  loadNarrative,
  preloadDomain,
  preloadEntry,
} from '@/api/data';
import { ApiLink } from '@/components/api/api-link';
import { ApiLabel, KindGlyph } from '@/components/api/kind-glyph';
import { MdxContent } from '@/components/api/mdx-content';
import { SymbolTable } from '@/components/api/symbol-table';
import { matchRoute, type RouteModuleProps } from '@/site/routes';

// On a direct load, start fetching this page's data as soon as the route
// chunk evaluates (before hydration) so hydration waits on one round trip.
if (typeof window !== 'undefined') {
  const current = matchRoute(window.location.pathname);
  if (current.kind === 'api-entry' && current.entry) {
    preloadEntry(current.entry);
  }
  if (current.kind === 'api-domain' && current.entry && current.domain) {
    preloadEntry(current.entry);
    preloadDomain(current.entry, current.domain);
  }
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function SymbolRow({
  entry,
  symbol,
}: {
  entry: string;
  symbol: ApiSymbolSummary;
}) {
  return (
    <li>
      <ApiLink
        to={symbolHref(entry, symbol.domain, symbol.name)}
        className="symbol-row"
      >
        <KindGlyph kind={symbol.kind} />
        <code className="symbol-row__name">{symbol.name}</code>
        <span className="symbol-row__summary">
          {symbol.deprecated !== undefined ? (
            <ApiLabel deprecated>deprecated</ApiLabel>
          ) : null}
          {symbol.summary}
        </span>
      </ApiLink>
    </li>
  );
}

function Reexports({ entry }: { entry: ApiEntry }) {
  const groups = new Map<string, ApiReexport[]>();
  for (const item of entry.reexports) {
    const list = groups.get(item.canonicalEntry) ?? [];
    list.push(item);
    groups.set(item.canonicalEntry, list);
  }
  return (
    <>
      <h2 id="reexports" className="api-h2">
        <a className="heading-anchor" href="#reexports">
          Re-exported here
        </a>
      </h2>
      <p>
        {entry.importPath} also exports{' '}
        {plural(entry.reexports.length, 'symbol')} documented in a more specific
        entry point. Import them from either path; they are the same
        declarations.
      </p>
      <dl className="reexports breakout">
        {[...groups].map(([slug, items]) => (
          <div key={slug} className="reexports__group">
            <dt>
              <ApiLink to={`/api/${slug}`} className="reexports__entry">
                <code>
                  {slug === 'core'
                    ? '@pbroom/color-kit'
                    : `@pbroom/color-kit/${slug}`}
                </code>
              </ApiLink>
              <span className="reexports__count">{items.length}</span>
            </dt>
            <dd>
              <ul className="reexports__list">
                {items.map((item) => (
                  <li key={item.name}>
                    <ApiLink
                      to={item.href}
                      title={item.summary}
                      className="reexports__link"
                    >
                      {item.name}
                    </ApiLink>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/**
 * `/api/:entry`: the entry's narrative (`content/api/<entry>/index.mdx`,
 * when present), then every symbol whose canonical home is this entry,
 * grouped by domain and linked to its row, then what the entry re-exports
 * from elsewhere.
 *
 * `/api/:entry/:domain`: one category as a table of disclosure rows, each
 * holding its symbol's full reference.
 */
export default function ApiEntryPage({ route }: RouteModuleProps) {
  const entry = use(loadEntry(route.entry ?? ''));
  const Narrative = use(loadNarrative(entry.slug));
  const bySymbol = new Map(
    entry.symbols.map((symbol) => [symbol.name, symbol]),
  );
  const { counts } = entry;
  const domains = route.domain
    ? entry.domains.filter((domain) => domain.slug === route.domain)
    : entry.domains;
  // Only a category route renders one domain; the entry route lists them all.
  const domainPage = route.domain ? domains[0] : undefined;

  return (
    <>
      <header className="doc-header">
        <p className="doc-eyebrow">API</p>
        <h1 className="doc-title" data-mono={!domainPage ? '' : undefined}>
          {domainPage?.title ?? entry.importPath}
        </h1>
        <p className="doc-lede">
          {domainPage
            ? `${domainPage.symbols.length} exports from ${entry.importPath}.`
            : entry.summary}
        </p>
        {!domainPage ? (
          <p className="entry-facts">
            <span>{plural(counts.symbols, 'export')}</span>
            <span>{plural(counts.values, 'value')}</span>
            <span>{plural(counts.types, 'type')}</span>
            {counts.reexports > 0 ? (
              <span>{plural(counts.reexports, 're-export')}</span>
            ) : null}
            {entry.aliases.map((alias) => (
              <span key={alias}>
                also <code>{alias}</code>
              </span>
            ))}
          </p>
        ) : null}
      </header>
      <div className="prose">
        {!domainPage && Narrative ? <MdxContent Content={Narrative} /> : null}
        {!domainPage ? (
          <nav className="domain-index breakout" aria-label="Domains">
            {entry.domains.map((domain) => (
              <a
                key={domain.slug}
                className="domain-index__link"
                href={`#domain-${domain.slug}`}
              >
                {domain.title}
                <span className="domain-index__count">
                  {domain.symbols.length}
                </span>
              </a>
            ))}
            {counts.reexports > 0 ? (
              <a className="domain-index__link" href="#reexports">
                Re-exported
                <span className="domain-index__count">{counts.reexports}</span>
              </a>
            ) : null}
          </nav>
        ) : null}
        {domainPage ? (
          <SymbolTable
            entry={entry.slug}
            domain={domainPage.slug}
            names={domainPage.symbols}
          />
        ) : (
          domains.map((domain) => (
            <section
              key={domain.slug}
              className="domain breakout"
              aria-labelledby={`domain-${domain.slug}`}
            >
              <h2 id={`domain-${domain.slug}`}>
                <a className="heading-anchor" href={`#domain-${domain.slug}`}>
                  {domain.title}
                </a>
              </h2>
              <ul className="symbol-list">
                {domain.symbols.map((name) => {
                  const symbol = bySymbol.get(name);
                  return symbol ? (
                    <SymbolRow key={name} entry={entry.slug} symbol={symbol} />
                  ) : null;
                })}
              </ul>
            </section>
          ))
        )}
        {!domainPage && entry.reexports.length > 0 ? (
          <Reexports entry={entry} />
        ) : null}
      </div>
    </>
  );
}
