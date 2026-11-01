import {
  createContext,
  use,
  type ComponentPropsWithoutRef,
  type ComponentType,
} from 'react';
import type { MdxPage } from '@/api/data';
import { panelAnchor } from '@/api/model';
import { mdxComponents } from '@/components/ui/mdx-components';

/**
 * Renders optional MDX that sits beside generated API pages
 * (`content/api/<entry>/index.mdx`) with the site's MDX component map.
 * Loaders cache the module, so `Content` keeps its identity across renders.
 */
export function MdxContent({ Content }: { Content: MdxPage }) {
  return <Content components={mdxComponents} />;
}

/** The symbol whose panel the notes render in. */
const PanelOwner = createContext('');

type HeadingTag = 'h3' | 'h4' | 'h5';

function PanelHeading({
  as: Tag,
  id,
  children,
  ...rest
}: ComponentPropsWithoutRef<'h3'> & { as: HeadingTag }) {
  const owner = use(PanelOwner);
  if (!id) {
    return <Tag {...rest}>{children}</Tag>;
  }
  const anchor = panelAnchor(owner, id);
  return (
    <Tag id={anchor} className="api-panel__heading" {...rest}>
      <a className="heading-anchor" href={`#${encodeURIComponent(anchor)}`}>
        {children}
      </a>
    </Tag>
  );
}

/**
 * Inside a panel, notes headings sit one level below the panel's own
 * sections and their ids carry the symbol's name (`Color-edge-cases`).
 */
const panelComponents: Record<string, ComponentType<never>> = {
  ...mdxComponents,
  h2: (props: ComponentPropsWithoutRef<'h3'>) => (
    <PanelHeading as="h3" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<'h3'>) => (
    <PanelHeading as="h4" {...props} />
  ),
  h4: (props: ComponentPropsWithoutRef<'h3'>) => (
    <PanelHeading as="h5" {...props} />
  ),
};

/**
 * `content/api/<entry>/<Symbol>.mdx` notes in the symbol's panel on its
 * category page.
 */
export function PanelMdxContent({
  Content,
  owner,
}: {
  Content: MdxPage;
  owner: string;
}) {
  return (
    <PanelOwner value={owner}>
      <Content components={panelComponents} />
    </PanelOwner>
  );
}
