import { ErrorPageContent } from '@/components/error-pages';

export default function NotFoundPage() {
  return (
    <ErrorPageContent
      status="404"
      title="No page at this address"
      description="It may have moved in the docs rewrite. Search with ⌘K, or start from the API reference."
      primaryAction="Go home"
      primaryLink="/"
      secondaryAction="API reference"
      secondaryLink="/api"
    />
  );
}
