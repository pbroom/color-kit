import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/jetbrains-mono';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app';
import { loadRoute } from './site/route-loader';
import { matchRoute } from './site/routes';

const container = document.getElementById('root')!;

const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

// Resolve the current route's chunk first: `use()` then reads it
// synchronously, so hydration adopts the prerendered markup without
// suspending. A failed chunk still mounts; the route boundary reports it.
void loadRoute(matchRoute(window.location.pathname))
  .catch(() => undefined)
  .then(() => {
    if (container.firstElementChild) {
      hydrateRoot(container, app);
    } else {
      // Dev server (no prerendered HTML).
      createRoot(container).render(app);
    }
  });
