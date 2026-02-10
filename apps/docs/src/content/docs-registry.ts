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
  { title: 'Color Provider', path: 'components/color-provider' },
  { title: 'Color Area', path: 'components/color-area' },
  { title: 'Color Slider', path: 'components/color-slider' },
  { title: 'Hue Slider', path: 'components/hue-slider' },
  { title: 'Alpha Slider', path: 'components/alpha-slider' },
  { title: 'Swatch', path: 'components/swatch' },
  { title: 'Swatch Group', path: 'components/swatch-group' },
  { title: 'Color Input', path: 'components/color-input' },
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
        title: 'Dual-State Migration',
        path: 'migration-dual-state',
        href: toDocsHref('migration-dual-state'),
      },
      {
        title: 'Multi-Color State',
        path: 'multi-color-state',
        href: toDocsHref('multi-color-state'),
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
];
