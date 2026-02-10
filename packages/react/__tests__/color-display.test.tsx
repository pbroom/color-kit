// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ColorDisplay } from '../src/color-display.js';

afterEach(() => {
  cleanup();
});

describe('ColorDisplay', () => {
  it('uses p3-first rendering while keeping an sRGB fallback color', () => {
    const requested = { l: 0.8, c: 0.4, h: 145, alpha: 1 };
    const { getByRole } = render(<ColorDisplay requested={requested} />);

    const node = getByRole('img');
    expect(node.getAttribute('data-gamut')).toBe('display-p3');
    expect(node.getAttribute('data-out-of-gamut')).toBe('true');
    expect(node.getAttribute('style')).toContain('background: color(display-p3');
  });

  it('renders without p3 background override when gamut=srgb', () => {
    const requested = { l: 0.8, c: 0.4, h: 145, alpha: 1 };
    const { getByRole } = render(
      <ColorDisplay requested={requested} gamut="srgb" />,
    );

    const node = getByRole('img');
    expect(node.getAttribute('data-gamut')).toBe('srgb');
    expect(node.getAttribute('style')).not.toContain('background: color(display-p3');
  });
});
