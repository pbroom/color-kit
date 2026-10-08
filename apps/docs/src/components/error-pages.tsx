import { Component, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { PrefetchLink } from './prefetch-link';

interface ErrorPageContentProps {
  status?: string;
  title: string;
  description: string;
  primaryAction?: string;
  primaryLink?: string;
  secondaryAction?: string;
  secondaryLink?: string;
}

export function ErrorPageContent({
  status,
  title,
  description,
  primaryAction = 'Go home',
  primaryLink = '/',
  secondaryAction,
  secondaryLink,
}: ErrorPageContentProps) {
  return (
    <section className="error-page">
      {status ? <p className="error-page__status">{status}</p> : null}
      <h1 className="error-page__title">{title}</h1>
      <p className="error-page__description">{description}</p>
      <p className="error-page__actions">
        <PrefetchLink className="button" data-variant="solid" to={primaryLink}>
          {primaryAction}
        </PrefetchLink>
        {secondaryAction && secondaryLink ? (
          <PrefetchLink className="button" to={secondaryLink}>
            {secondaryAction}
          </PrefetchLink>
        ) : null}
      </p>
    </section>
  );
}

interface BoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface BoundaryState {
  error?: Error;
}

class AppRouteErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {};

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: undefined });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorPageContent
          status="Error"
          title="This page failed to render"
          description="Something in this page threw while rendering. Other pages still work; try another route or reload."
          secondaryAction="API reference"
          secondaryLink="/api"
        />
      );
    }
    return this.props.children;
  }
}

/** Contains a route's render error to the content area; resets on navigation. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <AppRouteErrorBoundary resetKey={location.pathname}>
      {children}
    </AppRouteErrorBoundary>
  );
}
