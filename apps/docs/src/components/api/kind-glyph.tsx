import type { ReactNode } from 'react';
import type { SymbolKind } from '@/api/model';
import { VALUE_KINDS } from '@/api/model';

const GLYPHS: Record<SymbolKind, string> = {
  function: 'f',
  component: '<>',
  class: 'C',
  interface: 'I',
  type: 'T',
  const: 'K',
  variable: 'V',
  enum: 'E',
  namespace: 'N',
};

/**
 * A one-character mark for a symbol kind. Runtime values are filled, type-only
 * exports outlined, so the two read apart without color. The kind is the
 * accessible name; the letter is decoration.
 */
export function KindGlyph({ kind }: { kind: string }) {
  const known = kind in GLYPHS ? (kind as SymbolKind) : undefined;
  return (
    <span
      className="kind-glyph"
      data-kind={kind}
      data-value={known && VALUE_KINDS.has(known) ? '' : undefined}
      title={kind}
    >
      <span aria-hidden="true">{known ? GLYPHS[known] : '·'}</span>
      <span className="visually-hidden">{kind}</span>
    </span>
  );
}

/** Small mono label: `function`, `deprecated`, `readonly`. */
export function ApiLabel({
  children,
  deprecated,
}: {
  children: ReactNode;
  deprecated?: boolean;
}) {
  return (
    <span className="api-label" data-deprecated={deprecated ? '' : undefined}>
      {children}
    </span>
  );
}
