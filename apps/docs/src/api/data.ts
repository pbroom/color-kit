import type { ComponentType } from 'react';
import type { mdxComponents } from '@/components/ui/mdx-components';
import { apiSymbolAt, matchRoute } from '@/site/routes';
import type { ApiEntry, ApiSymbol } from './model';

/**
 * Lazy loaders for the generated API data. Each entry, and each category's
 * symbols, is its own chunk (a large category is split into a few parts), so
 * a page never downloads the whole model and a category page fetches its
 * rows in one or two requests rather than one per symbol. Loaders return
 * cached promises that carry React's thenable `status`/`value` fields, so
 * `use()` reads a settled one synchronously (prerender, warm navigation).
 */

export type MdxPage = ComponentType<{ components?: typeof mdxComponents }>;

const DOMAIN_DIR = '../generated/api/domains/';

const domainFiles = import.meta.glob<ApiSymbol[]>(
  '../generated/api/domains/*/*/*.json',
  { import: 'default' },
);
const entryFiles = import.meta.glob<ApiEntry>(
  '../generated/api/entries/*.json',
  { import: 'default' },
);
/** `content/api/<entry>/index.mdx`: the entry's narrative (S4). */
const narrativeFiles = import.meta.glob<MdxPage>('../content/api/*/index.mdx', {
  import: 'default',
});
/** `content/api/<entry>/<Symbol>.mdx`: notes shown in a symbol's panel. */
const symbolDocFiles = import.meta.glob<MdxPage>(
  ['../content/api/*/*.mdx', '!../content/api/*/index.mdx'],
  { import: 'default' },
);

type Tracked<T> = Promise<T> & {
  status?: 'pending' | 'fulfilled' | 'rejected';
  value?: T;
  reason?: unknown;
};

const cache = new Map<string, Tracked<unknown>>();

function tracked<T>(key: string, load: () => Promise<T>): Promise<T> {
  let promise = cache.get(key) as Tracked<T> | undefined;
  if (!promise) {
    const next: Tracked<T> = load();
    next.status = 'pending';
    next.then(
      (value) => {
        next.status = 'fulfilled';
        next.value = value;
      },
      (reason: unknown) => {
        next.status = 'rejected';
        next.reason = reason;
        cache.delete(key);
      },
    );
    cache.set(key, next as Tracked<unknown>);
    promise = next;
  }
  return promise;
}

function missing(what: string): Promise<never> {
  return Promise.reject(
    new Error(`${what} is not in the generated API data (run pnpm docs:api).`),
  );
}

/** `<entry>/<domain>/<n>.json` part loaders, in part order. */
function domainPartLoaders(
  entry: string,
  domain: string,
): Array<() => Promise<ApiSymbol[]>> {
  const prefix = `${DOMAIN_DIR}${entry}/${domain}/`;
  return Object.keys(domainFiles)
    .filter((key) => key.startsWith(prefix))
    .map((key) => ({ key, part: Number(key.slice(prefix.length, -5)) }))
    .sort((a, b) => a.part - b.part)
    .map(({ key }) => domainFiles[key]!);
}

/** Every symbol of one category, in display order. */
export function loadDomain(
  entry: string,
  domain: string,
): Promise<ApiSymbol[]> {
  return tracked(`domain:${entry}/${domain}`, () => {
    const parts = domainPartLoaders(entry, domain);
    if (parts.length === 0) return missing(`${entry}/${domain}`);
    return Promise.all(parts.map((load) => load())).then((lists) =>
      lists.flat(),
    );
  });
}

/** One symbol, from its category's data. */
export function loadSymbol(
  entry: string,
  domain: string,
  name: string,
): Promise<ApiSymbol> {
  return tracked(`symbol:${entry}/${domain}/${name}`, () =>
    loadDomain(entry, domain).then(
      (symbols) =>
        symbols.find((symbol) => symbol.name === name) ??
        missing(`${entry}/${name}`),
    ),
  );
}

export function loadEntry(entry: string): Promise<ApiEntry> {
  const key = `../generated/api/entries/${entry}.json`;
  return tracked(key, () => entryFiles[key]?.() ?? missing(`Entry ${entry}`));
}

export function loadNarrative(entry: string): Promise<MdxPage | null> {
  const key = `../content/api/${entry}/index.mdx`;
  return tracked(key, () => narrativeFiles[key]?.() ?? Promise.resolve(null));
}

/**
 * The MDX notes of each named symbol that has some, keyed by name. Symbols
 * without notes cost nothing: only existing files are fetched.
 */
export function loadSymbolDocs(
  entry: string,
  names: readonly string[],
): Promise<ReadonlyMap<string, MdxPage>> {
  return tracked(`docs:${entry}/${names.join(',')}`, () =>
    Promise.all(
      names.flatMap((name) => {
        const load = symbolDocFiles[`../content/api/${entry}/${name}.mdx`];
        return load
          ? [load().then((page) => [name, page] as const)]
          : ([] as Array<Promise<readonly [string, MdxPage]>>);
      }),
    ).then((pairs) => new Map(pairs)),
  );
}

/** Warm a category page's rows on intent; never throws. */
export function preloadDomain(entry: string, domain: string): void {
  loadDomain(entry, domain).catch(() => undefined);
}

/** Warm an entry page's data on intent; never throws. */
export function preloadEntry(entry: string): void {
  loadEntry(entry).catch(() => undefined);
  loadNarrative(entry).catch(() => undefined);
}

/**
 * Warm whatever API data `href` renders: an entry page, a category page
 * (`/api/core/conversion`, with or without a `#<Symbol>` row), or a legacy
 * symbol path that now redirects to its row.
 */
export function preloadApiHref(href: string): void {
  if (!href.startsWith('/api/')) return;
  const route = matchRoute(href);
  if (route.kind === 'api-entry' && route.entry) {
    preloadEntry(route.entry);
    return;
  }
  const symbol =
    route.kind === 'api-domain' ? undefined : apiSymbolAt(href.split('#')[0]!);
  const entry = symbol?.entry ?? route.entry;
  const domain = symbol?.domain ?? route.domain;
  if (entry && domain) {
    preloadEntry(entry);
    preloadDomain(entry, domain);
  }
}
