// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { ColorArea } from '../src/color-area.js';
import { Thumb } from '../src/thumb.js';

afterEach(() => {
  cleanup();
});

describe('ColorArea', () => {
  it('keeps thumb coordinates bound to requested values', () => {
    const requested: Color = { l: 0.75, c: 0.4, h: 210, alpha: 1 };
    const { container } = render(
      <ColorArea requested={requested} onChangeRequested={() => {}} />,
    );

    const thumb = container.querySelector('[data-color-area-thumb]');
    expect(thumb?.getAttribute('data-x')).toBe('1.0000');
    expect(thumb?.getAttribute('data-y')).toBe('0.2500');
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
    expect(next.c).toBeGreaterThan(requested.c);
    expect(options).toEqual({
      changedChannel: 'c',
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
