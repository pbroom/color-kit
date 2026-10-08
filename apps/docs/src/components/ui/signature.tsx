import { lazy, type ReactNode } from 'react';
import { ApiLabel } from '@/components/api/kind-glyph';
import { routes } from '@/site/routes';
import { CodeBlock } from './code-block';

const GeneratedSignature = lazy(
  () => import('@/components/api/generated-signature'),
);

/** One parameter row in a hand-written `<Signature params>` list. */
export interface SignatureParam {
  name: string;
  /** Type as written in the declaration. */
  type: string;
  optional?: boolean;
  defaultValue?: string;
  /** Plain text or rendered JSDoc. */
  description?: ReactNode;
}

/**
 * `<Signature />`: the declaration of an exported symbol.
 *
 * Contract:
 * - **Generated (preferred):** `<Signature name="sense" entry="plane" />`
 *   renders the symbol's declaration from `src/generated/api` exactly as its
 *   reference page does: one parameter per line when long, named types
 *   linked across entries, kind and deprecated labels, import line and
 *   source link, followed by its parameters. `entry` defaults to the first
 *   entry (package order) with a page for `name`. `params={false}` shows the
 *   declaration only.
 * - **Hand-written:** pass `declaration` (plain text) or `declarationHtml`
 *   (Shiki HTML, CSS-variables theme) plus optional `params`, `returns`,
 *   `throws`, `deprecated`, `sourceUrl`, `kind`. Use this only for code that
 *   has no generated page.
 * - Breaks out to the 920 px column.
 */
export interface SignatureProps {
  name: string;
  kind?: string;
  entry?: string;
  declarationHtml?: string;
  declaration?: string;
  params?: SignatureParam[] | false;
  returns?: { type: string; description?: ReactNode };
  throws?: ReactNode[];
  deprecated?: boolean | string;
  sourceUrl?: string;
}

function resolveEntry(name: string, entry?: string): string | undefined {
  if (entry) return entry;
  return routes.find(
    (route) => route.kind === 'api-symbol' && route.symbol === name,
  )?.entry;
}

export function Signature({
  name,
  kind,
  entry,
  declarationHtml,
  declaration,
  params,
  returns,
  throws,
  deprecated,
  sourceUrl,
}: SignatureProps) {
  const manual = Boolean(declarationHtml || declaration || params);
  const generatedEntry = manual ? undefined : resolveEntry(name, entry);
  if (generatedEntry) {
    return (
      <GeneratedSignature
        name={name}
        entry={generatedEntry}
        showParams={params !== false}
      />
    );
  }
  return (
    <section className="signature breakout" aria-label={`${name} signature`}>
      <header className="signature__head">
        {kind ? <ApiLabel>{kind}</ApiLabel> : null}
        {deprecated ? <ApiLabel deprecated>deprecated</ApiLabel> : null}
        {sourceUrl ? (
          <a className="signature__source" href={sourceUrl} rel="noreferrer">
            Source
          </a>
        ) : null}
      </header>
      {declarationHtml || declaration ? (
        <CodeBlock html={declarationHtml} code={declaration} lang="ts" />
      ) : null}
      {typeof deprecated === 'string' ? (
        <p className="signature__deprecated">{deprecated}</p>
      ) : null}
      {params && params.length > 0 ? (
        <dl className="params">
          {params.map((param) => (
            <div
              key={param.name}
              id={`param-${param.name}`}
              className="params__row"
            >
              <dt>
                <span className="params__name">
                  {param.name}
                  {param.optional ? (
                    <span className="params__optional">?</span>
                  ) : null}
                </span>
                <code className="params__type">{param.type}</code>
                {param.defaultValue ? (
                  <span className="params__default">
                    <span className="params__default-label">default</span>{' '}
                    <code>{param.defaultValue}</code>
                  </span>
                ) : null}
              </dt>
              {param.description ? <dd>{param.description}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}
      {returns ? (
        <p className="api-returns">
          <span className="signature__label">Returns</span>
          <code className="api-returns__type">{returns.type}</code>
          {returns.description ? (
            <span className="api-returns__text">{returns.description}</span>
          ) : null}
        </p>
      ) : null}
      {throws && throws.length > 0 ? (
        <div className="signature__throws">
          <span className="signature__label">Throws</span>
          <ul>
            {throws.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
