/**
 * The route registry. Every page on the site is a `SiteRoute` in `routes`;
 * the sidebar, search, prerender and the route smoke test all read from it.
 *
 * Do not hand-edit routes here. Pages are discovered:
 *
 * - **Content** (`/start`, `/concepts/<slug>`, `/guides/<slug>`): any
 *   `src/content/{start,concepts/*,guides/*}.mdx`. Frontmatter supplies
 *   `title` and `description` (both required; the page header renders
 *   them, so bodies start at `##`), plus optional `order` and `navTitle`.
 *   Files starting with `_` are drafts and skipped.
 * - **API** (`/api/<entry>`, `/api/<entry>/<domain>`): from the API route
 *   index (`src/site/api-routes.ts`), i.e. S2's generated data once present.
 *   Symbols are not pages: each is a row on its category page, listed in
 *   `apiSymbols` and linked as `/api/<entry>/<domain>#<Symbol>`. Their old
 *   page paths (`/api/<entry>/<Symbol>`) redirect to the row
 *   (`legacySymbolRedirect`).
 * - **Fixed pages** (`/`, `/api`, `/api/map`, 404) map to modules owned by
 *   their slices: `src/routes/home/**` (S3), `src/routes/api/**` (S2) and
 *   `src/routes/api/map/**` (S5).
 */
import type { ComponentType } from 'react';
import { memberAnchor, panelAnchor, symbolHref } from '../api/model';
import { loadApiRouteIndex, type ApiRouteIndex } from './api-routes';

export type RouteKind =
  | 'home'
  | 'start'
  | 'concept'
  | 'guide'
  | 'api-index'
  | 'api-map'
  | 'api-entry'
  | 'api-domain'
  | 'not-found';

export type NavSection = 'start' | 'concepts' | 'guides' | 'api' | 'map';

/** Props every route module receives. MDX modules ignore them. */
export interface RouteModuleProps {
  route: SiteRoute;
}

export interface RouteModule {
  default: ComponentType<RouteModuleProps>;
}

export type RouteLoader = () => Promise<RouteModule>;

export interface SiteRoute {
  /** Canonical path: leading slash, no trailing slash (`/` for home). */
  path: string;
  kind: RouteKind;
  /** `<title>` and `<h1>` text. */
  title: string;
  /** Shorter label for the sidebar, defaults to `title`. */
  navTitle: string;
  /** Meta description and lede. */
  description: string;
  section: NavSection | null;
  /** Sort key within the section (ascending), then title. */
  order: number;
  /** Module file relative to `apps/docs`, used for prerender modulepreload. */
  source: string;
  /** Further modules `load` imports (modulepreloaded alongside `source`). */
  alsoLoads?: string[];
  load: RouteLoader;
  /** API routes: the entry slug (`core`, `plane`, …). */
  entry?: string;
  /** API domain routes: the category slug. */
  domain?: string;
}

/** A documented export: a row on its category page. */
export interface ApiSymbolLink {
  /** Exported name, case preserved: `Color` in core ≠ `Color` in react. */
  name: string;
  /** Kind label (`function`, `interface`, …). */
  kind: string;
  /** Entry slug of its canonical home. */
  entry: string;
  /** Category slug: the row lives on `/api/<entry>/<domain>`. */
  domain: string;
  /** First sentence of the summary (prerender only; empty in the client). */
  summary?: string;
  /** The row: `/api/core/conversion#toRgb`. */
  href: string;
  /** The retired per-symbol page, `/api/core/toRgb`, now a redirect. */
  legacyPath: string;
}

export interface ContentFrontmatter {
  title: string;
  description: string;
  order?: number;
  navTitle?: string;
}

const SITE_DESCRIPTION =
  'color-kit is a queryable color engine: OKLCH-canonical conversion, contrast, gamut geometry and plane queries, with React bindings.';

interface MdxModule {
  default: import('../components/shell/content-frame').MdxContent;
}

