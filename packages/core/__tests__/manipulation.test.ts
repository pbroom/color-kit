import { describe, it, expect } from 'vitest';
import {
  lighten,
  darken,
  saturate,
  desaturate,
  adjustHue,
  setAlpha,
  mix,
  invert,
  grayscale,
} from '../src/index.js';
import type { Color } from '../src/index.js';

const blue: Color = { l: 0.55, c: 0.2, h: 250, alpha: 1 };

describe('lighten()', () => {
  it('moves lightness toward 1 by a relative amount', () => {
    const result = lighten(blue, 0.5);
    expect(result.l).toBeCloseTo(0.55 + 0.5 * (1 - 0.55), 10);
  });

  it('reaches exactly 1 at amount 1', () => {
    expect(lighten(blue, 1).l).toBe(1);
  });

  it('is a no-op at amount 0', () => {
    expect(lighten(blue, 0)).toEqual(blue);
  });

  it('does not mutate the input color', () => {
    const input = { ...blue };
    lighten(input, 0.3);
    expect(input).toEqual(blue);
  });

  it('preserves chroma, hue, and alpha', () => {
    const result = lighten(blue, 0.3);
    expect(result.c).toBe(blue.c);
    expect(result.h).toBe(blue.h);
    expect(result.alpha).toBe(blue.alpha);
  });
});

describe('darken()', () => {
  it('moves lightness toward 0 by a relative amount', () => {
    const result = darken(blue, 0.5);
    expect(result.l).toBeCloseTo(0.55 - 0.5 * 0.55, 10);
  });

  it('reaches exactly 0 at amount 1', () => {
    expect(darken(blue, 1).l).toBe(0);
  });

  it('is a no-op at amount 0', () => {
    expect(darken(blue, 0)).toEqual(blue);
  });

  it('inverts lighten at the extremes of the range', () => {
    // Relative scaling means lighten/darken are not exact inverses mid-range,
    // but both must stay within [0, 1].
    const result = darken(lighten(blue, 1), 1);
    expect(result.l).toBe(0);
  });
});

describe('saturate()', () => {
  it('increases chroma by amount * 0.4', () => {
    const result = saturate(blue, 0.25);
    expect(result.c).toBeCloseTo(0.2 + 0.25 * 0.4, 10);
  });

  it('clamps chroma at 0.4', () => {
    expect(saturate(blue, 1).c).toBe(0.4);
  });

  it('preserves lightness, hue, and alpha', () => {
    const result = saturate(blue, 0.5);
    expect(result.l).toBe(blue.l);
    expect(result.h).toBe(blue.h);
    expect(result.alpha).toBe(blue.alpha);
  });
});

describe('desaturate()', () => {
  it('decreases chroma by a relative amount', () => {
    const result = desaturate(blue, 0.5);
    expect(result.c).toBeCloseTo(0.1, 10);
  });

  it('reaches zero chroma at amount 1', () => {
    expect(desaturate(blue, 1).c).toBe(0);
  });

  it('is a no-op at amount 0', () => {
    expect(desaturate(blue, 0)).toEqual(blue);
  });
});

describe('adjustHue()', () => {
  it('shifts hue by the given degrees', () => {
    expect(adjustHue(blue, 30).h).toBeCloseTo(280, 10);
  });

  it('wraps hue past 360', () => {
    expect(adjustHue(blue, 200).h).toBeCloseTo(90, 10);
  });

  it('wraps negative hues into [0, 360)', () => {
    const result = adjustHue(blue, -300);
    expect(result.h).toBeGreaterThanOrEqual(0);
    expect(result.h).toBeLessThan(360);
    expect(result.h).toBeCloseTo(310, 10);
  });

  it('preserves lightness, chroma, and alpha', () => {
    const result = adjustHue(blue, 45);
    expect(result.l).toBe(blue.l);
    expect(result.c).toBe(blue.c);
    expect(result.alpha).toBe(blue.alpha);
  });
});

describe('setAlpha()', () => {
  it('sets the alpha channel', () => {
    expect(setAlpha(blue, 0.5).alpha).toBe(0.5);
  });

  it('clamps alpha to [0, 1]', () => {
    expect(setAlpha(blue, 2).alpha).toBe(1);
    expect(setAlpha(blue, -1).alpha).toBe(0);
  });
});

describe('mix()', () => {
  const a: Color = { l: 0.2, c: 0.1, h: 20, alpha: 1 };
  const b: Color = { l: 0.8, c: 0.3, h: 60, alpha: 0.5 };

  it('returns color1 at t = 0 and color2 at t = 1', () => {
    expect(mix(a, b, 0)).toEqual(a);
    expect(mix(a, b, 1)).toEqual(b);
  });

  it('defaults to an equal mix', () => {
    const result = mix(a, b);
    expect(result.l).toBeCloseTo(0.5, 10);
    expect(result.c).toBeCloseTo(0.2, 10);
    expect(result.h).toBeCloseTo(40, 10);
    expect(result.alpha).toBeCloseTo(0.75, 10);
  });

  it('interpolates hue along the shortest path across 0/360', () => {
    const nearRed: Color = { l: 0.5, c: 0.2, h: 350, alpha: 1 };
    const orange: Color = { l: 0.5, c: 0.2, h: 10, alpha: 1 };
    const result = mix(nearRed, orange, 0.5);
    expect(result.h).toBeCloseTo(0, 10);
  });

  it('interpolates hue the short way when the gap exceeds 180 the other direction', () => {
    const teal: Color = { l: 0.5, c: 0.2, h: 200, alpha: 1 };
    const pink: Color = { l: 0.5, c: 0.2, h: 10, alpha: 1 };
    const result = mix(teal, pink, 0.5);
    // Shortest path from 200 to 10 crosses 360, midpoint at 285.
    expect(result.h).toBeCloseTo(285, 10);
  });
});

describe('invert()', () => {
  it('complements lightness and rotates hue 180 degrees', () => {
    const result = invert(blue);
    expect(result.l).toBeCloseTo(0.45, 10);
    expect(result.h).toBeCloseTo(70, 10);
    expect(result.c).toBe(blue.c);
    expect(result.alpha).toBe(blue.alpha);
  });

  it('is its own inverse', () => {
    const result = invert(invert(blue));
    expect(result.l).toBeCloseTo(blue.l, 10);
    expect(result.h).toBeCloseTo(blue.h, 10);
    expect(result.c).toBe(blue.c);
  });
});

describe('grayscale()', () => {
  it('zeroes chroma and preserves everything else', () => {
    const result = grayscale(blue);
    expect(result.c).toBe(0);
    expect(result.l).toBe(blue.l);
    expect(result.h).toBe(blue.h);
    expect(result.alpha).toBe(blue.alpha);
  });
});
