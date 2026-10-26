import { Fragment, use, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ApiSymbol } from '@/api/model';
import { loadDomain, loadSymbolDocs, type MdxPage } from '@/api/data';
import { revealHashTarget } from '@/site/hash-target';
import { ApiLabel, KindGlyph } from './kind-glyph';
import { SymbolReference } from './symbol-reference';
import { TypeView } from './type-link';

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? '' : 's'}`;
}

/**
 * The Type column: `(color: Color, format?: CssColorFormat) => string` for
 * callables (first overload), the declared type for type aliases and
 * variables, a member count for interfaces and classes. Named types are not
 * links here: the whole row is the disclosure button.
 */
function RowType({ symbol }: { symbol: ApiSymbol }) {
  const [first, ...rest] = symbol.signatures;
  if (symbol.kind !== 'class' && first) {
    return (
      <>
        <span className="tok tok-punct">(</span>
        {first.params.map((param, index) => (
          <Fragment key={param.name}>
            {index > 0 ? <span className="tok tok-punct">, </span> : null}
            <span className="tok tok-param">
              {param.rest ? '...' : null}
              {param.name}
            </span>
            <span className="tok tok-punct">
              {param.optional && !param.rest ? '?: ' : ': '}
            </span>
            <TypeView type={param.type} linked={false} />
          </Fragment>
        ))}
        <span className="tok tok-punct">{') => '}</span>
        <TypeView type={first.returns} linked={false} />
        {rest.length > 0 ? (
          <span className="api-table__more">
            {' '}
            +{plural(rest.length, 'overload')}
          </span>
        ) : null}
      </>
    );
  }
  if (symbol.type) {
    return <TypeView type={symbol.type} linked={false} />;
  }
  return (
    <span className="api-table__more">
      {plural(symbol.members.length, 'member')}
    </span>
  );
}

/**
 * One export: a native disclosure whose whole summary row (name, type,
 * chevron) toggles the panel underneath. Closed by default, but the panel
 * is in the markup, so prerendered pages are searchable and readable
 * without JavaScript. The row's id is the bare name (`#toRgb`).
 */
function SymbolRow({
  symbol,
  Notes,
}: {
  symbol: ApiSymbol;
  Notes: MdxPage | null;
}) {
  return (
    <details
      id={symbol.name}
      data-outline={symbol.name}
      className="api-table__row"
    >
      <summary className="api-table__summary">
        <span className="api-table__name">
          <KindGlyph kind={symbol.kind} />
          <code>{symbol.name}</code>
          {symbol.deprecated !== undefined ? (
            <ApiLabel deprecated>deprecated</ApiLabel>
          ) : null}
        </span>
        <code className="api-table__type">
          <RowType symbol={symbol} />
        </code>
        <ChevronDown
          className="api-table__chevron"
          aria-hidden="true"
          size={16}
          strokeWidth={1.75}
        />
      </summary>
      {/* Panel headings stay out of "On this page"; the rows are listed. */}
      <div className="api-table__panel" data-outline-ignore="">
        <SymbolReference symbol={symbol} Notes={Notes} />
      </div>
    </details>
  );
}

/**
 * A category page's exports as one bordered table of disclosure rows: Name
 * and Type in the row, the full reference (summary, declaration,
 * parameters, members, examples, notes, …) in its panel. A `#<Symbol>`
 * fragment opens and scrolls to its row, on load and on later hash changes.
 */
export function SymbolTable({
  entry,
  domain,
  names,
}: {
  entry: string;
  domain: string;
  names: readonly string[];
}) {
  // Start both loads before suspending on either.
  const pendingSymbols = loadDomain(entry, domain);
  const pendingNotes = loadSymbolDocs(entry, names);
  const symbols = use(pendingSymbols);
  const notes = use(pendingNotes);

  useEffect(() => {
    const reveal = () => {
      revealHashTarget(window.location.hash);
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [entry, domain]);

  return (
    <div className="api-table breakout">
      <div className="api-table__head" aria-hidden="true">
        <span>Name</span>
        <span>Type</span>
      </div>
      {symbols.map((symbol) => (
        <SymbolRow
          key={symbol.name}
          symbol={symbol}
          Notes={notes.get(symbol.name) ?? null}
        />
      ))}
    </div>
  );
}
