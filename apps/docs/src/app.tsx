import { lazy, Suspense } from 'react';
import { Navigate, Routes, Route } from 'react-router';
import {
  ErrorPageContent,
  RouteErrorBoundary,
  StandaloneErrorPage,
} from './components/error-pages.js';
import { ThemeProvider } from './components/theme-context.js';

const HomePage = lazy(() =>
  import('./routes/index.js').then((module) => ({
    default: module.HomePage,
  })),
);
const DocsLayout = lazy(() =>
  import('./components/docs-layout.js').then((module) => ({
    default: module.DocsLayout,
  })),
);
const DocsPage = lazy(() =>
  import('./routes/docs.js').then((module) => ({
    default: module.DocsPage,
  })),
);
const ComponentDocRoute = lazy(() =>
  import('./routes/component-doc.js').then((module) => ({
    default: module.ComponentDocRoute,
  })),
);
const LabPage = lazy(() =>
  import('./routes/lab.js').then((module) => ({
    default: module.LabPage,
  })),
);

function RouteFallback() {
  return <div className="ck-shell-bg min-h-screen" />;
}

export function App() {
  return (
    <ThemeProvider>
      <RouteErrorBoundary>
        <Routes>
          <Route
            index
            element={
              <Suspense fallback={<RouteFallback />}>
                <HomePage />
              </Suspense>
            }
          />
          <Route
            path="lab"
            element={
              <Suspense fallback={<RouteFallback />}>
                <LabPage />
              </Suspense>
            }
          />
          <Route path="playground" element={<Navigate to="/lab" replace />} />
          <Route
            path="docs"
            element={
              <Suspense fallback={<RouteFallback />}>
                <DocsLayout />
              </Suspense>
            }
          >
            <Route
              path="components/:slug"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <ComponentDocRoute />
                </Suspense>
              }
            />
            <Route
              path=":slug"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <DocsPage />
                </Suspense>
              }
            />
            <Route
              path=":category/:slug"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <DocsPage />
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <ErrorPageContent
                  status="404"
                  eyebrow="Not found"
                  title="That docs page does not exist"
                  description="The documentation route you opened is not in the docs registry. Check the URL or start from the docs introduction."
                  primaryAction="Open docs"
                  primaryLink="/docs/introduction"
                  secondaryAction="Go home"
                  secondaryLink="/"
                />
              }
            />
          </Route>
          <Route
            path="*"
            element={
              <StandaloneErrorPage
                status="404"
                eyebrow="Not found"
                title="This page does not exist"
                description="The page you opened is not part of Color Kit docs. You can head home or jump into the documentation."
                primaryAction="Go home"
                primaryLink="/"
                secondaryAction="Open docs"
                secondaryLink="/docs/introduction"
              />
            }
          />
        </Routes>
      </RouteErrorBoundary>
    </ThemeProvider>
  );
}
