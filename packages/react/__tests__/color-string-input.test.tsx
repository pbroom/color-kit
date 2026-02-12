// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { parse } from '@color-kit/core';
import { ColorStringInput } from '../src/color-string-input.js';

afterEach(() => {
  cleanup();
});

describe('ColorStringInput', () => {
  it('commits exactly once when pressing Enter', () => {
    const onChangeRequested = vi.fn();

    render(
      <ColorStringInput
        requested={parse('#ff0000')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '#00ff00' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChangeRequested).toHaveBeenCalledTimes(1);
  });

  it('does not commit when pressing Escape', () => {
    const onChangeRequested = vi.fn();

    render(
      <ColorStringInput
        requested={parse('#ff0000')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '#00ff00' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChangeRequested).not.toHaveBeenCalled();
  });

  it('calls onInvalidCommit for invalid values', () => {
    const onChangeRequested = vi.fn();
    const onInvalidCommit = vi.fn();

    render(
      <ColorStringInput
        requested={parse('#ff0000')}
        onChangeRequested={onChangeRequested}
        onInvalidCommit={onInvalidCommit}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'not-a-color' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChangeRequested).not.toHaveBeenCalled();
    expect(onInvalidCommit).toHaveBeenCalledWith('not-a-color');
  });
});
