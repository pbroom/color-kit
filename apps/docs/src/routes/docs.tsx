import { useParams } from 'react-router';
import { Suspense } from 'react';
import { docsPages } from '../content/docs-registry.js';
import { getComponentDoc } from '../content/components/component-docs-data.js';
import { ComponentDocPage } from '../components/component-doc-page.js';

function NotFound() {
  return (
    <div>
      <h1>Page not found</h1>
      <p>The documentation page you're looking for doesn't exist yet.</p>
    </div>
  );
}

export function DocsPage() {
  const { slug, category } = useParams();
  const path = category ? `${category}/${slug}` : slug;

  if (category === 'components' && slug) {
    const componentDoc = getComponentDoc(slug);
    if (componentDoc) {
      return <ComponentDocPage doc={componentDoc} />;
    }
  }

  const Page = path ? docsPages[path] : undefined;

  if (!Page) {
    return <NotFound />;
  }

  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-3/4 bg-muted rounded" />
        </div>
      }
    >
      <Page />
    </Suspense>
  );
}
