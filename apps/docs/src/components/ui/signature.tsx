import type { ReactNode } from 'react';
import { CodeBlock } from './code-block';

/** One parameter row in the `<Params>` definition list. */
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
 * `<Signature />`: the reference header for one exported symbol.
 *
 * Contract (S2 builds the full version from `src/generated/api.json`):
 * - `name` + `kind` (`function`, `interface`, `type`, `class`, `variable`,
 *   `enum`) head the block; `entry` is the canonical entry slug.
 * - `declarationHtml`: Shiki HTML (CSS-variables theme) of the TS
 *   declaration, one parameter per line when long. `declaration` is the
 *   plain-text fallback. Param names in the declaration anchor to
 *   `#param-<name>` in the params list below.
 * - `params`, `returns`, `throws`, `deprecated` render after the
 *   declaration; `sourceUrl` links the source at the build commit.
 * - Cross-entry type links (`<TypeLink>`) are S2's; this stub prints types
 *   as code.
 * - Breaks out to the 920 px column.
 */
export interface SignatureProps {
  name: string;
  kind?: string;
  entry?: string;
  declarationHtml?: string;
  declaration?: string;
  params?: SignatureParam[];
  returns?: { type: string; description?: ReactNode };
  throws?: ReactNode[];
  deprecated?: boolean | string;
  sourceUrl?: string;
}

export function Signature({
  name,
  kind,
  declarationHtml,
  declaration,
  params,
  returns,
  throws,
  deprecated,
  sourceUrl,
}: SignatureProps) {
  return (
    <section className="signature breakout" aria-label={`${name} signature`}>
      <header className="signature__head">
        {kind ? <span className="signature__kind">{kind}</span> : null}
        {deprecated ? (
          <span className="signature__kind" data-deprecated="">
            deprecated
          </span>
        ) : null}
        {sourceUrl ? (
          <a className="signature__source" href={sourceUrl}>
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
                <code className="params__name">
                  {param.name}
                  {param.optional ? '?' : ''}
                </code>
                <code className="params__type">{param.type}</code>
                {param.defaultValue ? (
                  <span className="params__default">
                    = <code>{param.defaultValue}</code>
                  </span>
                ) : null}
              </dt>
              {param.description ? <dd>{param.description}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}
      {returns ? (
        <p className="signature__returns">
          <span className="signature__label">Returns</span>
          <code>{returns.type}</code>
          {returns.description ? <> {returns.description}</> : null}
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
