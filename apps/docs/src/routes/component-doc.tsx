import { Suspense } from 'react';
import { useParams } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { ComponentDocPage } from '../components/component-doc-page.js';
import { getComponentDoc } from '../content/components/component-docs-data.js';

function NotFound() {
  return (
    <div>
      <h1>Page not found</h1>
      <p>The documentation page you're looking for doesn't exist yet.</p>
    </div>
  );
}

function ComponentDocFallback() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function ComponentDocRoute() {
  const { slug } = useParams();
  const componentDoc = slug ? getComponentDoc(slug) : undefined;

  if (!componentDoc) {
    return <NotFound />;
  }

  return (
    <Suspense fallback={<ComponentDocFallback />}>
      <ComponentDocPage doc={componentDoc} />
    </Suspense>
  );
}
