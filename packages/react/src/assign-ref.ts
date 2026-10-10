import type { ForwardedRef } from 'react';

/**
 * Assigns `node` to a forwarded ref and returns the matching detach function,
 * honoring React 19 callback-ref cleanups.
 *
 * Use inside a `useCallback`-memoized callback ref (returning the detach
 * function as its cleanup) instead of an inline ref: inline callback refs are
 * recreated each render, so React detaches and reattaches them every commit.
 */
export function assignRef<T>(
  ref: ForwardedRef<T> | undefined,
  node: T | null,
): () => void {
  if (typeof ref === 'function') {
    const cleanup = ref(node) as unknown;
    return typeof cleanup === 'function'
      ? (cleanup as () => void)
      : () => {
          ref(null);
        };
  }

  if (ref) {
    ref.current = node;
    return () => {
      ref.current = null;
    };
  }

  return () => {};
}
