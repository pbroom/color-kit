// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { fromHex, type Color, type CssColorFormat } from '@color-kit/core';
import { createColorState, type ColorState } from '@color-kit/driver';
import { Color } from '../src/color.js';
import { useColorContext } from '../src/context.js';
import { useColorPlaneRenderer } from '../src/use-color-plane-renderer.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
    requestedCss: (format?: CssColorFormat) => string;
    displayedCss: (format?: CssColorFormat) => string;
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
        context.setActiveView(context.activeView === 'oklch' ? 'rgb' : 'oklch')
      }
    >
      Toggle view
    </button>
  );
}

function PlaneCanvas() {
  const { requested } = useColorContext();
  const { ref, canvasKey } = useColorPlaneRenderer(
    { color: requested },
    { renderer: 'cpu' },
  );
  return <canvas ref={ref} key={canvasKey} />;
}

describe('Color provider contracts', () => {
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

  it("paints the plane in the provider's active gamut by default", async () => {
    const drawn: Uint8ClampedArray[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function getContext(kind: string) {
        if (kind !== '2d') return null;
        return {
          createImageData: (width: number, height: number) => ({
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height,
          }),
          putImageData: (image: ImageData) => {
            drawn.push(new Uint8ClampedArray(image.data));
          },
        } as unknown as RenderingContext;
      } as HTMLCanvasElement['getContext'],
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: 0,
      top: 0,
      width: 24,
      height: 24,
      right: 24,
      bottom: 24,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    render(
      <Color defaultColor={OUT_OF_GAMUT_REQUESTED}>
        <PlaneCanvas />
        <GamutToggle />
      </Color>,
    );
    await waitFor(() => expect(drawn).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Toggle gamut' }));
    await waitFor(() => expect(drawn).toHaveLength(2));
    // sRGB mapping clamps more of the plane than Display P3 does.
    expect(drawn[1]).not.toEqual(drawn[0]);
  });
});
