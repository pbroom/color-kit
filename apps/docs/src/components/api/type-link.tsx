import type { ReactNode } from 'react';
import type { TypePart, TypeRef } from '@/api/model';
import { symbolHref } from '@/api/model';
import { routes } from '@/site/routes';
import { ApiLink } from './api-link';

/**
 * `<TypeLink>`: a named type, linked to its reference page in whichever
 * entry point is its canonical home (`ColorState` on a react page links to
 * `/api/driver/ColorState`).
 *
 * - `href`: the page, as resolved by the generator. Preferred.
 * - Without `href`, `entry` + `name` build it; without `entry`, the first
 *   symbol route with that name in package order is used. Unknown names
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
    (entry
      ? symbolHref(entry, name)
      : routes.find(
          (route) => route.kind === 'api-symbol' && route.symbol === name,
        )?.path);
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

export function TypePartView({ part }: { part: TypePart }) {
  if (part.href) {
    return <TypeLink name={part.text} href={part.href} />;
  }
  return <span className={`tok tok-${part.kind}`}>{part.text}</span>;
}

/** A declared type with every documented name linked. */
export function TypeView({ type }: { type: TypeRef }) {
  return (
    <>
      {type.parts.map((part, index) => (
        <TypePartView key={index} part={part} />
      ))}
    </>
  );
}
