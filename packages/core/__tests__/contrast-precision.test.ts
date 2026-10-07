/**
 * Contrast metrics measure unrounded channels, and contrast regions use the
 * same metric path as the public checks.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  Hct as MaterialHct,
  argbFromRgb,
} from '@material/material-color-utilities';
import {
  contrastAPCA,
  contrastRatio,
  contrastRegionPaths,
  fromRgb,
  inP3Gamut,
  inSrgbGamut,
  maxChromaAt,
  meetsAA,
  meetsAAA,
  relativeLuminance,
  toHct,
  toHsl,
  toRgb,
} from '../src/index.js';
import type { Color, ContrastOptions } from '../src/index.js';
import { srgbToLinearChannel } from '../src/utils/index.js';

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(0x5eed);
const randomByte = () => Math.floor(random() * 256);
const byteColor = (): Color =>
  fromRgb({ r: randomByte(), g: randomByte(), b: randomByte(), alpha: 1 });

/** color-kit 0.1 relative luminance: 8-bit `toRgb`, then linearize. */
function luminance8bit(color: Color): number {
  const rgb = toRgb(color);
  return (
    0.2126 * srgbToLinearChannel(rgb.r / 255) +
    0.7152 * srgbToLinearChannel(rgb.g / 255) +
    0.0722 * srgbToLinearChannel(rgb.b / 255)
  );
}

/** color-kit 0.1 APCA screen luminance: 8-bit `toRgb`, then `** 2.4`. */
function apcaY8bit(color: Color): number {
  const rgb = toRgb(color);
  return (
    0.2126729 * (rgb.r / 255) ** 2.4 +
    0.7151522 * (rgb.g / 255) ** 2.4 +
    0.072175 * (rgb.b / 255) ** 2.4
  );
}

