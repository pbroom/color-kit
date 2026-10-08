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
 * - **API** (`/api/<entry>`, `/api/<entry>/<Symbol>`): from the API route
 *   index (`src/site/api-routes.ts`), i.e. S2's generated data once present.
 * - **Fixed pages** (`/`, `/api`, `/api/map`, 404) map to modules owned by
 *   their slices: `src/routes/home/**` (S3), `src/routes/api/**` (S2) and
 *   `src/routes/api/map/**` (S5).
 */
import type { ComponentType } from 'react';
import { loadApiRouteIndex, type ApiRouteIndex } from './api-routes';

export type RouteKind =
  | 'home'
  | 'start'
  | 'concept'
  | 'guide'
  | 'api-index'
  | 'api-map'
  | 'api-entry'
  | 'api-symbol'
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
  /** API symbol routes: the exported name, case preserved. */
  symbol?: string;
  /** API symbol routes: the kind label (`function`, `interface`, …). */
  symbolKind?: string;
  /** API symbol routes: domain group for the sidebar tree. */
  group?: string;
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
  apiSymbol: () => import('../routes/api/symbol.js'),
  apiMap: () => import('../routes/api/map/index.js'),
  notFound: () => import('../routes/not-found.js'),
} satisfies Record<string, RouteLoader>;

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
 * or fixture) and returns entry + symbol routes in package order.
 */
export function apiRoutes(index: ApiRouteIndex): SiteRoute[] {
  return index.entries.flatMap((entry, entryOrder) => [
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
    ...entry.symbols.map((symbol, symbolOrder) => ({
      path: `/api/${entry.slug}/${encodeURIComponent(symbol.name)}`,
      kind: 'api-symbol' as const,
      title: symbol.name,
      navTitle: symbol.name,
      description: symbol.summary ?? `${symbol.name} from ${entry.importPath}.`,
      section: 'api' as const,
      order: symbolOrder,
      source: 'src/routes/api/symbol.tsx',
      load: PAGE_MODULES.apiSymbol,
      entry: entry.slug,
      symbol: symbol.name,
      symbolKind: symbol.kind,
      group: symbol.group,
    })),
  ]);
}

const fixedRoutes: SiteRoute[] = [
  {
    path: '/',
    kind: 'home',
    title: 'color-kit',
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

export const routes: readonly SiteRoute[] = [
  ...fixedRoutes,
  ...contentRoutes().sort(byOrder),
  ...apiRoutes(loadApiRouteIndex()),
];

const routesByPath = new Map(routes.map((route) => [route.path, route]));

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
  if (route.kind === 'api-entry') {
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
      .filter((route) => route.kind !== 'api-symbol')
      .map((route) => ({
        ...toItem(route),
        children:
          route.kind === 'api-entry'
            ? inSection('api')
                .filter(
                  (symbol) =>
                    symbol.kind === 'api-symbol' &&
                    symbol.entry === route.entry,
                )
                .map((symbol) => ({
                  ...toItem(symbol),
                  meta: symbol.symbolKind,
                }))
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
