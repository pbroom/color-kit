// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { ColorSlider } from '../src/color-slider.js';

afterEach(() => {
  cleanup();
});

async function flushAnimationFrames(count: number = 1): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

describe('ColorSlider', () => {
  it('uses requested values for aria and thumb position', () => {
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };
    const { container, getByRole } = render(
      <ColorSlider
        channel="c"
        requested={requested}
        onChangeRequested={() => {}}
      />,
    );

    expect(getByRole('slider').getAttribute('aria-valuenow')).toBe('0.2');
    expect(
      container
        .querySelector('[data-color-slider-thumb]')
        ?.getAttribute('data-value'),
    ).toBe('0.5000');
  });

  it('emits changed channel metadata on keyboard edits', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };
    const { getByRole } = render(
      <ColorSlider
        channel="h"
        requested={requested}
        onChangeRequested={onChangeRequested}
      />,
    );

    fireEvent.keyDown(getByRole('slider'), { key: 'ArrowRight' });

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
    const [next, options] = onChangeRequested.mock.calls[0];
    expect(next.h).toBeGreaterThan(requested.h);
    expect(options).toEqual({ changedChannel: 'h', interaction: 'keyboard' });
  });

  it('applies dragEpsilon when processing pointer movement', async () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 0.5 };
    const { getByRole } = render(
      <ColorSlider
        channel="alpha"
        requested={requested}
        onChangeRequested={onChangeRequested}
        dragEpsilon={0.1}
        maxPointerRate={1000}
      />,
    );

    const slider = getByRole('slider') as HTMLDivElement;
    slider.setPointerCapture = vi.fn();
    slider.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 10,
      }) as DOMRect;

    fireEvent.pointerDown(slider, {
      pointerId: 1,
      clientX: 50,
      clientY: 5,
    });

    fireEvent.pointerMove(slider, {
      pointerId: 1,
      clientX: 55,
      clientY: 5,
    });
    await flushAnimationFrames(2);

    expect(onChangeRequested).toHaveBeenCalledTimes(1);

    fireEvent.pointerUp(slider, {
      pointerId: 1,
      clientX: 55,
      clientY: 5,
    });
  });
});
