import { describe, expect, it } from 'vitest';
import {
  GAMUT_EPSILON,
  definePlane,
  inP3Gamut,
  inSrgbGamut,
  linearP3ToLinearSrgb,
  linearRgbToOklab,
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
