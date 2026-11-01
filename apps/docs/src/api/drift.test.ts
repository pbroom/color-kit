/**
 * Drift test: the generated reference must cover exactly what ships.
 *
 * - Every export of the built facade's `.d.ts`, per entry point, is a row on
 *   a category page (in that entry, or a re-export pointing at its
 *   canonical row).
 * - Every subpath in `packages/color-kit/package.json#exports` is documented.
 * - Every retired symbol page path redirects to its row.
 * - Every in-content link to `/api/...` resolves to a page (and to a row,
 *   member or parameter anchor on it, when it names one), never to a
 *   retired symbol page.
 *
 * Needs the facade build (`pnpm build`) and the generated data
 * (`pnpm docs:api`, part of the docs build).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { ApiEntry, ApiModel, ApiSymbol } from './model';
import { memberAnchor, paramAnchor, symbolHref } from './model';
import {
  apiSymbols,
  legacySymbolRedirect,
  matchRoute,
  notFoundRoute,
  routes,
} from '@/site/routes';
import {
  docsRoot,
  facadeRoot,
  readEntryPoints,
  type EntryPoint,
} from '../../scripts/api/entries.mjs';

const generated = path.join(docsRoot, 'src', 'generated');
const modelFile = path.join(generated, 'api.json');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function requireGenerated(): ApiModel {
  if (!existsSync(modelFile)) {
    throw new Error(
      'src/generated/api.json is missing: run `pnpm --filter @color-kit/docs docs:api` (the docs build runs it).',
    );
  }
  return readJson<ApiModel>(modelFile);
}

function readEntry(slug: string): ApiEntry {
  return readJson<ApiEntry>(
    path.join(generated, 'api', 'entries', `${slug}.json`),
  );
}

const domainCache = new Map<string, ApiSymbol[]>();

/** A category's symbols, from all of its data parts in order. */
function readDomain(slug: string, domain: string): ApiSymbol[] {
  const key = `${slug}/${domain}`;
  let symbols = domainCache.get(key);
  if (!symbols) {
    const dir = path.join(generated, 'api', 'domains', slug, domain);
    symbols = existsSync(dir)
      ? readdirSync(dir)
          .filter((file) => /^\d+\.json$/.test(file))
          .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
          .flatMap((file) => readJson<ApiSymbol[]>(path.join(dir, file)))
      : [];
    domainCache.set(key, symbols);
  }
  return symbols;
}

/** Ids a symbol's panel links to: member and parameter rows. */
function panelAnchors(symbol: ApiSymbol): Set<string> {
  return new Set([
    ...symbol.members.map((member) => memberAnchor(symbol.name, member.name)),
    ...symbol.signatures.flatMap((signature, overload) =>
      signature.params.flatMap((param) => [
        paramAnchor(symbol.name, param.name, overload),
        ...(param.children ?? []).map((child) =>
          paramAnchor(symbol.name, `${param.name}.${child.name}`, overload),
        ),
      ]),
    ),
  ]);
}

/** Export names of each built declaration file, via the TS checker. */
function facadeExports(entries: EntryPoint[]): Map<string, string[]> {
  const files = entries.map((entry) => path.join(facadeRoot, entry.dts));
  for (const file of files) {
    if (!existsSync(file)) {
      throw new Error(
        `${path.relative(process.cwd(), file)} is missing: build the packages first (\`pnpm build\`).`,
      );
    }
  }
  const program = ts.createProgram(files, {
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    types: [],
  });
  const checker = program.getTypeChecker();
  return new Map(
    entries.map((entry, index) => {
      const source = program.getSourceFile(files[index]!);
      const symbol = source && checker.getSymbolAtLocation(source);
      const names = symbol
        ? checker.getExportsOfModule(symbol).map((item) => item.name)
        : [];
      return [entry.slug, names];
    }),
  );
}

const entryPoints = readEntryPoints();

