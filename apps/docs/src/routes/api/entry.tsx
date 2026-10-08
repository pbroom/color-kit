import { PrefetchLink } from '@/components/prefetch-link';
import { CodeBlock } from '@/components/ui/code-block';
import { routes, type RouteModuleProps } from '@/site/routes';

/**
 * `/api/:entry`. Placeholder owned by S2, which renders the entry's domain
 * narrative (`content/api/<entry>/index.mdx`) and its symbol index.
 */
export default function ApiEntryPage({ route }: RouteModuleProps) {
  const symbols = routes.filter(
    (item) => item.kind === 'api-symbol' && item.entry === route.entry,
  );
  return (
    <>
      <header className="doc-header">
        <p className="doc-eyebrow">API</p>
        <h1 className="doc-title" data-mono="">
          {route.title}
        </h1>
        <p className="doc-lede">{route.description}</p>
      </header>
      <div className="prose">
        <CodeBlock lang="ts" code={`import { … } from '${route.title}';`} />
        {symbols.length > 0 ? (
          <ul>
            {symbols.map((symbol) => (
              <li key={symbol.path}>
                <PrefetchLink to={symbol.path}>
                  <code>{symbol.title}</code>
                </PrefetchLink>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            The reference for this entry point is generated from the source
            JSDoc and lands here next.
          </p>
        )}
      </div>
    </>
  );
}
