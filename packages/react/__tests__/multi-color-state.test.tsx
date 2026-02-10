// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import {
  useMultiColor,
  type UseMultiColorReturn,
} from '../src/use-multi-color.js';

afterEach(() => {
  cleanup();
});

function MultiColorProbe(props: {
  onReady: (value: UseMultiColorReturn) => void;
}) {
  const multi = useMultiColor({
    defaultColors: {
      base: '#3b82f6',
      accent: 'oklch(0.8 0.4 145)',
    },
    defaultSelectedId: 'base',
  });

  props.onReady(multi);
  return null;
}

describe('useMultiColor', () => {
  it('keeps shared gamut/view configuration coherent across entries', () => {
    let probe: UseMultiColorReturn | null = null;

    render(
      <MultiColorProbe
        onReady={(value) => {
          probe = value;
        }}
      />,
    );

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.ids).toEqual(['base', 'accent']);
    expect(probe.state.activeGamut).toBe('display-p3');
    expect(probe.state.colors.base.activeGamut).toBe('display-p3');
    expect(probe.state.colors.accent.activeView).toBe('oklch');

    act(() => {
      probe?.setActiveGamut('srgb');
      probe?.setActiveView('hex');
    });

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.state.activeGamut).toBe('srgb');
    expect(probe.state.activeView).toBe('hex');
    expect(probe.state.colors.base.activeGamut).toBe('srgb');
    expect(probe.state.colors.accent.activeView).toBe('hex');
  });

  it('supports per-entry updates and collection operations', () => {
    let probe: UseMultiColorReturn | null = null;

    render(
      <MultiColorProbe
        onReady={(value) => {
          probe = value;
        }}
      />,
    );

    if (!probe) throw new Error('Probe was not initialized');
    const baseBefore = probe.state.colors.base.requested;

    act(() => {
      probe?.setChannel('accent', 'h', 220, { interaction: 'user' });
    });

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.state.colors.base.requested).toEqual(baseBefore);
    expect(probe.state.colors.accent.requested.h).toBe(220);

    act(() => {
      probe?.addColor('neutral', '#6b7280');
      probe?.renameColor('neutral', 'neutral-1');
      probe?.select('accent', 'pointer');
      probe?.removeColor('base');
    });

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.ids).toEqual(['accent', 'neutral-1']);
    expect(probe.selectedId).toBe('accent');
    expect(probe.state.colors.base).toBeUndefined();
    expect(probe.state.colors['neutral-1']).toBeDefined();
  });
});
