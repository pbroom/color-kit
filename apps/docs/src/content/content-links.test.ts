/**
 * Internal links in hand-written content must resolve against the route
 * registry: concept and guide pages (and their heading anchors) must exist,
 * and every `/api/...` link must name a page of the generated API reference.
 * Symbol pages live only at their canonical entry, so a link to a root
 * re-export (`/api/core/definePlane`) fails; link `/api/plane/definePlane`.
 * Member anchors on `/api` links are checked by the API drift test.
 *
 * Needs the generated API data (`pnpm docs:api`, part of the docs build).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { matchRoute, notFoundRoute } from '@/site/routes';

const here = path.dirname(fileURLToPath(import.meta.url));
const generatedModel = path.resolve(here, '../generated/api.json');

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

const API_KINDS = ['api-index', 'api-map', 'api-entry', 'api-symbol'];

const files = mdxFiles(here);
const links = files.flatMap((file) =>
  [...readFileSync(file, 'utf8').matchAll(/\]\((\/[^)\s]*)\)/g)].map(
    ([, href]) => ({ file: path.relative(here, file), href }),
  ),
);

describe('content links', () => {
  it('has the generated API data to check against', () => {
    expect(
      existsSync(generatedModel),
      'src/generated/api.json is missing: run `pnpm --filter @color-kit/docs docs:api` (the docs build runs it).',
    ).toBe(true);
  });

  it('finds links to check', () => {
    expect(links.length).toBeGreaterThan(50);
  });

  it.each(links.map((link) => [link.href, link.file]))(
    '%s (in %s) resolves',
    (href) => {
      const [pathname = '', hash] = href.split('#');
      const route = matchRoute(pathname);
      expect(route, `unknown internal link ${href}`).not.toBe(notFoundRoute);
      if (pathname.startsWith('/api')) {
        expect(API_KINDS).toContain(route.kind);
        return;
      }
      const page = /^\/(concepts|guides)\/([\w-]+)$/.exec(pathname);
      if (!page || !hash) return;
      const file = path.join(here, page[1]!, `${page[2]}.mdx`);
      expect(headingIds(file).has(hash), `no #${hash} on ${pathname}`).toBe(
        true,
      );
    },
  );
});
