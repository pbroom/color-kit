/**
 * Server entry for prerendering (`vite build --ssr src/entry-server.tsx`).
 * `scripts/prerender.mjs` imports the built bundle and renders every route in
 * the registry with `react-dom/static`. Nothing here may touch `window`.
 */
import { StrictMode } from 'react';
import { StaticRouter } from 'react-router';
import { App } from './app';

export { documentTitle, routes, notFoundRoute } from './site/routes';

export function renderApp(url: string) {
  return (
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>
  );
}
