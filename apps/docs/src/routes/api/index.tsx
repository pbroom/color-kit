import { PrefetchLink } from '@/components/prefetch-link';
import { routes, type RouteModuleProps } from '@/site/routes';

/**
 * `/api`. Placeholder owned by S2: lists entry points from the route
 * registry until the generated overview replaces it.
 */
export default function ApiIndexPage({ route }: RouteModuleProps) {
  const entries = routes.filter((item) => item.kind === 'api-entry');
  return (
    <>
      <header className="doc-header">
        <p className="doc-eyebrow">API</p>
        <h1 className="doc-title">{route.title}</h1>
        <p className="doc-lede">{route.description}</p>
      </header>
      <div className="prose">
        <ul className="entry-list breakout">
          {entries.map((entry) => (
            <li key={entry.path}>
              <PrefetchLink to={entry.path} className="entry-list__link">
                <code className="entry-list__name">{entry.title}</code>
                <span className="entry-list__text">{entry.description}</span>
              </PrefetchLink>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