/** color-kit 0.1 `contrastAPCA` (APCA-W3 0.0.98G-4g on 8-bit `toRgb`). */
function apca8bit(text: Color, background: Color): number {
  let txtY = apcaY8bit(text);
  let bgY = apcaY8bit(background);
  if (txtY <= 0.022) txtY += (0.022 - txtY) ** 1.414;
  if (bgY <= 0.022) bgY += (0.022 - bgY) ** 1.414;
  if (Math.abs(bgY - txtY) < 0.0005) return 0;
  if (bgY > txtY) {
    const sapc = (bgY ** 0.56 - txtY ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : sapc - 0.027;
  }
  const sapc = (bgY ** 0.65 - txtY ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : sapc + 0.027;
}

describe('unrounded contrast metrics', () => {
  it('8-bit inputs give the same WCAG and APCA results as before', () => {
    for (let i = 0; i < 2000; i += 1) {
      const a = byteColor();
      const b = byteColor();
      // The opt-in 8-bit mode reproduces the old byte-based luminance
      // bit for bit.
      expect(relativeLuminance(a, { precision: '8bit' })).toBe(
        luminance8bit(a),
      );
      // The default unrounded mode agrees to float precision, so pass/fail
      // decisions are unchanged.
      expect(relativeLuminance(a)).toBeCloseTo(luminance8bit(a), 12);
      expect(contrastRatio(a, b)).toBeCloseTo(
        contrastRatio(a, b, { precision: '8bit' }),
        11,
      );
      expect(contrastAPCA(a, b)).toBeCloseTo(
        contrastAPCA(a, b, { precision: '8bit' }),
        12,
      );
      expect(meetsAA(a, b)).toBe(meetsAA(a, b, false, { precision: '8bit' }));
      expect(meetsAAA(a, b)).toBe(meetsAAA(a, b, false, { precision: '8bit' }));
    }
  });

  it('APCA 8-bit mode reproduces the old byte-based Lc bit for bit', () => {
    for (let i = 0; i < 2000; i += 1) {
      const text = byteColor();
      const bg = byteColor();
      expect(contrastAPCA(text, bg, { precision: '8bit' })).toBe(
        apca8bit(text, bg),
      );
    }
  });

  it('is continuous in the color (no 8-bit steps)', () => {
    const white: Color = { l: 1, c: 0, h: 0, alpha: 1 };
    const apca = new Set<number>();
    const wcag = new Set<number>();
    let previous = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 200; i += 1) {
      const sample: Color = {
        l: 0.5 + (i / 200) * 0.004,
        c: 0.1,
        h: 210,
        alpha: 1,
      };
      const lc = contrastAPCA(sample, white);
      apca.add(lc);
      wcag.add(contrastRatio(sample, white));
      // Lighter text on white: contrast strictly decreases.
      expect(lc).toBeLessThan(previous);
      previous = lc;
    }
    expect(apca.size).toBe(200);
    expect(wcag.size).toBe(200);
  });

  it('measures in the requested display gamut', () => {
    const reference: Color = { l: 0.9, c: 0.03, h: 95, alpha: 1 };
    const p3Only: Color = {
      l: 0.5,
      c: 0.22809734908482968,
      h: 24.864352050672835,
      alpha: 1,
    };
    expect(inP3Gamut(p3Only)).toBe(true);
    expect(inSrgbGamut(p3Only)).toBe(false);
    // Clipping the negative sRGB channels to 0 lightens this red, so it
    // fails 4.8:1 on an sRGB display but passes on a P3 display, which is
    // what a `gamut: 'display-p3'` contrast region reports for it.
    expect(contrastRatio(p3Only, reference)).toBeLessThan(4.8);
    expect(
      contrastRatio(p3Only, reference, { gamut: 'display-p3' }),
    ).toBeGreaterThan(4.8);
    const paths = contrastRegionPaths(reference, p3Only.h, {
      gamut: 'display-p3',
      threshold: 4.8,
    });
    expect(Math.max(...paths.flat().map((point) => point.l))).toBeGreaterThan(
      p3Only.l,
    );

    // In-sRGB colors measure the same in either gamut.
    for (let i = 0; i < 200; i += 1) {
      const a = byteColor();
      const b = byteColor();
      expect(contrastRatio(a, b, { gamut: 'display-p3' })).toBeCloseTo(
        contrastRatio(a, b),
        9,
      );
      expect(contrastAPCA(a, b, { gamut: 'display-p3' })).toBeCloseTo(
        contrastAPCA(a, b),
        9,
      );
    }
  });
});

// ─── Regions agree with the checks ──────────────────────────────────

type Metric = 'wcag' | 'apca';
type Gamut = 'srgb' | 'display-p3';

/** Signed margin of the public check (>= 0 passes). */
function checkMargin(
  metric: Metric,
  sample: Color,
  reference: Color,
  threshold: number,
  options: ContrastOptions,
): number {
  return metric === 'wcag'
    ? contrastRatio(sample, reference, options) - threshold
    : Math.abs(contrastAPCA(sample, reference, options)) - threshold;
}

describe('contrast regions use the public metric', () => {
  it('region boundaries sit on the check boundary (nudged points split)', () => {
    // For every contour vertex away from the gamut edge, moving 0.0005 L to
    // either side must land one point inside the check and one outside.
    // With the old 8-bit checks against the unrounded region field, about
    // half of these vertices failed.
    const delta = 0.0005;
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 0.15, noNaN: true }),
        fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true }),
        fc.constantFrom<Metric>('wcag', 'apca'),
        fc.constantFrom<Gamut>('srgb', 'display-p3'),
        (hue, refL, refC, refH, metric, gamut) => {
          const reference: Color = { l: refL, c: refC, h: refH, alpha: 1 };
          fc.pre(
            gamut === 'srgb' ? inSrgbGamut(reference) : inP3Gamut(reference),
          );
          const threshold = metric === 'wcag' ? 3 : 0.45;
          const options: ContrastOptions = { gamut };
          const paths = contrastRegionPaths(reference, hue, {
            metric,
            threshold,
            gamut,
          });
          for (const path of paths) {
            for (const vertex of path) {
              if (vertex.l - delta <= 0 || vertex.l + delta >= 1) continue;
              const maxChroma = Math.min(
                maxChromaAt(vertex.l - delta, hue, { gamut }),
                maxChromaAt(vertex.l + delta, hue, { gamut }),
              );
              // At the gamut edge the region maps out-of-gamut samples
              // first; that boundary is a gamut boundary, not a contrast one.
              if (vertex.c > maxChroma * 0.98) continue;
              const at = (l: number): number =>
                checkMargin(
                  metric,
                  { l, c: vertex.c, h: hue, alpha: 1 },
                  reference,
                  threshold,
                  options,
                );
              const below = at(vertex.l - delta);
              const above = at(vertex.l + delta);
              expect(
                below >= 0 !== above >= 0,
                `${metric}/${gamut} vertex ${JSON.stringify(vertex)}: ${below}, ${above}`,
              ).toBe(true);
            }
          }
        },
      ),
      { numRuns: 60, seed: 0x5eed },
    );
  }, 30_000);
});

