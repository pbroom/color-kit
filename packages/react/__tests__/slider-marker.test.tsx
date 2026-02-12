// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { ColorSlider } from '../src/color-slider.js';
import { SliderMarker } from '../src/slider-marker.js';

afterEach(() => {
  cleanup();
});

describe('SliderMarker', () => {
  it('positions markers from channel values and marks them decorative', () => {
    const requested: Color = { l: 0.6, c: 0.2, h: 220, alpha: 0.5 };
    const { container } = render(
      <ColorSlider
        channel="alpha"
        requested={requested}
        onChangeRequested={() => {}}
      >
        <SliderMarker value={0.25} />
      </ColorSlider>,
    );

    const marker = container.querySelector('[data-color-slider-marker]');

    expect(marker?.getAttribute('data-norm')).toBe('0.2500');
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
    expect((marker as HTMLDivElement).style.left).toContain(
      '--ck-slider-position-inset',
    );
    expect((marker as HTMLDivElement).style.left).toContain('* 0.25');
  });

  it('prioritizes explicit normalized coordinates over value', () => {
    const requested: Color = { l: 0.6, c: 0.2, h: 220, alpha: 1 };
    const { container } = render(
      <ColorSlider
        channel="alpha"
        requested={requested}
        onChangeRequested={() => {}}
      >
        <SliderMarker value={0.9} norm={0.2} />
      </ColorSlider>,
    );

    const marker = container.querySelector('[data-color-slider-marker]');
    expect(marker?.getAttribute('data-norm')).toBe('0.2000');
    expect((marker as HTMLDivElement).style.left).toContain(
      '--ck-slider-position-inset',
    );
    expect((marker as HTMLDivElement).style.left).toContain('* 0.2');
  });

  it('handles vertical orientation positioning', () => {
    const requested: Color = { l: 0.6, c: 0.2, h: 220, alpha: 1 };
    const { container } = render(
      <ColorSlider
        channel="alpha"
        orientation="vertical"
        requested={requested}
        onChangeRequested={() => {}}
      >
        <SliderMarker norm={0.25} />
      </ColorSlider>,
    );

    const marker = container.querySelector('[data-color-slider-marker]');
    expect((marker as HTMLDivElement).style.top).toContain(
      '--ck-slider-position-inset',
    );
    expect((marker as HTMLDivElement).style.top).toContain('* 0.75');
  });
});
