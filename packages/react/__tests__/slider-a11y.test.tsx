// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import axe from 'axe-core';
import type { Color } from '@color-kit/core';
import { ColorArea } from '../src/color-area.js';
import { ColorSlider } from '../src/color-slider.js';
import { Thumb } from '../src/thumb.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const RECT = {
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  right: 100,
  bottom: 100,
  x: 0,
  y: 0,
  toJSON: () => '',
} as DOMRect;

async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      // jsdom has no layout or computed colors.
      'color-contrast': { enabled: false },
    },
  });
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.html),
    })),
  ).toEqual([]);
}

function renderSlider(
  props: Partial<Parameters<typeof ColorSlider>[0]> & {
    channel: 'l' | 'c' | 'h' | 'alpha';
    requested: Color;
  },
) {
  const onChangeRequested = vi.fn();
  const utils = render(
    <ColorSlider onChangeRequested={onChangeRequested} {...props} />,
  );
  return { ...utils, onChangeRequested, slider: utils.getByRole('slider') };
}

describe('ColorSlider keyboard', () => {
  const base: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };

  it.each([
    ['ArrowRight', {}, 0.51],
    ['ArrowUp', {}, 0.51],
    ['ArrowLeft', {}, 0.49],
    ['ArrowDown', {}, 0.49],
    ['ArrowRight', { shiftKey: true }, 0.6],
    ['ArrowLeft', { shiftKey: true }, 0.4],
    ['PageUp', {}, 0.6],
    ['PageDown', {}, 0.4],
    ['Home', {}, 0],
    ['End', {}, 1],
  ])('%s %o sets lightness to %d', (key, modifiers, expected) => {
    const { slider, onChangeRequested } = renderSlider({
      channel: 'l',
      requested: base,
    });

    fireEvent.keyDown(slider, { key, ...modifiers });

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
    const [next, options] = onChangeRequested.mock.calls[0];
    expect(next.l).toBeCloseTo(expected, 6);
    expect(options).toEqual({ changedChannel: 'l', interaction: 'keyboard' });
  });

  it('uses configurable stepRatio and largeStepRatio', () => {
    const { slider, onChangeRequested } = renderSlider({
      channel: 'l',
      requested: base,
      stepRatio: 0.05,
      largeStepRatio: 0.25,
    });

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'PageDown' });
    fireEvent.keyDown(slider, { key: 'ArrowUp', shiftKey: true });

    const values = onChangeRequested.mock.calls.map(([next]) => next.l);
    expect(values[0]).toBeCloseTo(0.55, 6);
    expect(values[1]).toBeCloseTo(0.25, 6);
    expect(values[2]).toBeCloseTo(0.75, 6);
  });

  it('wraps hue at both ends and clamps other channels', () => {
    const hueHigh = renderSlider({
      channel: 'h',
      requested: { ...base, h: 359 },
    });
    fireEvent.keyDown(hueHigh.slider, { key: 'ArrowRight' });
    expect(hueHigh.onChangeRequested.mock.calls[0][0].h).toBeCloseTo(2.6, 6);
    cleanup();

    const hueLow = renderSlider({ channel: 'h', requested: { ...base, h: 1 } });
    fireEvent.keyDown(hueLow.slider, { key: 'PageDown' });
    expect(hueLow.onChangeRequested.mock.calls[0][0].h).toBeCloseTo(325, 6);
    cleanup();

    const lightness = renderSlider({
      channel: 'l',
      requested: { ...base, l: 0.995 },
    });
    fireEvent.keyDown(lightness.slider, { key: 'ArrowRight' });
    expect(lightness.onChangeRequested.mock.calls[0][0].l).toBe(1);
    cleanup();

    const noWrap = renderSlider({
      channel: 'h',
      requested: { ...base, h: 359 },
      wrap: false,
    });
    fireEvent.keyDown(noWrap.slider, { key: 'ArrowRight' });
    expect(noWrap.onChangeRequested.mock.calls[0][0].h).toBe(360);
  });

  it('ignores unrelated keys', () => {
    const { slider, onChangeRequested } = renderSlider({
      channel: 'l',
      requested: base,
    });
    fireEvent.keyDown(slider, { key: 'a' });
    fireEvent.keyDown(slider, { key: 'Tab' });
    expect(onChangeRequested).not.toHaveBeenCalled();
  });
});

