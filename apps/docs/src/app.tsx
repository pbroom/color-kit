import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
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

function RouteFallback() {
  return <div className="ck-shell-bg min-h-screen" />;
}

export function App() {
  return (
    <ThemeProvider>
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
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
