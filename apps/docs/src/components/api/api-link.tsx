import type { ReactNode } from 'react';
import type { LinkProps } from 'react-router';
import { PrefetchLink } from '@/components/prefetch-link';
import { preloadApiHref } from '@/api/data';

/**
 * `PrefetchLink` that also warms the target's API data (symbol or entry
 * JSON), so moving between reference pages never shows a loading state.
 */
export function ApiLink({
  to,
  onPointerEnter,
  onFocus,
  ...rest
}: LinkProps & { to: string }) {
  return (
    <PrefetchLink
      {...rest}
      to={to}
      onPointerEnter={(event) => {
        preloadApiHref(to);
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        preloadApiHref(to);
        onFocus?.(event);
      }}
    />
  );
}

/** Internal docs path or external URL → the right link element. */
export function SmartLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (href.startsWith('/') && !href.startsWith('//')) {
    return (
      <ApiLink to={href} className={className}>
        {children}
      </ApiLink>
    );
  }
  return (
    <a href={href} className={className} rel="noreferrer">
      {children}
    </a>
  );
}
