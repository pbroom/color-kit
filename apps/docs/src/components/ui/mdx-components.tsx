import type { ComponentPropsWithoutRef, ComponentType } from 'react';
import { PrefetchLink } from '@/components/prefetch-link';
import { Callout } from './callout';
import { CodeBlock } from './code-block';
import { Example } from './example';
import { InstallLine } from './install-line';
import { Signature } from './signature';
import { GamutBadge, Swatch } from './swatch';

function Heading({
  as: Tag,
  id,
  children,
  ...rest
}: ComponentPropsWithoutRef<'h2'> & { as: 'h2' | 'h3' | 'h4' }) {
  if (!id) {
    return <Tag {...rest}>{children}</Tag>;
  }
  return (
    <Tag id={id} {...rest}>
      <a className="heading-anchor" href={`#${id}`}>
        {children}
      </a>
    </Tag>
  );
}

function Anchor({
  href = '',
  children,
  ...rest
}: ComponentPropsWithoutRef<'a'>) {
  if (href.startsWith('/') && !href.startsWith('//')) {
    return (
      <PrefetchLink to={href} {...rest}>
        {children}
      </PrefetchLink>
    );
  }
  const external = /^https?:/.test(href);
  return (
    <a href={href} {...rest} {...(external ? { rel: 'noreferrer' } : null)}>
      {children}
    </a>
  );
}

/** Fenced code from rehype-shiki: `<pre data-lang data-title>` → CodeBlock. */
function Pre(
  props: ComponentPropsWithoutRef<'pre'> & {
    'data-title'?: string;
    'data-lang'?: string;
  },
) {
  const { 'data-title': title, 'data-lang': lang, ...rest } = props;
  return (
    <CodeBlock filename={title} lang={lang}>
      <pre {...rest} />
    </CodeBlock>
  );
}

function Table(props: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="table-scroll" tabIndex={0}>
      <table {...props} />
    </div>
  );
}

/**
 * Components available in every MDX page without an import: element
 * overrides plus the contracts `Callout`, `CodeBlock`, `Example`,
 * `GamutBadge`, `InstallLine`, `Signature` and `Swatch`.
 */
export const mdxComponents: Record<string, ComponentType<never>> = {
  h2: (props: ComponentPropsWithoutRef<'h2'>) => <Heading as="h2" {...props} />,
  h3: (props: ComponentPropsWithoutRef<'h3'>) => <Heading as="h3" {...props} />,
  h4: (props: ComponentPropsWithoutRef<'h4'>) => <Heading as="h4" {...props} />,
  a: Anchor,
  pre: Pre,
  table: Table,
  Callout,
  CodeBlock,
  Example,
  GamutBadge,
  InstallLine,
  Signature,
  Swatch,
};