const CONTENT_GLOBS = {
  loaders: import.meta.glob<MdxModule>([
    '../content/start.mdx',
    '../content/concepts/*.mdx',
    '../content/guides/*.mdx',
    '!../content/**/_*.mdx',
  ]),
  frontmatter: import.meta.glob<ContentFrontmatter>(
    [
      '../content/start.mdx',
      '../content/concepts/*.mdx',
      '../content/guides/*.mdx',
      '!../content/**/_*.mdx',
    ],
    { eager: true, query: '?frontmatter', import: 'default' },
  ),
};

const PAGE_MODULES = {
  home: () => import('../routes/home/index.js'),
  apiIndex: () => import('../routes/api/index.js'),
  apiEntry: () => import('../routes/api/entry.js'),
  apiMap: () => import('../routes/api/map/index.js'),
  notFound: () => import('../routes/not-found.js'),
} satisfies Record<string, RouteLoader>;

const API_DOMAIN_TITLES: Record<string, string> = { hct: 'HCT' };

function apiDomainTitle(slug: string): string {
  return (
    API_DOMAIN_TITLES[slug] ??
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
  );
}

const CONTENT_FRAME_SOURCE = 'src/components/shell/content-frame.tsx';
const loadContentFrame = () => import('../components/shell/content-frame.js');

