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

  it('does not commit when focus/blur occurs without edits', () => {
    const onChangeRequested = vi.fn();

    render(
      <ColorStringInput
        requested={parse('#ff0000')}
        onChangeRequested={onChangeRequested}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onChangeRequested).not.toHaveBeenCalled();
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

  it('renders a consumer aria-label once, on the input only', () => {
    const { container } = render(
      <ColorStringInput
        requested={parse('#ff0000')}
        onChangeRequested={vi.fn()}
        aria-label="Brand color"
      />,
    );

    expect(container.querySelectorAll('[aria-label]')).toHaveLength(1);
    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe(
      'Brand color',
    );
    expect(screen.getByRole('textbox', { name: 'Brand color' })).toBeTruthy();
  });

  it('keeps the default label and forwards aria-labelledby to the input', () => {
    const { container, rerender } = render(
      <ColorStringInput
        requested={parse('#ff0000')}
        onChangeRequested={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe(
      'Color value',
    );

    rerender(
      <>
        <span id="brand-label">Brand color</span>
        <ColorStringInput
          requested={parse('#ff0000')}
          onChangeRequested={vi.fn()}
          aria-labelledby="brand-label"
        />
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Brand color' });
    expect(input.getAttribute('aria-labelledby')).toBe('brand-label');
    expect(input.hasAttribute('aria-label')).toBe(false);
    expect(container.querySelectorAll('[aria-labelledby]')).toHaveLength(1);
  });
});
