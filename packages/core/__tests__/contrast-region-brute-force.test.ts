import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  contrastAPCA,
  contrastRatio,
  contrastRegionPaths,
  inP3Gamut,
  inSrgbGamut,
  parse,
  relativeLuminance,
  type ContrastApcaPolarity,
  type ContrastApcaRole,
  type GamutTarget,
} from '../src/index.js';
import {
  COARSE_FOLD_REPROS,
  EDGE_REPROS,
  FIN_REPROS,
  FOLD_BAND,
  FOLDED_REPROS,
  INTERACTIVE,
  INTERACTIVE_AGREEMENT,
  NOTCH_REPROS,
  REPRESENTATIVE,
  SPREAD,
  bruteForce,
  bruteForceAbsolute,
  checkAgreement,
  expectChordsInGamut,
  expectVerticesPass,
  wcag,
} from './contrast-region-brute-force-harness.js';

describe('contrast regions agree with brute force', () => {
  it.each(FOLDED_REPROS)(
    'keeps the folded $metric $threshold contour on $hex at h$hue in $gamut whole',
    (query) => {
      checkAgreement(query, bruteForce(query, 1200, 160), 2);
    },
  );

  it.each(EDGE_REPROS)(
    'ends the $metric $threshold contour on $hex at h$hue in $gamut on the gamut edge',
    (query) => {
      checkAgreement(query, bruteForce(query, 600, 160), query.paths);
    },
  );

  // Contour pieces must match brute force.
  it.each(REPRESENTATIVE)(
    'agrees on $metric $threshold on $hex at h$hue in $gamut',
    (query) => {
      checkAgreement(query, bruteForce(query, 400, 120));
    },
  );

  it.each(SPREAD)(
    'spread: $metric $threshold on $hex at h$hue in $gamut',
    (query) => {
      checkAgreement(query, bruteForce(query, 400, 120));
    },
  );

  it.each(SPREAD.slice(0, 16))(
    'spread at interactive sampling: $metric $threshold on $hex at h$hue in $gamut',
    (query) => {
      checkAgreement(
        query,
        bruteForce(query, 400, 120),
        undefined,
        INTERACTIVE,
        INTERACTIVE_AGREEMENT,
      );
    },
  );
});

// The sRGB blue fold: near h 264 a thin in-gamut fin runs beside the main
// body, so the in-gamut set is two intervals at fixed lightness or chroma.
// A contour crossing the fin is a separate piece that ends on the fin's
// edges; one crossing the gap must stop at the gamut edge. Gamut events are
// found independently of the sampling options, so pieces must match at
// both the core defaults and the interactive setting.
describe('contrast regions follow the sRGB blue fold', () => {
  const absolute = (query: (typeof FOLD_BAND)[number]) =>
    bruteForceAbsolute(query, 800, 640);

  it.each([...FIN_REPROS, ...COARSE_FOLD_REPROS])(
    'finds every fin piece for $metric $threshold on $hex at h$hue',
    (query) => {
      const truth = absolute(query);
      checkAgreement(query, truth, truth.pieces);
      checkAgreement(
        query,
        truth,
        truth.pieces,
        INTERACTIVE,
        INTERACTIVE_AGREEMENT,
      );
    },
  );

  it.each([...FOLD_BAND, wcag('#000000', 2, 264.1, 'display-p3')])(
    'fold band: $metric $threshold on $hex at h$hue in $gamut',
    (query) => {
      const truth = absolute(query);
      checkAgreement(query, truth, truth.pieces);
      checkAgreement(
        query,
        truth,
        truth.pieces,
        INTERACTIVE,
        INTERACTIVE_AGREEMENT,
      );
    },
  );
});

