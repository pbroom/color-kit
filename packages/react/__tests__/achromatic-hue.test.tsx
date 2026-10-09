// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { isAchromatic, parse, type Color as ColorValue } from '@color-kit/core';
import {
  createColorState,
  type ColorState,
  type ColorUpdateEvent,
  type MultiColorState,
} from '@color-kit/driver';
import { useColor, type UseColorReturn } from '../src/use-color.js';
import {
  useMultiColor,
  type UseMultiColorReturn,
} from '../src/use-multi-color.js';

afterEach(() => {
  cleanup();
});

const BLUE: ColorValue = { l: 0.6, c: 0.15, h: 250, alpha: 1 };

type Mode = 'controlled' | 'uncontrolled';

function ColorProbe(props: {
  mode: Mode;
  onReady: (value: UseColorReturn) => void;
  events: ColorUpdateEvent[];
}) {
  const [state, setState] = useState<ColorState>(() => createColorState(BLUE));
  const color = useColor(
    props.mode === 'controlled'
      ? {
          state,
          onChange: (event) => {
            props.events.push(event);
            setState(event.next);
          },
        }
      : {
          defaultColor: BLUE,
          onChange: (event) => props.events.push(event),
        },
  );
  props.onReady(color);
  return null;
}

function renderColor(mode: Mode) {
  const handle: { current: UseColorReturn | null } = { current: null };
  const events: ColorUpdateEvent[] = [];
  render(
    <ColorProbe
      mode={mode}
      onReady={(value) => {
        handle.current = value;
      }}
      events={events}
    />,
  );
  const get = () => {
    if (!handle.current) throw new Error('Probe was not initialized');
    return handle.current;
  };
  return { get, events };
}

describe.each<Mode>(['uncontrolled', 'controlled'])(
  'useColor achromatic hue (%s)',
  (mode) => {
    it('setFromString(#808080) keeps hue 250 and resumes it with chroma', () => {
      const { get, events } = renderColor(mode);

      act(() => get().setFromString('#808080'));
      expect(get().requested.h).toBe(250);
      expect(isAchromatic(get().requested.c)).toBe(true);
      expect(events.at(-1)?.next.requested.h).toBe(250);
      expect(events.at(-1)?.interaction).toBe('text-input');
      expect(events.at(-1)?.next.meta.source).toBe('user');

      act(() => get().setChannel('c', 0.12));
      expect(get().requested).toMatchObject({ c: 0.12, h: 250 });
    });

    it('carries the hue through setFromRgb, setFromHsl and setFromHsv', () => {
      const { get } = renderColor(mode);

      act(() => get().setFromRgb({ r: 0, g: 0, b: 0, alpha: 1 }));
      expect(get().requested.h).toBe(250);
      act(() => get().setFromHsl({ h: 120, s: 0, l: 100, alpha: 1 }));
      expect(get().requested.h).toBe(250);
      act(() => get().setFromHsv({ h: 300, s: 0, v: 40, alpha: 0.5 }));
      expect(get().requested).toMatchObject({ h: 250, alpha: 0.5 });
    });

    it('keeps explicit oklch hues and lets callers opt out', () => {
      const { get } = renderColor(mode);

      act(() => get().setFromString('oklch(0.5 0 200)'));
      expect(get().requested.h).toBe(200);
      act(() => get().setFromString('oklch(0.4 0 none)'));
      expect(get().requested.h).toBe(200);
      act(() => get().setFromString('#808080', { explicitHue: true }));
      expect(get().requested.h).toBe(0);
    });

    it('reads the hue from the latest snapshot within one tick', () => {
      const { get, events } = renderColor(mode);

      act(() => {
        get().setChannel('h', 100);
        get().setFromString('#808080');
      });
      expect(events).toHaveLength(2);
      expect(events[1]?.next.requested.h).toBe(100);
      expect(get().requested.h).toBe(100);
    });
  },
);

function MultiProbe(props: {
  mode: Mode;
  onReady: (value: UseMultiColorReturn) => void;
}) {
  const [state, setState] = useState<MultiColorState>(() => ({
    colors: { base: createColorState(BLUE) },
    order: ['base'],
    selectedId: 'base',
    activeGamut: 'display-p3',
    activeView: 'oklch',
  }));
  const multi = useMultiColor(
    props.mode === 'controlled'
      ? { state, onChange: (event) => setState(event.next) }
      : { defaultColors: { base: BLUE } },
  );
  props.onReady(multi);
  return null;
}

describe.each<Mode>(['uncontrolled', 'controlled'])(
  'useMultiColor achromatic hue (%s)',
  (mode) => {
    function renderMulti() {
      const handle: { current: UseMultiColorReturn | null } = {
        current: null,
      };
      render(
        <MultiProbe
          mode={mode}
          onReady={(value) => {
            handle.current = value;
          }}
        />,
      );
      const get = () => {
        if (!handle.current) throw new Error('Probe was not initialized');
        return handle.current;
      };
      const baseHue = () => get().state.colors.base?.requested.h;
      return { get, baseHue };
    }

    it('setRequested with explicitHue false keeps the entry hue', () => {
      const { get, baseHue } = renderMulti();

      act(() =>
        get().setRequested('base', parse('#808080'), { explicitHue: false }),
      );
      expect(baseHue()).toBe(250);

      act(() => get().setRequested('base', parse('#808080')));
      expect(baseHue()).toBe(0);
    });
  },
);
