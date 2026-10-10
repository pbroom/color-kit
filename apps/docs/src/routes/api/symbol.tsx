import { Signature } from '@/components/ui/signature';
import type { RouteModuleProps } from '@/site/routes';

/**
 * `/api/:entry/:symbol`. Placeholder owned by S2, which renders the
 * generated signature, params, examples and optional
 * `content/api/<entry>/<Symbol>.mdx`.
 */
export default function ApiSymbolPage({ route }: RouteModuleProps) {
  return (
    <>
      <header className="doc-header">
        <p className="doc-eyebrow">
          {route.entry === 'core' ? 'color-kit' : `color-kit/${route.entry}`}
        </p>
        <h1 className="doc-title" data-mono="">
          {route.title}
        </h1>
        <p className="doc-lede">{route.description}</p>
      </header>
      <div className="prose">
        <Signature
          name={route.symbol ?? route.title}
          kind={route.symbolKind}
          entry={route.entry}
        />
      </div>
    </>
  );
}
