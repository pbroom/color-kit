import type { ReactNode } from 'react';
import type { TypePart, TypeRef } from '@/api/model';
import { apiSymbols } from '@/site/routes';
import { ApiLink } from './api-link';

/**
 * `<TypeLink>`: a named type, linked to its row in whichever entry point is
 * its canonical home (`ColorState` on a react page links to
 * `/api/driver/color-state#ColorState`).
 *
 * - `href`: the row, as resolved by the generator. Preferred.
 * - Without `href`, the documented export named `name` (in `entry`, when
 *   given; otherwise the first in package order) is used. Unknown names
 *   render as plain code.
 */
export function TypeLink({
  name,
  href,
  entry,
  children,
}: {
  name: string;
  href?: string;
  entry?: string;
  children?: ReactNode;
}) {
  const target =
    href ??
    apiSymbols.find(
      (symbol) =>
        symbol.name === name && (entry === undefined || symbol.entry === entry),
    )?.href;
  const label = children ?? name;
  if (!target) {
    return <span className="tok tok-ref">{label}</span>;
  }
  return (
    <ApiLink to={target} className="tok tok-ref type-link">
      {label}
    </ApiLink>
  );
}

export function TypePartView({
  part,
  linked = true,
}: {
  part: TypePart;
  /** `false` renders named types as plain tokens (inside a row's summary). */
  linked?: boolean;
}) {
  if (part.href && linked) {
    return <TypeLink name={part.text} href={part.href} />;
  }
  return <span className={`tok tok-${part.kind}`}>{part.text}</span>;
}

/** A declared type with every documented name linked (unless `linked` is false). */
export function TypeView({
  type,
  linked = true,
}: {
  type: TypeRef;
  linked?: boolean;
}) {
  return (
    <>
      {type.parts.map((part, index) => (
        <TypePartView key={index} part={part} linked={linked} />
      ))}
    </>
  );
}
