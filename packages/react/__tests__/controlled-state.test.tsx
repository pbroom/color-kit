// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  StrictMode,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { toHex, toRgb } from '@color-kit/core';
import {
  createColorState,
  type ColorState,
  type ColorUpdateEvent,
} from '@color-kit/driver';
import { useColor, type UseColorReturn } from '../src/use-color.js';
import {
  useMultiColor,
  type MultiColorState,
  type MultiColorUpdateEvent,
  type UseMultiColorReturn,
} from '../src/use-multi-color.js';

afterEach(() => {
  cleanup();
});

const INITIAL = { l: 0.6, c: 0.12, h: 250, alpha: 1 };

function createInitialColorState(): ColorState {
  return createColorState(INITIAL, { source: 'programmatic' });
}

function createInitialMultiState(): MultiColorState {
  return {
    colors: {
      base: createColorState(INITIAL, { source: 'programmatic' }),
      accent: createColorState(
        { l: 0.72, c: 0.21, h: 130, alpha: 1 },
        { source: 'programmatic' },
      ),
    },
    order: ['base', 'accent'],
    selectedId: 'base',
    activeGamut: 'display-p3',
    activeView: 'oklch',
  };
}

type Mode = 'controlled' | 'uncontrolled';

function ColorProbe(props: {
  mode: Mode;
  onReady: (value: UseColorReturn) => void;
  onChange: (event: ColorUpdateEvent) => void;
  transform?: (next: ColorState) => ColorState;
  accept?: (next: ColorState) => boolean;
  initial?: () => ColorState;
}) {
  const [state, setState] = useState(props.initial ?? createInitialColorState);
  const color = useColor(
    props.mode === 'controlled'
      ? {
          state,
          onChange: (event) => {
            props.onChange(event);
            if (props.accept && !props.accept(event.next)) return;
            setState(props.transform?.(event.next) ?? event.next);
          },
        }
      : { defaultColor: INITIAL, onChange: props.onChange },
  );
  props.onReady(color);
  return null;
}

/** Calls `setChannel('h', 90)` once from its own layout effect. */
function LayoutEffectSetter(props: {
  trigger: boolean;
  setChannel: UseColorReturn['setChannel'];
}) {
  const { trigger, setChannel } = props;
  const fired = useRef(false);
  useLayoutEffect(() => {
    if (!trigger || fired.current) return;
    fired.current = true;
    setChannel('h', 90);
  }, [trigger, setChannel]);
  return null;
}

function LayoutEffectParent(props: {
  state: ColorState;
  trigger: boolean;
  onChange: (event: ColorUpdateEvent) => void;
}) {
  const color = useColor({ state: props.state, onChange: props.onChange });
  return (
    <LayoutEffectSetter trigger={props.trigger} setChannel={color.setChannel} />
  );
}

function RejectingColorParent(props: {
  onChange: (event: ColorUpdateEvent) => void;
  onReady: (value: UseColorReturn) => void;
}) {
  const [state] = useState(createInitialColorState);
  const [trigger, setTrigger] = useState(false);
  const color = useColor({
    state,
    onChange: (event) => {
      props.onChange(event);
      setTrigger(true);
    },
  });
  props.onReady(color);
  return <LayoutEffectSetter trigger={trigger} setChannel={color.setChannel} />;
}

function MultiLayoutEffectSetter(props: {
  trigger: boolean;
  setChannel: UseMultiColorReturn['setChannel'];
}) {
  const { trigger, setChannel } = props;
  const fired = useRef(false);
  useLayoutEffect(() => {
    if (!trigger || fired.current) return;
    fired.current = true;
    setChannel('base', 'h', 90);
  }, [trigger, setChannel]);
  return null;
}

function RejectingMultiParent(props: {
  onChange: (event: MultiColorUpdateEvent) => void;
  onReady: (value: UseMultiColorReturn) => void;
}) {
  const [state] = useState(createInitialMultiState);
  const [trigger, setTrigger] = useState(false);
  const multi = useMultiColor({
    state,
    onChange: (event) => {
      props.onChange(event);
      setTrigger(true);
    },
  });
  props.onReady(multi);
  return (
    <MultiLayoutEffectSetter trigger={trigger} setChannel={multi.setChannel} />
  );
}

