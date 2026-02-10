// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { AlphaSlider } from '../src/alpha-slider.js';
import { HueSlider } from '../src/hue-slider.js';

afterEach(() => {
  cleanup();
});

describe('HueSlider and AlphaSlider', () => {
  it('routes hue edits through ColorSlider channel=h', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 1 };
    const { getByRole } = render(
      <HueSlider requested={requested} onChangeRequested={onChangeRequested} />,
    );

    const slider = getByRole('slider');
    expect(slider.getAttribute('data-channel')).toBe('h');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    const [, options] = onChangeRequested.mock.calls[0];
    expect(options.changedChannel).toBe('h');
  });

  it('routes alpha edits through ColorSlider channel=alpha', () => {
    const onChangeRequested = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 0.5 };
    const { getByRole } = render(
      <AlphaSlider
        requested={requested}
        onChangeRequested={onChangeRequested}
      />,
    );

    const slider = getByRole('slider');
    expect(slider.getAttribute('data-channel')).toBe('alpha');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    const [next, options] = onChangeRequested.mock.calls[0];
    expect(next.alpha).toBeGreaterThan(requested.alpha);
    expect(options.changedChannel).toBe('alpha');
  });
});
