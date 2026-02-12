// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { ColorWheel } from '../src/color-wheel.js';

afterEach(() => {
  cleanup();
});

function dispatchPointer(
  target: Pick<EventTarget, 'dispatchEvent'>,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  options: {
    pointerId?: number;
    clientX: number;
    clientY: number;
  },
) {
  const PointerEventCtor =
    typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  const event = new PointerEventCtor(type, {
    bubbles: true,
    clientX: options.clientX,
    clientY: options.clientY,
  }) as PointerEvent;
  Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 });
  target.dispatchEvent(event);
}

describe('ColorWheel', () => {
  it('uses requested values for aria and thumb position', () => {
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };
    const { container, getByRole } = render(
      <ColorWheel requested={requested} onChangeRequested={() => {}} />,
    );

    expect(getByRole('slider').getAttribute('aria-valuenow')).toBe('0.2');
    expect(
      container
        .querySelector('[data-color-wheel-thumb]')
        ?.getAttribute('data-radius'),
    ).toBe('0.5000');
  });

  it('emits changed-channel metadata for keyboard edits', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };
    const { getByRole } = render(
      <ColorWheel
        requested={requested}
        onChangeRequested={onChangeRequested}
      />,
    );

    const slider = getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowUp' });

    const [, hueOptions] = onChangeRequested.mock.calls[0];
    expect(hueOptions).toEqual({
      interaction: 'keyboard',
      changedChannel: 'h',
    });

    const [, chromaOptions] = onChangeRequested.mock.calls[1];
    expect(chromaOptions).toEqual({
      interaction: 'keyboard',
      changedChannel: 'c',
    });
  });

  it('maps pointer interactions to hue/chroma updates', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 180, alpha: 1 };
    const { container } = render(
      <ColorWheel
        requested={requested}
        onChangeRequested={onChangeRequested}
      />,
    );

    const root = container.querySelector(
      '[data-color-wheel]',
    ) as HTMLDivElement;
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    dispatchPointer(root, 'pointerdown', {
      pointerId: 1,
      clientX: 100,
      clientY: 50,
    });

    const [next, options] = onChangeRequested.mock.calls[0];
    expect(next.h).toBeCloseTo(0, 0);
    expect(next.c).toBeCloseTo(0.4, 3);
    expect(options).toEqual({ interaction: 'pointer' });
  });

  it('preserves hue when pointer is centered', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 287, alpha: 1 };
    const { container } = render(
      <ColorWheel
        requested={requested}
        onChangeRequested={onChangeRequested}
      />,
    );

    const root = container.querySelector(
      '[data-color-wheel]',
    ) as HTMLDivElement;
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    dispatchPointer(root, 'pointerdown', {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });

    const [next] = onChangeRequested.mock.calls[0];
    expect(next.h).toBeCloseTo(287, 6);
    expect(next.c).toBeCloseTo(0, 6);
  });
});