function MultiProbe(props: {
  mode: Mode;
  onReady: (value: UseMultiColorReturn) => void;
  onChange: (event: MultiColorUpdateEvent) => void;
  accept?: (next: MultiColorState) => boolean;
}) {
  const [state, setState] = useState(createInitialMultiState);
  const multi = useMultiColor(
    props.mode === 'controlled'
      ? {
          state,
          onChange: (event) => {
            props.onChange(event);
            if (props.accept && !props.accept(event.next)) return;
            setState(event.next);
          },
        }
      : {
          defaultColors: {
            base: INITIAL,
            accent: { l: 0.72, c: 0.21, h: 130, alpha: 1 },
          },
          defaultSelectedId: 'base',
          onChange: props.onChange,
        },
  );
  props.onReady(multi);
  return null;
}

function renderColor(
  mode: Mode,
  options: {
    strict?: boolean;
    transform?: (next: ColorState) => ColorState;
    accept?: (next: ColorState) => boolean;
    initial?: () => ColorState;
  } = {},
) {
  const events: ColorUpdateEvent[] = [];
  const handle: { current: UseColorReturn | null } = { current: null };
  const probe = (
    <ColorProbe
      mode={mode}
      transform={options.transform}
      accept={options.accept}
      initial={options.initial}
      onReady={(value) => {
        handle.current = value;
      }}
      onChange={(event) => {
        events.push(event);
      }}
    />
  );
  render(options.strict ? <StrictMode>{probe}</StrictMode> : probe);
  const get = (): UseColorReturn => {
    if (!handle.current) throw new Error('Probe was not initialized');
    return handle.current;
  };
  return { events, get };
}

function renderMulti(
  mode: Mode,
  options: {
    strict?: boolean;
    accept?: (next: MultiColorState) => boolean;
  } = {},
) {
  const events: MultiColorUpdateEvent[] = [];
  const handle: { current: UseMultiColorReturn | null } = { current: null };
  const probe: ReactNode = (
    <MultiProbe
      mode={mode}
      accept={options.accept}
      onReady={(value) => {
        handle.current = value;
      }}
      onChange={(event) => {
        events.push(event);
      }}
    />
  );
  render(options.strict ? <StrictMode>{probe}</StrictMode> : probe);
  const get = (): UseMultiColorReturn => {
    if (!handle.current) throw new Error('Probe was not initialized');
    return handle.current;
  };
  return { events, get };
}

const MODES: Mode[] = ['controlled', 'uncontrolled'];