describe('contrast regions with an out-of-gamut reference', () => {
  it('match the public check, which clips the reference', () => {
    const delta = 0.0005;
    const references: Color[] = [
      { l: 0.6, c: 0.32, h: 150, alpha: 1 },
      { l: 0.45, c: 0.3, h: 270, alpha: 1 },
      { l: 0.85, c: 0.25, h: 100, alpha: 1 },
    ];
    let checked = 0;
    for (const reference of references) {
      for (const gamut of ['srgb', 'display-p3'] as Gamut[]) {
        expect(
          gamut === 'srgb' ? inSrgbGamut(reference) : inP3Gamut(reference),
        ).toBe(false);
        for (const metric of ['wcag', 'apca'] as Metric[]) {
          const threshold = metric === 'wcag' ? 3 : 0.45;
          for (const hue of [30, 200]) {
            const paths = contrastRegionPaths(reference, hue, {
              metric,
              threshold,
              gamut,
            });
            for (const path of paths) {
              for (const vertex of path) {
                if (vertex.l - delta <= 0 || vertex.l + delta >= 1) continue;
                const maxChroma = Math.min(
                  maxChromaAt(vertex.l - delta, hue, { gamut }),
                  maxChromaAt(vertex.l + delta, hue, { gamut }),
                );
                if (vertex.c > maxChroma * 0.98) continue;
                const at = (l: number): number =>
                  checkMargin(
                    metric,
                    { l, c: vertex.c, h: hue, alpha: 1 },
                    reference,
                    threshold,
                    { gamut },
                  );
                expect(
                  at(vertex.l - delta) >= 0 !== at(vertex.l + delta) >= 0,
                ).toBe(true);
                checked++;
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  }, 30_000);
});

// ─── HSL / HCT ──────────────────────────────────────────────────────

describe('toHsl / toHct without 8-bit rounding', () => {
  it('match the 8-bit results for 8-bit inputs', () => {
    for (let i = 0; i < 500; i += 1) {
      const r = randomByte();
      const g = randomByte();
      const b = randomByte();
      const color = fromRgb({ r, g, b, alpha: 1 });
      const material = MaterialHct.fromInt(argbFromRgb(r, g, b));
      const hct = toHct(color);
      expect(hct.t).toBeCloseTo(material.tone, 9);
      expect(hct.c).toBeCloseTo(material.chroma, 7);
      if (material.chroma > 1e-3) {
        const d = Math.abs(hct.h - material.hue) % 360;
        expect(Math.min(d, 360 - d)).toBeLessThan(1e-6);
      }
    }
    const gray = toHsl(fromRgb({ r: 128, g: 128, b: 128, alpha: 1 }));
    expect(gray.h).toBe(0);
    expect(gray.s).toBe(0);
    expect(gray.l).toBeCloseTo((128 / 255) * 100, 10);
  });

  it('are continuous in the color', () => {
    const tones = new Set<number>();
    const lightness = new Set<number>();
    for (let i = 0; i < 100; i += 1) {
      const color: Color = {
        l: 0.5 + (i / 100) * 0.002,
        c: 0.08,
        h: 140,
        alpha: 1,
      };
      tones.add(toHct(color).t);
      lightness.add(toHsl(color).l);
    }
    expect(tones.size).toBe(100);
    expect(lightness.size).toBe(100);
  });
});
