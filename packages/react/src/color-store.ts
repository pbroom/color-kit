import { useCallback, useSyncExternalStore } from 'react';
import type { ColorState } from '@color-kit/driver';

/**
 * Minimal external store for shared color state. The provider owns one store
 * instance; child components subscribe to referentially stable slices via
 * `useColorStoreSelector` so provider renders stay cheap.
 */
export interface ColorStore {
  get: () => ColorState;
  set: (next: ColorState) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createColorStore(initial: ColorState): ColorStore {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => state,
    set: (next) => {
      if (next === state) {
        return;
      }
      state = next;
      for (const listener of [...listeners]) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const noopSubscribe = () => () => {};

/**
 * Subscribes to a slice of a (possibly absent) color store.
 *
 * The selector must return a referentially stable value for an unchanged
 * state (primitives or sub-objects of the immutable ColorState), because
 * snapshots are compared with Object.is between renders.
 */
export function useColorStoreSelector<T>(
  store: ColorStore | null,
  selector: (state: ColorState | null) => T,
): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store ? store.subscribe(onStoreChange) : noopSubscribe(),
    [store],
  );
  const getSnapshot = () => selector(store ? store.get() : null);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
