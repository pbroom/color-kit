// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { parse } from '@color-kit/core';
import { ColorProvider } from '../src/color-provider.js';
import { SwatchGroup } from '../src/swatch-group.js';

afterEach(() => {
  cleanup();
});

describe('SwatchGroup', () => {
  it('marks the context color as selected when value prop is omitted', () => {
    const colors = [parse('#ff0000'), parse('#00ff00')];

    render(
      <ColorProvider defaultColor="#00ff00">
        <SwatchGroup colors={colors} />
      </ColorProvider>,
    );

    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(2);
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
  });
});