describe('useColor update semantics', () => {
  it.each(MODES)('%s: composes multiple updates within one tick', (mode) => {
    const { events, get } = renderColor(mode);

    act(() => {
      const color = get();
      color.setChannel('l', 0.35, { interaction: 'pointer' });
      color.setChannel('c', 0.05, { interaction: 'pointer' });
      color.setActiveGamut('srgb');
    });

    expect(events).toHaveLength(3);
    expect(events[0].next.requested).toMatchObject({ l: 0.35, c: 0.12 });
    expect(events[1].next.requested).toMatchObject({ l: 0.35, c: 0.05 });
    expect(events[2].next.requested).toMatchObject({ l: 0.35, c: 0.05 });
    expect(events[2].next.activeGamut).toBe('srgb');
    expect(events.map((event) => event.changedChannel)).toEqual([
      'l',
      'c',
      undefined,
    ]);

    const color = get();
    expect(color.requested).toMatchObject({ l: 0.35, c: 0.05, h: 250 });
    expect(color.activeGamut).toBe('srgb');
  });

  it.each(MODES)(
    '%s: calls onChange synchronously inside the setter',
    (mode) => {
      const { events, get } = renderColor(mode);
      const observed: number[] = [];

      act(() => {
        get().setChannel('h', 120);
        observed.push(events.length);
        get().setChannel('h', 120);
        observed.push(events.length);
      });

      // Second call is a no-op against the latest snapshot, even before render.
      expect(observed).toEqual([1, 1]);
      expect(events).toHaveLength(1);
    },
  );

  it('emits identical event sequences in controlled and uncontrolled modes', () => {
    const run = (mode: Mode) => {
      const { events, get } = renderColor(mode);
      act(() => {
        get().setChannel('l', 0.4);
        get().setFromString('#ff0000');
      });
      act(() => {
        get().setActiveView('hex');
        get().setActiveView('hex');
        get().setChannel('alpha', 0.5, { interaction: 'keyboard' });
      });
      cleanup();
      return events;
    };

    const controlled = run('controlled');
    const uncontrolled = run('uncontrolled');

    expect(controlled).toHaveLength(4);
    expect(controlled).toEqual(uncontrolled);
  });

  it.each(MODES)('%s: does not duplicate onChange under StrictMode', (mode) => {
    const { events, get } = renderColor(mode, { strict: true });

    act(() => {
      get().setChannel('l', 0.3);
      get().setChannel('h', 30);
    });
    act(() => {
      get().setActiveGamut('srgb');
    });

    expect(events).toHaveLength(3);
    expect(get().requested).toMatchObject({ l: 0.3, h: 30 });
    expect(get().activeGamut).toBe('srgb');
  });

  it('drops the pending snapshot once the controlled state changes', () => {
    // Parent pins hue to 0 regardless of what the hook emits.
    const { events, get } = renderColor('controlled', {
      transform: (next) =>
        createColorState(
          { ...next.requested, h: 0 },
          {
            activeGamut: next.activeGamut,
            activeView: next.activeView,
            source: next.meta.source,
          },
        ),
    });

    act(() => {
      get().setChannel('h', 90);
    });
    expect(get().requested.h).toBe(0);

    act(() => {
      get().setChannel('l', 0.5);
    });

    expect(events.at(-1)?.next.requested).toMatchObject({ l: 0.5, h: 0 });
  });

  it('starts a descendant layout-effect update from the new controlled state', () => {
    // Descendant layout effects run before the parent's, so the update must
    // not start from the previously committed state (l = 0.2).
    const events: ColorUpdateEvent[] = [];
    const onChange = (event: ColorUpdateEvent) => events.push(event);
    const at = (l: number) =>
      createColorState({ ...INITIAL, l }, { source: 'programmatic' });

    const { rerender } = render(
      <LayoutEffectParent
        state={at(0.2)}
        trigger={false}
        onChange={onChange}
      />,
    );
    rerender(
      <LayoutEffectParent state={at(0.8)} trigger onChange={onChange} />,
    );

    expect(events).toHaveLength(1);
    expect(events[0].next.requested).toMatchObject({ l: 0.8, h: 90 });
  });

  it('does not carry a rejected controlled update into later updates', () => {
    // Parent rejects any lightness above 0.8 and keeps its current state.
    const { events, get } = renderColor('controlled', {
      accept: (next) => next.requested.l <= 0.8,
    });

    act(() => {
      get().setChannel('l', 0.9);
    });
    expect(events.at(-1)?.next.requested.l).toBe(0.9);
    expect(get().requested.l).toBe(INITIAL.l);

    act(() => {
      get().setChannel('h', 90);
    });

    expect(events).toHaveLength(2);
    expect(events[1].next.requested).toMatchObject({ l: INITIAL.l, h: 90 });
    expect(get().requested).toMatchObject({ l: INITIAL.l, h: 90 });
  });

  it('keeps the gamut mapping method of a controlled state across updates', () => {
    const vivid = { l: 0.7, c: 0.35, h: 150, alpha: 1 };
    const { events, get } = renderColor('controlled', {
      initial: () => createColorState(vivid, { gamutMapMethod: 'css' }),
    });
    const cssC = get().displayedSrgb.c;
    expect(cssC).toBeCloseTo(0.2104, 3);

    act(() => {
      get().setChannel('alpha', 0.9);
    });

    expect(events.at(-1)?.next.meta.gamutMapMethod).toBe('css');
    expect(get().displayedSrgb.c).toBe(cssC);
  });

  it('computes conversions lazily and keeps them stable per requested color', () => {
    const { get } = renderColor('uncontrolled');
    const first = get();

    expect(first.hex).toBe(toHex(first.requested));
    expect(first.rgb).toEqual(toRgb(first.requested));
    expect(first.rgb).toBe(first.rgb);

    act(() => {
      get().setActiveView('hex');
    });

    const second = get();
    expect(second.requested).toBe(first.requested);
    expect(second.rgb).toBe(first.rgb);
  });
});

