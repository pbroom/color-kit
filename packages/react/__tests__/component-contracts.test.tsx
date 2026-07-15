// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { fromHex, type Color } from '@color-kit/core';
import { createColorState, type ColorState } from '@color-kit/driver';
import { ColorArea } from '../src/color-area.js';
import { ColorInput } from '../src/color-input.js';
import { Color } from '../src/color.js';
import { ColorStringInput } from '../src/color-string-input.js';
import { ColorSlider } from '../src/color-slider.js';
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

function GamutContextProbe() {
  const { activeGamut, setActiveGamut } = useColorContext();
  return (
    <button
      type="button"
      onClick={() =>
        setActiveGamut(activeGamut === 'display-p3' ? 'srgb' : 'display-p3')
      }
    >
      {activeGamut}
    </button>
  );
}

function ControlledContextProbe({
  onSnapshot,
}: {
  onSnapshot: (snapshot: {
    state: ColorState;
    storeState: ColorState;
    activeGamut: string;
    hex: string;
    requestedCss: string;
  }) => void;
}) {
  const context = useColorContext();
  onSnapshot({
    state: context.state,
    storeState: context.store.get(),
    activeGamut: context.activeGamut,
    hex: context.hex,
    requestedCss: context.requestedCss('hex'),
  });
  return null;
}

function CssCallbackProbe({
  onSnapshot,
}: {
  onSnapshot: (snapshot: {
    requestedCss: (format?: string) => string;
    displayedCss: (format?: string) => string;
  }) => void;
}) {
  const context = useColorContext();
  onSnapshot({
    requestedCss: context.requestedCss,
    displayedCss: context.displayedCss,
  });
  return (
    <button
      type="button"
      onClick={() =>
        context.setActiveView(
          context.activeView === 'oklch' ? 'rgb' : 'oklch',
        )
      }
    >
      Toggle view
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
    expect(() => render(<ColorInput model="oklch" channel="h" />)).toThrowError(
      /ColorInput requires either/,
    );
    expect(() => render(<ColorStringInput />)).toThrowError(
      /ColorStringInput requires either/,
    );
  });

  it('renders context-driven primitives from Color without standalone props', () => {
    render(
      <Color defaultColor={OUT_OF_GAMUT_REQUESTED}>
        <ColorArea />
        <ColorSlider channel="c" />
        <ColorSlider channel="h" />
        <ColorSlider channel="alpha" />
        <ColorInput model="oklch" channel="h" />
        <ColorStringInput />
      </Color>,
    );

    expect(screen.getAllByRole('slider')).toHaveLength(4);
    expect(screen.getByRole('spinbutton')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('keeps useColorContext snapshots reactive to store updates', () => {
    render(
      <Color>
        <GamutContextProbe />
      </Color>,
    );

    const toggle = screen.getByRole('button', { name: 'display-p3' });
    fireEvent.click(toggle);
    expect(toggle.textContent).toBe('srgb');

    fireEvent.click(toggle);
    expect(toggle.textContent).toBe('display-p3');
  });

  it('keeps context CSS callbacks stable across unrelated state updates', () => {
    const onSnapshot = vi.fn();
    render(
      <Color>
        <CssCallbackProbe onSnapshot={onSnapshot} />
      </Color>,
    );

    const first = onSnapshot.mock.calls.at(-1)?.[0];
    fireEvent.click(screen.getByRole('button', { name: 'Toggle view' }));
    const second = onSnapshot.mock.calls.at(-1)?.[0];

    expect(second.requestedCss).toBe(first.requestedCss);
    expect(second.displayedCss).toBe(first.displayedCss);
  });

  it('reads controlled context snapshots on the first render of each state', () => {
    const onSnapshot = vi.fn();
    const first = createColorState(fromHex('#ff0000'), {
      activeGamut: 'srgb',
    });
    const second = createColorState(fromHex('#00ff00'), {
      activeGamut: 'display-p3',
    });
    const { rerender } = render(
      <Color state={first}>
        <ControlledContextProbe onSnapshot={onSnapshot} />
      </Color>,
    );

    expect(onSnapshot.mock.calls[0]?.[0]).toMatchObject({
      state: first,
      storeState: first,
      activeGamut: 'srgb',
      hex: '#ff0000',
      requestedCss: '#ff0000',
    });

    const callsBeforeRerender = onSnapshot.mock.calls.length;
    rerender(
      <Color state={second}>
        <ControlledContextProbe onSnapshot={onSnapshot} />
      </Color>,
    );

    expect(onSnapshot.mock.calls[callsBeforeRerender]?.[0]).toMatchObject({
      state: second,
      storeState: second,
      activeGamut: 'display-p3',
      hex: '#00ff00',
      requestedCss: '#00ff00',
    });
  });

  it('keeps ColorArea thumb coordinates stable across active gamut switches', () => {
    const { container } = render(
      <Color defaultColor={OUT_OF_GAMUT_REQUESTED}>
        <ColorArea />
        <GamutToggle />
      </Color>,
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
      <Color defaultColor={OUT_OF_GAMUT_REQUESTED}>
        <ColorSlider channel="c" />
        <GamutToggle />
      </Color>,
    );

    const thumb = container.querySelector('[data-color-slider-thumb]');
    expect(thumb).toBeTruthy();
    const before = thumb?.getAttribute('data-value');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle gamut' }));

    const after = thumb?.getAttribute('data-value');
    expect(after).toBe(before);
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