describe('API reference drift', () => {
  const model = requireGenerated();

  it('documents every subpath in package.json#exports', () => {
    const manifest = readJson<{ exports: Record<string, unknown> }>(
      path.join(facadeRoot, 'package.json'),
    );
    const subpaths = Object.keys(manifest.exports)
      .filter((key) => key !== './package.json')
      .sort();
    expect(entryPoints.flatMap((entry) => entry.subpaths).sort()).toEqual(
      subpaths,
    );
    for (const entry of entryPoints) {
      const documented = model.entries.find((item) => item.slug === entry.slug);
      expect(
        documented,
        `${entry.importPath} is not in api.json`,
      ).toBeDefined();
      expect(documented!.aliases).toEqual(entry.aliases);
      expect(
        matchRoute(`/api/${entry.slug}`).kind,
        `/api/${entry.slug} has no route`,
      ).toBe('api-entry');
    }
  });

  it('documents every export of the built facade as a row', () => {
    const exportsByEntry = facadeExports(entryPoints);
    const missing: string[] = [];
    const stale: string[] = [];
    for (const entry of entryPoints) {
      const data = readEntry(entry.slug);
      const rows = new Map(data.symbols.map((symbol) => [symbol.name, symbol]));
      const reexports = new Map(
        data.reexports.map((item) => [item.name, item]),
      );
      const shipped = exportsByEntry.get(entry.slug) ?? [];
      expect(shipped.length, `${entry.dts} exports nothing`).toBeGreaterThan(0);
      for (const name of shipped) {
        const row = rows.get(name);
        if (row) {
          const page = matchRoute(`/api/${entry.slug}/${row.domain}`);
          if (page.kind !== 'api-domain') {
            missing.push(`${entry.importPath}: ${name} (no category page)`);
          } else if (
            !readDomain(entry.slug, row.domain).some(
              (symbol) => symbol.name === name,
            )
          ) {
            missing.push(`${entry.importPath}: ${name} (no row data)`);
          }
          continue;
        }
        const reexport = reexports.get(name);
        const problem = reexport ? checkLink(reexport.href) : 'not listed';
        if (problem) {
          missing.push(`${entry.importPath}: ${name} (${problem})`);
        }
      }
      const shippedSet = new Set(shipped);
      for (const name of [...rows.keys(), ...reexports.keys()]) {
        if (!shippedSet.has(name)) stale.push(`${entry.importPath}: ${name}`);
      }
    }
    expect(missing, 'exports without a reference row').toEqual([]);
    expect(stale, 'rows for names the facade does not export').toEqual([]);
  });

  it('links every generated symbol to its row, case preserved', () => {
    const rows = model.entries.flatMap((entry) =>
      entry.symbols.map((symbol) =>
        symbolHref(entry.slug, symbol.domain, symbol.name),
      ),
    );
    expect(apiSymbols.map((symbol) => symbol.href).sort()).toEqual(rows.sort());
    expect(routes.some((route) => route.path === '/api/core/Color')).toBe(
      false,
    );
    const core = apiSymbols.find(
      (symbol) => symbol.entry === 'core' && symbol.name === 'Color',
    );
    const react = apiSymbols.find(
      (symbol) => symbol.entry === 'react' && symbol.name === 'Color',
    );
    expect(core?.kind).toBe('interface');
    expect(react?.kind).toBe('component');
    expect(core?.href).not.toBe(react?.href);
  });

  it('redirects every retired symbol page to its row', () => {
    for (const symbol of apiSymbols) {
      expect(matchRoute(symbol.legacyPath), symbol.legacyPath).toBe(
        notFoundRoute,
      );
      expect(legacySymbolRedirect(symbol.legacyPath), symbol.legacyPath).toBe(
        symbol.href,
      );
      expect(checkLink(symbol.href), symbol.href).toBeNull();
    }
    expect(legacySymbolRedirect('/api/core/Color')).toMatch(
      /^\/api\/core\/[a-z-]+#Color$/,
    );
    expect(legacySymbolRedirect('/api/react/Color')).toBe(
      '/api/react/color-state#Color',
    );
    expect(legacySymbolRedirect('/api/react/Color', '#prop-children')).toBe(
      '/api/react/color-state#Color-prop-children',
    );
    expect(legacySymbolRedirect('/api/core/conversion')).toBeNull();
    expect(legacySymbolRedirect('/api/core/notAnExport')).toBeNull();
  });
});

function walkJson(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walkJson(file, out);
    else if (name.endsWith('.json')) out.push(file);
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file, out);
    else if (/\.(mdx?|tsx?)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(file);
    }
  }
  return out;
}

/** `/api/...` hrefs in MDX links, JSX `href`/`to` props and plain strings. */
function apiLinks(source: string): string[] {
  const links = new Set<string>();
  const patterns = [
    /\]\((\/api\/[^)\s]*)\)/g,
    /(?:href|to)=["'{`]+(\/api\/[^"'`}\s]*)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) links.add(match[1]!);
  }
  return [...links].filter((link) => !link.includes('${'));
}

/**
 * Why `href` is broken, or `null`. On a category page the fragment must
 * name a row (`#toRgb`) or an id inside one (`#toRgb-param-color`,
 * `#Color-prop-hex`, `#toRgb-examples`); member and parameter anchors must
 * exist on that symbol.
 */
function checkLink(href: string): string | null {
  const [pathname = '', rawHash] = href.split('#');
  const route = matchRoute(pathname);
  if (route === notFoundRoute) {
    const row = legacySymbolRedirect(pathname);
    return row ? `a retired symbol page: link ${row}` : 'no such page';
  }
  if (rawHash && route.kind === 'api-domain' && route.entry && route.domain) {
    const hash = decodeURIComponent(rawHash);
    const symbols = readDomain(route.entry, route.domain);
    if (symbols.some((symbol) => symbol.name === hash)) return null;
    const owner = symbols.find((symbol) => hash.startsWith(`${symbol.name}-`));
    if (!owner) return `no row for #${hash} on ${pathname}`;
    const id = hash.slice(owner.name.length + 1);
    if (/^(prop|param)-/.test(id) && !panelAnchors(owner).has(hash)) {
      return `no #${hash} in the ${owner.name} row`;
    }
  }
  return null;
}

describe('API links', () => {
  requireGenerated();

  it('every /api link in docs content resolves', () => {
    const src = path.join(docsRoot, 'src');
    const files = [
      ...walk(path.join(src, 'content')),
      ...walk(path.join(src, 'examples')),
      ...walk(path.join(src, 'routes')),
      ...walk(path.join(src, 'components')),
    ];
    const broken: string[] = [];
    for (const file of files) {
      for (const href of apiLinks(readFileSync(file, 'utf8'))) {
        const problem = checkLink(href);
        if (problem) {
          broken.push(`${path.relative(src, file)}: ${href} (${problem})`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('every link generated from JSDoc and types resolves', () => {
    const broken: string[] = [];
    const files = walkJson(path.join(generated, 'api'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/"href":"(\/[^"]*)"/g)) {
        const problem = checkLink(match[1]!);
        if (problem) {
          broken.push(
            `${path.relative(generated, file)}: ${match[1]} (${problem})`,
          );
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
