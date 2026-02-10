// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Swatch } from '../src/swatch.js';

afterEach(() => {
  cleanup();
});

describe('Swatch', () => {
  it('is keyboard-selectable when interactive', () => {
    const onSelect = vi.fn();
    const color = { l: 0.6, c: 0.2, h: 210, alpha: 1 };
    const { getByRole } = render(<Swatch color={color} onSelect={onSelect} />);

    fireEvent.keyDown(getByRole('button'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(color);
  });

  it('exposes out-of-gamut metadata in display-p3 mode', () => {
    const color = { l: 0.8, c: 0.4, h: 145, alpha: 1 };
    const { getByRole } = render(<Swatch color={color} gamut="display-p3" />);

    const swatch = getByRole('img');
    expect(swatch.getAttribute('data-out-of-gamut')).toBe('true');
    expect(swatch.getAttribute('style')).toContain('background-image');
  });
});
