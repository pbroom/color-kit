import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parse } from 'color-kit';
import {
  CONTRAST_PAIRS,
  GRAY_LIGHTNESS,
  renderTokensCss,
  resolveToken,
  type ThemeName,
} from './tokens';

const THEMES: ThemeName[] = ['light', 'dark'];
const EMITTED_CSS = readFileSync(
  new URL('./tokens.css', import.meta.url),
  'utf8',
);

/** Read one rule from this generated stylesheet, preserving serialized colors. */
function declarations(css: string, selector: string): Record<string, string> {
  const body = css.split(`${selector} {`)[1]?.split('}')[0] ?? '';
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
      match[1]!,
      match[2]!.trim(),
    ]),
  );
}

function emittedColors(theme: ThemeName, gamut: 'srgb' | 'display-p3') {
  const [base, overrides = ''] = EMITTED_CSS.split(
    '@media (color-gamut: p3) {',
  );
  const p3 = gamut === 'display-p3' ? overrides : '';
  // Explicit dark selectors outrank :root, including the light P3 overrides.
  const values = {
    ...declarations(base!, ':root'),
    ...declarations(p3, ':root'),
    ...(theme === 'dark'
      ? {
          ...declarations(base!, ":root[data-theme='dark']"),
          ...declarations(p3, ":root[data-theme='dark']"),
        }
      : {}),
  };
  return (name: string) => {
    let value = values[name];
    const seen = new Set<string>();
    while (value?.startsWith('var(')) {
      if (seen.has(value)) throw new Error(`Circular token ${name}`);
      seen.add(value);
      value = values[value.slice(4, -1)];
    }
    if (!value) throw new Error(`Missing emitted color ${name}`);
    return parse(value);
  };
}

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
    for (const gamut of ['srgb', 'display-p3'] as const) {
      describe(`${theme} ${gamut} emitted contrast`, () => {
        const resolve = emittedColors(theme, gamut);
        it.each(CONTRAST_PAIRS)(
          '$fg on $bg meets $min:1',
          ({ fg, bg, min }) => {
            const ratio = contrastRatio(resolve(fg), resolve(bg), { gamut });
            expect(ratio).toBeGreaterThanOrEqual(min);
          },
        );
      });
    }
  }
});
