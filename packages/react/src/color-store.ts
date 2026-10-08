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
  /** Returns the current state. */
  get: () => ColorState;
  /** Replaces the state and notifies listeners; a no-op when `next` is the current state object. */
  set: (next: ColorState) => void;
  /** Registers a change listener and returns its unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
}

/**
 * Creates a minimal external store holding a `ColorState`.
 *
 * `set` compares by reference: passing the current state object does not
 * notify. Listeners run synchronously in subscription order. This is the
 * store {@link useColor} and {@link Color} use internally; create one
 * yourself to share color state outside React or across roots.
 *
 * @param initial - The initial state, e.g. from `createColorState`.
 * @returns A store with `get`, `set` and `subscribe`.
 * @see {@link useColorStoreSelector}
 *
 * @example
 * ```ts
 * import { createColorStore } from 'color-kit/react';
 * import { createColorState } from 'color-kit/driver';
 * import { parse, toHex } from 'color-kit';
 *
 * const store = createColorStore(createColorState(parse('#3b82f6')));
 * const unsubscribe = store.subscribe(() => console.log('changed'));
 * store.set(createColorState(parse('#ff6600'))); // logs 'changed'
 * toHex(store.get().requested); // → '#ff6600'
 * unsubscribe();
 * ```
 */
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
 * Subscribes a component to a slice of a (possibly absent) color store and
 * returns the selected value.
 *
 * The component rerenders only when the selected value changes. The
 * selector must return a referentially stable value for an unchanged state
 * (primitives or sub-objects of the immutable `ColorState`), because
 * snapshots are compared with `Object.is` between renders. With a `null`
 * store the selector receives `null` and nothing is subscribed.
 *
 * @param store - The store to read, or `null` (e.g. outside a provider).
 * @param selector - Maps the state (or `null`) to the slice to return.
 * @returns The selected slice.
 * @see {@link createColorStore}
 *
 * @example
 * ```tsx
 * import { useContext } from 'react';
 * import { ColorContext, useColorStoreSelector } from 'color-kit/react';
 *
 * function HueLabel() {
 *   const context = useContext(ColorContext);
 *   const hue = useColorStoreSelector(
 *     context?.store ?? null,
 *     (state) => state?.requested.h ?? null,
 *   );
 *   return <span>{hue === null ? '–' : `${Math.round(hue)}°`}</span>;
 * }
 * ```
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
