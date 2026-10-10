import { useSyncExternalStore } from 'react';

/**
 * Subscribe to a media query. Returns `null` while prerendering and during
 * hydration (the server snapshot), then the live value, so window-dependent
 * UI never causes a hydration mismatch.
 */
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}

const noopSubscribe = () => () => {};

/** `true` on Apple platforms, `null` before hydration. */
export function useIsApplePlatform(): boolean | null {
  return useSyncExternalStore(
    noopSubscribe,
    () =>
      /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => null,
  );
}
