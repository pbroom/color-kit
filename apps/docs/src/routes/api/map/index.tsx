import type { RouteModuleProps } from '@/site/routes';

/**
 * `/api/map`. Placeholder owned by S5, which renders the native map
 * (d3-hierarchy layout, React SVG, pan/zoom, coverage ledger) from the
 * generated API data.
 */
export default function ApiMapPage({ route }: RouteModuleProps) {
  return (
    <>
      <header className="doc-header">
        <p className="doc-eyebrow">API</p>
        <h1 className="doc-title">{route.title}</h1>
        <p className="doc-lede">{route.description}</p>
      </header>
      <div className="prose">
        <p>
          The map draws every entry point, domain and symbol as one tree, with
          each node linking to its reference page. It is generated from the same
          data as the API reference.
        </p>
      </div>
    </>
  );
}
