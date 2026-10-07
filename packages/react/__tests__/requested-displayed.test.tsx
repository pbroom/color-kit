// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { inSrgbGamut } from '@color-kit/core';
import {
  createColorState,
  type ColorState,
  type ColorUpdateEvent,
} from '@color-kit/driver';
import { useColor, type UseColorReturn } from '../src/use-color.js';

afterEach(() => {
  cleanup();
});

function UseColorProbe(props: { onReady: (value: UseColorReturn) => void }) {
  const color = useColor({
    defaultColor: { l: 0.8, c: 0.4, h: 145, alpha: 1 },
  });
  props.onReady(color);
  return null;
}

describe('requested/displayed contract', () => {
  it('preserves requested values while mapping displayed values to gamut', () => {
    let probe: UseColorReturn | null = null;

    render(
      <UseColorProbe
        onReady={(value) => {
          probe = value;
        }}
      />,
    );

    if (!probe) throw new Error('Probe was not initialized');

    expect(inSrgbGamut(probe.requested)).toBe(false);
    expect(inSrgbGamut(probe.displayedSrgb)).toBe(true);
    expect(probe.displayedSrgb.c).toBeLessThan(probe.requested.c);
  });

  it('switches active gamut without mutating requested values', () => {
    let probe: UseColorReturn | null = null;

    render(
      <UseColorProbe
        onReady={(value) => {
          probe = value;
        }}
      />,
    );

    if (!probe) throw new Error('Probe was not initialized');
    const requestedBefore = { ...probe.requested };

    act(() => {
      probe?.setActiveGamut('srgb');
    });

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.requested).toEqual(requestedBefore);
    expect(probe.displayed).toEqual(probe.displayedSrgb);

    act(() => {
      probe?.setActiveGamut('display-p3');
    });

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.requested).toEqual(requestedBefore);
    expect(probe.displayed).toEqual(probe.displayedP3);
  });

  it('applies sequential channel edits from the latest state in one batch', () => {
    let probe: UseColorReturn | null = null;

    render(
      <UseColorProbe
        onReady={(value) => {
          probe = value;
        }}
      />,
    );

    if (!probe) throw new Error('Probe was not initialized');

    act(() => {
      probe?.setChannel('l', 0.35, { interaction: 'user' });
      probe?.setChannel('c', 0.1, { interaction: 'user' });
    });

    if (!probe) throw new Error('Probe was not initialized');
    expect(probe.requested.l).toBeCloseTo(0.35, 6);
    expect(probe.requested.c).toBeCloseTo(0.1, 6);
    expect(probe.requested.h).toBeCloseTo(145, 6);
  });

  it('treats unchanged gamut updates as no-ops', () => {
    let probe: UseColorReturn | null = null;
    let renderCount = 0;

    render(
      <UseColorProbe
        onReady={(value) => {
          probe = value;
          renderCount += 1;
        }}
      />,
    );

    if (!probe) throw new Error('Probe was not initialized');
    const rendersBefore = renderCount;

    act(() => {
      probe?.setActiveGamut('display-p3', 'programmatic');
    });

    expect(renderCount).toBe(rendersBefore);
  });

  it('treats unchanged view updates as no-ops', () => {
    let probe: UseColorReturn | null = null;
    let renderCount = 0;

    render(
      <UseColorProbe
        onReady={(value) => {
          probe = value;
          renderCount += 1;
        }}
      />,
    );

    if (!probe) throw new Error('Probe was not initialized');
    const rendersBefore = renderCount;

    act(() => {
      probe?.setActiveView('oklch', 'programmatic');
    });

    expect(renderCount).toBe(rendersBefore);
  });
});

function ControlledProbe(props: {
  state: ColorState;
  onChange: (event: ColorUpdateEvent) => void;
  onReady: (value: UseColorReturn) => void;
}) {
  const color = useColor({ state: props.state, onChange: props.onChange });
  props.onReady(color);
  return null;
}

describe('gamut mapping method', () => {
  it('keeps the state mapping method when the requested color changes', () => {
    const initial = createColorState(
      { l: 0.8, c: 0.4, h: 145, alpha: 1 },
      { gamutMapMethod: 'css' },
    );
    const events: ColorUpdateEvent[] = [];
    let probe: UseColorReturn | null = null;

    render(
      <ControlledProbe
        state={initial}
        onChange={(event) => events.push(event)}
        onReady={(value) => {
          probe = value;
        }}
      />,
    );
    act(() => {
      probe?.setRequested({ l: 0.7, c: 0.38, h: 150, alpha: 1 });
    });

    expect(events).toHaveLength(1);
    const next = events[0].next;
    expect(next.meta.gamutMapMethod).toBe('css');
    expect(next.displayed).toEqual(
      createColorState(next.requested, { gamutMapMethod: 'css' }).displayed,
    );
  });
});
