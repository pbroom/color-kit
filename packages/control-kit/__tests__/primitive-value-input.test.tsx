// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultiInputControl } from '../src/multi-input-control.js';
import { PrimitiveValueInput } from '../src/primitive-value-input.js';

const noop = () => {};
const mountedRoots: Root[] = [];

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof globalThis.PointerEvent === 'undefined') {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }

  Object.defineProperty(globalThis, 'PointerEvent', {
    value: TestPointerEvent,
    configurable: true,
  });
}

function renderPrimitive(
  props: Partial<Parameters<typeof PrimitiveValueInput>[0]> = {},
) {
  return renderToStaticMarkup(
    <PrimitiveValueInput
      value={12}
      onValueChange={noop}
      min={0}
      max={100}
      wrapMode="clamp"
      step={1}
      fineStep={0.1}
      coarseStep={10}
      pageStep={10}
      precision={0}
      autoTrim
      allowExpressions
      selectAllOnFocus
      commitOnBlur
      scrubEnabled
      scrubThreshold={1}
      pointerLockEnabled={false}
      disabled={false}
      readOnly={false}
      visualState="auto"
      size="full"
      {...props}
    />,
  );
}

function mountPrimitive(
  props: Partial<Parameters<typeof PrimitiveValueInput>[0]> = {},
) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  act(() => {
    root.render(
      <PrimitiveValueInput
        value={42}
        onValueChange={noop}
        min={0}
        max={100}
        wrapMode="clamp"
        step={1}
        fineStep={0.1}
        coarseStep={10}
        pageStep={10}
        precision={0}
        autoTrim
        allowExpressions
        selectAllOnFocus
        commitOnBlur
        scrubEnabled
        scrubPixelsPerStep={1}
        scrubThreshold={1}
        pointerLockEnabled={false}
        disabled={false}
        readOnly={false}
        visualState="auto"
        size="full"
        {...props}
      />,
    );
  });

  return container;
}

function firePointerEvent(
  target: EventTarget,
  type:
    | 'pointerdown'
    | 'pointermove'
    | 'pointerup'
    | 'pointercancel'
    | 'lostpointercapture',
  init: {
    pointerId: number;
    clientX: number;
    button?: number;
    shiftKey?: boolean;
    altKey?: boolean;
  },
): void {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: init.pointerId,
    clientX: init.clientX,
    button: init.button ?? 0,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
  });
  target.dispatchEvent(event);
}

function changeInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('PrimitiveValueInput', () => {
  it('keeps explicit scrub handle content when the handle moves trailing', () => {
    const html = renderPrimitive({
      leadingElement: null,
      handleElement: 'V',
      handleSide: 'trailing',
    });

    expect(html).toContain('>V<');
  });

  it('renders trailing suffixes separately from explicit trailing handle content', () => {
    const html = renderPrimitive({
      handleElement: 'D',
      handleSide: 'trailing',
      trailingElement: 'px',
    });

    expect(html.indexOf('>px<')).toBeLessThan(html.indexOf('>D<'));
  });

  it('applies the resize cursor class on the scrub handle', () => {
    const html = renderPrimitive();

    expect(html).toContain('cursor-ew-resize');
  });

  it('uses a narrow leading scrub target when handle content is empty', () => {
    const html = renderPrimitive({
      leadingElement: null,
      handleElement: null,
      handleSide: 'leading',
    });

    expect(html).toContain('w-[5px]');
  });

  it('applies inset padding on the editable field', () => {
    const html = renderPrimitive();

    expect(html).toContain('pl-1');
  });

  it('commits valid text drafts on blur with text-input metadata', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({ onValueChange });
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.focus();
      changeInputValue(input, '25');
    });
    act(() => {
      input.blur();
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(25, {
      interaction: 'text-input',
    });
  });

  it('commits valid text drafts once on Enter and blurs', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({ onValueChange });
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.focus();
      changeInputValue(input, '25');
    });
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(25, {
      interaction: 'text-input',
    });
    expect(document.activeElement).not.toBe(input);
  });

  it('discards edited drafts on Escape without committing during blur', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({ onValueChange });
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.focus();
      changeInputValue(input, '25');
    });
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);
  });

  it('reverts invalid drafts and reports invalid commits', () => {
    const onValueChange = vi.fn();
    const onInvalidCommit = vi.fn();
    const container = mountPrimitive({ onValueChange, onInvalidCommit });
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.focus();
      changeInputValue(input, 'not a number');
    });
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(onInvalidCommit).toHaveBeenCalledWith('not a number');
    expect(input.value).toBe('42');
  });

  it('steps keyboard values with modifier-aware metadata', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({ onValueChange });
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(onValueChange).toHaveBeenLastCalledWith(52, {
      interaction: 'keyboard',
    });
  });

  it('lets horizontal arrows move the caret unless stepping is requested', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({ onValueChange });
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onValueChange).not.toHaveBeenCalled();

    const nextContainer = mountPrimitive({
      onValueChange,
      horizontalArrowKeysMoveCaret: false,
    });
    const nextInput = nextContainer.querySelector('input') as HTMLInputElement;
    act(() => {
      nextInput.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onValueChange).toHaveBeenLastCalledWith(43, {
      interaction: 'keyboard',
    });
  });

  it('wraps keyboard stepping across range boundaries', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({
      value: 95,
      onValueChange,
      max: 100,
      step: 10,
      wrapMode: 'wrap',
    });
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(onValueChange).toHaveBeenLastCalledWith(5, {
      interaction: 'keyboard',
    });
  });

  it('commits Home and End boundaries without wrapping', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({
      value: 95,
      onValueChange,
      max: 100,
      step: 10,
      wrapMode: 'wrap',
    });
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'End',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(onValueChange).toHaveBeenLastCalledWith(100, {
      interaction: 'keyboard',
    });
    act(() => {
      input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Home',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(onValueChange).toHaveBeenLastCalledWith(0, {
      interaction: 'keyboard',
    });
  });

  it('blocks keyboard and scrub commits when disabled or read-only', () => {
    const onValueChange = vi.fn();
    const disabledContainer = mountPrimitive({ onValueChange, disabled: true });
    const disabledInput = disabledContainer.querySelector(
      'input',
    ) as HTMLInputElement;
    const disabledHandle = disabledContainer.querySelector(
      '[data-control-kit-scrub-handle]',
    ) as HTMLDivElement;

    act(() => {
      disabledInput.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          bubbles: true,
          cancelable: true,
        }),
      );
      firePointerEvent(disabledHandle, 'pointerdown', {
        pointerId: 8,
        button: 0,
        clientX: 0,
      });
      firePointerEvent(document, 'pointermove', {
        pointerId: 8,
        clientX: 20,
      });
    });

    const readOnlyContainer = mountPrimitive({ onValueChange, readOnly: true });
    const readOnlyInput = readOnlyContainer.querySelector(
      'input',
    ) as HTMLInputElement;

    act(() => {
      readOnlyInput.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('tracks scrub dragging through document pointer events', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({ onValueChange });
    const handle = container.querySelector(
      '[data-control-kit-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    act(() => {
      firePointerEvent(handle, 'pointerdown', {
        pointerId: 1,
        button: 0,
        clientX: 0,
      });
    });
    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 1,
        clientX: 20,
      });
    });

    expect(onValueChange).toHaveBeenLastCalledWith(62, {
      interaction: 'pointer',
    });
  });

  it('supports discrete scrub stepping with stepDragDistance', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({
      onValueChange,
      step: 0.1,
      fineStep: 0.01,
      coarseStep: 1,
      precision: 2,
      stepDragDistance: 2,
    });
    const handle = container.querySelector(
      '[data-control-kit-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    act(() => {
      firePointerEvent(handle, 'pointerdown', {
        pointerId: 4,
        button: 0,
        clientX: 0,
      });
    });
    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 4,
        clientX: 1,
      });
    });
    expect(onValueChange).not.toHaveBeenCalled();

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 4,
        clientX: 2,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(42.1, {
      interaction: 'pointer',
    });

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 4,
        clientX: 3,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 4,
        clientX: 4,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(42.2, {
      interaction: 'pointer',
    });
  });

  it('does not skip steps for fractional stepDragDistance values', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({
      onValueChange,
      step: 0.1,
      fineStep: 0.01,
      coarseStep: 1,
      precision: 2,
      stepDragDistance: 1.5,
    });
    const handle = container.querySelector(
      '[data-control-kit-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    act(() => {
      firePointerEvent(handle, 'pointerdown', {
        pointerId: 5,
        button: 0,
        clientX: 0,
      });
    });
    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 5,
        clientX: 2.4,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(42.1, {
      interaction: 'pointer',
    });

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 5,
        clientX: 2.6,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 5,
        clientX: 3,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(42.2, {
      interaction: 'pointer',
    });
  });

  it('defers scrub commits until the max commit rate frame budget elapses', () => {
    const frameCallbacks = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      frameCallbacks.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      frameCallbacks.delete(frameId);
    });
    const flushFrame = (frameTime: number) => {
      const nextFrame = frameCallbacks.entries().next().value;
      expect(nextFrame).toBeDefined();
      const [frameId, callback] = nextFrame as [number, FrameRequestCallback];
      frameCallbacks.delete(frameId);
      act(() => {
        callback(frameTime);
      });
    };

    const onValueChange = vi.fn();
    const container = mountPrimitive({
      onValueChange,
      scrubMaxCommitRate: 10,
    });
    const handle = container.querySelector(
      '[data-control-kit-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    act(() => {
      firePointerEvent(handle, 'pointerdown', {
        pointerId: 8,
        button: 0,
        clientX: 0,
      });
    });
    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 8,
        clientX: 5,
      });
    });
    expect(onValueChange).not.toHaveBeenCalled();

    flushFrame(16);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(47, {
      interaction: 'pointer',
    });

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 8,
        clientX: 8,
      });
    });
    flushFrame(40);
    expect(onValueChange).toHaveBeenCalledTimes(1);

    flushFrame(116);
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(50, {
      interaction: 'pointer',
    });
  });

  it('forwards scrub commit thresholds through the component wrapper', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({
      onValueChange,
      scrubCommitThreshold: 5,
    });
    const handle = container.querySelector(
      '[data-control-kit-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    act(() => {
      firePointerEvent(handle, 'pointerdown', {
        pointerId: 6,
        button: 0,
        clientX: 0,
      });
    });
    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 6,
        clientX: 4,
      });
    });
    expect(onValueChange).not.toHaveBeenCalled();

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 6,
        clientX: 5,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(47, {
      interaction: 'pointer',
    });
  });

  it('commits the final scrub position when a thresholded scrub is canceled', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({
      onValueChange,
      scrubCommitThreshold: 5,
    });
    const handle = container.querySelector(
      '[data-control-kit-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    act(() => {
      firePointerEvent(handle, 'pointerdown', {
        pointerId: 7,
        button: 0,
        clientX: 0,
      });
    });
    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 7,
        clientX: 5,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(47, {
      interaction: 'pointer',
    });

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 7,
        clientX: 7,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);

    act(() => {
      firePointerEvent(document, 'pointercancel', {
        pointerId: 7,
        clientX: 7,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(49, {
      interaction: 'pointer',
    });
  });

  it('ends scrubbing when the handle loses pointer capture', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({
      onValueChange,
      scrubCommitThreshold: 5,
    });
    const handle = container.querySelector(
      '[data-control-kit-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    act(() => {
      firePointerEvent(handle, 'pointerdown', {
        pointerId: 9,
        button: 0,
        clientX: 0,
      });
    });
    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 9,
        clientX: 5,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(47, {
      interaction: 'pointer',
    });

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 9,
        clientX: 7,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);

    act(() => {
      firePointerEvent(handle, 'lostpointercapture', {
        pointerId: 9,
        clientX: 7,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(49, {
      interaction: 'pointer',
    });

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 9,
        clientX: 12,
      });
    });
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it('falls back to document dragging when pointer lock throws', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({
      onValueChange,
      pointerLockEnabled: true,
    });
    const handle = container.querySelector(
      '[data-control-kit-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();
    handle.requestPointerLock = vi.fn(() => {
      throw new Error('Pointer lock unavailable');
    }) as HTMLDivElement['requestPointerLock'];

    act(() => {
      firePointerEvent(handle, 'pointerdown', {
        pointerId: 2,
        button: 0,
        clientX: 0,
      });
    });
    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 2,
        clientX: 12,
      });
    });

    expect(onValueChange).toHaveBeenLastCalledWith(54, {
      interaction: 'pointer',
    });
  });

  it('rebases scrub movement at clamp boundaries', () => {
    const onValueChange = vi.fn();
    const container = mountPrimitive({
      value: 95,
      onValueChange,
      min: 0,
      max: 100,
      step: 1,
      wrapMode: 'clamp',
    });
    const handle = container.querySelector(
      '[data-control-kit-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    act(() => {
      firePointerEvent(handle, 'pointerdown', {
        pointerId: 3,
        button: 0,
        clientX: 0,
      });
    });
    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 3,
        clientX: 10,
      });
    });
    expect(onValueChange).toHaveBeenLastCalledWith(100, {
      interaction: 'pointer',
    });

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 3,
        clientX: 9,
      });
    });

    expect(onValueChange).toHaveBeenLastCalledWith(99, {
      interaction: 'pointer',
    });
  });
});

describe('MultiInputControl', () => {
  it('uses unit text as trailing scrub handle content', () => {
    const html = renderToStaticMarkup(
      <MultiInputControl
        values={{ a: 0.5 }}
        config={{
          a: {
            min: 0,
            max: 1,
            step: 0.01,
            fineStep: 0.001,
            coarseStep: 0.1,
            pageStep: 0.1,
            precision: 1,
            autoTrim: true,
            wrapMode: 'clamp',
            disabled: false,
          },
        }}
        fields={[
          {
            value: 'a',
            label: 'O',
            tooltip: 'Opacity',
            unit: '%',
          },
        ]}
        onFieldChange={noop}
      />,
    );

    expect(html).toContain('>%<');
  });
});