describe('contrast regions split at gamut notches', () => {
  // Brute force confirms the two pieces for a few; the rest check the piece
  // count found by the review's truth and that no chord leaves the gamut.
  it.each([NOTCH_REPROS[2]])(
    'agrees with brute force across the notch: WCAG $threshold at h$hue',
    (query) => {
      const truth = bruteForceAbsolute(query, 800, 640);
      expect(truth.pieces).toBe(2);
      checkAgreement(query, truth, 2);
      checkAgreement(query, truth, 2, INTERACTIVE, INTERACTIVE_AGREEMENT);
    },
  );

  it.each(NOTCH_REPROS)(
    'keeps two pieces and in-gamut chords: WCAG $threshold at h$hue',
    (query) => {
      for (const sampling of [{}, INTERACTIVE]) {
        const paths = contrastRegionPaths(parse(query.hex), query.hue, {
          threshold: query.threshold,
          ...sampling,
        });
        expect(paths).toHaveLength(2);
        expectVerticesPass(query, paths);
        expectChordsInGamut(paths, query.hue, query.gamut);
      }
    },
  );

  it('does not bridge the notch gap for APCA positive on a dark reference', () => {
    // The true gap runs from chroma 0.28317 to 0.28517; a bridging chord
    // left the gamut by 0.0016 in lightness.
    const reference = {
      l: 0.20243248087354004,
      c: 0.0068675961825647395,
      h: 103.23549835011363,
      alpha: 1,
    };
    const hue = 264.20614510828165;
    for (const sampling of [{}, INTERACTIVE]) {
      const paths = contrastRegionPaths(reference, hue, {
        metric: 'apca',
        threshold: 0.15568124939687553,
        apcaPolarity: 'positive',
        apcaRole: 'sample-background',
        ...sampling,
      });
      expect(paths).toHaveLength(2);
      expectChordsInGamut(paths, hue, 'srgb');
      for (const path of paths) {
        for (const point of path) {
          const sample = { l: point.l, c: point.c, h: hue, alpha: 1 };
          expect(contrastAPCA(reference, sample)).toBeGreaterThanOrEqual(
            0.15568124939687553,
          );
          expect(inSrgbGamut(sample)).toBe(true);
          expect(point.c > 0.2832 && point.c < 0.2851).toBe(false);
        }
      }
    }
  });
});

describe('contrast regions at the edges of the criterion', () => {
  it.each(['#767676', '#22aa55', '#000000'])(
    'returns white alone when the WCAG threshold equals the contrast of %s against white',
    (hex) => {
      const reference = parse(hex);
      const white = { l: 1, c: 0 };
      for (const gamut of ['srgb', 'display-p3'] as const) {
        const threshold = contrastRatio(
          { ...white, h: 0, alpha: 1 },
          reference,
          { gamut },
        );
        const paths = contrastRegionPaths(reference, 30, { threshold, gamut });
        expect(paths).toContainEqual([white]);
        expectVerticesPass(wcag(hex, threshold, 30, gamut), paths);
        // A hair above it, nothing on the light side passes.
        const above = contrastRegionPaths(reference, 30, {
          threshold: threshold + 1e-12,
          gamut,
        });
        expect(above.flat().every((point) => point.l < 0.99)).toBe(true);
      }
    },
  );

  it('reaches the public gamut edge near black', () => {
    // The prototype used a strict lower channel bound below L 0.05, so the
    // dark contour stopped 0.0055 short of where `inP3Gamut` puts the edge.
    const query = wcag(
      '#6c691c',
      3.6739755325760246,
      69.9028090853244,
      'display-p3',
    );
    for (const sampling of [{}, INTERACTIVE]) {
      const paths = contrastRegionPaths(parse(query.hex), query.hue, {
        threshold: query.threshold,
        gamut: query.gamut,
        ...sampling,
      });
      expectVerticesPass(query, paths);
      const dark = paths.find((path) =>
        path.some((point) => point.c === 0 && point.l < 0.1),
      );
      expect(dark).toBeDefined();
      const outer = dark!.reduce((a, b) => (b.c > a.c ? b : a));
      const color = { l: outer.l, c: outer.c, h: query.hue, alpha: 1 };
      expect(outer.c).toBeGreaterThan(0.0118);
      expect(inP3Gamut(color)).toBe(true);
      // Just past the end the contour leaves the gamut.
      expect(inP3Gamut({ ...color, c: color.c + 1e-7 })).toBe(false);
    }
  });

  it('traces both sides of a WCAG threshold just above 1', () => {
    // Only a band a few 1e-5 wide around the reference's luminance fails.
    const query = wcag('#767676', 1.0001, 315, 'srgb');
    const reference = parse(query.hex);
    const paths = contrastRegionPaths(reference, query.hue, {
      threshold: query.threshold,
    });
    expect(paths).toHaveLength(2);
    expectVerticesPass(query, paths);
    // One contour is darker than the reference and one lighter.
    const referenceY = relativeLuminance(reference);
    const sides = paths
      .map((path) => {
        const ys = path.map((point) =>
          relativeLuminance({ l: point.l, c: point.c, h: query.hue, alpha: 1 }),
        );
        return ys.every((y) => y < referenceY)
          ? 'dark'
          : ys.every((y) => y > referenceY)
            ? 'light'
            : 'both';
      })
      .sort();
    expect(sides).toEqual(['dark', 'light']);
    for (const path of paths) {
      expect(Math.min(...path.map((point) => point.c))).toBe(0);
      for (const point of path) {
        const ratio = contrastRatio(
          { l: point.l, c: point.c, h: query.hue, alpha: 1 },
          reference,
        );
        expect(ratio - query.threshold).toBeLessThan(1e-9);
      }
    }
  });

  it('keeps the light region 1e-9 below the largest WCAG ratio', () => {
    // 4.542224958605249 is 1e-9 below #767676's ratio against white, so
    // only colors within ~1e-10 of white's luminance pass on the light side.
    const query = wcag('#767676', 4.542224958605249, 0, 'srgb');
    const paths = contrastRegionPaths(parse(query.hex), query.hue, {
      threshold: query.threshold,
    });
    expectVerticesPass(query, paths);
    const light = paths.filter((path) => path.every((point) => point.l > 0.9));
    expect(light).toHaveLength(1);
    expect(light[0].length).toBeGreaterThanOrEqual(2);
    expect(Math.min(...light[0].map((point) => point.c))).toBe(0);
    expect(Math.max(...light[0].map((point) => 1 - point.l))).toBeLessThan(
      1e-6,
    );
  });
});

