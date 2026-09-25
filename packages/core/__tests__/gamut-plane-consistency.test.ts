import { describe, expect, it } from 'vitest';
import {
  GAMUT_EPSILON,
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
 * OKLCH plane fields are `maxChromaAt() - c`, and `maxChromaAt()` returns the
 * in-gamut end of a bisection interval (~1e-4 wide). Colors in that gap are
 * still in gamut, so a viewport holding only them must not read as outside.
 * An l/h plane at fixed chroma exercises the field classification directly
 * (implicit-contour solver, no analytic boundary path).
 */
describe('OKLCH gamutRegion near the maxChromaAt search gap', () => {
  // A point whose true boundary sits mid-way through the final bisection
  // cell (gap ~4.6e-5), so a tiny viewport around it does not straddle a
  // jump in maxChromaAt()'s discrete result.
  const l = 0.5;
  const h = 200;
  const searched = maxChromaAt(l, h, { gamut: 'srgb' });

  function trueBoundaryChroma(): number {
    let lo = searched;
    let hi = searched + 0.001;
    for (let step = 0; step < 60; step += 1) {
      const mid = (lo + hi) / 2;
      if (inSrgbGamut({ l, c: mid, h, alpha: 1 })) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function tinyLightnessHuePlane(c: number) {
    const delta = 1e-9;
    return definePlane({
      model: 'oklch',
      x: { channel: 'l', range: [l - delta, l + delta] },
      y: { channel: 'h', range: [h + delta, h - delta] },
      fixed: { c, alpha: 1 },
    });
  }

  it('keeps in-gamut colors just above maxChromaAt visible', () => {
    const gap = trueBoundaryChroma() - searched;
    expect(gap).toBeGreaterThan(2e-5);

    const c = searched + gap / 2;
    expect(inSrgbGamut({ l, c, h, alpha: 1 })).toBe(true);

    const region = sense(tinyLightnessHuePlane(c)).gamutRegion({
      gamut: 'srgb',
    });
    expect(region.solver).toBe('implicit-contour');
    expect(region.viewportRelation).not.toBe('outside');
    expect(region.visibleRegion.paths.length).toBeGreaterThan(0);
  });

  it('still marks a viewport beyond the search gap as outside', () => {
    const c = searched + 2e-4;
    expect(inSrgbGamut({ l, c, h, alpha: 1 })).toBe(false);

    const region = sense(tinyLightnessHuePlane(c)).gamutRegion({
      gamut: 'srgb',
    });
    expect(region.solver).toBe('implicit-contour');
    expect(region.viewportRelation).toBe('outside');
  });
});