describe('ColorSlider ARIA', () => {
  it.each([
    ['h', { l: 0.5, c: 0.2, h: 213.4567, alpha: 1 }, 'Hue 213°'],
    ['l', { l: 0.6, c: 0.2, h: 120, alpha: 1 }, 'Lightness 60%'],
    ['alpha', { l: 0.6, c: 0.2, h: 120, alpha: 0.5 }, 'Opacity 50%'],
    ['c', { l: 0.6, c: 0.2, h: 120, alpha: 1 }, 'Chroma 0.2'],
  ] as const)('announces %s as "%s"', (channel, requested, text) => {
    const { slider } = renderSlider({ channel, requested });
    expect(slider.getAttribute('aria-valuetext')).toBe(text);
  });

  it('supports custom value text', () => {
    const requested: Color = { l: 0.6, c: 0.2, h: 213.4, alpha: 1 };
    const { slider } = renderSlider({
      channel: 'h',
      requested,
      getValueText: (value, channel) => `${channel}=${value.toFixed(1)}`,
    });
    expect(slider.getAttribute('aria-valuetext')).toBe('h=213.4');
    cleanup();

    const explicit = renderSlider({
      channel: 'h',
      requested,
      'aria-valuetext': 'Blue-ish',
    });
    expect(explicit.slider.getAttribute('aria-valuetext')).toBe('Blue-ish');
  });

  it('passes axe checks', async () => {
    const { container } = render(
      <div>
        <ColorSlider
          channel="h"
          requested={{ l: 0.6, c: 0.2, h: 213, alpha: 1 }}
          onChangeRequested={() => {}}
        />
        <ColorSlider
          channel="alpha"
          orientation="vertical"
          disabled
          requested={{ l: 0.6, c: 0.2, h: 213, alpha: 0.5 }}
          onChangeRequested={() => {}}
        />
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});

describe('ColorSlider disabled and focus', () => {
  const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };

  it('blocks interaction and leaves the tab order when disabled', () => {
    const { slider, onChangeRequested } = renderSlider({
      channel: 'l',
      requested,
      disabled: true,
    });
    slider.setPointerCapture = vi.fn();
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(RECT);

    expect(slider.getAttribute('aria-disabled')).toBe('true');
    expect(slider.hasAttribute('data-disabled')).toBe(true);
    expect(slider.hasAttribute('tabindex')).toBe(false);

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 80, clientY: 5 });

    expect(onChangeRequested).not.toHaveBeenCalled();
    expect(slider.hasAttribute('data-dragging')).toBe(false);
    expect(document.activeElement).not.toBe(slider);
  });

  it('focuses the slider on pointerdown without focus-visible', () => {
    const { slider } = renderSlider({ channel: 'l', requested });
    slider.setPointerCapture = vi.fn();
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(RECT);

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 80, clientY: 5 });

    expect(document.activeElement).toBe(slider);
    expect(slider.hasAttribute('data-focus-visible')).toBe(false);

    // Keyboard use after a pointer focus upgrades to focus-visible.
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider.hasAttribute('data-focus-visible')).toBe(true);

    act(() => {
      slider.blur();
    });
    expect(slider.hasAttribute('data-focus-visible')).toBe(false);
  });

  it('sets data-focus-visible for keyboard focus', () => {
    const { slider } = renderSlider({ channel: 'l', requested });

    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => {
      slider.focus();
    });

    expect(slider.hasAttribute('data-focus-visible')).toBe(true);
  });

  it('composes consumer focus handlers', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const { slider } = renderSlider({
      channel: 'l',
      requested,
      onFocus,
      onBlur,
    });

    act(() => {
      slider.focus();
    });
    act(() => {
      slider.blur();
    });

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe('ColorArea thumb accessibility', () => {
  const requested: Color = { l: 0.6, c: 0.2, h: 213, alpha: 1 };

  function renderArea(
    props: Partial<Parameters<typeof ColorArea>[0]> = {},
    thumb?: Parameters<typeof ColorArea>[0]['thumb'],
  ) {
    const onChangeRequested = vi.fn();
    const utils = render(
      <ColorArea
        requested={requested}
        onChangeRequested={onChangeRequested}
        thumb={thumb}
        {...props}
      />,
    );
    const root = utils.container.querySelector(
      '[data-color-area]',
    ) as HTMLDivElement;
    const thumbNode = utils.getByRole('slider');
    return { ...utils, onChangeRequested, root, thumb: thumbNode };
  }

  it('exposes 2D slider semantics with per-axis value text', () => {
    const { thumb } = renderArea();

    expect(thumb.getAttribute('aria-roledescription')).toBe('2D slider');
    expect(thumb.getAttribute('aria-valuenow')).toBe('0.6');
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('1');
    expect(thumb.getAttribute('aria-valuetext')).toBe(
      'Lightness 60%, Chroma 0.2',
    );
  });

  it('supports custom value text', () => {
    const { thumb } = renderArea(
      {},
      <Thumb
        getValueText={(color, axes) =>
          `${axes.x.channel}${color.l} ${axes.y.channel}${color.c}`
        }
      />,
    );
    expect(thumb.getAttribute('aria-valuetext')).toBe('l0.6 c0.2');
  });

  it.each([
    ['ArrowRight', {}, 'l', 0.61],
    ['ArrowLeft', {}, 'l', 0.59],
    ['ArrowUp', {}, 'c', 0.204],
    ['ArrowDown', {}, 'c', 0.196],
    ['ArrowRight', { shiftKey: true }, 'l', 0.7],
    ['PageUp', {}, 'c', 0.24],
    ['PageDown', {}, 'c', 0.16],
    ['Home', {}, 'l', 0],
    ['End', {}, 'l', 1],
  ] as const)('%s %o changes %s to %d', (key, modifiers, channel, expected) => {
    const { thumb, onChangeRequested } = renderArea();

    fireEvent.keyDown(thumb, { key, ...modifiers });

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
    const [next, options] = onChangeRequested.mock.calls[0];
    expect(next[channel]).toBeCloseTo(expected, 6);
    expect(options).toEqual({
      interaction: 'keyboard',
      changedChannel: channel,
    });
  });

  it('uses configurable thumb steps', () => {
    const { thumb, onChangeRequested } = renderArea(
      {},
      <Thumb stepRatio={0.05} largeStepRatio={0.5} />,
    );
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    fireEvent.keyDown(thumb, { key: 'PageDown' });
    expect(onChangeRequested.mock.calls[0][0].l).toBeCloseTo(0.65, 6);
    expect(onChangeRequested.mock.calls[1][0].c).toBeCloseTo(0, 6);
  });

  it('wraps a hue axis', () => {
    const onChangeRequested = vi.fn();
    const { getByRole } = render(
      <ColorArea
        axes={{ x: { channel: 'h' }, y: { channel: 'l' } }}
        requested={{ l: 0.6, c: 0.1, h: 358, alpha: 1 }}
        onChangeRequested={onChangeRequested}
      />,
    );
    fireEvent.keyDown(getByRole('slider'), { key: 'ArrowRight' });
    expect(onChangeRequested.mock.calls[0][0].h).toBeCloseTo(1.6, 6);
  });

  it('focuses the thumb on pointerdown', () => {
    const { root, thumb } = renderArea();
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(RECT);
    root.setPointerCapture = vi.fn();

    fireEvent.pointerDown(root, { pointerId: 1, clientX: 30, clientY: 30 });

    expect(document.activeElement).toBe(thumb);
    expect(thumb.hasAttribute('data-focus-visible')).toBe(false);
  });

  it('blocks interaction when disabled', () => {
    const { root, thumb, onChangeRequested } = renderArea({ disabled: true });
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(RECT);
    root.setPointerCapture = vi.fn();

    expect(root.hasAttribute('data-disabled')).toBe(true);
    expect(thumb.hasAttribute('data-disabled')).toBe(true);
    expect(thumb.getAttribute('aria-disabled')).toBe('true');
    expect(thumb.hasAttribute('tabindex')).toBe(false);

    fireEvent.pointerDown(root, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });

    expect(onChangeRequested).not.toHaveBeenCalled();
    expect(root.hasAttribute('data-dragging')).toBe(false);
    expect(document.activeElement).not.toBe(thumb);
  });

  it('passes axe checks', async () => {
    const { container } = render(
      <div>
        <ColorArea requested={requested} onChangeRequested={() => {}} />
        <ColorArea
          disabled
          axes={{ x: { channel: 'h' }, y: { channel: 'l' } }}
          requested={requested}
          onChangeRequested={() => {}}
          thumb={<Thumb aria-label="Hue and lightness" />}
        />
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});
