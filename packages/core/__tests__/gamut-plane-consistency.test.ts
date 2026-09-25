import { describe, expect, it } from 'vitest';
import {
  GAMUT_EPSILON,
  containsPoint,
  definePlane,
  inP3Gamut,
  inSrgbGamut,
  linearP3ToLinearSrgb,
  linearRgbToOklab,
  maxChromaAt,
  sense,
} from '../src/index.js';
import type { Color } from '../src/index.js';

/**
 * inSrgbGamut/inP3Gamut and the plane gamut-region solver must classify
 * boundary colors identically. The interesting band is a linear channel in
 * (-GAMUT_EPSILON, -GAMUT_EPSILON / 12.92): outside per the encoded-channel
 * epsilon, but inside under the former linear-light tolerance.
 */
const BAND_CHANNEL = -3e-5;

type Lab = { L: number; a: number; b: number };

function tinyOklabPlane(lab: Lab) {
  const delta = 1e-9;
  return definePlane({
    model: 'oklab',
    x: { channel: 'a', range: [lab.a - delta, lab.a + delta] },
    y: { channel: 'b', range: [lab.b + delta, lab.b - delta] },
    fixed: { L: lab.L, alpha: 1 },
  });
}

function oklabToColor(lab: Lab): Color {
  const c = Math.hypot(lab.a, lab.b);
  const h = ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  return { l: lab.L, c, h, alpha: 1 };
}

describe('gamut membership vs plane gamutRegion', () => {
  it('uses a channel inside the disputed band', () => {
    expect(BAND_CHANNEL).toBeGreaterThan(-GAMUT_EPSILON);
    expect(BAND_CHANNEL).toBeLessThan(-GAMUT_EPSILON / 12.92);
  });

  it('rejects a dark sRGB color in the band in both APIs', () => {
    const lab = linearRgbToOklab({ r: 0.01, g: 0.01, b: BAND_CHANNEL });
    expect(inSrgbGamut(oklabToColor(lab))).toBe(false);

    const region = sense(tinyOklabPlane(lab)).gamutRegion({ gamut: 'srgb' });
    expect(region.solver).toBe('implicit-contour');
    expect(region.viewportRelation).toBe('outside');
  });

  it('accepts a dark sRGB color within the encoded epsilon in both APIs', () => {
    const lab = linearRgbToOklab({ r: 0.01, g: 0.01, b: -1e-6 });
    expect(inSrgbGamut(oklabToColor(lab))).toBe(true);

    const region = sense(tinyOklabPlane(lab)).gamutRegion({ gamut: 'srgb' });
    expect(region.viewportRelation).toBe('inside');
  });

  it('rejects a dark Display P3 color in the band in both APIs', () => {
    const lab = linearRgbToOklab(
      linearP3ToLinearSrgb({ r: 0.01, g: 0.01, b: BAND_CHANNEL }),
    );
    expect(inP3Gamut(oklabToColor(lab))).toBe(false);

    const region = sense(tinyOklabPlane(lab)).gamutRegion({
      gamut: 'display-p3',
    });
    expect(region.solver).toBe('implicit-contour');
    expect(region.viewportRelation).toBe('outside');
  });
});

/**
 * OKLCH plane fields start from `maxChromaAt() - c`, and `maxChromaAt()`
 * returns the in-gamut end of a bisection interval (~1e-4 wide). Samples in
 * that gap are ambiguous and must be classified like `inSrgbGamut` /
 * `inP3Gamut`, in both directions. A lightness/hue plane at fixed chroma
 * exercises the field classification directly (implicit-contour solver, no
 * analytic boundary path).
 */
const SEARCH_CELL = 0.4 / 4096;

type GamutCase = {
  gamut: 'srgb' | 'display-p3';
  inGamut: (color: Color) => boolean;
};

const GAMUT_CASES: GamutCase[] = [
  { gamut: 'srgb', inGamut: inSrgbGamut },
  { gamut: 'display-p3', inGamut: inP3Gamut },
];

function trueBoundaryChroma(
  l: number,
  h: number,
  from: number,
  inGamut: (color: Color) => boolean,
): number {
  let lo = from;
  let hi = from + 0.001;
  for (let step = 0; step < 60; step += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut({ l, c: mid, h, alpha: 1 })) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Picks a lightness/hue whose true boundary sits mid-way through the final
 * bisection cell, so both sides of the gap have room and a tiny viewport does
 * not straddle a jump in maxChromaAt()'s discrete result.
 */
function findMidGapPoint({ gamut, inGamut }: GamutCase) {
  for (const l of [0.5, 0.55, 0.6, 0.65, 0.7, 0.45, 0.4]) {
    for (let h = 0; h < 360; h += 10) {
      const searched = maxChromaAt(l, h, { gamut });
      if (searched >= 0.4) continue;
      const boundary = trueBoundaryChroma(l, h, searched, inGamut);
      const gap = boundary - searched;
      if (gap > SEARCH_CELL * 0.35 && gap < SEARCH_CELL * 0.65) {
        return { l, h, searched, boundary };
      }
    }
  }
  throw new Error(`no mid-gap sample found for ${gamut}`);
}

function tinyLightnessHuePlane(l: number, h: number, c: number) {
  const delta = 1e-9;
  return definePlane({
    model: 'oklch',
    x: { channel: 'l', range: [l - delta, l + delta] },
    y: { channel: 'h', range: [h + delta, h - delta] },
    fixed: { c, alpha: 1 },
  });
}

describe.each(GAMUT_CASES)(
  'OKLCH gamutRegion inside the maxChromaAt search gap ($gamut)',
  (gamutCase) => {
    const { gamut, inGamut } = gamutCase;
    const { l, h, searched, boundary } = findMidGapPoint(gamutCase);

    it('keeps in-gamut colors just above maxChromaAt visible', () => {
      const c = (searched + boundary) / 2;
      expect(inGamut({ l, c, h, alpha: 1 })).toBe(true);

      const region = sense(tinyLightnessHuePlane(l, h, c)).gamutRegion({
        gamut,
      });
      expect(region.solver).toBe('implicit-contour');
      expect(region.viewportRelation).not.toBe('outside');
      expect(region.visibleRegion.paths.length).toBeGreaterThan(0);
    });

    it('does not fill out-of-gamut colors that fall inside the search gap', () => {
      // Past the true boundary, but still less than one search tolerance above
      // maxChromaAt(): every sampled `maxChromaAt() - c` is in (-1e-4, 0).
      const c = (boundary + searched + 1e-4) / 2;
      expect(searched - c).toBeGreaterThan(-1e-4);
      expect(searched - c).toBeLessThan(0);
      expect(inGamut({ l, c, h, alpha: 1 })).toBe(false);

      const region = sense(tinyLightnessHuePlane(l, h, c)).gamutRegion({
        gamut,
      });
      expect(region.solver).toBe('implicit-contour');
      expect(region.viewportRelation).not.toBe('inside');
      expect(containsPoint(region.visibleRegion, { x: 0.5, y: 0.5 })).toBe(
        false,
      );
    });

    it('marks a viewport beyond the search gap as outside', () => {
      const c = searched + 2e-4;
      expect(inGamut({ l, c, h, alpha: 1 })).toBe(false);

      const region = sense(tinyLightnessHuePlane(l, h, c)).gamutRegion({
        gamut,
      });
      expect(region.viewportRelation).toBe('outside');
    });
  },
);
