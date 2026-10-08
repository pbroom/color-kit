/**
 * A color picker with no framework: color-kit/driver supplies the state,
 * geometry, keyboard model and drag throttling; this file only touches the
 * DOM. Any binding (React, Vue, Svelte, web components) can wrap it.
 */
import { toRgbInto, toSrgbGamutInto, type Color, type Rgb } from 'color-kit';
import {
  colorFromColorAreaKey,
  colorFromColorAreaPosition,
  colorFromColorSliderKey,
  colorFromColorSliderPosition,
  createColorState,
  createPointerDragController,
  getColorAreaThumbPosition,
  getColorAreaValueText,
  getColorDisplayStyles,
  getColorSliderThumbPosition,
  getColorSliderValueText,
  getSliderGradientStyles,
  normalizeColorAreaPointer,
  normalizeColorSliderPointer,
  resolveColorAreaAxes,
  setColorRequested,
  type ColorState,
} from 'color-kit/driver';

export interface PickerElements {
  /** 2D area: lightness on x, chroma on y. Contains `canvas` and `thumb`. */
  area: HTMLElement;
  canvas: HTMLCanvasElement;
  thumb: HTMLElement;
  /** Hue rail and its thumb. */
  hue: HTMLElement;
  hueThumb: HTMLElement;
  swatch: HTMLElement;
}

const axes = resolveColorAreaAxes(); // x: l [0, 1], y: c [0, 0.4]
const HUE: [number, number] = [0, 360];

export function bindPicker(
  el: PickerElements,
  initial: Color,
  onChange?: (state: ColorState) => void,
): () => void {
  let state = createColorState(initial);
  let paintedHue = Number.NaN;

  const commit = (next: Color) => {
    const updated = setColorRequested(state, next, 'user');
    if (updated === state) return; // reducers return the same object on a no-op
    state = updated;
    render();
    onChange?.(state);
  };

  // Paint the plane at the current hue, mapped into sRGB pixel by pixel.
  const pixel: Color = { l: 0, c: 0, h: 0, alpha: 1 };
  const rgb: Rgb = { r: 0, g: 0, b: 0, alpha: 1 };
  function paintPlane(hue: number) {
    const { width, height } = el.canvas;
    const ctx = el.canvas.getContext('2d');
    if (!ctx) return;
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = colorFromColorAreaPosition(
          { l: 0, c: 0, h: hue, alpha: 1 },
          axes,
          x / (width - 1),
          y / (height - 1),
        );
        toRgbInto(rgb, toSrgbGamutInto(pixel, color));
        const i = (y * width + x) * 4;
        image.data[i] = rgb.r;
        image.data[i + 1] = rgb.g;
        image.data[i + 2] = rgb.b;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    paintedHue = hue;
  }

  function render() {
    const { requested, displayed, activeGamut } = state;
    const { x, y } = getColorAreaThumbPosition(requested, axes);
    el.thumb.style.left = `${x * 100}%`;
    el.thumb.style.top = `${y * 100}%`;
    el.thumb.setAttribute(
      'aria-valuetext',
      getColorAreaValueText(requested, axes),
    );

    const hue = getColorSliderThumbPosition(requested, 'h', HUE);
    el.hueThumb.style.left = `${hue * 100}%`;
    el.hue.setAttribute('aria-valuenow', String(Math.round(requested.h)));
    el.hue.setAttribute(
      'aria-valuetext',
      getColorSliderValueText('h', requested.h),
    );

    // Display P3 where supported, with an sRGB fallback underneath.
    Object.assign(
      el.swatch.style,
      getColorDisplayStyles(displayed.p3, displayed.srgb, activeGamut),
    );
    if (requested.h !== paintedHue) paintPlane(requested.h);
  }

  // Pointer moves are coalesced to one commit per frame.
  const areaDrag = createPointerDragController<PointerEvent>({
    normalize: (e) =>
      normalizeColorAreaPointer(
        e.clientX,
        e.clientY,
        el.area.getBoundingClientRect(),
      ),
    commit: ({ x, y }) =>
      commit(colorFromColorAreaPosition(state.requested, axes, x, y)),
  });
  const hueDrag = createPointerDragController<PointerEvent>({
    normalize: (e) => {
      const rect = el.hue.getBoundingClientRect();
      return {
        x: normalizeColorSliderPointer(
          'horizontal',
          e.clientX,
          rect.left,
          rect.width,
        ),
        y: 0,
      };
    },
    commit: ({ x }) =>
      commit(colorFromColorSliderPosition(state.requested, 'h', x, HUE)),
  });

  // One AbortController removes every listener on cleanup.
  const listeners = new AbortController();
  const on = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (e: HTMLElementEventMap[K]) => void,
  ) => target.addEventListener(type, handler, { signal: listeners.signal });

  for (const [target, drag] of [
    [el.area, areaDrag],
    [el.hue, hueDrag],
  ] as const) {
    on(target, 'pointerdown', (e) => {
      target.setPointerCapture(e.pointerId);
      drag.start(e);
    });
    on(target, 'pointermove', (e) => {
      if (drag.isActive()) drag.move(e);
    });
    on(target, 'pointerup', () => drag.end());
    on(target, 'pointercancel', () => drag.cancel());
  }

  // Arrow keys step 1% of the range, Shift steps 10%.
  on(el.thumb, 'keydown', (e) => {
    const next = colorFromColorAreaKey(
      state.requested,
      axes,
      e.key,
      e.shiftKey ? 0.1 : 0.01,
    );
    if (next) {
      e.preventDefault();
      commit(next);
    }
  });
  on(el.hue, 'keydown', (e) => {
    const next = colorFromColorSliderKey(
      state.requested,
      'h',
      e.key,
      e.shiftKey ? 0.1 : 0.01,
      HUE,
    );
    if (next) {
      e.preventDefault();
      commit(next);
    }
  });

  el.hue.style.background = getSliderGradientStyles({
    model: 'oklch',
    channel: 'h',
    baseColor: state.requested,
    range: HUE,
    colorSpace: 'srgb',
  }).activeBackgroundImage;
  render();

  return () => {
    areaDrag.cancel();
    hueDrag.cancel();
    listeners.abort();
  };
}
