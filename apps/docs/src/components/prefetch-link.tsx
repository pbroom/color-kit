import type { FocusEvent, PointerEvent, Ref, TouchEvent } from 'react';
import { Link, type LinkProps } from 'react-router';
import { prefetchHref } from '@/lib/prefetch';

function toHref(to: LinkProps['to']): string | undefined {
  if (typeof to === 'string') {
    return to;
  }
  return to?.pathname ?? undefined;
}

/**
 * Drop-in replacement for react-router's `Link` that prefetches the target
 * route's chunk the moment the user shows intent (hover, focus, or touch
 * start), so by the time the click lands the route renders without a
 * loading state.
 */
export function PrefetchLink({
  to,
  onPointerEnter,
  onFocus,
  onTouchStart,
  ref,
  ...rest
}: LinkProps & { ref?: Ref<HTMLAnchorElement> }) {
  const href = toHref(to);
  const warm = () => {
    if (href) {
      prefetchHref(href);
    }
  };

  return (
    <Link
      {...rest}
      ref={ref}
      to={to}
      onPointerEnter={(event: PointerEvent<HTMLAnchorElement>) => {
        warm();
        onPointerEnter?.(event);
      }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        warm();
        onFocus?.(event);
      }}
      onTouchStart={(event: TouchEvent<HTMLAnchorElement>) => {
        warm();
        onTouchStart?.(event);
      }}
    />
  );
}
