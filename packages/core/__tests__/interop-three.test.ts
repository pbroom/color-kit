/**
 * Verifies the three.js interop recipe against the real `three` package
 * (devDependency only; `three` is never imported by `src/`).
 *
 * three.js facts this relies on (three r186, `src/math/Color.js` and
 * `src/math/ColorManagement.js`):
 * - `ColorManagement.workingColorSpace` defaults to `LinearSRGBColorSpace`
 *   (`'srgb-linear'`), so `Color.r/g/b` hold linear-light sRGB.
 * - `Color.fromArray(array, offset)` copies the three values verbatim (no
 *   color-space conversion, no clamping); `toArray` does the reverse.
 * - `Color.setStyle(css)` and `setHex` parse sRGB and convert to the working
 *   space; `setRGB(r, g, b, SRGBColorSpace)` converts from sRGB floats.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  fromLinearSrgbArray,
  packColors,
  toCss,
  toHex,
  toLinearSrgbArray,
  toSrgbArray,
} from '../src/index.js';
import type { Color } from '../src/index.js';

const SAMPLES: Color[] = [
  { l: 0.63, c: 0.2, h: 30, alpha: 1 },
  { l: 0.85, c: 0.1, h: 120, alpha: 1 },
  { l: 0.45, c: 0.15, h: 260, alpha: 1 },
  { l: 0.3, c: 0.05, h: 330, alpha: 1 },
  { l: 0.97, c: 0.01, h: 90, alpha: 1 },
];

// Outside sRGB and P3: vivid green.
const WIDE: Color = { l: 0.6, c: 0.35, h: 145, alpha: 1 };

describe('three.js interop', () => {
  it('uses linear sRGB as the working color space', () => {
    expect(THREE.ColorManagement.enabled).toBe(true);
    expect(THREE.ColorManagement.workingColorSpace).toBe(
      THREE.LinearSRGBColorSpace,
    );
  });

  it('Color.fromArray(toLinearSrgbArray(c)) round-trips losslessly', () => {
    for (const color of [...SAMPLES, WIDE]) {
      const linear = toLinearSrgbArray(color);
      const threeColor = new THREE.Color().fromArray(linear);
      expect(threeColor.toArray()).toEqual(linear);
      const back = fromLinearSrgbArray(threeColor.toArray());
      expect(back.l).toBeCloseTo(color.l, 12);
      expect(back.c).toBeCloseTo(color.c, 12);
      expect(back.h).toBeCloseTo(color.h, 9);
    }
  });

  it('matches setRGB(...toSrgbArray(c), SRGBColorSpace)', () => {
    for (const color of SAMPLES) {
      const [r, g, b] = toSrgbArray(color);
      const viaSrgb = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
      const viaLinear = new THREE.Color().fromArray(toLinearSrgbArray(color));
      // three's SRGBToLinear uses 10-digit constants (1 / 1.055 as
      // 0.9478672986, ...), so agreement is ~1e-11 rather than exact.
      expect(viaSrgb.r).toBeCloseTo(viaLinear.r, 10);
      expect(viaSrgb.g).toBeCloseTo(viaLinear.g, 10);
      expect(viaSrgb.b).toBeCloseTo(viaLinear.b, 10);
    }
  });

  it('setStyle(toCss(c)) only agrees to 8-bit precision', () => {
    for (const color of SAMPLES) {
      const viaCss = new THREE.Color().setStyle(toCss(color));
      const viaArray = new THREE.Color().fromArray(toLinearSrgbArray(color));
      // Same color, as seen through three's sRGB encode.
      expect(viaArray.getHexString()).toBe(toHex(color).slice(1));
      expect(viaCss.getHexString()).toBe(toHex(color).slice(1));
      // ...but the CSS path is quantized, so the floats differ.
      const maxDelta = Math.max(
        Math.abs(viaCss.r - viaArray.r),
        Math.abs(viaCss.g - viaArray.g),
        Math.abs(viaCss.b - viaArray.b),
      );
      expect(maxDelta).toBeLessThan(0.01);
    }
  });

  it('does not clamp out-of-gamut values (and neither does the default writer)', () => {
    const linear = toLinearSrgbArray(WIDE);
    expect(Math.min(...linear)).toBeLessThan(0);
    const threeColor = new THREE.Color().fromArray(linear);
    expect(threeColor.r).toBe(linear[0]);
    expect(threeColor.g).toBe(linear[1]);
    expect(threeColor.b).toBe(linear[2]);
    // The CSS path clips first, so it cannot represent WIDE.
    const viaCss = new THREE.Color().setStyle(toCss(WIDE));
    expect(Math.min(viaCss.r, viaCss.g, viaCss.b)).toBeGreaterThanOrEqual(0);
  });

  it('packColors feeds a BufferAttribute of vertex colors', () => {
    const attribute = new THREE.BufferAttribute(
      packColors(SAMPLES, 'linearSrgb'),
      3,
    );
    expect(attribute.count).toBe(SAMPLES.length);
    SAMPLES.forEach((color, i) => {
      const fromAttribute = new THREE.Color().fromBufferAttribute(attribute, i);
      const expected = toLinearSrgbArray(color).map(Math.fround);
      expect(fromAttribute.toArray()).toEqual(expected);
    });
  });
});