describe('rejected updates and descendant layout effects', () => {
  // The parent rejects l = 0.9 (keeps its state); on that commit a
  // descendant's layout effect sets h = 90, which must start from the
  // state the parent kept, not from the rejected pending update.
  it('useColor: does not compose onto a rejected update', () => {
    const events: ColorUpdateEvent[] = [];
    let api: UseColorReturn | null = null;
    render(
      <RejectingColorParent
        onChange={(event) => events.push(event)}
        onReady={(value) => {
          api = value;
        }}
      />,
    );

    act(() => {
      api?.setChannel('l', 0.9);
    });

    expect(events).toHaveLength(2);
    expect(events[0].next.requested.l).toBe(0.9);
    expect(events[1].next.requested).toMatchObject({ l: INITIAL.l, h: 90 });
  });

  it('useMultiColor: does not compose onto a rejected update', () => {
    const events: MultiColorUpdateEvent[] = [];
    let api: UseMultiColorReturn | null = null;
    render(
      <RejectingMultiParent
        onChange={(event) => events.push(event)}
        onReady={(value) => {
          api = value;
        }}
      />,
    );

    act(() => {
      api?.setChannel('base', 'l', 0.9);
    });

    expect(events).toHaveLength(2);
    expect(events[0].next.colors.base.requested.l).toBe(0.9);
    expect(events[1].next.colors.base.requested).toMatchObject({
      l: INITIAL.l,
      h: 90,
    });
  });
});

describe('useMultiColor update semantics', () => {
  it.each(MODES)('%s: composes multiple updates within one tick', (mode) => {
    const { events, get } = renderMulti(mode);

    act(() => {
      const multi = get();
      multi.setChannel('base', 'l', 0.3, { interaction: 'pointer' });
      multi.setChannel('accent', 'h', 200, { interaction: 'pointer' });
      multi.addColor('neutral', '#6b7280');
      multi.select('neutral');
    });

    expect(events).toHaveLength(4);
    const last = events[3].next;
    expect(last.colors.base.requested.l).toBe(0.3);
    expect(last.colors.accent.requested.h).toBe(200);
    expect(last.order).toEqual(['base', 'accent', 'neutral']);
    expect(last.selectedId).toBe('neutral');

    const multi = get();
    expect(multi.state.colors.base.requested.l).toBe(0.3);
    expect(multi.state.colors.accent.requested.h).toBe(200);
    expect(multi.ids).toEqual(['base', 'accent', 'neutral']);
    expect(multi.selectedId).toBe('neutral');
  });

  it.each(MODES)('%s: calls onChange synchronously inside the call', (mode) => {
    const { events, get } = renderMulti(mode);
    const observed: number[] = [];

    act(() => {
      get().removeColor('accent');
      observed.push(events.length);
      get().removeColor('accent');
      observed.push(events.length);
    });

    expect(observed).toEqual([1, 1]);
    expect(events[0].id).toBe('accent');
    expect(get().ids).toEqual(['base']);
  });

  it('emits identical event sequences in controlled and uncontrolled modes', () => {
    const run = (mode: Mode) => {
      const { events, get } = renderMulti(mode);
      act(() => {
        get().setActiveGamut('srgb');
        get().renameColor('accent', 'accent-1');
        get().setChannel('accent-1', 'c', 0.1, { interaction: 'keyboard' });
      });
      act(() => {
        get().select('accent-1', 'pointer');
        get().select('accent-1', 'pointer');
        get().removeColor('base');
      });
      cleanup();
      return events;
    };

    const controlled = run('controlled');
    const uncontrolled = run('uncontrolled');

    expect(controlled).toHaveLength(5);
    expect(controlled).toEqual(uncontrolled);
  });

  it('does not carry a rejected controlled update into later updates', () => {
    // Parent rejects any base lightness above 0.8 and keeps its current state.
    const { events, get } = renderMulti('controlled', {
      accept: (next) => (next.colors.base?.requested.l ?? 0) <= 0.8,
    });

    act(() => {
      get().setChannel('base', 'l', 0.9);
    });
    expect(events.at(-1)?.next.colors.base.requested.l).toBe(0.9);
    expect(get().state.colors.base.requested.l).toBe(INITIAL.l);

    act(() => {
      get().setChannel('base', 'h', 90);
    });

    expect(events).toHaveLength(2);
    expect(events[1].next.colors.base.requested).toMatchObject({
      l: INITIAL.l,
      h: 90,
    });
    expect(get().state.colors.base.requested).toMatchObject({
      l: INITIAL.l,
      h: 90,
    });
  });

  it.each(MODES)('%s: does not duplicate onChange under StrictMode', (mode) => {
    const { events, get } = renderMulti(mode, { strict: true });

    act(() => {
      get().setChannel('base', 'h', 10);
      get().setChannel('base', 'l', 0.2);
    });
    act(() => {
      get().addColor('extra', '#000000');
    });

    expect(events).toHaveLength(3);
    expect(get().state.colors.base.requested).toMatchObject({ h: 10, l: 0.2 });
    expect(get().ids).toEqual(['base', 'accent', 'extra']);
  });
});
