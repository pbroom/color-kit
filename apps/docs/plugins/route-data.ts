import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { parse as parseYaml } from 'yaml';

/**
 * Build-time projections that keep the route registry cheap:
 *
 * - `file.mdx?frontmatter` → `export default { title, order, … }`, the
 *   page's YAML frontmatter only. The registry globs these eagerly for nav
 *   and meta while the MDX body stays in its own lazy chunk.
 * - `api.json?api-routes` → the slim `ApiRouteIndex` (entries and symbol
 *   names, see `src/site/api-routes.ts`) projected out of the generated API
 *   model, so the full model never lands in the main bundle.
 */
const QUERIES = {
  '?frontmatter': 'frontmatter',
  '?api-routes': 'api-routes',
} as const;

type Kind = (typeof QUERIES)[keyof typeof QUERIES];

const PREFIX = '\0color-kit-route-data:';

export function readFrontmatter(source: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) {
    return {};
  }
  const data: unknown = parseYaml(match[1]!);
  return data && typeof data === 'object'
    ? (data as Record<string, unknown>)
    : {};
}

interface RawSymbol {
  name?: unknown;
  kind?: unknown;
  summary?: unknown;
  group?: unknown;
  domain?: unknown;
}

interface RawEntry {
  slug?: unknown;
  title?: unknown;
  importPath?: unknown;
  summary?: unknown;
  symbols?: unknown;
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * Project the generated API model onto the route index. S2 owns the model's
 * shape; if it changes, adjust this projection rather than the registry.
 */
export function projectApiRoutes(
  model: unknown,
  { summaries = true }: { summaries?: boolean } = {},
): unknown {
  const entries = (model as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) {
    return { entries: [] };
  }
  return {
    entries: (entries as RawEntry[]).map((entry) => ({
      slug: asString(entry.slug) ?? '',
      title: asString(entry.title) ?? asString(entry.slug) ?? '',
      importPath: asString(entry.importPath) ?? '',
      summary: asString(entry.summary),
      symbols: Array.isArray(entry.symbols)
        ? (entry.symbols as RawSymbol[]).map((symbol) => ({
            name: asString(symbol.name) ?? '',
            kind: asString(symbol.kind) ?? 'unknown',
            // Symbol summaries only feed prerendered meta descriptions, so
            // the client bundle (which every page loads) skips them.
            summary: summaries ? asString(symbol.summary) : undefined,
            // The model calls it `domain` (src/api/model.ts).
            group: asString(symbol.domain) ?? asString(symbol.group),
          }))
        : [],
    })),
  };
}

export function routeDataPlugin(): Plugin {
  return {
    name: 'color-kit:route-data',
    enforce: 'pre',
    async resolveId(source, importer) {
      const query = (Object.keys(QUERIES) as Array<keyof typeof QUERIES>).find(
        (q) => source.endsWith(q),
      );
      if (!query) {
        return null;
      }
      const resolved = await this.resolve(
        source.slice(0, -query.length),
        importer,
        { skipSelf: true },
      );
      if (!resolved) {
        return null;
      }
      // No source extension at the end, so MDX/React/JSON plugins skip it.
      return `${PREFIX}${QUERIES[query]}:${resolved.id.split('?')[0]}.data`;
    },
    async load(id, options) {
      if (!id.startsWith(PREFIX)) {
        return null;
      }
      const rest = id.slice(PREFIX.length, -'.data'.length);
      const separator = rest.indexOf(':');
      const kind = rest.slice(0, separator) as Kind;
      const file = rest.slice(separator + 1);
      this.addWatchFile(file);
      const source = await readFile(file, 'utf8');
      const data =
        kind === 'frontmatter'
          ? readFrontmatter(source)
          : projectApiRoutes(JSON.parse(source), {
              summaries: Boolean(options?.ssr),
            });
      return `export default ${JSON.stringify(data)};`;
    },
  };
}
