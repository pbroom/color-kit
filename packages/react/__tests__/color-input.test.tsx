// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { parse } from '@color-kit/core';
import { ColorInput } from '../src/color-input.js';

afterEach(() => {
  cleanup();
});

describe('ColorInput', () => {
  it('commits exactly once when pressing Enter', () => {
    const onChangeRequested = vi.fn();

    render(
      <ColorInput
        requested={parse('#ff0000')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByLabelText('Color value');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '#00ff00' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
  });

  it('does not commit when pressing Escape', () => {
    const onChangeRequested = vi.fn();

    render(
      <ColorInput
        requested={parse('#ff0000')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByLabelText('Color value');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '#00ff00' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChangeRequested).not.toHaveBeenCalled();
  });
});
