// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { maxChromaAt } from '@color-kit/core';
import { ChromaMarkers } from '../src/chroma-markers.js';
import { ColorProvider } from '../src/color-provider.js';
import { ColorSlider } from '../src/color-slider.js';

afterEach(() => {
  cleanup();
});

describe('ChromaMarkers', () => {
  it('renders current and hue max markers and fallback mini-thumb when out of range', () => {
    const requested: Color = { l: 0.84, c: 0.38, h: 146, alpha: 1 };
    const expectedCurrent = maxChromaAt(requested.l, requested.h, {
      gamut: 'srgb',
      maxChroma: 0.4,
    });

    const { container } = render(
      <ColorSlider
        channel="c"
        requested={requested}
        onChangeRequested={() => {}}
      >
        <ChromaMarkers gamut="srgb" />
      </ColorSlider>,
    );

    const current = container.querySelector(
      '[data-color-slider-marker-kind="current-max"]',
    );
    const hueWide = container.querySelector(
      '[data-color-slider-marker-kind="hue-max"]',
    );
    const fallback = container.querySelector(
      '[data-color-slider-marker-kind="fallback-thumb"]',
    );

    expect(current).toBeTruthy();
    expect(hueWide).toBeTruthy();
    expect(fallback).toBeTruthy();
    expect(Number(current?.getAttribute('data-value'))).toBeCloseTo(
      expectedCurrent,
      4,
    );
  });

  it('omits fallback marker when requested chroma is within current limit', () => {
    const requested: Color = { l: 0.84, c: 0.05, h: 146, alpha: 1 };

    const { container } = render(
      <ColorSlider
        channel="c"
        requested={requested}
        onChangeRequested={() => {}}
      >
        <ChromaMarkers gamut="srgb" />
      </ColorSlider>,
    );

    expect(
      container.querySelector('[data-color-slider-marker-kind="fallback-thumb"]'),
    ).toBeNull();
  });

  it('defaults to display-p3 in standalone mode', () => {
    const requested: Color = { l: 0.84, c: 0.05, h: 146, alpha: 1 };

    const { container } = render(
      <ColorSlider
        channel="c"
        requested={requested}
        onChangeRequested={() => {}}
      >
        <ChromaMarkers />
      </ColorSlider>,
    );

    const current = container.querySelector(
      '[data-color-slider-marker-kind="current-max"]',
    );
    expect(current?.getAttribute('data-gamut')).toBe('display-p3');
  });

  it('uses active provider gamut when no explicit gamut override is passed', () => {
    const requested: Color = { l: 0.84, c: 0.3, h: 146, alpha: 1 };

    const srgb = render(
      <ColorProvider defaultColor={requested} defaultGamut="srgb">
        <ColorSlider channel="c">
          <ChromaMarkers />
        </ColorSlider>
      </ColorProvider>,
    );

    const srgbCurrent = srgb.container.querySelector(
      '[data-color-slider-marker-kind="current-max"]',
    );
    const srgbValue = Number(srgbCurrent?.getAttribute('data-value'));
    expect(srgbCurrent?.getAttribute('data-gamut')).toBe('srgb');

    cleanup();

    const p3 = render(
      <ColorProvider defaultColor={requested} defaultGamut="display-p3">
        <ColorSlider channel="c">
          <ChromaMarkers />
        </ColorSlider>
      </ColorProvider>,
    );

    const p3Current = p3.container.querySelector(
      '[data-color-slider-marker-kind="current-max"]',
    );
    const p3Value = Number(p3Current?.getAttribute('data-value'));
    expect(p3Current?.getAttribute('data-gamut')).toBe('display-p3');
    expect(p3Value).toBeGreaterThan(srgbValue);
  });
});
