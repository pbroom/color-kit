import { describe, expect, it, vi } from 'vitest';
import { createColorState } from '@color-kit/driver';
import { createColorStore } from '../src/color-store.js';

describe('createColorStore', () => {
  it('notifies subscribers only for new states and honors unsubscribe', () => {
    const initial = createColorState({
      l: 0.6,
      c: 0.2,
      h: 250,
      alpha: 1,
    });
    const store = createColorStore(initial);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set(initial);
    expect(listener).not.toHaveBeenCalled();

    const next = { ...initial, activeGamut: 'srgb' as const };
    store.set(next);
    expect(store.get()).toBe(next);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.set({ ...next, activeGamut: 'display-p3' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
