import { Suspense } from 'react';
import { useParams } from 'react-router';
import { ErrorPageContent } from '@/components/error-pages';
import { Skeleton } from '@/components/ui/skeleton';
import { docsPages } from '../content/docs-registry.js';

function NotFound() {
  return (
    <ErrorPageContent
      status="404"
      eyebrow="Missing document"
      title="That docs page does not exist"
      description="The documentation page you opened is not in the registry yet. Start from the introduction or browse the Lab."
      primaryAction="Open docs"
      primaryLink="/docs/introduction"
      secondaryAction="Open Lab"
      secondaryLink="/lab"
    />
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
