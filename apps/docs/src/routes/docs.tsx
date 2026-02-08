import { useParams } from 'react-router';
import { lazy, Suspense } from 'react';

/**
 * MDX content modules mapped by slug path.
 * This is a simple approach that avoids complex dynamic imports.
 * Add new docs pages here as they are created.
 */
const pages: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  introduction: lazy(() => import('../content/introduction.mdx')),
  installation: lazy(() => import('../content/installation.mdx')),
};

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
  const Page = path ? pages[path] : undefined;

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
