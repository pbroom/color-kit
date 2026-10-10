import { routes, type SiteRoute } from './routes';

export type SearchHitKind = 'symbol' | 'page' | 'prose';

export interface SearchHit {
  /** Stable key, unique within one result list. */
  id: string;
  kind: SearchHitKind;
  title: string;
  href: string;
  /** Small mono label: entry point for symbols, section for pages. */
  meta?: string;
  /** Prose hits only: Pagefind excerpt HTML with `<mark>` highlights. */
  excerptHtml?: string;
}

/**
 * The symbol-results slot. Symbol hits render first and arrive instantly
 * (no network). The default provider ranks API symbol routes by name; S2/S5
 * can swap in a richer provider over the generated API data (aliases,
 * re-export sites, summaries) with `setSymbolSearchProvider`.
 */
export type SymbolSearchProvider = (
  query: string,
  limit: number,
) => SearchHit[];

/** Lower is better: exact, then prefix, then substring; Infinity = no match. */
function score(name: string, query: string): number {
  const n = name.toLowerCase();
  if (n === query) return 0;
  if (n.startsWith(query)) return 1;
  if (n.includes(query)) return 2;
  return Number.POSITIVE_INFINITY;
}

function entryLabel(route: SiteRoute): string | undefined {
  if (!route.entry) return undefined;
  return route.entry === 'core' ? 'color-kit' : `color-kit/${route.entry}`;
}

const defaultSymbolProvider: SymbolSearchProvider = (query, limit) =>
  routes
    .filter((route) => route.kind === 'api-symbol')
    .map((route) => ({ route, rank: score(route.title, query) }))
    .filter(({ rank }) => Number.isFinite(rank))
    .sort(
      (a, b) => a.rank - b.rank || a.route.title.length - b.route.title.length,
    )
    .slice(0, limit)
    .map(({ route }) => ({
      id: `symbol:${route.path}`,
      kind: 'symbol' as const,
      title: route.title,
      href: route.path,
      meta: [route.symbolKind, entryLabel(route)].filter(Boolean).join(' · '),
    }));

let symbolProvider: SymbolSearchProvider = defaultSymbolProvider;

export function setSymbolSearchProvider(provider: SymbolSearchProvider): void {
  symbolProvider = provider;
}

/** Instant, synchronous hits: symbols first, then page titles. */
export function searchInstant(rawQuery: string): SearchHit[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return [];
  }
  const symbols = symbolProvider(query, 8);
  const pages = routes
    .filter(
      (route) => route.kind !== 'api-symbol' && route.kind !== 'not-found',
    )
    .map((route) => ({ route, rank: score(route.title, query) }))
    .filter(({ rank }) => Number.isFinite(rank))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 6)
    .map(({ route }) => ({
      id: `page:${route.path}`,
      kind: 'page' as const,
      title: route.title,
      href: route.path,
      meta: route.section ?? undefined,
    }));
  return [...symbols, ...pages];
}

interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string };
}

interface Pagefind {
  options(options: { baseUrl?: string }): Promise<void>;
  init(): Promise<void>;
  debouncedSearch(
    query: string,
    options?: object,
    debounceMs?: number,
  ): Promise<{
    results: Array<{ id: string; data(): Promise<PagefindResultData> }>;
  } | null>;
}

let pagefindPromise: Promise<Pagefind | null> | null = null;

/**
 * Pagefind is generated over the prerendered `dist` (`pagefind --site dist`)
 * and fetched only when search first opens. Resolves `null` when there is no
 * index (dev server, or a build without the Pagefind step).
 */
export function loadPagefind(): Promise<Pagefind | null> {
  pagefindPromise ??= (async () => {
    try {
      const url = '/pagefind/pagefind.js';
      const pagefind = (await import(/* @vite-ignore */ url)) as Pagefind;
      await pagefind.options({ baseUrl: '/' });
      await pagefind.init();
      return pagefind;
    } catch {
      return null;
    }
  })();
  return pagefindPromise;
}

function toRoutePath(url: string): string {
  const path = url.replace(/\.html$/, '').replace(/\/index$/, '/');
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

/**
 * Full-text hits from Pagefind. Returns `null` when superseded by a newer
 * keystroke (Pagefind's debounce), `[]` when nothing matched.
 */
export async function searchProse(
  pagefind: Pagefind,
  query: string,
  limit = 8,
): Promise<SearchHit[] | null> {
  const search = await pagefind.debouncedSearch(query, {}, 120);
  if (!search) {
    return null;
  }
  const data = await Promise.all(
    search.results.slice(0, limit).map((result) => result.data()),
  );
  return data.map((item, index) => ({
    id: `prose:${item.url}:${index}`,
    kind: 'prose' as const,
    title: item.meta.title ?? item.url,
    href: toRoutePath(item.url),
    excerptHtml: item.excerpt,
  }));
}
