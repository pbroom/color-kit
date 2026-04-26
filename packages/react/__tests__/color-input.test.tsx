// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { parse } from '@color-kit/core';
import { useState } from 'react';
import { ColorInput } from '../src/color-input.js';

function setPointerLockElement(element: Element | null): void {
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    value: element,
  });
}

afterEach(() => {
  cleanup();
  setPointerLockElement(null);
});

describe('ColorInput', () => {
  async function flushAnimationFrames(count: number = 1): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
  }

  function firePointerEvent(
    target: Element,
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    init: {
      pointerId: number;
      clientX: number;
      button?: number;
      shiftKey?: boolean;
      altKey?: boolean;
    },
  ): void {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      pointerId: { value: init.pointerId },
      clientX: { value: init.clientX },
      button: { value: init.button ?? 0 },
      shiftKey: { value: init.shiftKey ?? false },
      altKey: { value: init.altKey ?? false },
    });
    fireEvent(target, event);
  }

  function fireDocumentMouseMove(init: {
    movementX: number;
    shiftKey?: boolean;
    altKey?: boolean;
  }): void {
    const event = new Event('mousemove', { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      movementX: { value: init.movementX },
      shiftKey: { value: init.shiftKey ?? false },
      altKey: { value: init.altKey ?? false },
    });
    document.dispatchEvent(event);
  }

  it('commits valid text input exactly once on Enter', () => {
    const onChangeRequested = vi.fn();

    render(
      <ColorInput
        model="oklch"
        channel="c"
        requested={parse('#ff0000')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByRole('spinbutton');
    input.focus();
    fireEvent.change(input, { target: { value: '0.25' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
    const [next, options] = onChangeRequested.mock.calls[0];
    expect(next.c).toBeCloseTo(0.25, 6);
    expect(options).toEqual({ changedChannel: 'c', interaction: 'text-input' });
  });

  it('does not commit when focus/blur occurs without draft changes', () => {
    const onChangeRequested = vi.fn();

    render(
      <ColorInput
        model="oklch"
        channel="h"
        requested={parse('oklch(0.6 0.2 100)')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByRole('spinbutton');
    input.focus();
    fireEvent.blur(input);

    expect(onChangeRequested).not.toHaveBeenCalled();
  });

  it('does not double-commit after keyboard stepping followed by blur', () => {
    const onChangeRequested = vi.fn();

    render(
      <ColorInput
        model="oklch"
        channel="h"
        requested={parse('oklch(0.6 0.2 100)')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByRole('spinbutton');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.blur(input);

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
    const [, options] = onChangeRequested.mock.calls[0];
    expect(options).toEqual({ changedChannel: 'h', interaction: 'keyboard' });
  });

  it('reverts invalid commits without mutating requested state', () => {
    const onChangeRequested = vi.fn();
    const onInvalidCommit = vi.fn();

    render(
      <ColorInput
        model="oklch"
        channel="c"
        requested={parse('#0ea5e9')}
        onChangeRequested={onChangeRequested}
        onInvalidCommit={onInvalidCommit}
      />,
    );

    const input = screen.getByRole('spinbutton');
    const initial = (input as HTMLInputElement).value;
    input.focus();
    fireEvent.change(input, { target: { value: 'invalid' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChangeRequested).not.toHaveBeenCalled();
    expect(onInvalidCommit).toHaveBeenCalledTimes(1);
    expect((input as HTMLInputElement).value).toBe(initial);
  });

  it('does not commit when pressing Escape', () => {
    const onChangeRequested = vi.fn();

    render(
      <ColorInput
        model="oklch"
        channel="c"
        requested={parse('#ff0000')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0.3' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChangeRequested).not.toHaveBeenCalled();
  });

  it('supports keyboard stepping and omits changedChannel metadata for hsl model', () => {
    const onChangeRequested = vi.fn();
    render(
      <ColorInput
        model="hsl"
        channel="s"
        requested={parse('#336699')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true });

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
    const [, options] = onChangeRequested.mock.calls[0];
    expect(options).toEqual({ interaction: 'keyboard' });
  });

  it('parses relative math expressions against the focus-start value', () => {
    const onChangeRequested = vi.fn();
    render(
      <ColorInput
        model="oklch"
        channel="h"
        requested={parse('oklch(0.6 0.2 100)')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '+10' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const [next] = onChangeRequested.mock.calls[0];
    expect(next.h).toBeCloseTo(110, 4);
  });

  it('selects all text on focus when selectAllOnFocus is enabled', async () => {
    render(
      <ColorInput
        model="oklch"
        channel="c"
        requested={parse('#ff0000')}
        onChangeRequested={() => {}}
      />,
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    const selectSpy = vi.spyOn(input, 'select');
    fireEvent.focus(input);
    await flushAnimationFrames(1);

    expect(selectSpy).toHaveBeenCalled();
    selectSpy.mockRestore();
  });

  it('supports left-edge scrub dragging with pointer interaction metadata', async () => {
    const onChangeRequested = vi.fn();
    const { container } = render(
      <ColorInput
        model="oklch"
        channel="c"
        requested={parse('oklch(0.6 0.2 160)')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const handle = container.querySelector(
      '[data-color-input-scrub-handle]',
    ) as HTMLDivElement;
    const root = container.querySelector(
      '[data-color-input]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    firePointerEvent(handle, 'pointerdown', {
      pointerId: 7,
      button: 0,
      clientX: 0,
    });

    expect(root.hasAttribute('data-scrubbing')).toBe(false);

    firePointerEvent(handle, 'pointermove', {
      pointerId: 7,
      clientX: 18,
    });

    await flushAnimationFrames(2);

    expect(root.hasAttribute('data-scrubbing')).toBe(true);

    firePointerEvent(handle, 'pointerup', {
      pointerId: 7,
      clientX: 18,
    });

    expect(onChangeRequested).toHaveBeenCalled();
    const [, options] =
      onChangeRequested.mock.calls[onChangeRequested.mock.calls.length - 1];
    expect(options).toEqual({ changedChannel: 'c', interaction: 'pointer' });
  });

  it('does not enter scrubbing state for a press without drag movement', async () => {
    const onChangeRequested = vi.fn();
    const { container } = render(
      <ColorInput
        model="oklch"
        channel="c"
        requested={parse('oklch(0.6 0.2 160)')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const root = container.querySelector(
      '[data-color-input]',
    ) as HTMLDivElement;
    const handle = container.querySelector(
      '[data-color-input-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    firePointerEvent(handle, 'pointerdown', {
      pointerId: 9,
      button: 0,
      clientX: 0,
    });
    firePointerEvent(handle, 'pointerup', {
      pointerId: 9,
      clientX: 0,
    });

    await flushAnimationFrames(1);

    expect(root.hasAttribute('data-scrubbing')).toBe(false);
    expect(onChangeRequested).not.toHaveBeenCalled();
  });

  it('continues scrubbing with pointer-lock relative movement', async () => {
    const onChangeRequested = vi.fn();
    const { container } = render(
      <ColorInput
        model="oklch"
        channel="c"
        requested={parse('oklch(0.6 0.2 160)')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const root = container.querySelector(
      '[data-color-input]',
    ) as HTMLDivElement;
    const handle = container.querySelector(
      '[data-color-input-scrub-handle]',
    ) as HTMLDivElement;
    const exitPointerLock = vi.fn(() => {
      setPointerLockElement(null);
      document.dispatchEvent(new Event('pointerlockchange'));
    });
    Object.defineProperty(document, 'exitPointerLock', {
      configurable: true,
      value: exitPointerLock,
    });
    handle.setPointerCapture = vi.fn();
    handle.requestPointerLock = vi.fn(() => {
      setPointerLockElement(handle);
      document.dispatchEvent(new Event('pointerlockchange'));
    }) as HTMLDivElement['requestPointerLock'];

    firePointerEvent(handle, 'pointerdown', {
      pointerId: 11,
      button: 0,
      clientX: 40,
    });
    fireDocumentMouseMove({ movementX: 18 });

    await flushAnimationFrames(2);

    expect(root.hasAttribute('data-scrubbing')).toBe(true);
    expect(onChangeRequested).toHaveBeenCalled();

    firePointerEvent(handle, 'pointerup', {
      pointerId: 11,
      clientX: 40,
    });

    const [next] =
      onChangeRequested.mock.calls[onChangeRequested.mock.calls.length - 1];
    expect(next.c).toBeCloseTo(0.215, 3);
    expect(exitPointerLock).toHaveBeenCalled();
  });

  it('does not keep unfocused scrub input in editing mode after external updates', async () => {
    function ControlledInput() {
      const [requested, setRequested] = useState(parse('oklch(0.6 0.2 160)'));

      return (
        <>
          <ColorInput
            model="oklch"
            channel="c"
            requested={requested}
            onChangeRequested={setRequested}
          />
          <button
            type="button"
            onClick={() => setRequested(parse('oklch(0.6 0.35 160)'))}
          >
            External update
          </button>
        </>
      );
    }

    const { container } = render(<ControlledInput />);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    const handle = container.querySelector(
      '[data-color-input-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    expect(document.activeElement).not.toBe(input);

    firePointerEvent(handle, 'pointerdown', {
      pointerId: 12,
      button: 0,
      clientX: 0,
    });
    firePointerEvent(handle, 'pointermove', {
      pointerId: 12,
      clientX: 18,
    });

    await flushAnimationFrames(2);

    firePointerEvent(handle, 'pointerup', {
      pointerId: 12,
      clientX: 18,
    });

    await flushAnimationFrames(1);

    fireEvent.click(screen.getByRole('button', { name: 'External update' }));

    expect(Number(input.value)).toBeCloseTo(0.35, 3);
  });

  it('preserves full text selection while scrub dragging', async () => {
    const { container } = render(
      <ColorInput
        model="oklch"
        channel="c"
        requested={parse('oklch(0.6 0.2 160)')}
        onChangeRequested={() => {}}
      />,
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    const handle = container.querySelector(
      '[data-color-input-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    input.focus();
    await flushAnimationFrames(1);
    input.setSelectionRange(0, input.value.length);

    firePointerEvent(handle, 'pointerdown', {
      pointerId: 13,
      button: 0,
      clientX: 0,
    });
    firePointerEvent(handle, 'pointermove', {
      pointerId: 13,
      clientX: 18,
    });

    await flushAnimationFrames(2);

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);

    firePointerEvent(handle, 'pointerup', {
      pointerId: 13,
      clientX: 18,
    });
    await flushAnimationFrames(1);

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('preserves the text caret while scrub dragging', async () => {
    const { container } = render(
      <ColorInput
        model="oklch"
        channel="c"
        requested={parse('oklch(0.6 0.2 160)')}
        onChangeRequested={() => {}}
      />,
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    const handle = container.querySelector(
      '[data-color-input-scrub-handle]',
    ) as HTMLDivElement;
    handle.setPointerCapture = vi.fn();

    input.focus();
    await flushAnimationFrames(1);
    input.setSelectionRange(1, 1);

    firePointerEvent(handle, 'pointerdown', {
      pointerId: 15,
      button: 0,
      clientX: 0,
    });
    firePointerEvent(handle, 'pointermove', {
      pointerId: 15,
      clientX: 18,
    });

    await flushAnimationFrames(2);

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);

    firePointerEvent(handle, 'pointerup', {
      pointerId: 15,
      clientX: 18,
    });
    await flushAnimationFrames(1);

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);
  });

  it('exposes spinbutton aria and data attributes', () => {
    const { container } = render(
      <ColorInput
        model="rgb"
        channel="r"
        requested={parse('#112233')}
        onChangeRequested={() => {}}
      />,
    );

    const root = container.querySelector('[data-color-input]');
    const input = screen.getByRole('spinbutton');

    expect(root?.getAttribute('data-model')).toBe('rgb');
    expect(root?.getAttribute('data-channel')).toBe('r');
    expect(root?.hasAttribute('data-valid')).toBe(true);
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('255');
    expect(Number(input.getAttribute('aria-valuenow'))).toBeCloseTo(17, 3);
  });
});
