// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { ColorSlider } from '../src/color-slider.js';

afterEach(() => {
  cleanup();
});

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
});