// Every returned point must pass the public check and be in gamut per
// `inSrgbGamut` / `inP3Gamut`, exactly, including inside their GAMUT_EPSILON
// slack (near black, and references there), for every metric, polarity, and
// role. Chords between points must stay in the gamut too.
describe('contrast regions agree with the public checks', () => {
  it('keeps every point and chord inside the passing, in-gamut set', () => {
    fc.assert(
      fc.property(
        fc.record({
          l: fc.double({ min: 0, max: 1, noNaN: true }),
          c: fc.double({ min: 0, max: 0.37, noNaN: true }),
          h: fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true }),
        }),
        fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true }),
        fc.constantFrom<GamutTarget>('srgb', 'display-p3'),
        fc.oneof(
          fc.record({
            metric: fc.constant<'wcag'>('wcag'),
            threshold: fc.double({ min: 1.0001, max: 20, noNaN: true }),
            apcaPolarity: fc.constant<ContrastApcaPolarity>('absolute'),
            apcaRole: fc.constant<ContrastApcaRole>('sample-text'),
          }),
          fc.record({
            metric: fc.constant<'apca'>('apca'),
            threshold: fc.double({ min: 0.01, max: 1.05, noNaN: true }),
            apcaPolarity: fc.constantFrom<ContrastApcaPolarity>(
              'absolute',
              'positive',
              'negative',
            ),
            apcaRole: fc.constantFrom<ContrastApcaRole>(
              'sample-text',
              'sample-background',
            ),
          }),
        ),
        fc.constantFrom({}, INTERACTIVE),
        (ref, hue, gamut, criterion, sampling) => {
          const reference = { ...ref, alpha: 1 };
          const paths = contrastRegionPaths(reference, hue, {
            gamut,
            ...criterion,
            ...sampling,
          });
          const options = { gamut };
          // Measured unmapped, as the solver and the public checks do.
          const mapped = reference;
          const inGamut = gamut === 'display-p3' ? inP3Gamut : inSrgbGamut;
          const passes = (l: number, c: number): boolean => {
            const sample = { l, c, h: hue, alpha: 1 };
            if (criterion.metric === 'wcag') {
              return (
                contrastRatio(sample, mapped, options) >= criterion.threshold
              );
            }
            const lc =
              criterion.apcaRole === 'sample-background'
                ? contrastAPCA(mapped, sample, options)
                : contrastAPCA(sample, mapped, options);
            const value =
              criterion.apcaPolarity === 'positive'
                ? lc
                : criterion.apcaPolarity === 'negative'
                  ? -lc
                  : Math.abs(lc);
            return value >= criterion.threshold;
          };
          for (const path of paths) {
            path.forEach((point, index) => {
              const label = JSON.stringify(point);
              expect(passes(point.l, point.c), label).toBe(true);
              expect(
                inGamut({ l: point.l, c: point.c, h: hue, alpha: 1 }),
                label,
              ).toBe(true);
              if (index === 0) return;
              const previous = path[index - 1];
              const middle = {
                l: (previous.l + point.l) / 2,
                c: (previous.c + point.c) / 2,
                h: hue,
                alpha: 1,
              };
              expect(inGamut(middle), label).toBe(true);
            });
          }
        },
      ),
      { numRuns: 300, seed: 0xc0ffee },
    );
  });
});
