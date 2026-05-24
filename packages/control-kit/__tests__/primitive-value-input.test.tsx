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
  type: 'pointerdown' | 'pointermove' | 'pointerup',
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

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
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

  it('applies the resize cursor directly on the scrub handle', () => {
    const html = renderPrimitive();

    expect(html).toContain('cursor:ew-resize');
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

    expect(onValueChange).toHaveBeenLastCalledWith(62);
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

    expect(onValueChange).toHaveBeenLastCalledWith(54);
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
    expect(onValueChange).toHaveBeenLastCalledWith(100);

    act(() => {
      firePointerEvent(document, 'pointermove', {
        pointerId: 3,
        clientX: 9,
      });
    });

    expect(onValueChange).toHaveBeenLastCalledWith(99);
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
