import { Suspense } from 'react';
import { useParams } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { docsPages } from '../content/docs-registry.js';

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

  const Page = path ? docsPages[path] : undefined;

  if (!Page) {
    return <NotFound />;
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      }
    >
      <Page />
    </Suspense>
  );
}
