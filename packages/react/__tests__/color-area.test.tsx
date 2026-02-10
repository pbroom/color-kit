// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { ColorArea } from '../src/color-area.js';

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
    expect(options).toEqual({ interaction: 'keyboard' });
  });
});
