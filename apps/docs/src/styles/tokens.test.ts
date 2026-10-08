import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from 'color-kit';
import {
  CONTRAST_PAIRS,
  GRAY_LIGHTNESS,
  renderTokensCss,
  resolveToken,
  type ThemeName,
} from './tokens';

const THEMES: ThemeName[] = ['light', 'dark'];

describe('design tokens', () => {
  it('tokens.css is generated from tokens.ts', () => {
    const onDisk = readFileSync(
      new URL('./tokens.css', import.meta.url),
      'utf8',
    );
    expect(onDisk).toBe(renderTokensCss());
  });

  it.each(THEMES)('the %s gray ramp is achromatic and monotonic', (theme) => {
    const ramp = GRAY_LIGHTNESS[theme];
    expect(ramp).toHaveLength(13);
    for (let step = 1; step < ramp.length; step += 1) {
      const delta = ramp[step]! - ramp[step - 1]!;
      expect(theme === 'light' ? delta < 0 : delta > 0).toBe(true);
    }
    for (let step = 0; step < ramp.length; step += 1) {
      expect(resolveToken(`--gray-${step}`, theme).c).toBe(0);
    }
  });

  for (const theme of THEMES) {
    describe(`${theme} contrast`, () => {
      it.each(CONTRAST_PAIRS)('$fg on $bg meets $min:1', ({ fg, bg, min }) => {
        const ratio = contrastRatio(
          resolveToken(fg, theme),
          resolveToken(bg, theme),
        );
        expect(ratio).toBeGreaterThanOrEqual(min);
      });
    });
  }
});
