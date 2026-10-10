// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { ColorSlider } from '../src/color-slider.js';

afterEach(() => {
  cleanup();
});

/** jsdom's PointerEvent drops clientX/Y; build pointer events from MouseEvent. */
function firePointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
) {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  act(() => {
    target.dispatchEvent(event);
  });
}

async function flushAnimationFrames(count: number = 1): Promise<void> {
  if (count <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  await flushAnimationFrames(count - 1);
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
        maxUpdateHz={1000}
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

    firePointer(slider, 'pointerdown', 50, 5);
    expect(onChangeRequested).toHaveBeenCalledTimes(1);
    expect(onChangeRequested.mock.calls[0][0].alpha).toBeCloseTo(0.5, 6);

    // 0.05 normalized movement is within dragEpsilon.
    firePointer(slider, 'pointermove', 55, 5);
    await flushAnimationFrames(3);
    expect(onChangeRequested).toHaveBeenCalledTimes(1);

    firePointer(slider, 'pointermove', 80, 5);
    await flushAnimationFrames(3);
    expect(onChangeRequested).toHaveBeenCalledTimes(2);
    expect(onChangeRequested.mock.calls[1][0].alpha).toBeCloseTo(0.8, 6);

    firePointer(slider, 'pointerup', 80, 5);
  });
});
