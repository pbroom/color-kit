import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  contrastAPCA,
  contrastRatio,
  definePlane,
  ensureContrast,
  inP3Gamut,
  inSrgbGamut,
  parse,
  planeToColor,
  sense,
  toSrgbGamut,
  tryEnsureContrast,
  type Color,
  type ContrastTargetOptions,
  type Gamut,
  type Plane,
  type PlaneContrastPointOptions,
  type PlaneContrastPointResult,
  type PlanePoint,
} from '../src/index.js';
import {
  packPlaneQueryResults,
  runPackedPlaneQueries,
  createPlaneComputeScheduler,
  unpackPlaneQueryResults,
} from '../src/compute/index.js';
import {
  createPlaneQueryKey,
  getPlaneContrastPoint,
  inspectPlaneQuery,
  nearestPointOnPath,
  pointDistance,
  runCachedPlaneQuery,
  runPlaneQuery,
  PlaneQueryCache,
} from '../src/plane/index.js';
import { displayP3 as P3, srgb as SRGB } from '../src/index.js';

const WHITE = parse('#ffffff');
const BLACK = parse('#000000');
const MID_GRAY = parse('#808080');
const NAVY = parse('#111827');
const BLUE = parse('#3b82f6');

/** The public checks a passing color must satisfy, written independently. */
function passesPublicChecks(
  color: Color,
  reference: Color,
  options: ContrastTargetOptions,
  constrainTo: Gamut | undefined = options.gamut,
): boolean {
  const metricOptions = { gamut: options.gamut };
  let meets: boolean;
  if (options.metric === 'apca') {
    const threshold = options.threshold ?? 0.6;
    const lc =
      options.apcaRole === 'sample-background'
        ? contrastAPCA(reference, color, metricOptions)
        : contrastAPCA(color, reference, metricOptions);
    meets =
      options.apcaPolarity === 'positive'
        ? lc >= threshold
        : options.apcaPolarity === 'negative'
          ? -lc >= threshold
          : Math.abs(lc) >= threshold;
  } else {
    meets =
      contrastRatio(color, reference, metricOptions) >=
      (options.threshold ??
        { AA: 4.5, AAA: 7, 'AA-large': 3 }[options.level ?? 'AA']);
  }
  if (!meets) return false;
  if (constrainTo === undefined) return true;
  return constrainTo.id === 'display-p3'
    ? inP3Gamut(color)
    : inSrgbGamut(color);
}

/** Distance from `start` to the nearest passing sample of a dense lattice. */
function bruteForceNearest(
  plane: Plane,
  start: PlanePoint,
  reference: Color,
  options: ContrastTargetOptions,
  resolution: number,
): number {
  let nearest = Infinity;
  for (let row = 0; row <= resolution; row += 1) {
    for (let column = 0; column <= resolution; column += 1) {
      const point = { x: column / resolution, y: row / resolution };
      const distance = pointDistance(point, start);
      if (
        distance < nearest &&
        passesPublicChecks(planeToColor(plane, point), reference, options)
      ) {
        nearest = distance;
      }
    }
  }
  return nearest;
}

function towardStart(
  result: PlaneContrastPointResult,
  start: PlanePoint,
  amount: number,
): PlanePoint {
  const point = result.point!;
  const scale = amount / result.distance!;
  return {
    x: point.x + (start.x - point.x) * scale,
    y: point.y + (start.y - point.y) * scale,
  };
}

/** The color at lightness `l` on the line ensureContrast() searches. */
function onLightnessLine(color: Color, l: number, gamut: Gamut): Color {
  const inGamut = gamut.id === 'display-p3' ? inP3Gamut : inSrgbGamut;
  const sample = { ...color, l };
  if (inGamut(sample)) return sample;
  let lo = 0;
  let hi = color.c;
  for (let index = 0; index < 60; index += 1) {
    const middle = (lo + hi) / 2;
    if (inGamut({ ...sample, c: middle })) lo = middle;
    else hi = middle;
  }
  return { ...sample, c: lo };
}

const LC_264 = definePlane({ fixed: { h: 264 } });

