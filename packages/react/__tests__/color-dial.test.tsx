// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { ColorDial } from '../src/color-dial.js';
import { HueDial } from '../src/hue-dial.js';

afterEach(() => {
  cleanup();
});

describe('ColorDial', () => {
  it('uses requested values for aria and thumb position', () => {
    const requested: Color = { l: 0.5, c: 0.2, h: 180, alpha: 1 };
    const { container, getByRole } = render(
      <ColorDial
        channel="h"
        requested={requested}
        onChangeRequested={() => {}}
      />,
    );

    expect(getByRole('slider').getAttribute('aria-valuenow')).toBe('180');
    expect(
      container
        .querySelector('[data-color-dial-thumb]')
        ?.getAttribute('data-value'),
    ).toBe('0.5000');
  });

  it('emits changed channel metadata on keyboard edits', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };
    const { getByRole } = render(
      <ColorDial
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

  it('wraps hue keyboard edits when wrap is enabled', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 358, alpha: 1 };
    const { getByRole } = render(
      <ColorDial
        channel="h"
        requested={requested}
        onChangeRequested={onChangeRequested}
        wrap
      />,
    );

    fireEvent.keyDown(getByRole('slider'), { key: 'ArrowRight' });

    const [next] = onChangeRequested.mock.calls[0] as [Color];
    expect(next.h).toBeLessThan(requested.h);
  });

  it('supports Home/End keyboard shortcuts', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 200, alpha: 1 };
    const { getByRole } = render(
      <ColorDial
        channel="h"
        requested={requested}
        onChangeRequested={onChangeRequested}
      />,
    );

    const slider = getByRole('slider');
    fireEvent.keyDown(slider, { key: 'Home' });
    fireEvent.keyDown(slider, { key: 'End' });

    const [first] = onChangeRequested.mock.calls[0] as [Color];
    const [second] = onChangeRequested.mock.calls[1] as [Color];
    expect(first.h).toBe(0);
    expect(second.h).toBe(360);
  });

  it('captures pointer interaction on dial root when pointer starts on child content', () => {
    const requested: Color = { l: 0.6, c: 0.2, h: 210, alpha: 1 };
    const { getByRole, getByTestId } = render(
      <ColorDial
        channel="h"
        requested={requested}
        onChangeRequested={() => {}}
        startAngle={0}
        endAngle={360}
      >
        <span data-testid="ring-child">ring</span>
      </ColorDial>,
    );

    const dial = getByRole('slider') as HTMLDivElement;
    const child = getByTestId('ring-child') as HTMLSpanElement;
    const dialCapture = vi.fn();
    const childCapture = vi.fn();
    dial.setPointerCapture = dialCapture;
    child.setPointerCapture = childCapture;
    dial.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
      }) as DOMRect;

    fireEvent.pointerDown(child, { pointerId: 7, clientX: 100, clientY: 50 });

    expect(dialCapture).toHaveBeenCalledTimes(1);
    expect(childCapture).not.toHaveBeenCalled();
  });
});

describe('HueDial', () => {
  it('routes hue edits through ColorDial channel=h', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };
    const { getByRole } = render(
      <HueDial requested={requested} onChangeRequested={onChangeRequested} />,
    );

    const dial = getByRole('slider');
    expect(dial.getAttribute('data-channel')).toBe('h');
    fireEvent.keyDown(dial, { key: 'ArrowRight' });

    const [, options] = onChangeRequested.mock.calls[0];
    expect(options.changedChannel).toBe('h');
  });
});
