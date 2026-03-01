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

export const docsPages: Record<
  string,
  LazyExoticComponent<ComponentType>
> = Object.fromEntries(
  Object.entries(mdxLoaders).map(([mdxPath, loader]) => [
    normalizeMdxPath(mdxPath),
    lazy(loader),
  ]),
);

const componentPages = [
  { title: 'Color', path: 'components/color' },
  { title: 'Color Area', path: 'components/color-area' },
  { title: 'Color Wheel', path: 'components/color-wheel' },
  { title: 'Color Slider', path: 'components/color-slider' },
  { title: 'Color Dial', path: 'components/color-dial' },
  { title: 'Hue Dial', path: 'components/hue-dial' },
  { title: 'Swatch', path: 'components/swatch' },
  { title: 'Swatch Group', path: 'components/swatch-group' },
  { title: 'Color Input', path: 'components/color-input' },
  { title: 'Color String Input', path: 'components/color-string-input' },
  { title: 'Color Display', path: 'components/color-display' },
  { title: 'Contrast Badge', path: 'components/contrast-badge' },
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
    ],
  },
  {
    title: 'Recipes',
    items: [
      {
        title: 'Plane Basic',
        path: 'recipes/plane-basic',
        href: toDocsHref('recipes/plane-basic'),
      },
      {
        title: 'Plane Composition',
        path: 'recipes/plane-composition',
        href: toDocsHref('recipes/plane-composition'),
      },
      {
        title: 'Plane Performance',
        path: 'recipes/plane-performance',
        href: toDocsHref('recipes/plane-performance'),
      },
    ],
  },
];