describe('ensureContrast()', () => {
  it('lands on the threshold: the result passes and misses just inside', () => {
    const cases: Array<[Color, Color, ContrastTargetOptions]> = [
      [BLUE, WHITE, {}],
      [BLUE, WHITE, { level: 'AAA' }],
      [BLUE, NAVY, { threshold: 7 }],
      [BLUE, WHITE, { metric: 'apca', threshold: 0.75 }],
      [BLUE, NAVY, { metric: 'apca' }],
      [parse('oklch(0.7 0.2 150)'), WHITE, { gamut: P3 }],
    ];
    for (const [color, reference, options] of cases) {
      expect(passesPublicChecks(color, reference, options, SRGB)).toBe(false);
      const result = ensureContrast(color, reference, options);
      const gamut = options.gamut ?? SRGB;
      expect(passesPublicChecks(result, reference, options, gamut)).toBe(true);
      expect(result.h).toBe(color.h);
      expect(result.alpha).toBe(color.alpha);
      expect(result.c).toBeLessThanOrEqual(color.c);

      // One part in a million of lightness back toward the input fails.
      const inside = onLightnessLine(
        color,
        result.l + Math.sign(color.l - result.l) * 1e-6,
        gamut,
      );
      expect(passesPublicChecks(inside, reference, options, gamut)).toBe(false);
    }
  });

  it('holds chroma when the gamut allows it', () => {
    const result = ensureContrast(BLUE, WHITE);
    expect(result.c).toBe(BLUE.c);
    expect(result.l).toBeLessThan(BLUE.l);
    expect(contrastRatio(result, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(result, WHITE)).toBeCloseTo(4.5, 6);
  });

  it('returns an already-passing color unchanged', () => {
    const dark = parse('oklch(0.3 0.1 264)');
    const result = ensureContrast(dark, WHITE);
    expect(result).toEqual(dark);
    expect(result).not.toBe(dark);
    expect(tryEnsureContrast(dark, WHITE, { metric: 'apca' })).toEqual(dark);
  });

  it('gamut-maps an already-passing color that is out of gamut', () => {
    const vivid = parse('oklch(0.4 0.35 150)');
    expect(inSrgbGamut(vivid)).toBe(false);
    const mapped = ensureContrast(vivid, WHITE);
    expect(inSrgbGamut(mapped)).toBe(true);
    expect(mapped).toMatchObject({ l: vivid.l, h: vivid.h, alpha: 1 });
    // Same chroma reduction as toSrgbGamut(), solved more tightly.
    const reference = toSrgbGamut(vivid);
    expect(mapped.c).toBeGreaterThanOrEqual(reference.c);
    expect(mapped.c - reference.c).toBeLessThan(2e-4);
  });

  it('reports unreachable thresholds', () => {
    expect(tryEnsureContrast(BLUE, MID_GRAY, { threshold: 21 })).toBeNull();
    expect(
      tryEnsureContrast(BLUE, MID_GRAY, { metric: 'apca', threshold: 0.9 }),
    ).toBeNull();
    expect(
      tryEnsureContrast(BLUE, WHITE, { metric: 'apca', threshold: 1.2 }),
    ).toBeNull();
    expect(() => ensureContrast(BLUE, MID_GRAY, { threshold: 21 })).toThrow(
      RangeError,
    );
    expect(() => ensureContrast(BLUE, MID_GRAY, { threshold: 21 })).toThrow(
      'ensureContrast(): no lightness reaches the contrast threshold',
    );
    // Black on white is the largest ratio there is (21:1, a hair less in
    // floating point): 20.99 is reachable, just above black.
    const black = ensureContrast(BLUE, WHITE, { threshold: 20.99 });
    expect(black.l).toBeLessThan(0.05);
    expect(contrastRatio(black, WHITE)).toBeGreaterThanOrEqual(20.99);
  });

  it('respects the direction option', () => {
    const middle = parse('oklch(0.56 0.1 264)');
    const options = { threshold: 3 } as const;
    const lighter = ensureContrast(middle, MID_GRAY, {
      ...options,
      direction: 'lighter',
    });
    const darker = ensureContrast(middle, MID_GRAY, {
      ...options,
      direction: 'darker',
    });
    expect(lighter.l).toBeGreaterThan(middle.l);
    expect(darker.l).toBeLessThan(middle.l);
    for (const result of [lighter, darker]) {
      expect(contrastRatio(result, MID_GRAY)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(result, MID_GRAY)).toBeCloseTo(3, 6);
    }
    const nearest = ensureContrast(middle, MID_GRAY, options);
    const expected =
      lighter.l - middle.l <= middle.l - darker.l ? lighter : darker;
    expect(nearest).toEqual(expected);

    // Against white only darker works, so forcing lighter is unreachable.
    expect(tryEnsureContrast(BLUE, WHITE, { direction: 'lighter' })).toBeNull();
    expect(() => ensureContrast(BLUE, WHITE, { direction: 'lighter' })).toThrow(
      'ensureContrast(): no lighter color reaches the contrast threshold',
    );
    expect(ensureContrast(BLUE, WHITE, { direction: 'darker' })).toEqual(
      ensureContrast(BLUE, WHITE),
    );
  });

  it('respects APCA polarity and role', () => {
    const middle = parse('oklch(0.6 0.05 264)');
    const base = { metric: 'apca', threshold: 0.3 } as const;
    // Sample is the text: positive Lc is dark text on a lighter background.
    const darkText = ensureContrast(middle, MID_GRAY, {
      ...base,
      apcaPolarity: 'positive',
    });
    expect(darkText.l).toBeLessThan(middle.l);
    expect(contrastAPCA(darkText, MID_GRAY)).toBeGreaterThanOrEqual(0.3);
    expect(contrastAPCA(darkText, MID_GRAY)).toBeCloseTo(0.3, 6);

    const lightText = ensureContrast(middle, MID_GRAY, {
      ...base,
      apcaPolarity: 'negative',
    });
    expect(lightText.l).toBeGreaterThan(middle.l);
    expect(contrastAPCA(lightText, MID_GRAY)).toBeLessThanOrEqual(-0.3);
    expect(contrastAPCA(lightText, MID_GRAY)).toBeCloseTo(-0.3, 6);

    // Sample is the background: the roles, and so the sides, swap.
    const lightBackground = ensureContrast(middle, MID_GRAY, {
      ...base,
      apcaPolarity: 'positive',
      apcaRole: 'sample-background',
    });
    expect(lightBackground.l).toBeGreaterThan(middle.l);
    expect(contrastAPCA(MID_GRAY, lightBackground)).toBeCloseTo(0.3, 6);
    expect(contrastAPCA(MID_GRAY, lightBackground)).toBeGreaterThanOrEqual(0.3);

    // The two polarities are different colors, not mirror images.
    expect(lightText.l - middle.l).not.toBeCloseTo(middle.l - darkText.l, 3);
  });

  it('reduces chroma only as far as the gamut requires', () => {
    const vivid = parse('oklch(0.75 0.3 145)');
    for (const gamut of [SRGB, P3]) {
      const inGamut = gamut.id === 'srgb' ? inSrgbGamut : inP3Gamut;
      const result = ensureContrast(vivid, WHITE, { threshold: 7, gamut });
      expect(inGamut(result)).toBe(true);
      expect(result.h).toBe(vivid.h);
      expect(result.c).toBeLessThan(vivid.c);
      // The chroma is the gamut's maximum at this lightness and hue.
      expect(result.c).toBeCloseTo(
        onLightnessLine(vivid, result.l, gamut).c,
        9,
      );
      expect(inGamut({ ...result, c: result.c + 1e-4 })).toBe(false);
      expect(contrastRatio(result, WHITE, { gamut })).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(result, WHITE, { gamut })).toBeCloseTo(7, 6);
    }
    const srgb = ensureContrast(vivid, WHITE, { threshold: 7 });
    const p3 = ensureContrast(vivid, WHITE, {
      threshold: 7,
      gamut: P3,
    });
    expect(p3.c).toBeGreaterThan(srgb.c);
  });

  it('rejects invalid options', () => {
    expect(() => ensureContrast(BLUE, WHITE, { gamut: 'p3' as never })).toThrow(
      TypeError,
    );
    expect(() =>
      ensureContrast(BLUE, WHITE, { direction: 'up' as never }),
    ).toThrow('ensureContrast(): unknown direction "up"');
    expect(() => ensureContrast(BLUE, WHITE, { threshold: 1 })).toThrow(
      'ensureContrast() requires threshold > 1',
    );
    expect(() =>
      ensureContrast(BLUE, WHITE, { metric: 'apca', threshold: 0 }),
    ).toThrow('ensureContrast() APCA threshold must be > 0');
  });

  it('property: results pass, stay in gamut and keep hue', () => {
    const color = fc.record({
      l: fc.double({ min: 0, max: 1, noNaN: true }),
      c: fc.double({ min: 0, max: 0.37, noNaN: true }),
      h: fc.double({ min: 0, max: 360, noNaN: true }),
      alpha: fc.constant(1),
    });
    fc.assert(
      fc.property(
        color,
        color,
        fc.double({ min: 1.1, max: 12, noNaN: true }),
        fc.constantFrom<Gamut>(SRGB, P3),
        fc.constantFrom('nearest', 'lighter', 'darker'),
        (input, reference, threshold, gamut, direction) => {
          const options = { threshold, gamut, direction } as const;
          const result = tryEnsureContrast(input, reference, options);
          const at = (l: number) => onLightnessLine(input, l, gamut);
          if (passesPublicChecks(at(input.l), reference, options)) {
            expect(result).toMatchObject({ l: input.l, h: input.h });
            expect(result!.c).toBeCloseTo(at(input.l).c, 9);
            return;
          }
          if (result === null) {
            // Nothing passes at the ends of the allowed directions either.
            const ends = { nearest: [0, 1], lighter: [1], darker: [0] }[
              direction
            ];
            for (const l of ends) {
              expect(passesPublicChecks(at(l), reference, options)).toBe(false);
            }
            return;
          }
          expect(passesPublicChecks(result, reference, options)).toBe(true);
          expect(result.h).toBe(input.h);
          expect(result.c).toBeLessThanOrEqual(input.c);
          if (direction === 'lighter') {
            expect(result.l).toBeGreaterThan(input.l);
          }
          if (direction === 'darker') {
            expect(result.l).toBeLessThan(input.l);
          }
        },
      ),
      { numRuns: 500, seed: 0xc0ffee },
    );
  });
});

