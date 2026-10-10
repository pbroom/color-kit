import type { ComponentType } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PrefetchLink } from '@/components/prefetch-link';
import { mdxComponents } from '@/components/ui/mdx-components';
import {
  readingOrder,
  SECTION_TITLES,
  type RouteModuleProps,
  type SiteRoute,
} from '@/site/routes';

export type MdxContent = ComponentType<{
  components?: typeof mdxComponents;
}>;

function Pager({ route }: { route: SiteRoute }) {
  const index = readingOrder.findIndex((item) => item.path === route.path);
  const previous = index > 0 ? readingOrder[index - 1] : undefined;
  const next = index >= 0 ? readingOrder[index + 1] : undefined;
  if (!previous && !next) {
    return null;
  }
  return (
    <nav className="pager" aria-label="Previous and next pages">
      {previous ? (
        <PrefetchLink to={previous.path} className="pager__link" rel="prev">
          <span className="pager__dir">
            <ArrowLeft aria-hidden="true" size={14} /> Previous
          </span>
          <span className="pager__title">{previous.navTitle}</span>
        </PrefetchLink>
      ) : (
        <span />
      )}
      {next ? (
        <PrefetchLink
          to={next.path}
          className="pager__link"
          data-next=""
          rel="next"
        >
          <span className="pager__dir">
            Next <ArrowRight aria-hidden="true" size={14} />
          </span>
          <span className="pager__title">{next.navTitle}</span>
        </PrefetchLink>
      ) : null}
    </nav>
  );
}

/**
 * Wraps an MDX page in the shared content frame: eyebrow, `<h1>` and lede
 * from frontmatter (so MDX bodies start at `##`), the prose grid with the
 * MDX component map, and previous/next links. Lives in its own chunk with
 * `mdxComponents`, so color-kit and the contracts load with content pages,
 * not with the shell.
 */
export function withContentFrame(
  Content: MdxContent,
): ComponentType<RouteModuleProps> {
  function ContentPage({ route }: RouteModuleProps) {
    return (
      <>
        <header className="doc-header">
          {route.section && SECTION_TITLES[route.section] !== route.title ? (
            <p className="doc-eyebrow">{SECTION_TITLES[route.section]}</p>
          ) : null}
          <h1 className="doc-title">{route.title}</h1>
          <p className="doc-lede">{route.description}</p>
        </header>
        <div className="prose">
          <Content components={mdxComponents} />
        </div>
        <Pager route={route} />
      </>
    );
  }
  return ContentPage;
}
