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
    const onChange = vi.fn();

    render(<ColorInput color={parse('#ff0000')} onChange={onChange} />);

    const input = screen.getByLabelText('Color value');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '#00ff00' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not commit when pressing Escape', () => {
    const onChange = vi.fn();

    render(<ColorInput color={parse('#ff0000')} onChange={onChange} />);

    const input = screen.getByLabelText('Color value');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '#00ff00' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
  });
});
