// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Color } from '@color-kit/core';
import { AlphaSlider } from '../src/alpha-slider.js';
import { ColorArea } from '../src/color-area.js';
import { ColorInput } from '../src/color-input.js';
import { ColorProvider } from '../src/color-provider.js';
import { ColorSlider } from '../src/color-slider.js';
import { ColorWheel } from '../src/color-wheel.js';
import { HueSlider } from '../src/hue-slider.js';
import { SliderMarker } from '../src/slider-marker.js';
import { useColorContext } from '../src/context.js';

afterEach(() => {
  cleanup();
});

const OUT_OF_GAMUT_REQUESTED: Color = { l: 0.8, c: 0.4, h: 145, alpha: 1 };

function GamutToggle() {
  const { activeGamut, setActiveGamut } = useColorContext();
  return (
    <button
      type="button"
      onClick={() =>
        setActiveGamut(activeGamut === 'display-p3' ? 'srgb' : 'display-p3')
      }
    >
      Toggle gamut
    </button>
  );
}

describe('shared component contracts', () => {
  it('requires provider or standalone state props for context-driven primitives', () => {
    expect(() => render(<ColorArea />)).toThrowError(
      /ColorArea requires either/,
    );
    expect(() => render(<ColorSlider channel="c" />)).toThrowError(
      /ColorSlider requires either/,
    );
    expect(() => render(<ColorInput />)).toThrowError(
      /ColorInput requires either/,
    );
    expect(() => render(<HueSlider />)).toThrowError(
      /ColorSlider requires either/,
    );
    expect(() => render(<AlphaSlider />)).toThrowError(
      /ColorSlider requires either/,
    );
    expect(() => render(<ColorWheel />)).toThrowError(
      /ColorWheel requires either/,
    );
  });

  it('renders context-driven primitives from ColorProvider without standalone props', () => {
    render(
      <ColorProvider defaultColor={OUT_OF_GAMUT_REQUESTED}>
        <ColorArea />
        <ColorSlider channel="c" />
        <ColorWheel />
        <HueSlider />
        <AlphaSlider />
        <ColorInput />
      </ColorProvider>,
    );

    expect(screen.getAllByRole('slider')).toHaveLength(5);
    expect(screen.getByLabelText('Color value')).toBeTruthy();
  });

  it('keeps ColorArea thumb coordinates stable across active gamut switches', () => {
    const { container } = render(
      <ColorProvider defaultColor={OUT_OF_GAMUT_REQUESTED}>
        <ColorArea />
        <GamutToggle />
      </ColorProvider>,
    );

    const thumb = container.querySelector('[data-color-area-thumb]');
    expect(thumb).toBeTruthy();
    const before = {
      x: thumb?.getAttribute('data-x'),
      y: thumb?.getAttribute('data-y'),
    };

    fireEvent.click(screen.getByRole('button', { name: 'Toggle gamut' }));

    const after = {
      x: thumb?.getAttribute('data-x'),
      y: thumb?.getAttribute('data-y'),
    };
    expect(after).toEqual(before);
  });

  it('keeps ColorSlider thumb coordinates stable across active gamut switches', () => {
    const { container } = render(
      <ColorProvider defaultColor={OUT_OF_GAMUT_REQUESTED}>
        <ColorSlider channel="c" />
        <GamutToggle />
      </ColorProvider>,
    );

    const thumb = container.querySelector('[data-color-slider-thumb]');
    expect(thumb).toBeTruthy();
    const before = thumb?.getAttribute('data-value');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle gamut' }));

    const after = thumb?.getAttribute('data-value');
    expect(after).toBe(before);
  });

  it('keeps ColorWheel thumb coordinates stable across active gamut switches', () => {
    const { container } = render(
      <ColorProvider defaultColor={OUT_OF_GAMUT_REQUESTED}>
        <ColorWheel />
        <GamutToggle />
      </ColorProvider>,
    );

    const thumb = container.querySelector('[data-color-wheel-thumb]');
    expect(thumb).toBeTruthy();
    const before = {
      x: thumb?.getAttribute('data-x'),
      y: thumb?.getAttribute('data-y'),
    };

    fireEvent.click(screen.getByRole('button', { name: 'Toggle gamut' }));

    const after = {
      x: thumb?.getAttribute('data-x'),
      y: thumb?.getAttribute('data-y'),
    };
    expect(after).toEqual(before);
  });

  it('preserves untouched channels during keyboard channel edits', () => {
    const onSliderChange = vi.fn();
    const onAreaChange = vi.fn();
    const requested: Color = { l: 0.5, c: 0.2, h: 120, alpha: 0.75 };

    const { getAllByRole } = render(
      <>
        <ColorSlider
          channel="h"
          requested={requested}
          onChangeRequested={onSliderChange}
        />
        <ColorArea requested={requested} onChangeRequested={onAreaChange} />
      </>,
    );

    const [slider, area] = getAllByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(area, { key: 'ArrowRight' });

    const [sliderNext] = onSliderChange.mock.calls[0] as [Color];
    expect(sliderNext.l).toBeCloseTo(requested.l, 6);
    expect(sliderNext.c).toBeCloseTo(requested.c, 6);
    expect(sliderNext.alpha).toBeCloseTo(requested.alpha, 6);
    expect(sliderNext.h).toBeGreaterThan(requested.h);

    const [areaNext] = onAreaChange.mock.calls[0] as [Color];
    expect(areaNext.l).toBeGreaterThan(requested.l);
    expect(areaNext.h).toBeCloseTo(requested.h, 6);
    expect(areaNext.alpha).toBeCloseTo(requested.alpha, 6);
    expect(areaNext.c).toBeCloseTo(requested.c, 6);
  });

  it('captures pointer interaction on slider root even when pointer starts on child content', () => {
    const requested: Color = { l: 0.6, c: 0.2, h: 210, alpha: 1 };
    const { getByRole, getByTestId } = render(
      <ColorSlider
        channel="c"
        requested={requested}
        onChangeRequested={() => {}}
      >
        <span data-testid="track-child">track</span>
      </ColorSlider>,
    );

    const slider = getByRole('slider') as HTMLDivElement;
    const child = getByTestId('track-child') as HTMLSpanElement;
    const sliderCapture = vi.fn();
    const childCapture = vi.fn();
    slider.setPointerCapture = sliderCapture;
    child.setPointerCapture = childCapture;
    slider.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 10,
      }) as DOMRect;

    fireEvent.pointerDown(child, { pointerId: 7, clientX: 50, clientY: 5 });

    expect(sliderCapture).toHaveBeenCalledTimes(1);
    expect(childCapture).not.toHaveBeenCalled();
  });

  it('captures pointer interaction on slider root when marker primitives are present', () => {
    const requested: Color = { l: 0.6, c: 0.2, h: 210, alpha: 1 };
    const { getByRole, container } = render(
      <ColorSlider
        channel="c"
        requested={requested}
        onChangeRequested={() => {}}
      >
        <SliderMarker value={0.1} />
      </ColorSlider>,
    );

    const slider = getByRole('slider') as HTMLDivElement;
    const marker = container.querySelector(
      '[data-color-slider-marker]',
    ) as HTMLDivElement;
    const sliderCapture = vi.fn();
    const markerCapture = vi.fn();

    slider.setPointerCapture = sliderCapture;
    marker.setPointerCapture = markerCapture;
    slider.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 10,
      }) as DOMRect;

    fireEvent.pointerDown(marker, { pointerId: 7, clientX: 50, clientY: 5 });

    expect(sliderCapture).toHaveBeenCalledTimes(1);
    expect(markerCapture).not.toHaveBeenCalled();
  });
});