describe('contrastPoint plane query', () => {
  it('is available through sense(), runPlaneQuery() and getPlaneContrastPoint()', () => {
    const options: PlaneContrastPointOptions = {
      color: parse('oklch(0.7 0.12 264)'),
      reference: WHITE,
      gamut: SRGB,
    };
    const direct = getPlaneContrastPoint(LC_264, options);
    expect(direct.kind).toBe('contrastPoint');
    expect(direct.status).toBe('adjusted');
    expect(sense(LC_264).contrastPoint(options)).toEqual(direct);
    expect(
      runPlaneQuery(LC_264, { kind: 'contrastPoint', ...options }),
    ).toEqual(direct);
  });

  it('lands on the threshold: the point passes and misses just inside', () => {
    const cases: Array<[PlanePoint, Color, ContrastTargetOptions]> = [
      [{ x: 0.7, y: 0.7 }, WHITE, {}],
      [{ x: 0.9, y: 0.1 }, WHITE, { threshold: 7 }],
      [{ x: 0.5, y: 0.5 }, MID_GRAY, {}],
      [{ x: 0.3, y: 0.6 }, NAVY, { metric: 'apca' }],
      [{ x: 0.75, y: 0.9 }, WHITE, { metric: 'apca', threshold: 0.75 }],
    ];
    for (const [start, reference, options] of cases) {
      const result = getPlaneContrastPoint(LC_264, {
        point: start,
        reference,
        ...options,
      });
      expect(result.status).toBe('adjusted');
      const { point } = result;
      expect(point!.color).toEqual(planeToColor(LC_264, point!));
      expect(passesPublicChecks(point!.color, reference, options)).toBe(true);
      expect(result.distance).toBeCloseTo(pointDistance(point!, start), 12);

      const measured =
        options.metric === 'apca'
          ? contrastAPCA(point!.color, reference)
          : contrastRatio(point!.color, reference);
      expect(result.contrast).toBe(measured);
      // No gamut constraint here, so the nearest point is on the contour.
      const threshold =
        options.threshold ?? (options.metric === 'apca' ? 0.6 : 4.5);
      expect(Math.abs(measured)).toBeCloseTo(threshold, 6);

      const inside = towardStart(result, start, 1e-6);
      expect(
        passesPublicChecks(planeToColor(LC_264, inside), reference, options),
      ).toBe(false);
    }
  });

  it('returns an already-passing start unchanged', () => {
    const start = { x: 0.3, y: 0.8 };
    const result = getPlaneContrastPoint(LC_264, {
      point: start,
      reference: WHITE,
      gamut: SRGB,
    });
    expect(result.status).toBe('satisfied');
    expect(result.distance).toBe(0);
    expect(result.point).toEqual({
      ...start,
      color: planeToColor(LC_264, start),
    });
    expect(result.contrast).toBe(contrastRatio(result.point!.color, WHITE));

    // A passing color that is out of gamut is not satisfied once a gamut
    // is required.
    const vivid = { x: 0.3, y: 0 };
    expect(inSrgbGamut(planeToColor(LC_264, vivid))).toBe(false);
    expect(
      getPlaneContrastPoint(LC_264, { point: vivid, reference: WHITE }).status,
    ).toBe('satisfied');
    const mapped = getPlaneContrastPoint(LC_264, {
      point: vivid,
      reference: WHITE,
      gamut: SRGB,
    });
    expect(mapped.status).toBe('adjusted');
    expect(inSrgbGamut(mapped.point!.color)).toBe(true);
  });

  it('projects a start color onto the plane', () => {
    const color = parse('oklch(0.7 0.12 264)');
    const fromColor = getPlaneContrastPoint(LC_264, {
      color,
      reference: WHITE,
    });
    const fromPoint = getPlaneContrastPoint(LC_264, {
      point: { x: 0.7, y: 1 - 0.12 / 0.4 },
      reference: WHITE,
    });
    expect(fromColor.point!.x).toBeCloseTo(fromPoint.point!.x, 9);
    expect(fromColor.point!.y).toBeCloseTo(fromPoint.point!.y, 9);

    // A color off the plane takes the plane's hue.
    const offPlane = getPlaneContrastPoint(LC_264, {
      color: { ...color, h: 30 },
      reference: WHITE,
    });
    expect(offPlane.point!.color.h).toBe(264);
    // A powerless hue is accepted.
    expect(
      getPlaneContrastPoint(LC_264, {
        color: { l: 0.7, c: 0, h: Number.NaN, alpha: 1 },
        reference: WHITE,
      }).status,
    ).toBe('adjusted');
  });

  it('reports unreachable targets explicitly', () => {
    const unreachable = {
      kind: 'contrastPoint',
      status: 'unreachable',
      point: null,
      contrast: null,
      distance: null,
    };
    const start = { x: 0.5, y: 0.5 };
    // 21:1 needs black against white; nothing reaches it against mid-gray.
    expect(
      getPlaneContrastPoint(LC_264, {
        point: start,
        reference: MID_GRAY,
        threshold: 21,
      }),
    ).toEqual(unreachable);
    // APCA tops out near Lc 108.
    expect(
      getPlaneContrastPoint(LC_264, {
        point: start,
        reference: WHITE,
        metric: 'apca',
        threshold: 1.2,
      }),
    ).toEqual(unreachable);
    // Light text (negative Lc) cannot exist on a white background.
    expect(
      getPlaneContrastPoint(LC_264, {
        point: start,
        reference: WHITE,
        metric: 'apca',
        apcaPolarity: 'negative',
      }),
    ).toEqual(unreachable);
    // A plane whose window holds no passing color: blue is fixed at 180, so
    // nothing gets dark or light enough for 4.5:1 against mid-gray.
    const rgb = definePlane({
      model: 'rgb',
      x: { channel: 'r' },
      y: { channel: 'g' },
      fixed: { b: 180 },
    });
    expect(
      getPlaneContrastPoint(rgb, { point: start, reference: MID_GRAY }),
    ).toEqual(unreachable);
    expect(bruteForceNearest(rgb, start, MID_GRAY, {}, 200)).toBe(Infinity);
    // The extreme that is reachable sits at the corner of the plane.
    const black = getPlaneContrastPoint(LC_264, {
      point: start,
      reference: WHITE,
      threshold: 20.99,
      gamut: SRGB,
    });
    expect(black.status).toBe('adjusted');
    expect(black.point!.color.l).toBeLessThan(0.05);
    expect(black.contrast).toBeGreaterThanOrEqual(20.99);
  });

  it('respects APCA polarity and role', () => {
    const start = { x: 0.6, y: 0.9 };
    const base = {
      point: start,
      reference: MID_GRAY,
      metric: 'apca',
      threshold: 0.3,
    } as const;
    const startL = planeToColor(LC_264, start).l;

    const positive = getPlaneContrastPoint(LC_264, {
      ...base,
      apcaPolarity: 'positive',
    });
    expect(positive.point!.color.l).toBeLessThan(startL);
    expect(positive.contrast).toBeGreaterThanOrEqual(0.3);
    expect(positive.contrast).toBeCloseTo(0.3, 6);

    const negative = getPlaneContrastPoint(LC_264, {
      ...base,
      apcaPolarity: 'negative',
    });
    expect(negative.point!.color.l).toBeGreaterThan(startL);
    expect(negative.contrast).toBeLessThanOrEqual(-0.3);
    expect(negative.contrast).toBeCloseTo(-0.3, 6);

    const absolute = getPlaneContrastPoint(LC_264, base);
    expect(absolute.distance).toBe(
      Math.min(positive.distance!, negative.distance!),
    );

    const background = getPlaneContrastPoint(LC_264, {
      ...base,
      apcaPolarity: 'positive',
      apcaRole: 'sample-background',
    });
    expect(background.point!.color.l).toBeGreaterThan(startL);
    expect(background.contrast).toBe(
      contrastAPCA(MID_GRAY, background.point!.color),
    );
    expect(background.contrast).toBeCloseTo(0.3, 6);
  });

  it('keeps the answer in gamut at high chroma (sRGB and Display P3)', () => {
    for (const hue of [30, 145, 264, 330]) {
      const plane = definePlane({ fixed: { h: hue } });
      // Top of the plane: chroma 0.4, far outside both gamuts.
      const start = { x: 0.8, y: 0 };
      const query = { point: start, reference: WHITE, threshold: 4.5 };
      const free = getPlaneContrastPoint(plane, query);
      const srgb = getPlaneContrastPoint(plane, { ...query, gamut: SRGB });
      const p3 = getPlaneContrastPoint(plane, {
        ...query,
        gamut: P3,
      });
      expect(inSrgbGamut(srgb.point!.color)).toBe(true);
      expect(inP3Gamut(p3.point!.color)).toBe(true);
      expect(contrastRatio(srgb.point!.color, WHITE)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrastRatio(p3.point!.color, WHITE, { gamut: P3 }),
      ).toBeGreaterThanOrEqual(4.5);
      // A wider gamut can only bring the answer closer.
      expect(p3.distance).toBeLessThanOrEqual(srgb.distance! + 1e-9);
      expect(free.distance).toBeLessThan(p3.distance!);
      // The constrained answers sit on the gamut edge: a hair toward the
      // start leaves the gamut (or the threshold).
      for (const [result, gamut] of [
        [srgb, SRGB],
        [p3, P3],
      ] as const) {
        const inside = planeToColor(plane, towardStart(result, start, 1e-6));
        expect(
          passesPublicChecks(inside, WHITE, { threshold: 4.5, gamut }),
        ).toBe(false);
        expect(
          bruteForceNearest(
            plane,
            start,
            WHITE,
            { threshold: 4.5, gamut },
            200,
          ),
        ).toBeGreaterThanOrEqual(result.distance! - 1e-9);
      }
    }
  });

  describe('agreement with contrastRegion / contrastBoundary', () => {
    const regionSampling = {
      initialSamples: 256,
      errorTolerance: 1e-5,
      maxDepth: 12,
    };
    const cases: Array<[number, Color, ContrastTargetOptions]> = [
      [264, WHITE, { gamut: SRGB }],
      [264, NAVY, { gamut: SRGB, threshold: 7 }],
      [30, MID_GRAY, { gamut: SRGB, threshold: 3 }],
      [145, WHITE, { gamut: P3 }],
      [330, BLACK, { gamut: P3, threshold: 7 }],
      [264, WHITE, { gamut: SRGB, metric: 'apca' }],
      [
        80,
        MID_GRAY,
        {
          gamut: SRGB,
          metric: 'apca',
          threshold: 0.3,
          apcaPolarity: 'negative',
        },
      ],
    ];
    const starts: PlanePoint[] = [
      { x: 0.5, y: 0.5 },
      { x: 0.9, y: 0.95 },
      { x: 0.1, y: 0.9 },
      { x: 0.7, y: 0.2 },
      { x: 0.35, y: 0.75 },
      { x: 0.62, y: 1 },
    ];

    it.each(cases)(
      'hue %i: no region point is nearer than the solved point',
      (hue, reference, options) => {
        const plane = definePlane({ fixed: { h: hue } });
        const query = sense(plane);
        const region = query.contrastRegion({
          reference,
          ...options,
          ...regionSampling,
        });
        const boundary = query.contrastBoundary({
          reference,
          ...options,
          ...regionSampling,
        });
        expect(region.paths.length).toBeGreaterThan(0);
        let adjusted = 0;
        let onContour = 0;
        for (const start of starts) {
          const result = query.contrastPoint({
            point: start,
            reference,
            ...options,
          });
          const startPasses = passesPublicChecks(
            planeToColor(plane, start),
            reference,
            options,
          );
          expect(result.status).toBe(startPasses ? 'satisfied' : 'adjusted');
          if (result.status !== 'adjusted') continue;
          adjusted += 1;
          const point = result.point!;
          // Inside the region: region membership is the public check.
          expect(passesPublicChecks(point.color, reference, options)).toBe(
            true,
          );

          // Every region path point passes and is in gamut, so none may be
          // materially nearer to the start than the solved point. The
          // polyline between vertices cuts corners by its own sampling
          // error (measured: at most 1.5e-8 with this sampling), so segments
          // get a 1e-6 allowance and vertices 1e-7.
          for (const path of [...region.paths, boundary.points]) {
            for (const vertex of path) {
              expect(pointDistance(vertex, start)).toBeGreaterThanOrEqual(
                result.distance! - 1e-7,
              );
            }
            const onPath = nearestPointOnPath(path, start);
            if (onPath) {
              expect(pointDistance(onPath, start)).toBeGreaterThanOrEqual(
                result.distance! - 1e-6,
              );
            }
          }

          // When the solved point is on the contrast contour (not held back
          // by the gamut edge), it lies on a region path.
          const threshold =
            options.threshold ?? (options.metric === 'apca' ? 0.6 : 4.5);
          if (Math.abs(Math.abs(result.contrast!) - threshold) < 1e-6) {
            onContour += 1;
            const gap = Math.min(
              ...region.paths.map((path) =>
                pointDistance(nearestPointOnPath(path, point)!, point),
              ),
            );
            expect(gap).toBeLessThan(1e-6);
          }

          // And a dense scan of the region's membership test finds nothing
          // nearer.
          expect(
            bruteForceNearest(plane, start, reference, options, 160),
          ).toBeGreaterThanOrEqual(result.distance! - 1e-9);
        }
        expect(adjusted).toBeGreaterThan(0);
        expect(onContour).toBeGreaterThan(0);
      },
    );
  });

  describe.each<[string, Plane]>([
    [
      'rgb r × g',
      definePlane({
        model: 'rgb',
        x: { channel: 'r' },
        y: { channel: 'g' },
        fixed: { b: 40 },
      }),
    ],
    [
      'hsl h × l',
      definePlane({
        model: 'hsl',
        x: { channel: 'h' },
        y: { channel: 'l' },
        fixed: { s: 80 },
      }),
    ],
    [
      'display-p3 r × b',
      definePlane({
        model: 'display-p3',
        x: { channel: 'r' },
        y: { channel: 'b' },
        fixed: { g: 0.5 },
      }),
    ],
    [
      'oklch h × c',
      definePlane({
        model: 'oklch',
        x: { channel: 'h' },
        y: { channel: 'c' },
        fixed: { l: 0.62 },
      }),
    ],
  ])('on a %s plane', (_name, plane) => {
    const targets: Array<[Color, ContrastTargetOptions]> = [
      [WHITE, {}],
      [NAVY, { gamut: SRGB }],
      [MID_GRAY, { threshold: 3, gamut: P3 }],
      [WHITE, { metric: 'apca', threshold: 0.5, gamut: SRGB }],
    ];
    const starts: PlanePoint[] = [
      { x: 0.5, y: 0.5 },
      { x: 0.08, y: 0.9 },
      { x: 0.93, y: 0.12 },
      { x: 0.3, y: 0.33 },
    ];

    it('matches a dense scan of the public checks', () => {
      let adjusted = 0;
      for (const [reference, options] of targets) {
        for (const start of starts) {
          const result = getPlaneContrastPoint(plane, {
            point: start,
            reference,
            ...options,
          });
          const brute = bruteForceNearest(
            plane,
            start,
            reference,
            options,
            160,
          );
          if (result.status === 'unreachable') {
            expect(brute).toBe(Infinity);
            continue;
          }
          expect(
            passesPublicChecks(result.point!.color, reference, options),
          ).toBe(true);
          if (result.status === 'satisfied') {
            expect(result.point).toMatchObject(start);
            continue;
          }
          adjusted += 1;
          // Nothing the scan finds is nearer than the solved point.
          expect(brute).toBeGreaterThanOrEqual(result.distance! - 1e-9);
          expect(result.distance).toBeCloseTo(
            pointDistance(result.point!, start),
            12,
          );
          const inside = planeToColor(plane, towardStart(result, start, 1e-6));
          expect(passesPublicChecks(inside, reference, options)).toBe(false);
        }
      }
      expect(adjusted).toBeGreaterThan(0);
    });
  });

  it('property: adjusted points pass and no scanned point is nearer', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 360, noNaN: true }),
        fc.record({
          x: fc.double({ min: 0, max: 1, noNaN: true }),
          y: fc.double({ min: 0, max: 1, noNaN: true }),
        }),
        fc.record({
          l: fc.double({ min: 0, max: 1, noNaN: true }),
          c: fc.double({ min: 0, max: 0.1, noNaN: true }),
          h: fc.double({ min: 0, max: 360, noNaN: true }),
          alpha: fc.constant(1),
        }),
        fc.double({ min: 1.5, max: 9, noNaN: true }),
        fc.constantFrom<Gamut | undefined>(undefined, SRGB, P3),
        (hue, start, reference, threshold, gamut) => {
          const plane = definePlane({ fixed: { h: hue } });
          const options = { threshold, gamut };
          const result = getPlaneContrastPoint(plane, {
            point: start,
            reference,
            ...options,
          });
          const brute = bruteForceNearest(plane, start, reference, options, 96);
          if (result.status === 'unreachable') {
            expect(brute).toBe(Infinity);
            expect(result.point).toBeNull();
            return;
          }
          expect(
            passesPublicChecks(result.point!.color, reference, options),
          ).toBe(true);
          if (result.status === 'satisfied') {
            expect(result.point).toMatchObject(start);
            expect(result.distance).toBe(0);
            return;
          }
          expect(
            passesPublicChecks(planeToColor(plane, start), reference, options),
          ).toBe(false);
          expect(brute).toBeGreaterThanOrEqual(result.distance! - 1e-9);
        },
      ),
      { numRuns: 80, seed: 0x5eed },
    );
  });

  it('validates its input', () => {
    const reference = WHITE;
    const point = { x: 0.5, y: 0.5 };
    expect(() => getPlaneContrastPoint(LC_264, { reference } as never)).toThrow(
      'contrastPoint(): pass exactly one of "color" or "point"',
    );
    expect(() =>
      getPlaneContrastPoint(LC_264, {
        reference,
        point,
        color: BLUE,
      } as never),
    ).toThrow(TypeError);
    expect(() =>
      getPlaneContrastPoint(LC_264, {
        reference,
        point: { x: Number.NaN, y: 0 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      getPlaneContrastPoint(LC_264, { reference, point, gamut: 'p3' as never }),
    ).toThrow(/contrastPoint\(\): gamut "p3" is not a Gamut object/);
    expect(() =>
      getPlaneContrastPoint(LC_264, { reference, point, threshold: 1 }),
    ).toThrow('contrastPoint() requires threshold > 1');
    // Out-of-window points are clamped onto the plane.
    expect(
      getPlaneContrastPoint(LC_264, { reference, point: { x: -3, y: 9 } })
        .point,
    ).toMatchObject({ x: 0, y: 1 });
  });

  it('traces its evaluations', () => {
    const { result, trace } = inspectPlaneQuery(LC_264, {
      kind: 'contrastPoint',
      point: { x: 0.7, y: 0.7 },
      reference: WHITE,
    });
    expect(result.status).toBe('adjusted');
    expect(trace.summary.queryKind).toBe('contrastPoint');
    expect(trace.summary.sampleCount).toBeGreaterThan(65 * 65);
    expect(trace.summary.scalarEvaluationCount).toBe(trace.summary.sampleCount);
    expect(trace.summary.resultPathCount).toBe(1);
    expect(trace.summary.resultPointCount).toBe(1);
    expect(trace.stages.map((stage) => stage.kind)).toEqual(['metrics']);

    const unreachable = inspectPlaneQuery(LC_264, {
      kind: 'contrastPoint',
      point: { x: 0.5, y: 0.5 },
      reference: MID_GRAY,
      threshold: 21,
    });
    expect(unreachable.trace.summary.resultPointCount).toBe(0);
  });

  it('is part of the query cache key', () => {
    const query = {
      kind: 'contrastPoint',
      point: { x: 0.7, y: 0.7 },
      reference: WHITE,
    } as const;
    const key = createPlaneQueryKey(LC_264, query);
    expect(key).toContain('"kind":"contrastPoint"');
    expect(createPlaneQueryKey(LC_264, { ...query, threshold: 7 })).not.toBe(
      key,
    );
    expect(createPlaneQueryKey(LC_264, { ...query, gamut: SRGB })).not.toBe(
      key,
    );
    const cache = new PlaneQueryCache();
    let runs = 0;
    const execute = () => {
      runs += 1;
      return runPlaneQuery(LC_264, query);
    };
    const first = runCachedPlaneQuery(cache, LC_264, query, execute);
    expect(runCachedPlaneQuery(cache, LC_264, { ...query }, execute)).toBe(
      first,
    );
    expect(runs).toBe(1);
  });

  describe('packed ABI', () => {
    const queries = [
      {
        kind: 'contrastPoint',
        point: { x: 0.7, y: 0.7 },
        reference: WHITE,
        gamut: SRGB,
      },
      { kind: 'contrastPoint', point: { x: 0.2, y: 0.8 }, reference: WHITE },
      {
        kind: 'contrastPoint',
        point: { x: 0.5, y: 0.5 },
        reference: MID_GRAY,
        threshold: 21,
      },
      {
        kind: 'contrastPoint',
        color: BLUE,
        reference: NAVY,
        metric: 'apca',
        apcaPolarity: 'negative',
      },
    ] as const;
    const results = queries.map((query) => runPlaneQuery(LC_264, query));

    it('round-trips every status', () => {
      expect(
        results.map((result) => (result as PlaneContrastPointResult).status),
      ).toEqual(['adjusted', 'satisfied', 'unreachable', 'adjusted']);
      const packed = packPlaneQueryResults(results);
      expect(packed.queryDescriptors.map((entry) => entry.pathCount)).toEqual([
        1, 1, 0, 1,
      ]);
      expect(packed.pathRanges).toEqual(Uint32Array.from([0, 1, 1, 1, 2, 1]));
      const unpacked = unpackPlaneQueryResults(
        packed,
      ) as PlaneContrastPointResult[];
      unpacked.forEach((actual, index) => {
        const expected = results[index] as PlaneContrastPointResult;
        expect(actual.kind).toBe('contrastPoint');
        expect(actual.status).toBe(expected.status);
        // Descriptor fields are float64 and survive exactly.
        expect(actual.contrast).toBe(expected.contrast);
        expect(actual.distance).toBe(expected.distance);
        if (expected.point === null) {
          expect(actual.point).toBeNull();
          return;
        }
        // Geometry is float32.
        expect(actual.point).toEqual({
          x: Math.fround(expected.point.x),
          y: Math.fround(expected.point.y),
          color: {
            l: Math.fround(expected.point.color.l),
            c: Math.fround(expected.point.color.c),
            h: Math.fround(expected.point.color.h),
            alpha: Math.fround(expected.point.color.alpha),
          },
        });
      });
    });

    it('runs through the compute backend and scheduler', () => {
      const request = { plane: LC_264, queries: [...queries] };
      const unpacked = unpackPlaneQueryResults(runPackedPlaneQueries(request));
      expect(unpacked).toEqual(
        unpackPlaneQueryResults(packPlaneQueryResults(results)),
      );
      const scheduled = createPlaneComputeScheduler().run(request);
      expect(unpackPlaneQueryResults(scheduled.result)).toEqual(unpacked);
      expect(scheduled.schedule!.bucketKey).toBe(
        'contrastPoint|gamutRegion:none|contrast:apca:negative:sample-text,wcag|priority:idle|quality:medium|profile:balanced|budget:xl',
      );
    });

    it.each([
      ['status', 'moved', /invalid status "moved"/],
      ['status', undefined, /missing required field "status"/],
      [
        'contrast',
        null,
        /contrast must be a finite number when status is "adjusted"/,
      ],
      ['contrast', Number.NaN, /contrast must be a finite number/],
      ['distance', undefined, /missing required field "distance"/],
      ['distance', '0.1', /distance must be a finite number/],
      ['pathCount', 0, /pathCount must be 1 when status is "adjusted"/],
    ])('rejects a descriptor with %s = %s', (field, value, message) => {
      const packed = packPlaneQueryResults([results[0]]);
      const descriptor = packed.queryDescriptors[0] as unknown as Record<
        string,
        unknown
      >;
      if (value === undefined) {
        delete descriptor[field];
      } else {
        descriptor[field] = value;
      }
      expect(() => unpackPlaneQueryResults(packed)).toThrow(message);
    });

    it('rejects an unreachable descriptor that carries data', () => {
      const corrupt = (edit: (descriptor: Record<string, unknown>) => void) => {
        const packed = packPlaneQueryResults([results[2]]);
        edit(packed.queryDescriptors[0] as unknown as Record<string, unknown>);
        return () => unpackPlaneQueryResults(packed);
      };
      expect(
        corrupt((descriptor) => {
          descriptor.contrast = 4.5;
        }),
      ).toThrow(/contrast must be null when status is "unreachable"/);
      expect(
        corrupt((descriptor) => {
          descriptor.status = 'adjusted';
        }),
      ).toThrow(/pathCount must be 1 when status is "adjusted"/);
      // A reachable result must own exactly one point.
      const packed = packPlaneQueryResults([results[0]]);
      packed.pathRanges[1] = 0;
      expect(() => unpackPlaneQueryResults(packed)).toThrow(
        /must contain exactly 1 point/,
      );
    });
  });
});
