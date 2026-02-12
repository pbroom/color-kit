// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { ColorArea } from '../src/color-area.js';
import { Thumb } from '../src/thumb.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function dispatchPointer(
  target: Pick<EventTarget, 'dispatchEvent'>,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  options: {
    pointerId?: number;
    clientX: number;
    clientY: number;
    coalesced?: Array<{ clientX: number; clientY: number }>;
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
  if (options.coalesced) {
    Object.defineProperty(event, 'getCoalescedEvents', {
      value: () => options.coalesced ?? [],
    });
  }
  target.dispatchEvent(event);
}

describe('ColorArea', () => {
  it('keeps thumb coordinates bound to requested values', () => {
    const requested: Color = { l: 0.75, c: 0.4, h: 210, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}} />,
    );

    const thumb = container.querySelector('[data-color-area-thumb]');
    expect(thumb?.getAttribute('data-x')).toBe('0.7500');
    expect(thumb?.getAttribute('data-y')).toBe('0.0000');
  });

  it('emits keyboard updates as requested changes', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };
    const { getByRole } = render(
      <ColorArea requested={requested} onChangeRequested={onChangeRequested} />,
    );

    fireEvent.keyDown(getByRole('slider'), { key: 'ArrowRight' });

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
    const [next, options] = onChangeRequested.mock.calls[0];
    expect(next.l).toBeGreaterThan(requested.l);
    expect(options).toEqual({
      changedChannel: 'l',
      interaction: 'keyboard',
    });
  });

  it('updates requested values from root pointer interactions', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.3, c: 0.1, h: 50, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={onChangeRequested} />,
    );

    const root = container.querySelector('[data-color-area]') as HTMLDivElement;
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

    fireEvent.pointerDown(root, { pointerId: 1, clientX: 50, clientY: 25 });

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
    const [next, options] = onChangeRequested.mock.calls[0];
    expect(next).toMatchObject({
      h: requested.h,
      alpha: requested.alpha,
    });
    expect(options).toEqual({ interaction: 'pointer' });
  });

  it('keeps drag updates flowing at default maxUpdateHz on 60hz cadence', () => {
    vi.useFakeTimers();

    let now = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.3, c: 0.1, h: 50, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={onChangeRequested} />,
    );

    const root = container.querySelector('[data-color-area]') as HTMLDivElement;
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
      clientX: 40,
      clientY: 60,
    });
    expect(onChangeRequested).toHaveBeenCalledTimes(1);

    now = 1_016;
    dispatchPointer(root, 'pointermove', {
      clientX: 60,
      clientY: 40,
    });
    vi.runOnlyPendingTimers();

    expect(onChangeRequested).toHaveBeenCalledTimes(2);
  });

  it('continues drag updates when move/up occur on window', () => {
    vi.useFakeTimers();

    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.3, c: 0.1, h: 50, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={onChangeRequested} />,
    );

    const root = container.querySelector('[data-color-area]') as HTMLDivElement;
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
      pointerId: 7,
      clientX: 20,
      clientY: 80,
    });
    dispatchPointer(window, 'pointermove', {
      pointerId: 7,
      clientX: 80,
      clientY: 20,
    });
    vi.runAllTimers();
    dispatchPointer(window, 'pointerup', {
      pointerId: 7,
      clientX: 80,
      clientY: 20,
    });

    expect(onChangeRequested).toHaveBeenCalledTimes(2);
  });

  it('caches geometry across drag frames to avoid repeated layout reads', () => {
    vi.useFakeTimers();

    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.3, c: 0.1, h: 50, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={onChangeRequested} />,
    );

    const root = container.querySelector('[data-color-area]') as HTMLDivElement;
    const rectSpy = vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
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

    dispatchPointer(root, 'pointerdown', { clientX: 15, clientY: 85 });
    dispatchPointer(root, 'pointermove', { clientX: 40, clientY: 60 });
    dispatchPointer(root, 'pointermove', { clientX: 70, clientY: 30 });
    vi.runAllTimers();
    dispatchPointer(root, 'pointerup', { clientX: 70, clientY: 30 });

    expect(onChangeRequested.mock.calls.length).toBeGreaterThan(1);
    expect(rectSpy).toHaveBeenCalledTimes(1);
  });

  it('uses latest coalesced pointer position and skips tiny movement by dragEpsilon', () => {
    vi.useFakeTimers();

    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.3, c: 0.1, h: 50, alpha: 1 };
    const { container } = render(
      <ColorArea
        requested={requested}
        onChangeRequested={onChangeRequested}
        dragEpsilon={0.1}
      />,
    );

    const root = container.querySelector('[data-color-area]') as HTMLDivElement;
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

    dispatchPointer(root, 'pointerdown', { clientX: 50, clientY: 50 });

    dispatchPointer(root, 'pointermove', {
      clientX: 51,
      clientY: 49,
      coalesced: [{ clientX: 51, clientY: 49 }],
    });
    vi.runAllTimers();

    dispatchPointer(root, 'pointermove', {
      clientX: 61,
      clientY: 39,
      coalesced: [
        { clientX: 61, clientY: 39 },
        { clientX: 90, clientY: 10 },
      ],
    });
    vi.runAllTimers();

    expect(onChangeRequested).toHaveBeenCalledTimes(2);
    const [, options] = onChangeRequested.mock.calls[1];
    expect(options).toEqual({ interaction: 'pointer' });
  });

  it('publishes interaction stats and adaptive quality metadata', () => {
    vi.useRealTimers();

    const requested: Color = { l: 0.3, c: 0.1, h: 50, alpha: 1 };
    const onInteractionFrame = vi.fn();
    const { container } = render(
      <ColorArea
        requested={requested}
        onChangeRequested={() => {
          const start = Date.now();
          while (Date.now() - start < 12) {
            // Simulate work to trigger adaptive quality behavior.
          }
        }}
        onInteractionFrame={onInteractionFrame}
      />,
    );

    const root = container.querySelector('[data-color-area]') as HTMLDivElement;
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

    fireEvent.pointerDown(root, { pointerId: 1, clientX: 20, clientY: 80 });
    for (let index = 0; index < 6; index += 1) {
      fireEvent.pointerMove(root, {
        pointerId: 1,
        clientX: 20 + index * 10,
        clientY: 80 - index * 10,
      });
    }
    fireEvent.pointerUp(root, { pointerId: 1, clientX: 80, clientY: 20 });

    expect(onInteractionFrame).toHaveBeenCalled();
    const latestStats = onInteractionFrame.mock.calls.at(-1)?.[0];
    expect(latestStats).toHaveProperty('coalescedCount');
    expect(root.getAttribute('data-quality-level')).toMatch(/high|medium|low/);
  });

  it('throws when multiple thumbs are provided', () => {
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };
    expect(() =>
      render(
        <ColorArea requested={requested} onChangeRequested={() => {}}>
          <Thumb />
          <Thumb />
        </ColorArea>,
      ),
    ).toThrowError(/one <Thumb/);
  });
});
