/**
 * Reference-accuracy suite: compares color-kit's conversions, CSS parsing and
 * serialization, gamut checks, contrast metrics, and gamut mapping against
 * colorjs.io, which implements the CSS Color 4 definitions (OKLab matrices
 * recalculated in float64 for a consistent D65 white, sRGB / Display P3
 * matrices derived from the primaries) and the APCA-W3 reference.
 *
 * Tolerances:
 * - FLOAT_TOL (1e-9) is used for all pure float64 conversion math on in-gamut
 *   values. Both libraries use the same full-precision matrices, so observed
 *   errors are ~1e-14; 1e-9 leaves headroom for operation-order differences
 *   (for example color-kit's pre-multiplied linear-sRGB -> LMS matrix versus
 *   colorjs.io's two-step linear-sRGB -> XYZ -> LMS) while still being three
 *   orders of magnitude tighter than the ~1e-6 target.
 * - Hue is only compared when chroma >= ACHROMATIC_CHROMA (hue is undefined
 *   for greys) and always with 0/360 wrap-around.
 * - Anything looser than FLOAT_TOL is justified at its call site (8-bit
 *   quantization, CSS serialization rounding, WCAG's rounded luminance
 *   coefficients, gamut-boundary epsilons, and gamut-mapping algorithm
 *   differences).
 *
 * Interpolation (`mix` / `generateScale` with a `space` option) is compared
 * against colorjs.io `mix` / `steps` with `premultiplied: true` for
 * rectangular spaces, which is what CSS `color-mix()` does.
 *
 * Set REFERENCE_ACCURACY_REPORT=1 to print the max observed error per area.
 */
import { afterAll, describe, expect, it } from 'vitest';
import ColorJs from 'colorjs.io';
import {
  contrastAPCA,
  contrastRatio,
  fromHex,
  fromHsl,
  fromHsv,
  fromOklab,
  fromP3,
  fromRgb,
  generateScale,
  hslToRgb,
  hsvToRgb,
  inP3Gamut,
  inSrgbGamut,
  linearP3ToLinearSrgb,
  linearRgbToOklab,
  linearSrgbToLinearP3,
  linearToSrgb,
  mix,
  oklabToLinearRgb,
  p3ToLinearP3,
  parse,
  relativeLuminance,
  rgbToHsl,
  rgbToHsv,
  srgbToLinear,
  toCss,
  toHex,
  toHsl,
  toHsv,
  toOklab,
  toP3,
  toP3Gamut,
  toRgb,
  toSrgbGamut,
} from '../src/index.js';
import type {
  Color,
  HueInterpolationMethod,
  InterpolationSpace,
} from '../src/index.js';

type Vec3 = [number, number, number];

const FLOAT_TOL = 1e-9;
const ACHROMATIC_CHROMA = 1e-4;
/** Degrees. Hue error ~ (ab error / chroma); at C >= 1e-4 this is ~1e-9 deg. */
const HUE_TOL = 1e-6;

// ─── Deterministic sampling ─────────────────────────────────────────

/** mulberry32: small, fast, seedable PRNG. */
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

const random = createRandom(0xc0105);

function randomUnitVec(): Vec3 {
  return [random(), random(), random()];
}

function randomByte(): number {
  return Math.floor(random() * 256);
}

function randomAlpha(): number {
  // Mix of fully opaque and translucent samples.
  return random() < 0.5 ? 1 : Math.round(random() * 1000) / 1000;
}

const EDGE_UNIT_RGB: Vec3[] = [
  [0, 0, 0],
  [1, 1, 1],
  // Greys, including the 8-bit midpoint and the sRGB linear-segment knee.
  [0.5, 0.5, 0.5],
  [128 / 255, 128 / 255, 128 / 255],
  [0.04045, 0.04045, 0.04045],
  [0.01, 0.01, 0.01],
  [0.99, 0.99, 0.99],
  // Primaries and secondaries.
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 0],
  [0, 1, 1],
  [1, 0, 1],
  // Near-achromatic.
  [0.5, 0.5, 0.500001],
  [0.2, 0.2000005, 0.2],
  // Hue wrap: reds just either side of OKLCH hue ~0/360 are reached via
  // magenta-ish reds (OKLCH hue of pure red is ~29 deg).
  [1, 0, 0.35],
  [1, 0, 0.36],
  [1, 0, 0.37],
];

const SRGB_SAMPLES: Vec3[] = [
  ...EDGE_UNIT_RGB,
  ...Array.from({ length: 2500 }, randomUnitVec),
];

// P3 primaries/secondaries are outside sRGB; they exercise the wide path.
const P3_SAMPLES: Vec3[] = [
  ...EDGE_UNIT_RGB,
  ...Array.from({ length: 1500 }, randomUnitVec),
];

function randomOklch(maxChroma: number): Color {
  return {
    l: random(),
    c: random() * maxChroma,
    h: random() * 360,
    alpha: randomAlpha(),
  };
}

const EDGE_OKLCH: Color[] = [
  { l: 0, c: 0, h: 0, alpha: 1 },
  { l: 1, c: 0, h: 0, alpha: 1 },
  { l: 0.5, c: 0, h: 0, alpha: 0 },
  { l: 0.6, c: 0.1, h: 0, alpha: 1 },
  { l: 0.6, c: 0.1, h: 360, alpha: 1 },
  { l: 0.6, c: 0.1, h: 359.9999, alpha: 1 },
  { l: 0.6, c: 0.1, h: 0.0001, alpha: 1 },
  { l: 0.6, c: 0.1, h: 720, alpha: 1 },
  { l: 0.6, c: 0.1, h: -90, alpha: 1 },
  { l: 0.6, c: 0.00005, h: 120, alpha: 1 },
  { l: 0.6, c: 0.0002, h: 240, alpha: 0.5 },
];

/** Wide OKLCH samples: a mix of in-gamut, P3-only, and out-of-P3 colors. */
const OKLCH_SAMPLES: Color[] = [
  ...EDGE_OKLCH,
  ...Array.from({ length: 2500 }, () => randomOklch(0.4)),
];

// ─── Reference helpers ──────────────────────────────────────────────

function ref(space: string, coords: Vec3, alpha = 1): ColorJs {
  return new ColorJs(space, coords, alpha);
}

function refCoords(color: ColorJs, space: string): Vec3 {
  const [a, b, c] = color.to(space).coords;
  const coords: Vec3 = [a ?? Number.NaN, b ?? Number.NaN, c ?? Number.NaN];
  if (space === 'oklch' && !Number.isFinite(coords[2])) {
    // colorjs.io snaps chroma to exactly 0 (and hue to `none`) when
    // |a| and |b| are both < 8e-6. color-kit keeps the true chroma, so
    // recover it (and the hue) from colorjs.io's OKLab coordinates.
    const [, labA, labB] = color.to('oklab').coords;
    coords[1] = Math.hypot(labA ?? 0, labB ?? 0);
    const hue = (Math.atan2(labB ?? 0, labA ?? 0) * 180) / Math.PI;
    coords[2] = (hue + 360) % 360;
  }
  return coords;
}

function refFromColor(color: Color): ColorJs {
  return ref('oklch', [color.l, color.c, color.h], color.alpha);
}

function wrapHueDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

// ─── Error bookkeeping ──────────────────────────────────────────────

interface ErrorRecord {
  max: number;
  tolerance: number;
  worst: string;
  count: number;
}

const report = new Map<string, ErrorRecord>();

class Tracker {
  private record: ErrorRecord;

  constructor(
    private readonly area: string,
    tolerance: number,
  ) {
    this.record = { max: 0, tolerance, worst: '', count: 0 };
    report.set(area, this.record);
  }

  observe(error: number, describeSample: () => string): void {
    this.record.count += 1;
    if (!(error <= this.record.max)) {
      this.record.max = error;
      this.record.worst = describeSample();
    }
  }

  assert(): void {
    const { max, tolerance, worst } = this.record;
    expect(
      max,
      `${this.area}: max error ${max} > ${tolerance} at ${worst}`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

function lchError(
  kit: { l: number; c: number; h: number },
  expected: Vec3,
): { lc: number; h: number } {
  const [l, c, h] = expected;
  const lc = Math.max(Math.abs(kit.l - l), Math.abs(kit.c - c));
  const hueComparable = c >= ACHROMATIC_CHROMA && Number.isFinite(h);
  return { lc, h: hueComparable ? wrapHueDelta(kit.h, h) : 0 };
}

function vecError(kit: Vec3, expected: Vec3): number {
  return Math.max(
    Math.abs(kit[0] - expected[0]),
    Math.abs(kit[1] - expected[1]),
    Math.abs(kit[2] - expected[2]),
  );
}

/**
 * Error of an 8-bit channel against an unrounded reference (0-255 scale).
 * Returns 0 when the byte is the correctly rounded reference, allowing
 * either neighbour when the reference sits within 1e-6 of a .5 tie (where
 * float noise legitimately decides the rounding direction). Otherwise the
 * distance past the correctly rounded value.
 */
function byteError(kit: number, reference: number): number {
  const rounded = Math.min(255, Math.max(0, Math.round(reference)));
  if (kit === rounded) return 0;
  const fraction = reference - Math.floor(reference);
  if (
    Math.abs(fraction - 0.5) < 1e-6 &&
    Math.abs(kit - reference) <= 0.5 + 1e-6
  ) {
    return 0;
  }
  return Math.abs(kit - rounded);
}

function fmt(values: readonly number[]): string {
  return `[${values.map((v) => Number(v.toPrecision(10))).join(', ')}]`;
}

afterAll(() => {
  if (!process.env.REFERENCE_ACCURACY_REPORT) return;
  const rows = [...report.entries()].map(([area, r]) => ({
    area,
    samples: r.count,
    maxError: Number(r.max.toPrecision(3)),
    tolerance: r.tolerance,
  }));
  console.table(rows);
});

// ─── Conversions ────────────────────────────────────────────────────

describe('reference accuracy: conversions vs colorjs.io', () => {
  it('sRGB -> OKLCH (fromRgb) matches', () => {
    const lc = new Tracker('sRGB -> OKLCH (L, C)', FLOAT_TOL);
    const hue = new Tracker('sRGB -> OKLCH (h, deg)', HUE_TOL);
    for (const rgb of SRGB_SAMPLES) {
      const alpha = randomAlpha();
      const kit = fromRgb({
        r: rgb[0] * 255,
        g: rgb[1] * 255,
        b: rgb[2] * 255,
        alpha,
      });
      const expected = refCoords(ref('srgb', rgb), 'oklch');
      const err = lchError(kit, expected);
      lc.observe(err.lc, () => fmt(rgb));
      hue.observe(err.h, () => fmt(rgb));
      expect(kit.alpha).toBe(alpha);
    }
    lc.assert();
    hue.assert();
  });

  it('achromatic sRGB inputs produce ~zero chroma', () => {
    const tracker = new Tracker('grey -> OKLCH chroma', FLOAT_TOL);
    for (let byte = 0; byte <= 255; byte += 1) {
      const kit = fromRgb({ r: byte, g: byte, b: byte, alpha: 1 });
      tracker.observe(kit.c, () => `grey ${byte}`);
    }
    tracker.assert();
    expect(fromRgb({ r: 255, g: 255, b: 255, alpha: 1 }).l).toBeCloseTo(1, 12);
    expect(fromRgb({ r: 0, g: 0, b: 0, alpha: 1 }).l).toBe(0);
  });

  it('OKLCH <-> OKLab matches (toOklab / fromOklab)', () => {
    const toLab = new Tracker('OKLCH -> OKLab', FLOAT_TOL);
    const fromLabLc = new Tracker('OKLab -> OKLCH (L, C)', FLOAT_TOL);
    const fromLabH = new Tracker('OKLab -> OKLCH (h, deg)', HUE_TOL);
    for (const color of OKLCH_SAMPLES) {
      const lab = toOklab(color);
      const expected = refCoords(refFromColor(color), 'oklab');
      toLab.observe(vecError([lab.L, lab.a, lab.b], expected), () =>
        fmt([color.l, color.c, color.h]),
      );
      expect(lab.alpha).toBe(color.alpha);

      const back = fromOklab({
        L: expected[0],
        a: expected[1],
        b: expected[2],
        alpha: color.alpha,
      });
      const expectedLch = refCoords(ref('oklab', expected), 'oklch');
      const err = lchError(back, expectedLch);
      fromLabLc.observe(err.lc, () => fmt(expected));
      fromLabH.observe(err.h, () => fmt(expected));
    }
    toLab.assert();
    fromLabLc.assert();
    fromLabH.assert();
  });

  it('linear sRGB <-> OKLab matches', () => {
    const toLab = new Tracker('linear sRGB -> OKLab', FLOAT_TOL);
    const fromLab = new Tracker('OKLab -> linear sRGB', FLOAT_TOL);
    for (const rgb of SRGB_SAMPLES) {
      const linear = refCoords(ref('srgb', rgb), 'srgb-linear');
      const expectedLab = refCoords(ref('srgb', rgb), 'oklab');
      const lab = linearRgbToOklab({
        r: linear[0],
        g: linear[1],
        b: linear[2],
        alpha: 1,
      });
      toLab.observe(vecError([lab.L, lab.a, lab.b], expectedLab), () =>
        fmt(rgb),
      );
      const back = oklabToLinearRgb({
        L: expectedLab[0],
        a: expectedLab[1],
        b: expectedLab[2],
        alpha: 1,
      });
      fromLab.observe(vecError([back.r, back.g, back.b], linear), () =>
        fmt(rgb),
      );
    }
    toLab.assert();
    fromLab.assert();
  });

  it('sRGB transfer functions match', () => {
    const toLinear = new Tracker('sRGB -> linear sRGB', FLOAT_TOL);
    // linearToSrgb returns 8-bit channels by design (Rgb is 0-255 and the
    // high-level API rounds for CSS output), so it is compared against the
    // correctly rounded reference instead of a float tolerance.
    const fromLinear = new Tracker('linear sRGB -> sRGB (8-bit, LSB)', 0);
    for (const rgb of SRGB_SAMPLES) {
      const expectedLinear = refCoords(ref('srgb', rgb), 'srgb-linear');
      const linear = srgbToLinear({
        r: rgb[0] * 255,
        g: rgb[1] * 255,
        b: rgb[2] * 255,
        alpha: 1,
      });
      toLinear.observe(
        vecError([linear.r, linear.g, linear.b], expectedLinear),
        () => fmt(rgb),
      );
      const encoded = linearToSrgb({
        r: expectedLinear[0],
        g: expectedLinear[1],
        b: expectedLinear[2],
        alpha: 1,
      });
      fromLinear.observe(
        Math.max(
          byteError(encoded.r, rgb[0] * 255),
          byteError(encoded.g, rgb[1] * 255),
          byteError(encoded.b, rgb[2] * 255),
        ),
        () => fmt(rgb),
      );
    }
    toLinear.assert();
    fromLinear.assert();
  });

  it('OKLCH -> sRGB (toRgb) rounds to the reference 8-bit value', () => {
    // toRgb quantizes to 8-bit by design; see sRGB transfer test above.
    const tracker = new Tracker('OKLCH -> sRGB (8-bit, LSB)', 0);
    const linearTracker = new Tracker('OKLCH -> linear sRGB', FLOAT_TOL);
    for (const color of OKLCH_SAMPLES) {
      const reference = refFromColor(color);
      if (!reference.inGamut('srgb', { epsilon: 0 })) continue;
      const expected = refCoords(reference, 'srgb');
      const rgb = toRgb(color);
      tracker.observe(
        Math.max(
          byteError(rgb.r, expected[0] * 255),
          byteError(rgb.g, expected[1] * 255),
          byteError(rgb.b, expected[2] * 255),
        ),
        () => fmt([color.l, color.c, color.h]),
      );
      expect(rgb.alpha).toBe(color.alpha);

      const linear = oklabToLinearRgb(toOklab(color));
      linearTracker.observe(
        vecError(
          [linear.r, linear.g, linear.b],
          refCoords(reference, 'srgb-linear'),
        ),
        () => fmt([color.l, color.c, color.h]),
      );
    }
    tracker.assert();
    linearTracker.assert();
  });

  it('hex round trips through colorjs.io', () => {
    const toHexTracker = new Tracker('OKLCH -> hex (8-bit, LSB)', 0);
    const fromHexTracker = new Tracker('hex -> OKLCH (L, C)', FLOAT_TOL);
    const fromHexHue = new Tracker('hex -> OKLCH (h, deg)', HUE_TOL);
    for (let i = 0; i < 1500; i += 1) {
      const bytes: Vec3 = [randomByte(), randomByte(), randomByte()];
      const alphaByte = random() < 0.5 ? 255 : randomByte();
      const hex =
        '#' +
        [...bytes, ...(alphaByte === 255 ? [] : [alphaByte])]
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('');

      const kit = fromHex(hex);
      const reference = new ColorJs(hex);
      const err = lchError(kit, refCoords(reference, 'oklch'));
      fromHexTracker.observe(err.lc, () => hex);
      fromHexHue.observe(err.h, () => hex);
      expect(kit.alpha).toBeCloseTo(reference.alpha as number, 15);

      // Serialize and read back with colorjs.io.
      const serialized = toHex(kit);
      const parsedBack = new ColorJs(serialized);
      const back = refCoords(parsedBack, 'srgb').map((v) => v * 255);
      toHexTracker.observe(
        Math.max(
          Math.abs(back[0] - bytes[0]),
          Math.abs(back[1] - bytes[1]),
          Math.abs(back[2] - bytes[2]),
          Math.abs((parsedBack.alpha as number) * 255 - alphaByte),
        ),
        () => `${hex} -> ${serialized}`,
      );
    }
    // 3- and 4-digit shorthand.
    for (const hex of ['#fff', '#000', '#f00', '#0f08', '#abc', '#1234']) {
      const err = lchError(fromHex(hex), refCoords(new ColorJs(hex), 'oklch'));
      fromHexTracker.observe(err.lc, () => hex);
      fromHexHue.observe(err.h, () => hex);
    }
    toHexTracker.assert();
    fromHexTracker.assert();
    fromHexHue.assert();
  });

  it('sRGB <-> HSL matches', () => {
    const toHslTracker = new Tracker('sRGB -> HSL (s, l in %)', FLOAT_TOL);
    const toHslHue = new Tracker('sRGB -> HSL (h, deg)', HUE_TOL);
    // hslToRgb returns 8-bit channels (see sRGB transfer test).
    const fromHslTracker = new Tracker('HSL -> sRGB (8-bit, LSB)', 0);
    for (const rgb of SRGB_SAMPLES) {
      const hsl = rgbToHsl({
        r: rgb[0] * 255,
        g: rgb[1] * 255,
        b: rgb[2] * 255,
        alpha: 1,
      });
      const [h, s, l] = refCoords(ref('srgb', rgb), 'hsl');
      toHslTracker.observe(
        Math.max(Math.abs(hsl.s - s), Math.abs(hsl.l - l)),
        () => fmt(rgb),
      );
      // HSL hue is undefined for greys (colorjs.io returns NaN).
      if (Number.isFinite(h) && s > 1e-6) {
        toHslHue.observe(wrapHueDelta(hsl.h, h), () => fmt(rgb));
      }
    }

    // Include out-of-range / wrapping hues: CSS hue is periodic.
    const hues = [0, 360, 720, -90, -400, 359.999, 1e-4];
    for (let i = 0; i < 2000; i += 1) {
      const input = {
        h: i < hues.length ? hues[i] : random() * 360,
        s: random() * 100,
        l: random() * 100,
        alpha: 1,
      };
      const rgb = hslToRgb(input);
      const expected = refCoords(
        ref('hsl', [input.h, input.s, input.l]),
        'srgb',
      );
      fromHslTracker.observe(
        Math.max(
          byteError(rgb.r, expected[0] * 255),
          byteError(rgb.g, expected[1] * 255),
          byteError(rgb.b, expected[2] * 255),
        ),
        () => fmt([input.h, input.s, input.l]),
      );
    }
    toHslTracker.assert();
    toHslHue.assert();
    fromHslTracker.assert();
  });

  it('sRGB <-> HSV matches', () => {
    const toHsvTracker = new Tracker('sRGB -> HSV (s, v in %)', FLOAT_TOL);
    const toHsvHue = new Tracker('sRGB -> HSV (h, deg)', HUE_TOL);
    const fromHsvTracker = new Tracker('HSV -> sRGB (8-bit, LSB)', 0);
    for (const rgb of SRGB_SAMPLES) {
      const hsv = rgbToHsv({
        r: rgb[0] * 255,
        g: rgb[1] * 255,
        b: rgb[2] * 255,
        alpha: 1,
      });
      const [h, s, v] = refCoords(ref('srgb', rgb), 'hsv');
      toHsvTracker.observe(
        Math.max(Math.abs(hsv.s - s), Math.abs(hsv.v - v)),
        () => fmt(rgb),
      );
      if (Number.isFinite(h) && s > 1e-6) {
        toHsvHue.observe(wrapHueDelta(hsv.h, h), () => fmt(rgb));
      }
    }

    const hues = [0, 360, 720, -90, -400, 359.999, 1e-4];
    for (let i = 0; i < 2000; i += 1) {
      const input = {
        h: i < hues.length ? hues[i] : random() * 360,
        s: random() * 100,
        v: random() * 100,
        alpha: 1,
      };
      const rgb = hsvToRgb(input);
      const expected = refCoords(
        ref('hsv', [input.h, input.s, input.v]),
        'srgb',
      );
      fromHsvTracker.observe(
        Math.max(
          byteError(rgb.r, expected[0] * 255),
          byteError(rgb.g, expected[1] * 255),
          byteError(rgb.b, expected[2] * 255),
        ),
        () => fmt([input.h, input.s, input.v]),
      );
    }
    toHsvTracker.assert();
    toHsvHue.assert();
    fromHsvTracker.assert();
  });

  it('Color <-> HSL / HSV through the high-level API', () => {
    // toHsl/toHsv go through toRgb, which quantizes to 8-bit; compare
    // against colorjs.io applied to the same 8-bit sRGB value so this checks
    // the pipeline wiring rather than re-measuring quantization.
    const hslTracker = new Tracker('Color -> HSL (8-bit input, %)', FLOAT_TOL);
    const hsvTracker = new Tracker('Color -> HSV (8-bit input, %)', FLOAT_TOL);
    const fromTracker = new Tracker('HSL/HSV -> Color (L, C)', FLOAT_TOL);
    for (const color of OKLCH_SAMPLES.slice(0, 800)) {
      const rgb = toRgb(color);
      const quantized = ref('srgb', [rgb.r / 255, rgb.g / 255, rgb.b / 255]);
      const hsl = toHsl(color);
      const [, hs, hl] = refCoords(quantized, 'hsl');
      hslTracker.observe(
        Math.max(Math.abs(hsl.s - hs), Math.abs(hsl.l - hl)),
        () => fmt([color.l, color.c, color.h]),
      );
      const hsv = toHsv(color);
      const [, vs, vv] = refCoords(quantized, 'hsv');
      hsvTracker.observe(
        Math.max(Math.abs(hsv.s - vs), Math.abs(hsv.v - vv)),
        () => fmt([color.l, color.c, color.h]),
      );

      // fromHsl/fromHsv of the kit's own HSL/HSV must land on the same
      // 8-bit sRGB color, i.e. the same OKLCH as the quantized reference.
      const expected = refCoords(quantized, 'oklch');
      fromTracker.observe(lchError(fromHsl(hsl), expected).lc, () =>
        fmt([hsl.h, hsl.s, hsl.l]),
      );
      fromTracker.observe(lchError(fromHsv(hsv), expected).lc, () =>
        fmt([hsv.h, hsv.s, hsv.v]),
      );
    }
    hslTracker.assert();
    hsvTracker.assert();
    fromTracker.assert();
  });

  it('Display P3 <-> OKLCH matches', () => {
    const fromP3Lc = new Tracker('Display P3 -> OKLCH (L, C)', FLOAT_TOL);
    const fromP3H = new Tracker('Display P3 -> OKLCH (h, deg)', HUE_TOL);
    const toP3Tracker = new Tracker('OKLCH -> Display P3', FLOAT_TOL);
    const linearTracker = new Tracker('linear sRGB <-> linear P3', FLOAT_TOL);
    const transferTracker = new Tracker('P3 -> linear P3', FLOAT_TOL);
    for (const p3 of P3_SAMPLES) {
      const reference = ref('p3', p3);
      const expected = refCoords(reference, 'oklch');
      const kit = fromP3({ r: p3[0], g: p3[1], b: p3[2], alpha: 1 });
      const err = lchError(kit, expected);
      fromP3Lc.observe(err.lc, () => fmt(p3));
      fromP3H.observe(err.h, () => fmt(p3));

      // Compare against colorjs.io's own OKLCH -> P3 (not the original p3
      // input): the sRGB/P3 transfer function's two pieces do not meet
      // exactly at the 0.04045 knee, so a round trip there is only ~3e-8
      // accurate in both libraries.
      const back = toP3({
        l: expected[0],
        c: expected[1],
        h: expected[2],
        alpha: 1,
      });
      toP3Tracker.observe(
        vecError(
          [back.r, back.g, back.b],
          refCoords(ref('oklch', expected), 'p3'),
        ),
        () => fmt(p3),
      );

      const linearP3 = refCoords(reference, 'p3-linear');
      const linearSrgb = refCoords(reference, 'srgb-linear');
      const kitLinearP3 = p3ToLinearP3({
        r: p3[0],
        g: p3[1],
        b: p3[2],
        alpha: 1,
      });
      transferTracker.observe(
        vecError([kitLinearP3.r, kitLinearP3.g, kitLinearP3.b], linearP3),
        () => fmt(p3),
      );
      const toSrgb = linearP3ToLinearSrgb({
        r: linearP3[0],
        g: linearP3[1],
        b: linearP3[2],
        alpha: 1,
      });
      const toWide = linearSrgbToLinearP3({
        r: linearSrgb[0],
        g: linearSrgb[1],
        b: linearSrgb[2],
        alpha: 1,
      });
      linearTracker.observe(
        Math.max(
          vecError([toSrgb.r, toSrgb.g, toSrgb.b], linearSrgb),
          vecError([toWide.r, toWide.g, toWide.b], linearP3),
        ),
        () => fmt(p3),
      );
    }
    fromP3Lc.assert();
    fromP3H.assert();
    toP3Tracker.assert();
    linearTracker.assert();
    transferTracker.assert();
  });
});

// ─── CSS parsing / serialization ────────────────────────────────────

describe('reference accuracy: CSS parsing and serialization', () => {
  function cssSamples(): string[] {
    const samples: string[] = [
      '#fff',
      '#000000',
      '#ff000080',
      '#0f08',
      'rgb(255, 0, 0)',
      'rgba(0, 128, 255, 0.5)',
      'rgb(12 34 56)',
      'rgb(12 34 56 / 25%)',
      'hsl(0, 100%, 50%)',
      'hsla(210, 40%, 30%, 0.8)',
      'hsl(120deg 30% 60%)',
      'hsl(360 50% 50% / 0.3)',
      'oklch(0.7 0.15 30)',
      'oklch(70% 0.15 30)',
      'oklch(0.5 50% 200 / 50%)',
      'oklch(0.6 0.1 360)',
      'oklch(0.6 0 0)',
      'oklab(0.5 -0.1 0.1)',
      'oklab(50% 25% -25% / 0.4)',
      'color(display-p3 1 0 0)',
      'color(display-p3 0.2 0.6 0.4 / 0.75)',
    ];
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    for (let i = 0; i < 300; i += 1) {
      const [a, b, c] = randomUnitVec();
      const alpha = r3(random());
      samples.push(
        `rgb(${Math.round(a * 255)} ${Math.round(b * 255)} ${Math.round(c * 255)} / ${alpha})`,
        `hsl(${r3(a * 360)} ${r3(b * 100)}% ${r3(c * 100)}%)`,
        `oklch(${r3(a)} ${r3(b * 0.37)} ${r3(c * 360)} / ${alpha})`,
        `oklab(${r3(a)} ${r3((b - 0.5) * 0.8)} ${r3((c - 0.5) * 0.8)})`,
        `color(display-p3 ${r3(a)} ${r3(b)} ${r3(c)})`,
      );
    }
    return samples;
  }

  it('parse() matches colorjs.io for common formats', () => {
    const lc = new Tracker('parse() -> OKLCH (L, C)', FLOAT_TOL);
    const hue = new Tracker('parse() -> OKLCH (h, deg)', HUE_TOL);
    const alpha = new Tracker('parse() alpha', FLOAT_TOL);
    for (const css of cssSamples()) {
      const kit = parse(css);
      const reference = new ColorJs(css);
      const err = lchError(kit, refCoords(reference, 'oklch'));
      lc.observe(err.lc, () => css);
      hue.observe(err.h, () => css);
      alpha.observe(
        Math.abs(kit.alpha - (reference.alpha as number)),
        () => css,
      );
    }
    lc.assert();
    hue.assert();
    alpha.assert();
  });

  it('toCss() output reads back in colorjs.io within serialization rounding', () => {
    // Each format rounds to a fixed number of decimals, so the tolerance is
    // half a unit in the last serialized place (plus FLOAT_TOL):
    // - rgb/hex: 8-bit quantization -> 0.5 in 0-255 units
    // - hsl: 8-bit sRGB (toHsl goes through toRgb) and then h/s/l rounded to
    //   0.1, compared in sRGB 8-bit units. Channel sensitivities: d/dl <= 2,
    //   d/ds <= 0.5, d/dh <= 6 * (q - p) / 360 <= 1/60 per degree. So the
    //   bound is 0.5 (quantization) + 255 * (2 * 0.0005 + 0.5 * 0.0005 +
    //   0.05 / 60) = 0.5 + 0.255 + 0.064 + 0.2125 ~= 1.03
    // - oklch: L, C to 4 decimals (5e-5), h to 2 decimals (0.005 deg)
    // - oklab: 4 decimals (5e-5)
    // - p3: 4 decimals (5e-5)
    const rgbTracker = new Tracker(
      'toCss rgb/hex (8-bit units)',
      0.5 + FLOAT_TOL,
    );
    const hslTracker = new Tracker('toCss hsl (8-bit units)', 1.035);
    const oklchLc = new Tracker('toCss oklch (L, C)', 5e-5 + FLOAT_TOL);
    const oklchH = new Tracker('toCss oklch (h, deg)', 0.005 + HUE_TOL);
    const oklabTracker = new Tracker('toCss oklab', 5e-5 + FLOAT_TOL);
    const p3Tracker = new Tracker('toCss display-p3', 5e-5 + FLOAT_TOL);
    const alphaTracker = new Tracker('toCss alpha', 0.0005 + FLOAT_TOL);

    for (const color of OKLCH_SAMPLES.slice(0, 1200)) {
      const reference = refFromColor(color);
      const describeColor = () => fmt([color.l, color.c, color.h, color.alpha]);

      if (reference.inGamut('srgb', { epsilon: 0 })) {
        const expectedSrgb = refCoords(reference, 'srgb').map((v) => v * 255);
        for (const format of ['rgb', 'hex'] as const) {
          const back = new ColorJs(toCss(color, format));
          const got = refCoords(back, 'srgb').map((v) => v * 255) as Vec3;
          rgbTracker.observe(
            vecError(got, expectedSrgb as Vec3),
            describeColor,
          );
          // hex alpha is 8-bit, rgb alpha is 3 decimals.
          const alphaTol = format === 'hex' ? 0.5 / 255 - 0.0005 : 0;
          alphaTracker.observe(
            Math.max(
              0,
              Math.abs((back.alpha as number) - color.alpha) - alphaTol,
            ),
            describeColor,
          );
        }
        const hslBack = new ColorJs(toCss(color, 'hsl'));
        hslTracker.observe(
          vecError(
            refCoords(hslBack, 'srgb').map((v) => v * 255) as Vec3,
            expectedSrgb as Vec3,
          ),
          describeColor,
        );
      }

      const oklchBack = new ColorJs(toCss(color, 'oklch'));
      const err = lchError(
        { l: color.l, c: color.c, h: color.h },
        refCoords(oklchBack, 'oklch'),
      );
      oklchLc.observe(err.lc, describeColor);
      // Only compare hue when the serialized chroma is clearly chromatic.
      if (color.c >= 0.001) oklchH.observe(err.h, describeColor);
      alphaTracker.observe(
        Math.abs((oklchBack.alpha as number) - color.alpha),
        describeColor,
      );

      const oklabBack = new ColorJs(toCss(color, 'oklab'));
      oklabTracker.observe(
        vecError(refCoords(oklabBack, 'oklab'), refCoords(reference, 'oklab')),
        describeColor,
      );

      if (reference.inGamut('p3', { epsilon: 0 })) {
        const p3Back = new ColorJs(toCss(color, 'p3'));
        p3Tracker.observe(
          vecError(refCoords(p3Back, 'p3'), refCoords(reference, 'p3')),
          describeColor,
        );
      }
    }
    rgbTracker.assert();
    hslTracker.assert();
    oklchLc.assert();
    oklchH.assert();
    oklabTracker.assert();
    p3Tracker.assert();
    alphaTracker.assert();
  });
});

// ─── Gamut checks ───────────────────────────────────────────────────

describe('reference accuracy: gamut membership', () => {
  /**
   * Both libraries allow GAMUT_EPSILON (7.5e-5) of slack on the
   * gamma-encoded channels, so they must agree everywhere except within
   * float noise of that slack boundary. Samples whose worst encoded-channel
   * excursion is within NOISE_BAND of the epsilon are skipped.
   */
  const EPSILON = 0.000075;
  const NOISE_BAND = 1e-9;

  function encodedExcursion(encoded: Vec3): number {
    return Math.max(...encoded.map((v) => Math.max(-v, v - 1)));
  }

  function boundarySamples(space: 'srgb' | 'p3'): Color[] {
    // Colors a hair inside / outside each face of the target gamut (in
    // encoded units), plus very dark colors where a linear-light epsilon
    // used to admit chroma far outside the gamut.
    const offsets = [-1e-3, -1e-4, -7e-5, -5e-5, 0, 5e-5, 7e-5, 1e-4, 1e-3];
    const samples: Color[] = [];
    for (let i = 0; i < 600; i += 1) {
      const encoded = randomUnitVec();
      const channel = i % 3;
      const offset = offsets[i % offsets.length];
      encoded[channel] = offset < 0 ? offset : offset === 0 ? 0 : 1 + offset;
      const [l, c, h] = refCoords(ref(space, encoded), 'oklch');
      samples.push({ l, c, h: Number.isFinite(h) ? h : 0, alpha: 1 });
    }
    for (let i = 0; i < 400; i += 1) {
      samples.push({
        l: random() * 0.1,
        c: random() * 0.1,
        h: random() * 360,
        alpha: 1,
      });
    }
    for (const unit of EDGE_UNIT_RGB) {
      samples.push(
        space === 'p3'
          ? fromP3({ r: unit[0], g: unit[1], b: unit[2], alpha: 1 })
          : fromRgb({
              r: unit[0] * 255,
              g: unit[1] * 255,
              b: unit[2] * 255,
              alpha: 1,
            }),
      );
    }
    return samples;
  }

  function checkGamut(
    space: 'srgb' | 'p3',
    kitCheck: (color: Color) => boolean,
  ): { mismatches: string[]; skipped: number; inside: number; total: number } {
    const mismatches: string[] = [];
    let skipped = 0;
    let inside = 0;
    const samples = [...OKLCH_SAMPLES, ...boundarySamples(space)];
    for (const color of samples) {
      const reference = refFromColor(color);
      const excursion = encodedExcursion(refCoords(reference, space));
      if (Math.abs(excursion - EPSILON) <= NOISE_BAND) {
        skipped += 1;
        continue;
      }
      const expected = reference.inGamut(space);
      if (expected) inside += 1;
      if (kitCheck(color) !== expected) {
        mismatches.push(
          `${fmt([color.l, color.c, color.h])} expected ${expected} (excursion ${excursion})`,
        );
      }
    }
    return { mismatches, skipped, inside, total: samples.length };
  }

  for (const [space, kitCheck, label] of [
    ['srgb', inSrgbGamut, 'inSrgbGamut'],
    ['p3', inP3Gamut, 'inP3Gamut'],
  ] as const) {
    it(`${label} agrees with colorjs.io inGamut("${space}")`, () => {
      const result = checkGamut(space, kitCheck);
      new Tracker(`${label} mismatches (count)`, 0).observe(
        result.mismatches.length,
        () => result.mismatches.slice(0, 3).join('; '),
      );
      expect(result.mismatches).toEqual([]);
      // Sanity: the sample must exercise both sides of the boundary, and the
      // float-noise skip must stay negligible.
      expect(result.inside).toBeGreaterThan(300);
      expect(result.total - result.inside).toBeGreaterThan(300);
      expect(result.skipped).toBeLessThan(5);
    });
  }
});

// ─── Contrast ───────────────────────────────────────────────────────

describe('reference accuracy: contrast', () => {
  // color-kit's contrast functions evaluate the 8-bit sRGB value of each
  // color (via toRgb), so pairs are sampled as 8-bit sRGB to compare the
  // metric math itself.
  const pairs: [Vec3, Vec3][] = [
    [
      [0, 0, 0],
      [255, 255, 255],
    ],
    [
      [255, 255, 255],
      [0, 0, 0],
    ],
    [
      [119, 119, 119],
      [136, 136, 136],
    ],
    [
      [128, 128, 128],
      [128, 128, 128],
    ],
    [
      [255, 0, 0],
      [0, 0, 255],
    ],
    [
      [1, 1, 1],
      [2, 2, 2],
    ],
    ...Array.from({ length: 3000 }, (): [Vec3, Vec3] => [
      [randomByte(), randomByte(), randomByte()],
      [randomByte(), randomByte(), randomByte()],
    ]),
  ];

  const toColor = (bytes: Vec3): Color =>
    fromRgb({ r: bytes[0], g: bytes[1], b: bytes[2], alpha: 1 });
  const toRef = (bytes: Vec3): ColorJs =>
    ref('srgb', [bytes[0] / 255, bytes[1] / 255, bytes[2] / 255]);

  it('relative luminance and WCAG 2.1 ratio match', () => {
    // WCAG 2.1 defines relative luminance with the 4-digit coefficients
    // 0.2126 / 0.7152 / 0.0722 (used by color-kit), while colorjs.io reads Y
    // from its full-precision sRGB -> XYZ matrix (0.212639 / 0.715169 /
    // 0.072192). The per-coefficient differences are -3.9e-5 / +3.1e-5 /
    // +7.7e-6, so for linear channels in [0, 1] |dY| <= 3.9e-5. Each
    // (Y + 0.05) term then moves by at most 3.9e-5 / 0.05 = 7.8e-4 relative,
    // so the ratio moves by at most ~1.56e-3 relative. The tolerances below
    // are those analytic bounds, not fitted to the observed error.
    const luminance = new Tracker('relative luminance (Y)', 4e-5);
    const ratio = new Tracker('WCAG 2.1 ratio (relative)', 1.6e-3);
    for (const [a, b] of pairs) {
      const colorA = toColor(a);
      const colorB = toColor(b);
      luminance.observe(
        Math.abs(relativeLuminance(colorA) - toRef(a).luminance),
        () => fmt(a),
      );
      const expected = toRef(a).contrast(toRef(b), 'WCAG21');
      const got = contrastRatio(colorA, colorB);
      ratio.observe(
        Math.abs(got - expected) / expected,
        () => `${fmt(a)} vs ${fmt(b)}`,
      );
    }
    luminance.assert();
    ratio.assert();

    // Endpoints are exact regardless of coefficients.
    expect(
      contrastRatio(toColor([0, 0, 0]), toColor([255, 255, 255])),
    ).toBeCloseTo(21, 12);
  });

  it('APCA Lc matches APCA-W3 0.0.98G-4g (colorjs.io "APCA")', () => {
    // color-kit returns Lc / 100. colorjs.io's signature is
    // background.contrast(text, 'APCA').
    const tracker = new Tracker('APCA Lc (normalized)', FLOAT_TOL);
    for (const [text, background] of pairs) {
      const expected = toRef(background).contrast(toRef(text), 'APCA') / 100;
      const got = contrastAPCA(toColor(text), toColor(background));
      tracker.observe(
        Math.abs(got - expected),
        () => `${fmt(text)} on ${fmt(background)}`,
      );
    }
    tracker.assert();
  });
});

// ─── Gamut mapping ──────────────────────────────────────────────────

describe('reference accuracy: gamut mapping', () => {
  // Out-of-gamut samples with lightness away from the black/white endpoints
  // (color-kit snaps L <= 1e-9 / L >= 1 - 1e-9 to black/white first).
  const outOfGamut = OKLCH_SAMPLES.filter(
    (color) => color.l > 0.02 && color.l < 0.98 && color.c > 0.01,
  ).slice(0, 400);

  function deltaEOK(a: ColorJs, b: ColorJs): number {
    return a.deltaE(b, 'OK');
  }

  function percentile(sorted: number[], p: number): number {
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  }

  for (const [target, kitMap, kitIn] of [
    ['srgb', toSrgbGamut, inSrgbGamut],
    ['p3', toP3Gamut, inP3Gamut],
  ] as const) {
    it(`${target}: chroma reduction matches colorjs.io "oklch.c" (jnd 0, deltaEOK)`, () => {
      // toSrgbGamut/toP3Gamut bisect OKLCH chroma at fixed L and h until the
      // bracket is < 1e-4, returning the strictly in-gamut end. colorjs.io's
      // `{ method: 'oklch.c', deltaEMethod: 'OK', jnd: 0 }` is the same
      // algorithm (chroma reduction with no JND allowance), bisecting to
      // 1e-6 and then clipping. Expected |dC| <= 1e-4 (color-kit's bracket
      // width) + 1e-6 (colorjs.io's bracket).
      //
      // Inputs that color-kit already accepts as in gamut (within the
      // GAMUT_EPSILON slack, see the membership tests) are returned as-is by
      // design, while colorjs.io maps anything outside the exact gamut, so
      // those are excluded here.
      const chroma = new Tracker(`toGamut ${target} vs oklch.c (dC)`, 1.01e-4);
      const lh = new Tracker(`toGamut ${target} preserves L/h`, FLOAT_TOL);
      let mapped = 0;
      for (const color of outOfGamut) {
        const reference = refFromColor(color);
        if (reference.inGamut(target, { epsilon: 0 }) || kitIn(color)) continue;
        mapped += 1;
        const expected = refCoords(
          reference.clone().toGamut({
            space: target,
            method: 'oklch.c',
            deltaEMethod: 'OK',
            jnd: 0,
          }),
          'oklch',
        );
        const kit = kitMap(color);
        // Strictly in gamut per the reference (no epsilon).
        expect(refFromColor(kit).inGamut(target, { epsilon: 0 })).toBe(true);
        chroma.observe(Math.abs(kit.c - expected[1]), () =>
          fmt([color.l, color.c, color.h]),
        );
        lh.observe(
          Math.max(Math.abs(kit.l - color.l), Math.abs(kit.h - color.h)),
          () => fmt([color.l, color.c, color.h]),
        );
      }
      expect(mapped).toBeGreaterThan(200);
      chroma.assert();
      lh.assert();
    });

    it(`${target}: result is comparable to the CSS Color 4 "css" mapping`, () => {
      // CSS Color 4 gamut mapping (colorjs.io method "css") is intentionally
      // a different algorithm: it keeps reducing OKLCH chroma only until the
      // *clipped* color is within JND = 0.02 deltaEOK of the unclipped one,
      // then returns the clipped color. It therefore retains more chroma than
      // the exact boundary and lets L/h drift by up to a JND, while color-kit
      // preserves L and h exactly. How much extra chroma CSS keeps depends on
      // how slowly the clip error grows along the chroma ray, which is
      // largest near the blue/cyan cusps, so no tight analytic bound exists.
      //
      // Invariants checked instead:
      // - color-kit's result is in gamut (per colorjs.io) and never gains
      //   chroma;
      // - typical results agree to within one JND (median <= 0.02 dE_OK);
      // - the tail stays within a few JNDs (p95 <= 2 JND, max <= 4 JND),
      //   which guards against gross divergence (e.g. the pre-fix
      //   near-black behaviour) without pretending the methods are the same.
      const JND = 0.02;
      const inGamut = new Tracker(
        `toGamut ${target} result in colorjs gamut`,
        0,
      );
      const median = new Tracker(
        `toGamut ${target} vs CSS Color 4 (median dE_OK)`,
        JND,
      );
      const p95 = new Tracker(
        `toGamut ${target} vs CSS Color 4 (p95 dE_OK)`,
        2 * JND,
      );
      const max = new Tracker(
        `toGamut ${target} vs CSS Color 4 (max dE_OK)`,
        4 * JND,
      );
      const deltas: number[] = [];
      let worstSample = '';
      let worstDelta = -1;
      for (const color of outOfGamut) {
        const reference = refFromColor(color);
        if (reference.inGamut(target, { epsilon: 0 })) continue;
        const css = reference.clone().toGamut({ space: target, method: 'css' });
        const kit = kitMap(color);
        const kitRef = refFromColor(kit);
        inGamut.observe(kitRef.inGamut(target) ? 0 : 1, () =>
          fmt([color.l, color.c, color.h]),
        );
        const delta = deltaEOK(kitRef, css);
        deltas.push(delta);
        if (delta > worstDelta) {
          worstDelta = delta;
          worstSample = fmt([color.l, color.c, color.h]);
        }
        expect(kit.c).toBeLessThanOrEqual(color.c);
      }
      deltas.sort((a, b) => a - b);
      median.observe(percentile(deltas, 0.5), () => 'median');
      p95.observe(percentile(deltas, 0.95), () => 'p95');
      max.observe(deltas[deltas.length - 1], () => worstSample);
      inGamut.assert();
      median.assert();
      p95.assert();
      max.assert();
    });
  }
});

// ─── Interpolation ──────────────────────────────────────────────────

describe('reference accuracy: interpolation vs colorjs.io mix/range', () => {
  // Separate PRNG so these samples do not shift the shared sequence the
  // earlier suites draw from at test time.
  const mixRandom = createRandom(0x313a);

  const COLORJS_SPACE: Record<InterpolationSpace, string> = {
    oklch: 'oklch',
    oklab: 'oklab',
    srgb: 'srgb',
    'linear-srgb': 'srgb-linear',
    p3: 'p3',
    'linear-p3': 'p3-linear',
  };
  const RECTANGULAR: InterpolationSpace[] = [
    'oklab',
    'srgb',
    'linear-srgb',
    'p3',
    'linear-p3',
  ];
  const HUE_METHODS: HueInterpolationMethod[] = [
    'shorter',
    'longer',
    'increasing',
    'decreasing',
  ];
  // Interior positions only: t = 0 and t = 1 return the inputs exactly (see
  // the endpoint test below), whereas colorjs.io returns a round trip of its
  // gamut-mapped inputs.
  const T_VALUES = [0.1, 0.25, 0.5, 0.75, 0.9];

  function mixAlpha(): number {
    const roll = mixRandom();
    if (roll < 0.5) return 1;
    if (roll < 0.55) return 0;
    return Math.round(mixRandom() * 1000) / 1000;
  }

  /** In-sRGB-gamut colors (so colorjs.io's input gamut mapping is a no-op). */
  const IN_GAMUT: Color[] = [
    ...EDGE_UNIT_RGB,
    ...Array.from(
      { length: 300 },
      (): Vec3 => [mixRandom(), mixRandom(), mixRandom()],
    ),
  ].map((rgb) =>
    fromRgb({ r: rgb[0] * 255, g: rgb[1] * 255, b: rgb[2] * 255, alpha: 1 }),
  );
  // Achromatic OKLCH endpoints with arbitrary stored hues. (Chroma is exactly
  // 0: colorjs.io's range() drops the hue of tiny-but-nonzero OKLCH chroma on
  // input, which would make the reference disagree by up to that chroma.)
  IN_GAMUT.push(
    { l: 0.5, c: 0, h: 123, alpha: 1 },
    { l: 0.8, c: 0, h: 300, alpha: 1 },
  );
  const PAIRS: [Color, Color][] = IN_GAMUT.map((color, i) => [
    { ...color, alpha: mixAlpha() },
    { ...IN_GAMUT[(i * 7 + 3) % IN_GAMUT.length], alpha: mixAlpha() },
  ]);

  /**
   * OKLCH-only pairs around the powerless-hue epsilon, e.g.
   * oklch(0.5 0.00005 0), whose hue must still drive the mix. (Kept out of
   * the rectangular comparisons: colorjs.io's range() drops such tiny hues
   * when converting its inputs.)
   */
  const FAINT: Color[] = [
    { l: 0.5, c: 0.00005, h: 0, alpha: 1 },
    { l: 0.4, c: 0.00002, h: 200, alpha: 0.6 },
    { l: 0.7, c: 0.000004, h: 90, alpha: 1 },
    { l: 0.3, c: 0.000003, h: 300, alpha: 1 },
  ];
  const OKLCH_PAIRS: [Color, Color][] = [
    ...PAIRS,
    ...FAINT.flatMap((faint, i): [Color, Color][] => [
      [faint, PAIRS[i * 11][1]],
      [PAIRS[i * 17 + 1][0], faint],
      [faint, FAINT[(i + 1) % FAINT.length]],
    ]),
  ];

  /**
   * CSS Color 4 OKLCH epsilon (spec sample code `OKLab_to_OKLCH`:
   * `chroma <= 0.000004` makes the hue `none`). colorjs.io only treats an
   * OKLCH hue as powerless when it is `none`, so the reference marks exactly
   * those hues, and nothing above the epsilon.
   */
  const CSS_OKLCH_EPSILON = 0.000004;

  /** colorjs.io input; a powerless OKLCH hue becomes `none` (NaN). */
  function refInput(color: Color, powerlessHue: boolean): ColorJs {
    const hue =
      powerlessHue && color.c <= CSS_OKLCH_EPSILON ? Number.NaN : color.h;
    return ref('oklch', [color.l, color.c, hue], color.alpha);
  }

  function oklabOf(color: Color): Vec3 {
    const lab = toOklab(color);
    return [lab.L, lab.a, lab.b];
  }

  /**
   * CSS / colorjs.io keep the premultiplied (all-zero) channels when the
   * interpolated alpha is exactly 0; color-kit interpolates with straight
   * alpha there instead (documented deviation). Compare those samples against
   * colorjs.io's straight-alpha mix.
   */
  function premultipliedAt(
    a: Color,
    b: Color,
    t: number,
    premultiplied: boolean,
  ): boolean {
    return premultiplied && a.alpha + (b.alpha - a.alpha) * t !== 0;
  }

  function describePair(a: Color, b: Color, t: number): string {
    return fmt([a.l, a.c, a.h, a.alpha, b.l, b.c, b.h, b.alpha, t]);
  }

  it('t = 0 and t = 1 return the endpoints exactly in every space', () => {
    const spaces: InterpolationSpace[] = [...RECTANGULAR, 'oklch'];
    for (const space of spaces) {
      for (const [a, b] of OKLCH_PAIRS) {
        expect(mix(a, b, 0, { space })).toEqual(a);
        expect(mix(a, b, 1, { space })).toEqual(b);
        const scale = generateScale(a, b, 9, { space });
        expect(scale[0]).toEqual(a);
        expect(scale[8]).toEqual(b);
      }
    }
  });

  for (const space of RECTANGULAR) {
    it(`mix in ${space} matches colorjs.io mix (premultiplied)`, () => {
      const tracker = new Tracker(`mix in ${space} (OKLab)`, FLOAT_TOL);
      const alpha = new Tracker(`mix in ${space} (alpha)`, FLOAT_TOL);
      for (const [a, b] of PAIRS) {
        for (const t of T_VALUES) {
          const kit = mix(a, b, t, { space });
          const reference = refInput(a, false).mix(refInput(b, false), t, {
            space: COLORJS_SPACE[space],
            premultiplied: premultipliedAt(a, b, t, true),
          });
          const expected = refCoords(reference, 'oklab');
          tracker.observe(vecError(oklabOf(kit), expected), () =>
            describePair(a, b, t),
          );
          alpha.observe(Math.abs(kit.alpha - reference.alpha), () =>
            describePair(a, b, t),
          );
        }
      }
      tracker.assert();
      alpha.assert();
    });
  }

  for (const hue of HUE_METHODS) {
    for (const premultiplied of [false, true]) {
      it(`mix in oklch (hue: ${hue}, premultiplied: ${premultiplied}) matches colorjs.io`, () => {
        const label = `mix in oklch ${hue}${premultiplied ? ' premult' : ''}`;
        const lc = new Tracker(`${label} (L, C)`, FLOAT_TOL);
        const h = new Tracker(`${label} (h, deg)`, HUE_TOL);
        for (const [a, b] of OKLCH_PAIRS) {
          for (const t of T_VALUES) {
            const kit = mix(a, b, t, { space: 'oklch', hue, premultiplied });
            const reference = refInput(a, true).mix(refInput(b, true), t, {
              space: 'oklch',
              hue,
              premultiplied: premultipliedAt(a, b, t, premultiplied),
            });
            const [l, c, refHue] = reference.coords;
            const err = lchError(kit, [
              l ?? Number.NaN,
              c ?? Number.NaN,
              refHue ?? Number.NaN,
            ]);
            lc.observe(err.lc, () => describePair(a, b, t));
            h.observe(err.h, () => describePair(a, b, t));
          }
        }
        lc.assert();
        h.assert();
      });
    }
  }

  it('generateScale with a space matches colorjs.io steps', () => {
    const tracker = new Tracker('generateScale (OKLab)', FLOAT_TOL);
    const spaces: InterpolationSpace[] = [...RECTANGULAR, 'oklch'];
    for (const space of spaces) {
      for (const [a, b] of PAIRS.slice(0, 40)) {
        const kit = generateScale(a, b, 9, { space });
        const reference = refInput(a, true).steps(refInput(b, true), {
          space: COLORJS_SPACE[space],
          steps: 9,
          premultiplied: space !== 'oklch',
        });
        kit.forEach((color, i) => {
          // Endpoints are exact; covered by the endpoint test.
          if (i === 0 || i === 8) return;
          const t = i / 8;
          const stop = premultipliedAt(a, b, t, space !== 'oklch')
            ? reference[i]
            : refInput(a, true).mix(refInput(b, true), t, {
                space: COLORJS_SPACE[space],
                premultiplied: false,
              });
          tracker.observe(
            vecError(oklabOf(color), refCoords(stop, 'oklab')),
            () => `${space} ${describePair(a, b, i / 8)}`,
          );
        });
      }
    }
    tracker.assert();
  });

  it('extended-range (out-of-gamut) inputs are interpolated unclamped', () => {
    // colorjs.io's range() gamut-maps its inputs into the interpolation
    // space first, whereas CSS color-mix() (and color-kit) keep extended
    // values. So the reference here is built from colorjs.io conversions
    // plus a hand-written premultiplied lerp.
    const wide = OKLCH_SAMPLES.slice(0, 400);
    for (const space of RECTANGULAR) {
      const tracker = new Tracker(
        `mix in ${space}, extended (OKLab)`,
        FLOAT_TOL,
      );
      const id = COLORJS_SPACE[space];
      for (let i = 0; i < wide.length; i += 1) {
        const a = wide[i];
        const b = wide[(i * 13 + 5) % wide.length];
        const pa = refFromColor(a).to(id).coords;
        const pb = refFromColor(b).to(id).coords;
        for (const t of [0.25, 0.5, 0.8]) {
          const alpha = a.alpha + (b.alpha - a.alpha) * t;
          const premult = alpha !== 0;
          const coords = [0, 1, 2].map((k) => {
            const start = (pa[k] ?? 0) * (premult ? a.alpha : 1);
            const end = (pb[k] ?? 0) * (premult ? b.alpha : 1);
            const value = start + (end - start) * t;
            return premult ? value / alpha : value;
          }) as Vec3;
          const expected = refCoords(ref(id, coords, alpha), 'oklab');
          const kit = mix(a, b, t, { space });
          tracker.observe(vecError(oklabOf(kit), expected), () =>
            describePair(a, b, t),
          );
        }
      }
      tracker.assert();
    }
  });
});
