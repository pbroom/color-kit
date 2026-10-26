import {
  setSymbolSearchProvider,
  type SearchHit,
  type SymbolSearchProvider,
} from '@/site/search';
import { apiSymbols, type ApiSymbolLink } from '@/site/routes';

/**
 * ⌘K symbol hits from the generated API index: synchronous, no network,
 * ranked ahead of pages and prose; each opens the symbol's row on its
 * category page. Ranking, best first:
 *
 * 0. exact name (`Color` matches both `@pbroom/color-kit` and `@pbroom/color-kit/react`)
 * 1. name prefix (`contrast` → `contrastRatio`)
 * 2. camelCase word prefix (`ratio` → `contrastRatio`, `cR` initials too)
 * 3. substring
 *
 * Ties go to value exports, then shorter names, then package order.
 */

interface Indexed {
  symbol: ApiSymbolLink;
  lower: string;
  /** Lowercased camelCase / snake_case words: `contrastRatio` → `contrast`, `ratio`. */
  words: string[];
  initials: string;
  value: boolean;
  order: number;
}

const VALUE_KINDS = new Set([
  'function',
  'component',
  'class',
  'const',
  'variable',
  'enum',
  'namespace',
]);

function splitWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_$]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

let index: Indexed[] | null = null;

function getIndex(): Indexed[] {
  index ??= apiSymbols.map((symbol, order) => {
    const words = splitWords(symbol.name);
    return {
      symbol,
      lower: symbol.name.toLowerCase(),
      words,
      initials: words.map((word) => word[0]).join(''),
      value: VALUE_KINDS.has(symbol.kind),
      order,
    };
  });
  return index;
}

function rank(item: Indexed, query: string): number {
  if (item.lower === query) return 0;
  if (item.lower.startsWith(query)) return 1;
  if (
    item.words.some((word) => word.startsWith(query)) ||
    (query.length > 1 && item.initials.startsWith(query))
  ) {
    return 2;
  }
  if (item.lower.includes(query)) return 3;
  return Number.POSITIVE_INFINITY;
}

export function entryLabel(entry: string | undefined): string | undefined {
  if (!entry) return undefined;
  return entry === 'core' ? '@pbroom/color-kit' : `@pbroom/color-kit/${entry}`;
}

export const apiSymbolSearch: SymbolSearchProvider = (rawQuery, limit) => {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, '');
  if (!query) return [];
  return getIndex()
    .map((item) => ({ item, score: rank(item, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number(b.item.value) - Number(a.item.value) ||
        a.item.lower.length - b.item.lower.length ||
        a.item.order - b.item.order,
    )
    .slice(0, limit)
    .map(
      ({ item }): SearchHit => ({
        id: `symbol:${item.symbol.href}`,
        kind: 'symbol',
        title: item.symbol.name,
        href: item.symbol.href,
        meta: [item.symbol.kind, entryLabel(item.symbol.entry)]
          .filter(Boolean)
          .join(' · '),
      }),
    );
};

// Importing this module fills the search dialog's symbol slot.
setSymbolSearchProvider(apiSymbolSearch);
