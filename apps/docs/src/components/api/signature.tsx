import { ArrowUpRight } from 'lucide-react';
import { VALUE_KINDS, type ApiSymbol } from '@/api/model';
import { Declaration } from './declaration';
import { ApiLabel } from './kind-glyph';

function sourceLabel(path: string, line: number): string {
  return `${path.split('/').pop()}:${line}`;
}

/**
 * The reference header of a generated symbol: kind and deprecation labels,
 * the import line, a source link at the build commit, then the declaration.
 * Breaks out to the 920 px column.
 */
export function ApiSignature({ symbol }: { symbol: ApiSymbol }) {
  return (
    <section
      className="signature breakout"
      aria-label={`${symbol.name} declaration`}
    >
      <header className="signature__head" data-pagefind-ignore="">
        <ApiLabel>{symbol.kind}</ApiLabel>
        {symbol.deprecated !== undefined ? (
          <ApiLabel deprecated>deprecated</ApiLabel>
        ) : null}
        {/* `import { name } from 'entry'`, or `import type` for type-only exports. */}
        <code className="signature__import">
          <span className="tok-keyword">
            {VALUE_KINDS.has(symbol.kind) ? 'import' : 'import type'}
          </span>
          <span className="tok-punct"> {'{'} </span>
          {symbol.name}
          <span className="tok-punct"> {'}'} </span>
          <span className="tok-keyword">from</span>{' '}
          <span className="tok-literal">'{symbol.importPath}'</span>
          <span className="tok-punct">;</span>
        </code>
        {symbol.source ? (
          <a
            className="signature__source"
            href={symbol.source.url}
            rel="noreferrer"
            title={`${symbol.source.path} at the build commit`}
          >
            {sourceLabel(symbol.source.path, symbol.source.line)}
            <ArrowUpRight aria-hidden="true" size={12} strokeWidth={2} />
          </a>
        ) : null}
      </header>
      <Declaration symbol={symbol} />
    </section>
  );
}
