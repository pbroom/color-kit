import { describe, expect, it } from 'vitest';
import keywords from 'colorjs.io/src/keywords.js';
import {
  namedColorHex,
  namedColorTable,
} from '../src/conversion/named-colors.js';

/** CSS Color 4 keywords as `rrggbb`, from colorjs.io's copy of the spec table. */
const SPEC = new Map(
  Object.entries(keywords as Record<string, [number, number, number]>).map(
    ([name, rgb]) => [
      name,
      rgb
        .map((c) =>
          Math.round(c * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join(''),
    ],
  ),
);

describe('packed named-color table', () => {
  it('reference list has the 148 CSS Color 4 keywords', () => {
    expect(SPEC.size).toBe(148);
  });

  it('decodes to exactly the CSS Color 4 keywords (gray spellings) plus transparent', () => {
    const expected = new Map(
      [...SPEC].filter(([name]) => !name.includes('grey')),
    );
    expected.set('transparent', '0000');
    expect(
      new Map([...namedColorTable()].sort(([a], [b]) => (a < b ? -1 : 1))),
    ).toEqual(new Map([...expected].sort(([a], [b]) => (a < b ? -1 : 1))));
  });

  it('resolves every spec keyword, including the grey spellings', () => {
    for (const [name, hex] of SPEC) {
      expect(namedColorHex(name), name).toBe(hex);
    }
    expect(namedColorHex('transparent')).toBe('0000');
  });

  it('rejects non-keywords, including Object.prototype names', () => {
    for (const name of [
      '',
      'grey1',
      'greygrey',
      'gre',
      'redd',
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
    ]) {
      expect(namedColorHex(name), name).toBeUndefined();
    }
  });
});
