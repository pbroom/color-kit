// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { createColorState } from '@color-kit/driver';
import {
  useMultiColor,
  type MultiColorState,
  type MultiColorUpdateEvent,
  type UseMultiColorReturn,
} from '../src/use-multi-color.js';

afterEach(() => {
  cleanup();
});

function MultiColorProbe(props: {
  onReady: (value: UseMultiColorReturn) => void;
  onChange?: (event: MultiColorUpdateEvent) => void;
}) {
  const multi = useMultiColor({
    defaultColors: {
      base: '#3b82f6',
      accent: 'oklch(0.8 0.4 145)',
    },
    defaultSelectedId: 'base',
    onChange: props.onChange,
  });

  props.onReady(multi);
  return null;
}

function createControlledState(): MultiColorState {
  return {
    colors: {
      base: createColorState(
        { l: 0.62, c: 0.16, h: 260, alpha: 1 },
        { source: 'user' },
      ),
      accent: createColorState(
        { l: 0.72, c: 0.21, h: 130, alpha: 1 },
        { source: 'user' },
      ),
    },
    order: ['base', 'accent'],
    selectedId: 'base',
    activeGamut: 'display-p3',
    activeView: 'oklch',
  };
}

function ControlledMultiColorProbe(props: {
  onReady: (value: UseMultiColorReturn) => void;
  onChange?: (event: MultiColorUpdateEvent) => void;
}) {
  const [state, setState] = useState(createControlledState);
  const multi = useMultiColor({
    state,
    onChange: (event) => {
      props.onChange?.(event);
      setState(event.next);
    },
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
    const events: MultiColorUpdateEvent[] = [];

    render(
      <MultiColorProbe
        onReady={(value) => {
          probe = value;
        }}
        onChange={(event) => {
          events.push(event);
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
    expect(probe.state.colors['neutral-1'].activeGamut).toBe(
      probe.state.activeGamut,
    );
    expect(probe.state.colors['neutral-1'].activeView).toBe(
      probe.state.activeView,
    );
    expect(events.at(-1)?.next.order).toEqual(['accent', 'neutral-1']);
    expect(events.at(-1)?.next.selectedId).toBe('accent');
  });

  it('applies batched display-context changes to the latest collection snapshot', () => {
    let probe: UseMultiColorReturn | null = null;

    render(
      <MultiColorProbe
        onReady={(value) => {
          probe = value;
        }}
      />,
    );

    if (!probe) throw new Error('Probe was not initialized');

    act(() => {
      probe?.addColor('neutral', '#6b7280');
      probe?.setActiveGamut('srgb');
      probe?.setActiveView('hex');
      probe?.renameColor('neutral', 'neutral-1');
      probe?.removeColor('base');
    });

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.ids).toEqual(['accent', 'neutral-1']);
    expect(probe.state.activeGamut).toBe('srgb');
    expect(probe.state.activeView).toBe('hex');
    expect(probe.state.colors.accent.activeGamut).toBe('srgb');
    expect(probe.state.colors.accent.activeView).toBe('hex');
    expect(probe.state.colors['neutral-1'].activeGamut).toBe('srgb');
    expect(probe.state.colors['neutral-1'].activeView).toBe('hex');
  });

  it('emits controlled updates with materialized next state', () => {
    let probe: UseMultiColorReturn | null = null;
    const events: MultiColorUpdateEvent[] = [];

    render(
      <ControlledMultiColorProbe
        onReady={(value) => {
          probe = value;
        }}
        onChange={(event) => {
          events.push(event);
        }}
      />,
    );

    if (!probe) throw new Error('Probe was not initialized');

    act(() => {
      probe?.setActiveGamut('srgb');
    });

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.state.activeGamut).toBe('srgb');
    expect(events.at(-1)?.next.colors.base.activeGamut).toBe('srgb');

    act(() => {
      probe?.renameColor('accent', 'accent-1');
    });

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.ids).toEqual(['base', 'accent-1']);
    expect(events.at(-1)?.next.order).toEqual(['base', 'accent-1']);

    act(() => {
      probe?.setChannel('accent-1', 'h', 210, { interaction: 'user' });
    });

    act(() => {
      probe?.removeColor('base');
    });

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.ids).toEqual(['accent-1']);
    expect(probe.selectedId).toBe('accent-1');
    expect(probe.state.colors['accent-1'].requested.h).toBe(210);
    expect(probe.state.colors['accent-1'].meta.source).toBe('user');
    expect(events).toHaveLength(4);
    expect(events.at(-1)?.id).toBe('base');
    expect(events.at(-1)?.next.order).toEqual(['accent-1']);
    expect(events.at(-1)?.next.colors['accent-1'].meta.source).toBe('user');
  });
});
