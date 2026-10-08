import {
  useCallback,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
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

export interface LatestSnapshot<T> {
  /** Latest state: the pending write if it is still live, else `committed`. */
  read: () => T;
  /**
   * Records `next` as the pending state on top of the current `committed`
   * value and schedules a re-render so the write's commit window closes.
   */
  write: (next: T) => void;
}

/**
 * Tracks the latest state a hook has emitted that React has not committed
 * yet, so several updates in one tick (before React re-renders) compose
 * instead of each starting from the render-time value.
 *
 * A pending write only lives until the render that includes it commits:
 * `write` schedules a re-render tagged with a token, and the commit that
 * carries that token (or any change of `committed`) drops the pending write
 * so `committed` wins. A controlled parent that ignores an update (keeps
 * passing the same `state`) therefore does not poison later updates: they
 * start again from the state it actually committed.
 *
 * Refs are only read inside `read`/`write`, which must be called from event
 * handlers or effects, never during render.
 */
export function useLatestSnapshot<T>(committed: T): LatestSnapshot<T> {
  const committedRef = useRef(committed);
  const pendingRef = useRef<{ base: T; next: T; token: number } | null>(null);
  const tokenRef = useRef(0);
  // Bumped by `write` so every write is followed by a commit of this hook,
  // even when a controlled parent rejects the update and does not re-render.
  const [committedToken, setCommittedToken] = useState(0);

  // Insertion effects run for the whole tree before any layout effect, so a
  // descendant that updates from its own layout effect already sees this
  // commit: the current `committed`, and no pending write that this commit
  // closed (a layout effect here would run after the child's).
  useInsertionEffect(() => {
    committedRef.current = committed;
    const pending = pendingRef.current;
    if (
      pending &&
      (pending.base !== committed || pending.token <= committedToken)
    ) {
      pendingRef.current = null;
    }
  }, [committed, committedToken]);

  return useMemo<LatestSnapshot<T>>(
    () => ({
      read: () => {
        const pending = pendingRef.current;
        const current = committedRef.current;
        return pending && pending.base === current ? pending.next : current;
      },
      write: (next) => {
        tokenRef.current += 1;
        const token = tokenRef.current;
        pendingRef.current = { base: committedRef.current, next, token };
        setCommittedToken(token);
      },
    }),
    [],
  );
}