function sourceOf(globKey: string): string {
  return globKey.replace(/^\.\.\//, 'src/');
}

function contentRoutes(): SiteRoute[] {
  return Object.entries(CONTENT_GLOBS.loaders).map(([key, load]) => {
    const meta = CONTENT_GLOBS.frontmatter[key];
    if (!meta?.title || !meta.description) {
      throw new Error(
        `${sourceOf(key)} needs \`title\` and \`description\` frontmatter`,
      );
    }
    const match = /content\/(?:(concepts|guides)\/)?([^/]+)\.mdx$/.exec(key);
    const folder = match?.[1];
    const slug = match?.[2] ?? '';
    const kind: RouteKind =
      folder === 'concepts'
        ? 'concept'
        : folder === 'guides'
          ? 'guide'
          : 'start';
    const section: NavSection =
      kind === 'concept' ? 'concepts' : kind === 'guide' ? 'guides' : 'start';
    return {
      path: kind === 'start' ? '/start' : `/${folder}/${slug}`,
      kind,
      title: meta.title,
      navTitle: meta.navTitle ?? meta.title,
      description: meta.description,
      section,
      order: meta.order ?? 100,
      source: sourceOf(key),
      alsoLoads: [CONTENT_FRAME_SOURCE],
      load: () =>
        Promise.all([load(), loadContentFrame()]).then(([page, frame]) => ({
          default: frame.withContentFrame(page.default),
        })),
    };
  });
}

/**
 * Hook for generated API routes. Called with the API route index (generated
 * or fixture) and returns entry + category routes in package order.
 */
export function apiRoutes(index: ApiRouteIndex): SiteRoute[] {
  return index.entries.flatMap((entry, entryOrder) => {
    const domains = [
      ...new Set(entry.symbols.map((symbol) => symbol.group ?? 'other')),
    ];
    return [
      {
        path: `/api/${entry.slug}`,
        kind: 'api-entry' as const,
        title: entry.title,
        navTitle: entry.title,
        description: entry.summary ?? `API reference for ${entry.importPath}.`,
        section: 'api' as const,
        order: entryOrder,
        source: 'src/routes/api/entry.tsx',
        load: PAGE_MODULES.apiEntry,
        entry: entry.slug,
      },
      ...domains.map((domain, domainOrder) => ({
        path: `/api/${entry.slug}/${domain}`,
        kind: 'api-domain' as const,
        title: apiDomainTitle(domain),
        navTitle: apiDomainTitle(domain),
        description: `${apiDomainTitle(domain)} API reference for ${entry.importPath}.`,
        section: 'api' as const,
        order: domainOrder,
        source: 'src/routes/api/entry.tsx',
        load: PAGE_MODULES.apiEntry,
        entry: entry.slug,
        domain,
      })),
    ];
  });
}

/** Every documented export, in package then display order. */
export function apiSymbolLinks(index: ApiRouteIndex): ApiSymbolLink[] {
  return index.entries.flatMap((entry) =>
    entry.symbols.map((symbol) => {
      const domain = symbol.group ?? 'other';
      return {
        name: symbol.name,
        kind: symbol.kind,
        entry: entry.slug,
        domain,
        summary: symbol.summary,
        href: symbolHref(entry.slug, domain, symbol.name),
        legacyPath: `/api/${entry.slug}/${encodeURIComponent(symbol.name)}`,
      };
    }),
  );
}

const fixedRoutes: SiteRoute[] = [
  {
    path: '/',
    kind: 'home',
    title: '@pbroom/color-kit',
    navTitle: 'Home',
    description: SITE_DESCRIPTION,
    section: null,
    order: 0,
    source: 'src/routes/home/index.tsx',
    load: PAGE_MODULES.home,
  },
  {
    path: '/api',
    kind: 'api-index',
    title: 'API reference',
    navTitle: 'Overview',
    description:
      'Every export of color-kit, organized by entry point in package order.',
    section: 'api',
    order: -1,
    source: 'src/routes/api/index.tsx',
    load: PAGE_MODULES.apiIndex,
  },
  {
    path: '/api/map',
    kind: 'api-map',
    title: 'API map',
    navTitle: 'Map',
    description:
      'The whole color-kit surface as one map: entry points, domains and symbols.',
    section: 'map',
    order: 0,
    source: 'src/routes/api/map/index.tsx',
    load: PAGE_MODULES.apiMap,
  },
];

/** Rendered for any unknown path; prerendered to `404.html`. */
export const notFoundRoute: SiteRoute = {
  path: '/404',
  kind: 'not-found',
  title: 'Page not found',
  navTitle: 'Not found',
  description: 'This page does not exist.',
  section: null,
  order: 0,
  source: 'src/routes/not-found.tsx',
  load: PAGE_MODULES.notFound,
};

function byOrder(a: SiteRoute, b: SiteRoute): number {
  return a.order - b.order || a.title.localeCompare(b.title);
}

const apiRouteIndex = loadApiRouteIndex();

export const routes: readonly SiteRoute[] = [
  ...fixedRoutes,
  ...contentRoutes().sort(byOrder),
  ...apiRoutes(apiRouteIndex),
];

/** Every documented export with its row link, in package order. */
export const apiSymbols: readonly ApiSymbolLink[] =
  apiSymbolLinks(apiRouteIndex);

const routesByPath = new Map(routes.map((route) => [route.path, route]));
const symbolsByHref = new Map(
  apiSymbols.flatMap((symbol) => [
    [symbol.href, symbol],
    [symbol.legacyPath, symbol],
  ]),
);

/** Normalize a URL pathname to a registry key. */
export function normalizePath(pathname: string): string {
  let path = pathname.split(/[?#]/)[0] ?? '/';
  try {
    path = decodeURI(path);
  } catch {
    // Keep the raw path; it will simply not match.
  }
  path = path.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

/**
 * The export a link points at: its row (`/api/core/conversion#toRgb`) or its
 * retired page path (`/api/core/toRgb`).
 */
export function apiSymbolAt(href: string): ApiSymbolLink | undefined {
  const [pathname = '', hash] = href.split('#');
  if (hash !== undefined) {
    return symbolsByHref.get(`${normalizePath(pathname)}#${hash}`);
  }
  const path = normalizePath(pathname);
  return symbolsByHref.get(path) ?? symbolsByHref.get(encodeURI(path));
}

/**
 * Where a retired symbol page (`/api/<entry>/<Symbol>`) lives now: its row,
 * `/api/<entry>/<domain>#<Symbol>`. An old member or parameter anchor
 * (`#prop-hex`, `#param-color`) maps to the same anchor inside the row's
 * panel (`#Color-prop-hex`). `null` for any other path.
 */
export function legacySymbolRedirect(
  pathname: string,
  hash = '',
): string | null {
  if (routesByPath.has(normalizePath(pathname))) return null;
  const symbol = apiSymbolAt(pathname);
  if (!symbol) return null;
  const fragment = hash.replace(/^#/, '');
  if (/^(prop|param)-/.test(fragment)) {
    const page = symbol.href.split('#')[0]!;
    let id = fragment;
    try {
      id = decodeURIComponent(fragment);
    } catch {
      // Keep the raw fragment.
    }
    const anchor = id.startsWith('prop-')
      ? memberAnchor(symbol.name, id.slice('prop-'.length))
      : panelAnchor(symbol.name, id);
    return `${page}#${encodeURIComponent(anchor)}`;
  }
  return symbol.href;
}

/** The route for a pathname, or the 404 route. */
export function matchRoute(pathname: string): SiteRoute {
  const path = normalizePath(pathname);
  const route = routesByPath.get(path);
  if (route) {
    return route;
  }
  // Symbol names are case-preserving, but forgive a stray encoding.
  return routesByPath.get(encodeURI(path)) ?? notFoundRoute;
}

/** The document `<title>` for a route (prerender and client navigation). */
export function documentTitle(route: SiteRoute): string {
  if (route.kind === 'home') {
    return 'color-kit: a queryable color engine';
  }
  if (route.kind === 'api-entry' || route.kind === 'api-domain') {
    return `${route.title} API reference`;
  }
  return `${route.title} · color-kit`;
}

export interface NavItem {
  title: string;
  path: string;
  kind: RouteKind;
  /** Mono label for API items (`function`, `interface`, …). */
  meta?: string;
  children?: NavItem[];
}

export interface NavGroup {
  id: NavSection;
  title: string;
  items: NavItem[];
}

function toItem(route: SiteRoute): NavItem {
  return { title: route.navTitle, path: route.path, kind: route.kind };
}

function inSection(section: NavSection): SiteRoute[] {
  return routes.filter((route) => route.section === section);
}

/** Sidebar order: Start, Concepts, Guides, API (package order), Map. */
export const navigation: readonly NavGroup[] = [
  { id: 'start', title: 'Start', items: inSection('start').map(toItem) },
  {
    id: 'concepts',
    title: 'Concepts',
    items: inSection('concepts').map(toItem),
  },
  { id: 'guides', title: 'Guides', items: inSection('guides').map(toItem) },
  {
    id: 'api',
    title: 'API',
    items: inSection('api')
      .filter((route) => route.kind !== 'api-domain')
      .map((route) => ({
        ...toItem(route),
        children:
          route.kind === 'api-entry'
            ? apiSymbols
                .filter((symbol) => symbol.entry === route.entry)
                .map(
                  (symbol): NavItem => ({
                    title: symbol.name,
                    // Symbols are rows on their category's page.
                    path: symbol.href,
                    kind: 'api-domain',
                    meta: symbol.kind,
                  }),
                )
            : undefined,
      })),
  },
  { id: 'map', title: 'Map', items: inSection('map').map(toItem) },
].filter((group) => group.items.length > 0) as NavGroup[];

/** Content pages in reading order, for previous/next links. */
export const readingOrder: readonly SiteRoute[] = [
  ...inSection('start'),
  ...inSection('concepts'),
  ...inSection('guides'),
];

export const SECTION_TITLES: Record<NavSection, string> = {
  start: 'Start',
  concepts: 'Concepts',
  guides: 'Guides',
  api: 'API',
  map: 'Map',
};
