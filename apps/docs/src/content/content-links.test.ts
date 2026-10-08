/**
 * Internal links in hand-written content must resolve: concept and guide
 * pages (and their heading anchors) must exist, and every
 * `/api/<entry>/<Symbol>` link must name a symbol that entry exports. For
 * the root entry (`core`), the symbol must not also be exported by a more
 * specific `color-kit/*` subpath, since that subpath is its canonical page.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const packages = path.resolve(here, '../../../../packages');

const BARRELS: Record<string, string> = {
  core: 'core/src/index.ts',
  plane: 'core/src/plane/index.ts',
  interop: 'core/src/interop/index.ts',
  compute: 'core/src/compute/index.ts',
  hct: 'core/src/hct/index.ts',
  driver: 'driver/src/index.ts',
  react: 'react/src/index.ts',
};
const CORE_SUBPATHS = ['plane', 'interop', 'compute', 'hct'];

function exportsOf(file: string): Set<string> {
  const source = readFileSync(path.join(packages, file), 'utf8').replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    '',
  );
  const names = new Set<string>();
  for (const [, list] of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const item of list.split(',')) {
      const name = item
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.replace(/^type\s+/, '');
      if (name) names.add(name);
    }
  }
  for (const [, name] of source.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(name);
  }
  return names;
}

const exportsByEntry = Object.fromEntries(
  Object.entries(BARRELS).map(([entry, file]) => [entry, exportsOf(file)]),
);

function mdxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name.startsWith('_')) return [];
    if (statSync(full).isDirectory()) return mdxFiles(full);
    return name.endsWith('.mdx') ? [full] : [];
  });
}

/** rehype-slug (github-slugger) ids for a page's `##`+ headings. */
function headingIds(file: string): Set<string> {
  const ids = new Set<string>();
  for (const [, text] of readFileSync(file, 'utf8').matchAll(
    /^#{2,6}\s+(.+)$/gm,
  )) {
    ids.add(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s/g, '-'),
    );
  }
  return ids;
}

const files = mdxFiles(here);
const links = files.flatMap((file) =>
  [...readFileSync(file, 'utf8').matchAll(/\]\((\/[^)\s]*)\)/g)].map(
    ([, href]) => ({ file: path.relative(here, file), href }),
  ),
);

describe('content links', () => {
  it('finds links to check', () => {
    expect(links.length).toBeGreaterThan(50);
  });

  it.each(links.map((link) => [link.href, link.file]))(
    '%s (in %s) resolves',
    (href) => {
      const [pathname, hash] = href.split('#');
      const api = /^\/api\/([^/]+)(?:\/([^/]+))?$/.exec(pathname);
      if (api) {
        const [, entry, symbol] = api;
        expect(Object.keys(BARRELS)).toContain(entry);
        if (!symbol) return;
        expect(exportsByEntry[entry].has(symbol)).toBe(true);
        if (entry === 'core') {
          const specific = CORE_SUBPATHS.filter((sub) =>
            exportsByEntry[sub].has(symbol),
          );
          expect(specific).toEqual([]);
        }
        return;
      }
      const page = /^\/(concepts|guides)\/([\w-]+)$/.exec(pathname);
      expect(page, `unknown internal link ${href}`).not.toBeNull();
      const file = path.join(here, page![1], `${page![2]}.mdx`);
      expect(statSync(file, { throwIfNoEntry: false })?.isFile()).toBe(true);
      if (hash) {
        expect(headingIds(file).has(hash)).toBe(true);
      }
    },
  );
});
