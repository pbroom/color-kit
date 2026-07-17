import { describe, expect, it } from 'vitest';
import { contrastAPCA, contrastRegionPaths, fromHex } from '../src/index.js';

const white = fromHex('#ffffff');
const black = fromHex('#000000');

describe('contrastAPCA()', () => {
  it('returns opposite signs for opposite polarities', () => {
    // Dark text on light background is normal polarity (positive Lc);
    // light text on dark background is reverse polarity (negative Lc).
    const darkOnLight = contrastAPCA(black, white);
    const lightOnDark = contrastAPCA(white, black);

    expect(darkOnLight).toBeGreaterThan(0);
    expect(lightOnDark).toBeLessThan(0);
  });

  it('uses polarity-specific exponents, so magnitudes are asymmetric', () => {
    const darkOnLight = contrastAPCA(black, white);
    const lightOnDark = contrastAPCA(white, black);

    // APCA is intentionally not symmetric: reverse polarity uses different
    // exponents (revBg/revTxt vs normBg/normTxt), so |Lc| differs by order.
    expect(Math.abs(Math.abs(lightOnDark) - darkOnLight)).toBeGreaterThan(
      0.001,
    );
  });

  it('returns values on the normalized Lc scale for black/white pairs', () => {
    // The implementation returns Lc / 100 (docstring: multiply by 100 for
    // the conventional APCA scale). Reference APCA-W3 0.0.98G-4g values are
    // roughly Lc 106 for black-on-white and Lc -108 for white-on-black.
    // This simplified port lands slightly higher (~1.09 / ~-1.11) but must
    // stay on the normalized scale, not the x100 scale.
    const darkOnLight = contrastAPCA(black, white);
    const lightOnDark = contrastAPCA(white, black);

    expect(darkOnLight).toBeGreaterThan(0.9);
    expect(darkOnLight).toBeLessThan(1.2);
    expect(lightOnDark).toBeLessThan(-0.9);
    expect(lightOnDark).toBeGreaterThan(-1.2);
  });

  it('returns exactly 0 for identical colors', () => {
    for (const hex of ['#ffffff', '#000000', '#808080', '#ff0000']) {
      const color = fromHex(hex);
      // Same-color pairs fall below the low-contrast clamp (loClip),
      // which hard-zeroes the output.
      expect(contrastAPCA(color, color)).toBe(0);
    }
  });

  it('clamps low-contrast pairs to 0', () => {
    // Raw contrast for this grey pair computes to just under the loClip
    // threshold of 0.1, so the clamp returns exactly 0 rather than a
    // small non-zero Lc.
    const grey1 = fromHex('#777777');
    const grey2 = fromHex('#888888');
    expect(contrastAPCA(grey1, grey2)).toBe(0);
  });

  it('increases |Lc| monotonically as text darkens on a white background', () => {
    const ramp = ['#dddddd', '#aaaaaa', '#777777', '#444444', '#000000'];
    const values = ramp.map((hex) => contrastAPCA(fromHex(hex), white));

    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeGreaterThan(values[index - 1]);
    }
  });
});

describe('contrast metric router (contrastRegionPaths metric="apca")', () => {
  it('lets an explicit threshold override the apcaPreset', () => {
    // resolveContrastCriterion() prefers options.threshold over the preset
    // table (body=0.6, large-text=0.45, ui=0.3). Passing the "ui" preset
    // with threshold 0.6 must behave exactly like the "body" preset.
    const bodyPreset = contrastRegionPaths(white, 210, {
      metric: 'apca',
      apcaPreset: 'body',
      lightnessSteps: 40,
      chromaSteps: 40,
    });
    const overridden = contrastRegionPaths(white, 210, {
      metric: 'apca',
      apcaPreset: 'ui',
      threshold: 0.6,
      lightnessSteps: 40,
      chromaSteps: 40,
    });

    expect(bodyPreset.length).toBeGreaterThan(0);
    expect(overridden).toEqual(bodyPreset);
  });

  it('dispatches apcaRole to swap text/background arguments', () => {
    // With a white reference, dark samples as text give positive Lc
    // (sample-text role), while white text on dark sample backgrounds
    // gives negative Lc (sample-background role). Polarity filtering
    // must therefore flip which role produces a region.
    const textRolePositive = contrastRegionPaths(white, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaRole: 'sample-text',
      apcaPolarity: 'positive',
      lightnessSteps: 40,
      chromaSteps: 40,
    });
    const backgroundRolePositive = contrastRegionPaths(white, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaRole: 'sample-background',
      apcaPolarity: 'positive',
      lightnessSteps: 40,
      chromaSteps: 40,
    });
    const backgroundRoleNegative = contrastRegionPaths(white, 210, {
      metric: 'apca',
      threshold: 0.45,
      apcaRole: 'sample-background',
      apcaPolarity: 'negative',
      lightnessSteps: 40,
      chromaSteps: 40,
    });

    expect(textRolePositive.length).toBeGreaterThan(0);
    expect(backgroundRolePositive).toEqual([]);
    expect(backgroundRoleNegative.length).toBeGreaterThan(0);
  });
});
