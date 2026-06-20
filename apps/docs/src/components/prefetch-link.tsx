import { forwardRef, type FocusEvent, type PointerEvent } from 'react';
import { Link, type LinkProps } from 'react-router';
import { prefetchHref } from '@/lib/prefetch';

function toHref(to: LinkProps['to']): string | undefined {
  if (typeof to === 'string') {
    return to;
  }
  if (to && typeof to === 'object') {
    return to.pathname ?? undefined;
  }
  return undefined;
}

/**
 * Drop-in replacement for react-router's `Link` that prefetches the target
 * route's code-split chunks the moment the user shows intent (hover, focus, or
 * touch start). By the time the click lands, `lazy()` resolves synchronously and
 * the transition feels instant instead of flashing a loading skeleton.
 */
export const PrefetchLink = forwardRef<HTMLAnchorElement, LinkProps>(
  function PrefetchLink(
    { to, onPointerEnter, onFocus, onTouchStart, ...rest },
    ref,
  ) {
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
        onTouchStart={(event) => {
          warm();
          onTouchStart?.(event);
        }}
      />
    );
  },
);
