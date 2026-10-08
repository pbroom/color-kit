import type { ComponentType } from 'react';
import type { mdxComponents } from '@/components/ui/mdx-components';
import { symbolFileName, type ApiEntry, type ApiSymbol } from './model';

/**
 * Lazy loaders for the generated API pages. Each symbol and entry is its own
 * small chunk, so a page never downloads the whole model. Loaders return
 * cached promises that carry React's thenable `status`/`value` fields, so
 * `use()` reads a settled one synchronously (prerender, warm navigation).
 */

export type MdxPage = ComponentType<{ components?: typeof mdxComponents }>;

const symbolFiles = import.meta.glob<ApiSymbol>(
  '../generated/api/symbols/*/*.json',
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
/** `content/api/<entry>/<Symbol>.mdx`: extra notes merged into a symbol page. */
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

/** Whether a page for `entry`/`name` was generated. */
export function hasSymbol(entry: string, name: string): boolean {
  return (
    `../generated/api/symbols/${entry}/${symbolFileName(name)}.json` in
    symbolFiles
  );
}

export function loadSymbol(entry: string, name: string): Promise<ApiSymbol> {
  const key = `../generated/api/symbols/${entry}/${symbolFileName(name)}.json`;
  return tracked(
    key,
    () => symbolFiles[key]?.() ?? missing(`${entry}/${name}`),
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

export function loadSymbolDoc(
  entry: string,
  name: string,
): Promise<MdxPage | null> {
  const key = `../content/api/${entry}/${name}.mdx`;
  return tracked(key, () => symbolDocFiles[key]?.() ?? Promise.resolve(null));
}

/** Warm a symbol page's data on intent; never throws. */
export function preloadSymbol(entry: string, name: string): void {
  loadSymbol(entry, name).catch(() => undefined);
  loadSymbolDoc(entry, name).catch(() => undefined);
}

/** Warm an entry page's data on intent; never throws. */
export function preloadEntry(entry: string): void {
  loadEntry(entry).catch(() => undefined);
  loadNarrative(entry).catch(() => undefined);
}

/** `/api/core/Color` → `{ entry: 'core', name: 'Color' }`. */
export function parseApiPath(
  href: string,
): { entry: string; name?: string } | null {
  const match = /^\/api\/([^/#?]+)(?:\/([^/#?]+))?\/?(?:[#?].*)?$/.exec(href);
  if (!match || match[1] === 'map') return null;
  let name: string | undefined;
  try {
    name = match[2] ? decodeURIComponent(match[2]) : undefined;
  } catch {
    return null;
  }
  return { entry: match[1]!, name };
}

/** Warm whatever API data `href` renders. */
export function preloadApiHref(href: string): void {
  const target = parseApiPath(href);
  if (!target) return;
  if (target.name) preloadSymbol(target.entry, target.name);
  else preloadEntry(target.entry);
}
