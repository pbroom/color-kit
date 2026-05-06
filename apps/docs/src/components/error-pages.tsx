import { Component, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { ThemeSwitcher } from './theme-switcher.js';
import { Button } from './ui/button.js';

interface ErrorPageContentProps {
  status?: string;
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction?: string;
  primaryLink?: string;
  secondaryAction?: string;
  secondaryLink?: string;
}

interface RouteErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface RouteErrorBoundaryState {
  error?: Error;
}

export function ErrorPageContent({
  status,
  eyebrow = 'Error',
  title,
  description,
  primaryAction = 'Go home',
  primaryLink = '/',
  secondaryAction,
  secondaryLink,
}: ErrorPageContentProps) {
  return (
    <section className="mx-auto flex min-h-[55vh] w-full max-w-2xl flex-col justify-center py-16 text-center">
      <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background/75 text-muted-foreground shadow-sm">
        <AlertTriangle aria-hidden="true" className="size-5" />
      </div>
      <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {status ? <span>{status}</span> : null}
        {status ? <span aria-hidden="true">/</span> : null}
        <span>{eyebrow}</span>
      </div>
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-pretty text-sm leading-6 text-muted-foreground md:text-base">
        {description}
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link to={primaryLink}>
            <Home aria-hidden="true" className="size-4" />
            {primaryAction}
          </Link>
        </Button>
        {secondaryAction && secondaryLink ? (
          <Button asChild variant="outline">
            <Link to={secondaryLink}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              {secondaryAction}
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function StandaloneErrorPage(props: ErrorPageContentProps) {
  return (
    <div className="ck-shell-bg min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1560px] items-center justify-between gap-4 px-4">
          <Link to="/" className="docs-brand">
            <span className="docs-brand-dot" />
            Color Kit
          </Link>
          <ThemeSwitcher />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1560px] px-4">
        <ErrorPageContent {...props} />
      </main>
    </div>
  );
}

class AppRouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: undefined });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <StandaloneErrorPage
          status="500"
          eyebrow="Route error"
          title="Something went wrong"
          description="The docs app hit an unexpected rendering error. Try another page or return home."
          primaryAction="Go home"
          primaryLink="/"
          secondaryAction="Open docs"
          secondaryLink="/docs/introduction"
        />
      );
    }

    return this.props.children;
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <AppRouteErrorBoundary resetKey={location.pathname}>
      {children}
    </AppRouteErrorBoundary>
  );
}
