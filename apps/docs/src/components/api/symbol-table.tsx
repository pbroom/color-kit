import { Fragment, use, useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ApiExample, ApiSymbol } from '@/api/model';
import { symbolHref } from '@/api/model';
import { loadSymbol } from '@/api/data';
import { CodeBlock } from '@/components/ui/code-block';
import { ApiLink } from './api-link';
import { ApiLabel, KindGlyph } from './kind-glyph';
import { RichInlines } from './rich-text';
import { TypeView } from './type-link';

/** `(color: Color, format?: CssColorFormat): string`, from the first overload. */
function CompactSignature({ symbol }: { symbol: ApiSymbol }) {
  const [first, ...rest] = symbol.signatures;
  if (first) {
    return (
      <>
        (
        {first.params.map((param, index) => (
          <Fragment key={param.name}>
            {index > 0 ? ', ' : null}
            {param.rest ? '...' : null}
            {param.name}
            {param.optional ? '?' : null}: <TypeView type={param.type} />
          </Fragment>
        ))}
        ): <TypeView type={first.returns} />
        {rest.length > 0 ? (
          <span className="symbol-table__more">
            {' '}
            +{rest.length} overload{rest.length > 1 ? 's' : ''}
          </span>
        ) : null}
      </>
    );
  }
  if (symbol.type) {
    return <TypeView type={symbol.type} />;
  }
  if (symbol.members.length > 0) {
    return (
      <span className="symbol-table__more">
        {symbol.members.length} member{symbol.members.length > 1 ? 's' : ''}
      </span>
    );
  }
  return null;
}

function examplesOf(symbol: ApiSymbol): ApiExample[] {
  return [
    ...symbol.comment.examples,
    ...symbol.signatures.flatMap((signature) => signature.comment.examples),
  ];
}

function SymbolTableRow({ symbol }: { symbol: ApiSymbol }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const examples = examplesOf(symbol);
  const lede = symbol.comment.summary[0];
  return (
    <>
      <tr
        id={symbol.name}
        data-outline={symbol.name}
        className="symbol-table__row"
      >
        <th scope="row" className="symbol-table__name">
          <ApiLink
            to={symbolHref(symbol.entry, symbol.name)}
            className="symbol-table__link"
          >
            <KindGlyph kind={symbol.kind} />
            <code>{symbol.name}</code>
          </ApiLink>
        </th>
        <td className="symbol-table__signature">
          <code>
            <CompactSignature symbol={symbol} />
          </code>
        </td>
        <td className="symbol-table__summary">
          {symbol.deprecated !== undefined ? (
            <ApiLabel deprecated>deprecated</ApiLabel>
          ) : null}
          {lede?.type === 'p' ? <RichInlines nodes={lede.children} /> : null}
        </td>
        <td className="symbol-table__toggle">
          {examples.length > 0 ? (
            <button
              type="button"
              className="symbol-table__expand"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((value) => !value)}
            >
              <ChevronRight aria-hidden="true" size={14} strokeWidth={2} />
              <span>
                {examples.length > 1
                  ? `${examples.length} examples`
                  : 'Example'}
              </span>
            </button>
          ) : null}
        </td>
      </tr>
      {examples.length > 0 ? (
        <tr id={panelId} className="symbol-table__examples" hidden={!open}>
          <td colSpan={4}>
            {examples.map((example, index) => (
              <Fragment key={index}>
                {example.caption ? (
                  <p className="api-caption">{example.caption}</p>
                ) : null}
                <CodeBlock
                  html={example.html}
                  code={example.code}
                  lang={example.lang}
                />
              </Fragment>
            ))}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/**
 * A category page's exports as a table: name (linking to the full symbol
 * page), compact signature, summary, and the JSDoc examples in an expandable
 * row. Each row is anchored at `#<name>` for the sidebar's symbol links.
 */
export function SymbolTable({
  entry,
  names,
}: {
  entry: string;
  names: readonly string[];
}) {
  // Start every load before suspending on any, so they fetch in parallel.
  const pending = names.map((name) => loadSymbol(entry, name));
  const symbols = pending.map((promise) => use(promise));
  return (
    <div className="symbol-table-wrap breakout">
      <table className="symbol-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Signature</th>
            <th scope="col">Summary</th>
            <th scope="col">
              <span className="visually-hidden">Examples</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {symbols.map((symbol) => (
            <SymbolTableRow key={symbol.name} symbol={symbol} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
