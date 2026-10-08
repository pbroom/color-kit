/**
 * Drift test: the generated reference must cover exactly what ships.
 *
 * - Every export of the built facade's `.d.ts`, per entry point, has a page
 *   (in that entry, or as a re-export pointing at its canonical page).
 * - Every subpath in `packages/color-kit/package.json#exports` is documented.
 * - Every in-content link to `/api/...` resolves to a page (and member
 *   anchor, when it names one).
 *
 * Needs the facade build (`pnpm build`) and the generated data
 * (`pnpm docs:api`, part of the docs build).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { ApiEntry, ApiModel, ApiSymbol } from './model';
import { symbolFileName } from './model';
import { matchRoute, notFoundRoute, routes } from '@/site/routes';
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

function readSymbol(slug: string, name: string): ApiSymbol | null {
  const file = path.join(
    generated,
    'api',
    'symbols',
    slug,
    `${symbolFileName(name)}.json`,
  );
  return existsSync(file) ? readJson<ApiSymbol>(file) : null;
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

  it('has a page for every export of the built facade', () => {
    const exportsByEntry = facadeExports(entryPoints);
    const missing: string[] = [];
    const stale: string[] = [];
    for (const entry of entryPoints) {
      const data = readEntry(entry.slug);
      const pages = new Set(data.symbols.map((symbol) => symbol.name));
      const reexports = new Map(
        data.reexports.map((item) => [item.name, item]),
      );
      const shipped = exportsByEntry.get(entry.slug) ?? [];
      expect(shipped.length, `${entry.dts} exports nothing`).toBeGreaterThan(0);
      for (const name of shipped) {
        if (pages.has(name)) {
          if (!readSymbol(entry.slug, name)) {
            missing.push(`${entry.importPath}: ${name} (no page file)`);
          }
          continue;
        }
        const reexport = reexports.get(name);
        if (!reexport || matchRoute(reexport.href) === notFoundRoute) {
          missing.push(`${entry.importPath}: ${name}`);
        }
      }
      const shippedSet = new Set(shipped);
      for (const name of [...pages, ...reexports.keys()]) {
        if (!shippedSet.has(name)) stale.push(`${entry.importPath}: ${name}`);
      }
    }
    expect(missing, 'exports without a reference page').toEqual([]);
    expect(stale, 'pages for names the facade does not export').toEqual([]);
  });

  it('routes every generated symbol, case preserved', () => {
    const symbolRoutes = routes.filter((route) => route.kind === 'api-symbol');
    const pages = model.entries.flatMap((entry) =>
      entry.symbols.map((symbol) => `/api/${entry.slug}/${symbol.name}`),
    );
    expect(symbolRoutes.map((route) => route.path).sort()).toEqual(
      pages.map((page) => encodeURI(page)).sort(),
    );
    expect(matchRoute('/api/core/Color')).not.toBe(
      matchRoute('/api/react/Color'),
    );
    expect(matchRoute('/api/core/Color').symbolKind).toBe('interface');
    expect(matchRoute('/api/react/Color').symbolKind).toBe('component');
    expect(matchRoute('/api/core/GamutTarget').path).toBe(
      '/api/core/GamutTarget',
    );
    expect(matchRoute('/api/driver/GamutTarget').path).toBe(
      '/api/driver/GamutTarget',
    );
  });
});

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

function checkLink(href: string): string | null {
  const [pathname = '', hash] = href.split('#');
  const route = matchRoute(pathname);
  if (route === notFoundRoute) return 'no such page';
  if (hash && route.kind === 'api-symbol' && route.entry && route.symbol) {
    const symbol = readSymbol(route.entry, route.symbol);
    const anchors = new Set([
      ...(symbol?.members ?? []).map((member) => `prop-${member.name}`),
      ...(symbol?.signatures ?? []).flatMap((signature, overload) =>
        signature.params.flatMap((param) => [
          overload === 0
            ? `param-${param.name}`
            : `param-${overload + 1}-${param.name}`,
          ...(param.children ?? []).map((child) =>
            overload === 0
              ? `param-${param.name}.${child.name}`
              : `param-${overload + 1}-${param.name}.${child.name}`,
          ),
        ]),
      ),
    ]);
    if (/^(prop|param)-/.test(hash) && !anchors.has(hash)) {
      return `no #${hash} on the page`;
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

  it('every link generated from JSDoc resolves', () => {
    const broken: string[] = [];
    const symbolsDir = path.join(generated, 'api', 'symbols');
    for (const entry of readdirSync(symbolsDir)) {
      for (const file of readdirSync(path.join(symbolsDir, entry))) {
        const text = readFileSync(path.join(symbolsDir, entry, file), 'utf8');
        for (const match of text.matchAll(/"href":"(\/[^"]*)"/g)) {
          const problem = checkLink(match[1]!);
          if (problem)
            broken.push(`${entry}/${file}: ${match[1]} (${problem})`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
