// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { parse } from '@color-kit/core';
import { ColorInput } from '../src/color-input.js';

afterEach(() => {
  cleanup();
});

describe('ColorInput', () => {
  async function flushAnimationFrames(count: number = 1): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
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
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0.25' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
    const [next, options] = onChangeRequested.mock.calls[0];
    expect(next.c).toBeCloseTo(0.25, 6);
    expect(options).toEqual({ changedChannel: 'c', interaction: 'text-input' });
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
    fireEvent.focus(input);
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
    handle.setPointerCapture = vi.fn();

    fireEvent.pointerDown(handle, {
      pointerId: 7,
      button: 0,
      clientX: 0,
    });

    fireEvent.pointerMove(handle, {
      pointerId: 7,
      clientX: 18,
    });

    await flushAnimationFrames(2);

    fireEvent.pointerUp(handle, {
      pointerId: 7,
      clientX: 18,
    });

    expect(onChangeRequested).toHaveBeenCalled();
    const [, options] =
      onChangeRequested.mock.calls[onChangeRequested.mock.calls.length - 1];
    expect(options).toEqual({ changedChannel: 'c', interaction: 'pointer' });
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
