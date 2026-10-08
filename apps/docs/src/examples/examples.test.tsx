import type { ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { evalExample, formatResult } from '../../plugins/eval-example';
import initialFrame from '../components/hero/initial-frame.ts?build';
import { queryHue } from './plane/hero';
import { code as snippet } from './core/requested-and-displayed.ts?highlighted';
import planeSnippetHtml, {
  code as planeSnippet,
} from './plane/query-a-plane.ts?highlighted';

const components = import.meta.glob<{ default?: ComponentType }>(
  ['./**/*.tsx', '!./**/*.test.tsx', '!./**/index.tsx'],
  { eager: true },
);

// Live examples default-export their component; helpers have no default.
const examples = Object.entries(components).filter(
  ([, module]) => module.default,
);

describe('live examples', () => {
  it('finds the examples', () => {
    expect(examples.length).toBeGreaterThanOrEqual(4);
  });

  it.each(examples)('%s prerenders without a window', (_, module) => {
    const Live = module.default!;
    expect(() => renderToString(<Live />)).not.toThrow();
  });
});

describe('`// →` results', () => {
  it('fills every marker in a ?highlighted import', () => {
    expect(snippet).not.toMatch(/\/\/ →\s*$/m);
    expect(snippet).toContain('inSrgbGamut(requested); // → false');
    expect(snippet).toContain('inP3Gamut(requested); // → true');
    expect(snippet).toMatch(/toHex\(displayed\); \/\/ → '#[0-9a-f]{6}'/);
    expect(planeSnippet).toContain("srgb.viewportRelation; // → 'intersects'");
    expect(planeSnippetHtml).toContain('→');
  });

  it('moves long results below the statement', () => {
    expect(planeSnippet).toMatch(
      /reduce\(\(a, b\) => \(b\.c > a\.c \? b : a\)\);\n\/\/ → ≈ \{ l: /,
    );
  });

  it('runs snippets through a loader and rewrites the markers', async () => {
    const code = [
      "import { x } from './x';",
      'x + 1; // →',
      'const y = [1, 2]; // → stale',
      'y.length;',
      '// →',
    ].join('\n');
    const loader = async () => ({ __ckResults: [2, [1, 2], 2] });
    const output = await evalExample('/virtual/snippet.ts', code, loader);
    expect(output).toBe(
      [
        "import { x } from './x';",
        'x + 1; // → 2',
        'const y = [1, 2]; // → [1, 2]',
        'y.length;',
        '// → 2',
      ].join('\n'),
    );
  });

  it('rejects markers after statements that have no value', async () => {
    await expect(
      evalExample('/virtual/bad.ts', 'function f() {} // →', async () => ({
        __ckResults: [],
      })),
    ).rejects.toThrow(/must follow an expression statement/);
  });

  it('formats values as JS literals, rounding with ≈', () => {
    expect(formatResult('#fff')).toBe("'#fff'");
    expect(formatResult(0.5)).toBe('0.5');
    expect(formatResult(1 / 3)).toBe('≈ 0.3333');
    expect(formatResult({ l: 0.7, c: 0.15, h: 150, alpha: 1 })).toBe(
      '{ l: 0.7, c: 0.15, h: 150, alpha: 1 }',
    );
    expect(formatResult([1, 2, 3, 4, 5, 6, 7, 8])).toBe(
      '[1, 2, 3, 4, 5, 6, … 2 more]',
    );
    expect(formatResult(new Float32Array([0.5, 1]))).toBe(
      'Float32Array(2) [0.5, 1]',
    );
  });
});

describe('hero', () => {
  it('prerenders the same frame the client hydrates', () => {
    expect(initialFrame).toEqual(queryHue(264));
  });

  it('answers every query at the default hue', () => {
    const frame = queryHue(264);
    expect(frame.srgb).toMatch(/^M [\d.]+ [\d.]+ L .* Z$/);
    expect(frame.p3).toMatch(/^M /);
    expect(frame.onWhite.area).toMatch(/Z$/);
    expect(frame.onBlack.area).toMatch(/Z$/);
    expect(frame.p3Peak.c).toBeGreaterThan(frame.srgbPeak.c);
    expect(frame.onWhite.grayL).toBeGreaterThan(0.5);
    expect(frame.onBlack.grayL).toBeLessThan(0.6);
  });

  it.each([0, 90, 145, 200, 330])('stays well-formed at hue %i', (hue) => {
    const frame = queryHue(hue);
    expect(frame.srgb).not.toBe('');
    expect(frame.p3).not.toBe('');
    expect(frame.onWhite.line).not.toBe('');
    expect(frame.onBlack.line).not.toBe('');
  });
});
