import { Suspense } from 'react';
import { useParams } from 'react-router';
import { ErrorPageContent } from '@/components/error-pages';
import { Skeleton } from '@/components/ui/skeleton';
import { ComponentDocPage } from '../components/component-doc-page.js';
import { getComponentDoc } from '../content/components/component-docs-data.js';

function NotFound() {
  return (
    <ErrorPageContent
      status="404"
      eyebrow="Missing component"
      title="That component page does not exist"
      description="The component route you opened is not registered yet. Head back to the component docs or browse the full documentation."
      primaryAction="View components"
      primaryLink="/docs/components/color-area"
      secondaryAction="Open docs"
      secondaryLink="/docs/introduction"
    />
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
