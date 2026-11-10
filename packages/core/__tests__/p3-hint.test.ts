import { describe, expect, it } from 'vitest';
import {
  definePlane,
  generateScale,
  interpolate,
  interpolateInto,
  maxChromaAt,
  mix,
  mixInto,
  parse,
  toCss,
  type Color,
} from '../src/index.js';
import { packColors, unpackColors } from '../src/interop/index.js';
import { displayP3 } from '../src/index.js';

const HINT = "use 'display-p3'";
const EXACT_HINT = "'p3' is not supported; use 'display-p3'";

const a = parse('#3b82f6');
const b = parse('#ef4444');
const out: Color = { l: 0, c: 0, h: 0, alpha: 1 };

// Every public entry point that takes a space, model or format must
// reject the removed `'p3'` spelling with a TypeError that points at
// `'display-p3'`.
const ENTRY_POINTS: ReadonlyArray<readonly [string, () => unknown]> = [
  // format
  ['toCss format', () => toCss(a, 'p3' as never)],
  // interpolation space
  ['mix', () => mix(a, b, 0.5, { space: 'p3' as never })],
  ['mixInto', () => mixInto(out, a, b, 0.5, { space: 'p3' as never })],
  ['interpolate', () => interpolate(a, b, 0.5, { space: 'p3' as never })],
  [
    'interpolateInto',
    () => interpolateInto(out, a, b, 0.5, { space: 'p3' as never }),
  ],
  ['generateScale', () => generateScale(a, b, 4, { space: 'p3' as never })],
  // plane model
  ['definePlane model', () => definePlane({ model: 'p3' as never })],
  // array interop space
  ['packColors', () => packColors([a], 'p3' as never)],
  ['unpackColors', () => unpackColors(new Float32Array(3), 'p3' as never)],
];

describe("the removed 'p3' spelling", () => {
  it.each(ENTRY_POINTS)('%s throws a TypeError with the hint', (_name, run) => {
    expect(run).toThrow(TypeError);
    expect(run).toThrow(HINT);
    expect(run).toThrow(EXACT_HINT);
  });

  // The exact-endpoint shortcut must not skip space validation.
  it.each([
    ['mix t=0', () => mix(a, b, 0, { space: 'p3' as never })],
    ['mix t=1', () => mix(a, b, 1, { space: 'p3' as never })],
    ['mixInto t=0', () => mixInto(out, a, b, 0, { space: 'p3' as never })],
    ['interpolate t=1', () => interpolate(a, b, 1, { space: 'p3' as never })],
    [
      'interpolateInto t=0',
      () => interpolateInto(out, a, b, 0, { space: 'p3' as never }),
    ],
    [
      'generateScale endpoints only',
      () => generateScale(a, b, 2, { space: 'p3' as never }),
    ],
  ] as const)('%s throws a TypeError with the hint', (_name, run) => {
    expect(run).toThrow(TypeError);
    expect(run).toThrow(EXACT_HINT);
  });

  it("keeps accepting 'display-p3' everywhere 'p3' is rejected", () => {
    expect(toCss(a, 'display-p3')).toMatch(/^color\(display-p3 /);
    expect(mix(a, b, 0.5, { space: 'display-p3' })).toBeDefined();
    expect(definePlane({ model: 'display-p3' }).model).toBe('display-p3');
    expect(packColors([a], 'linearP3')).toHaveLength(3);
    expect(maxChromaAt(0.5, 200, { gamut: displayP3 })).toBeGreaterThan(0);
  });
});
