import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

interface DocsMdxModule {
  default: ComponentType;
}

type DocsMdxLoader = () => Promise<DocsMdxModule>;

export interface DocsNavItem {
  title: string;
  path: string;
  href: string;
}

export interface DocsNavSection {
  title: string;
  items: DocsNavItem[];
}

function toDocsHref(path: string): string {
  return `/docs/${path}`;
}

function normalizeMdxPath(mdxPath: string): string {
  return mdxPath.replace(/^\.\//, '').replace(/\.mdx$/, '');
}

const mdxLoaders = import.meta.glob('./**/*.mdx') as Record<
  string,
  DocsMdxLoader
>;

const docsPageEntries = Object.entries(mdxLoaders).filter(
  ([mdxPath]) => !normalizeMdxPath(mdxPath).startsWith('components/'),
);

/**
 * Raw MDX module loaders keyed by normalized docs path (e.g. `introduction`,
 * `api/plane-api`). Exposed so navigation can warm a page's chunk on hover/focus
 * before the user clicks, making the eventual `lazy()` resolve synchronously.
 */
export const docsPageLoaders: Record<string, DocsMdxLoader> =
  Object.fromEntries(
    docsPageEntries.map(([mdxPath, loader]) => [
      normalizeMdxPath(mdxPath),
      loader,
    ]),
  );

export const docsPages: Record<
  string,
  LazyExoticComponent<ComponentType>
> = Object.fromEntries(
  docsPageEntries.map(([mdxPath, loader]) => [
    normalizeMdxPath(mdxPath),
    lazy(loader),
  ]),
);

const componentPages = [
  { title: 'Color', path: 'components/color' },
  { title: 'Color Area', path: 'components/color-area' },
  { title: 'Color Slider', path: 'components/color-slider' },
  { title: 'Color Input', path: 'components/color-input' },
  { title: 'Color String Input', path: 'components/color-string-input' },
] as const;

export const docsNavigation: DocsNavSection[] = [
  {
    title: 'Getting Started',
    items: [
      {
        title: 'Introduction',
        path: 'introduction',
        href: toDocsHref('introduction'),
      },
      {
        title: 'Installation',
        path: 'installation',
        href: toDocsHref('installation'),
      },
      {
        title: 'Multi-Color State',
        path: 'multi-color-state',
        href: toDocsHref('multi-color-state'),
      },
      {
        title: 'React Primitives',
        path: 'react-primitives',
        href: toDocsHref('react-primitives'),
      },
      {
        title: 'shadcn Registry',
        path: 'shadcn-registry',
        href: toDocsHref('shadcn-registry'),
      },
    ],
  },
  {
    title: 'Components',
    items: componentPages.map((page) => ({
      title: page.title,
      path: page.path,
      href: toDocsHref(page.path),
    })),
  },
  {
    title: 'API Reference',
    items: [
      {
        title: 'Plane API',
        path: 'api/plane-api',
        href: toDocsHref('api/plane-api'),
      },
      {
        title: 'Plane Queries',
        path: 'api/plane-queries',
        href: toDocsHref('api/plane-queries'),
      },
      {
        title: 'Conversion',
        path: 'api/conversion',
        href: toDocsHref('api/conversion'),
      },
      {
        title: 'Contrast',
        path: 'api/contrast',
        href: toDocsHref('api/contrast'),
      },
      {
        title: 'Harmony',
        path: 'api/harmony',
        href: toDocsHref('api/harmony'),
      },
      {
        title: 'Scale',
        path: 'api/scale',
        href: toDocsHref('api/scale'),
      },
      {
        title: 'Manipulation',
        path: 'api/manipulation',
        href: toDocsHref('api/manipulation'),
      },
      {
        title: 'Gamut',
        path: 'api/gamut',
        href: toDocsHref('api/gamut'),
      },
    ],
  },
];
