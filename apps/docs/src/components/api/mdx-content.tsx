import type { MdxPage } from '@/api/data';
import { mdxComponents } from '@/components/ui/mdx-components';

/**
 * Renders optional MDX that sits beside generated API pages
 * (`content/api/<entry>/index.mdx`, `content/api/<entry>/<Symbol>.mdx`)
 * with the site's MDX component map. Loaders cache the module, so `Content`
 * keeps its identity across renders.
 */
export function MdxContent({ Content }: { Content: MdxPage }) {
  return <Content components={mdxComponents} />;
}
