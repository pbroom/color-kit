import { describe, expect, it } from 'vitest';
import {
  assertGamut,
  chromaBand,
  contrastAPCA,
  contrastRatio,
  contrastRegionPaths,
  definePlane,
  displayP3,
  ensureContrast,
  GAMUT_EPSILON,
  gamutBoundaryPath,
  inGamut,
  inP3Gamut,
  inRec2020Gamut,
  inSrgbGamut,
  linearToSrgbChannel,
  maxChromaAt,
  maxChromaForHue,
  meetsAA,
  parse,
  rec2020,
  relativeLuminance,
  srgb,
  srgbToLinearChannel,
  toGamut,
  toGamutInto,
  toP3Gamut,
  toRec2020Gamut,
  toSrgbGamut,
  tryEnsureContrast,
  type Color,
  type Gamut,
  type PlaneQuery,
} from '../src/index.js';
import {
  linearToRec2020Channel,
  rec2020ToLinearChannel,
} from '../src/conversion/rec2020.js';
import { decodeTransfer, encodeTransfer } from '../src/gamut/transfer.js';
import {
  getPackedPlaneQueryTransferables,
  runPackedPlaneQueries,
  unpackPlaneQueryResults,
} from '../src/compute/index.js';
import {
  createPlaneQueryKey,
  runPlaneQueries,
  sense,
  srgb as planeSrgb,
  displayP3 as planeDisplayP3,
  rec2020 as planeRec2020,
} from '../src/plane/index.js';

const WHITE = parse('#ffffff');
const NAVY = parse('#111827');
const BLUE = parse('#3b82f6');
const oklch = (l: number, c: number, h: number): Color => ({
  l,
  c,
  h,
  alpha: 1,
});

const NEW_ERROR =
  /gamut "display-p3" is not a Gamut object; import one, such as displayP3/;

/** Every plane query kind that reads a gamut, with `gamut` filled in. */
function gamutQueries(gamut: Gamut): PlaneQuery[] {
  return [
    { kind: 'gamutBoundary', gamut, steps: 24 },
    { kind: 'gamutRegion', gamut },
    { kind: 'fallbackPoint', color: oklch(0.7, 0.6, 150), gamut },
    { kind: 'chromaBand', requestedChroma: 0.2, steps: 12, gamut },
    { kind: 'contrastBoundary', reference: WHITE, threshold: 4.5, gamut },
    { kind: 'contrastRegion', reference: NAVY, metric: 'apca', gamut },
    {
      kind: 'contrastPoint',
      color: oklch(0.8, 0.1, 264),
      reference: WHITE,
      gamut,
    },
  ];
}

describe('built-in gamut descriptors', () => {
  it('are the same objects on the root and plane entries', () => {
    expect(planeSrgb).toBe(srgb);
    expect(planeDisplayP3).toBe(displayP3);
    expect(planeRec2020).toBe(rec2020);
  });

  it('use the CSS color() space names as ids', () => {
    expect([srgb.id, displayP3.id, rec2020.id]).toEqual([
      'srgb',
      'display-p3',
      'rec2020',
    ]);
  });

  it('are plain data that survives structuredClone and JSON', () => {
    for (const gamut of [srgb, displayP3, rec2020]) {
      expect(structuredClone(gamut)).toEqual(gamut);
      expect(JSON.parse(JSON.stringify(gamut))).toEqual(gamut);
    }
  });

  it('carry transfer numbers that evaluate bit for bit like the named functions', () => {
    const samples = [
      -1.5, -1, -0.5, -0.04045, -0.0031308, -1e-9, -0, 0, 1e-12, 0.001,
      0.0031308, 0.0031309, 0.01, 0.04045, 0.04046, 0.18, 0.5, 0.735, 1,
      1.000075, 2.5,
    ];
    for (let index = 0; index <= 1000; index += 1) samples.push(index / 1000);
    for (const x of samples) {
      for (const gamut of [srgb, displayP3]) {
        expect(decodeTransfer(gamut.transfer, x)).toBe(srgbToLinearChannel(x));
        expect(encodeTransfer(gamut.transfer, x)).toBe(linearToSrgbChannel(x));
      }
      expect(decodeTransfer(rec2020.transfer, x)).toBe(
        rec2020ToLinearChannel(x),
      );
      expect(encodeTransfer(rec2020.transfer, x)).toBe(
        linearToRec2020Channel(x),
      );
    }
  });

  it('precompute linear bounds that match their transfer curve', () => {
    for (const gamut of [srgb, displayP3, rec2020]) {
      expect(gamut.linearMin).toBe(
        decodeTransfer(gamut.transfer, -GAMUT_EPSILON),
      );
      expect(gamut.linearMax).toBe(
        decodeTransfer(gamut.transfer, 1 + GAMUT_EPSILON),
      );
    }
  });
});

describe('a string gamut (the removed API)', () => {
  const p3 = 'display-p3' as never;

  it.each<[string, () => unknown]>([
    ['maxChromaAt', () => maxChromaAt(0.5, 200, { gamut: p3 })],
    ['maxChromaForHue', () => maxChromaForHue(200, { gamut: p3 })],
    [
      'maxChromaForHue (direct)',
      () => maxChromaForHue(200, { gamut: p3, method: 'direct' }),
    ],
    ['gamutBoundaryPath', () => gamutBoundaryPath(200, { gamut: p3 })],
    [
      'gamutBoundaryPath (adaptive)',
      () => gamutBoundaryPath(200, { gamut: p3, samplingMode: 'adaptive' }),
    ],
    ['chromaBand', () => chromaBand(200, 0.1, { gamut: p3 })],
    ['inGamut', () => inGamut(BLUE, p3)],
    ['toGamut', () => toGamut(BLUE, p3)],
    ['toGamutInto', () => toGamutInto({ ...BLUE }, BLUE, p3)],
    ['relativeLuminance', () => relativeLuminance(BLUE, { gamut: p3 })],
    ['contrastRatio', () => contrastRatio(BLUE, WHITE, { gamut: p3 })],
    ['contrastAPCA', () => contrastAPCA(BLUE, WHITE, { gamut: p3 })],
    ['meetsAA', () => meetsAA(BLUE, WHITE, false, { gamut: p3 })],
    [
      'contrastRegionPaths',
      () => contrastRegionPaths(WHITE, 200, { gamut: p3 }),
    ],
    ['ensureContrast', () => ensureContrast(BLUE, WHITE, { gamut: p3 })],
    ['tryEnsureContrast', () => tryEnsureContrast(BLUE, WHITE, { gamut: p3 })],
  ])('throws the descriptor TypeError from %s', (_name, run) => {
    expect(run).toThrow(TypeError);
    expect(run).toThrow(NEW_ERROR);
  });

  // Contrast and chroma-band queries return empty geometry on non-L×C
  // planes; the gamut must still be validated there.
  it.each(
    [definePlane({ fixed: { h: 264 } }), definePlane({ model: 'rgb' })].flatMap(
      (plane) =>
        gamutQueries(p3).map(
          (query) => [query.kind, plane.model, plane, query] as const,
        ),
    ),
  )(
    'throws the descriptor TypeError from the plane %s query on an %s plane',
    (_kind, _model, plane, query) => {
      const run = () => runPlaneQueries(plane, [query]);
      expect(run).toThrow(TypeError);
      expect(run).toThrow(NEW_ERROR);
    },
  );

  it('names the function, the value and the import', () => {
    expect(() => maxChromaAt(0.5, 200, { gamut: 'rec2020' as never })).toThrow(
      new TypeError(
        'maxChromaAt(): gamut "rec2020" is not a Gamut object; import one, such as displayP3',
      ),
    );
  });

  it('rejects other non-descriptors and accepts undefined', () => {
    for (const bad of [null, 3, {}, { id: 'srgb' }, { ...srgb, id: 7 }]) {
      expect(() => assertGamut(bad, 'f()')).toThrow(TypeError);
      expect(() => maxChromaAt(0.5, 200, { gamut: bad as never })).toThrow(
        TypeError,
      );
    }
    expect(() => assertGamut(undefined, 'f()')).not.toThrow();
    expect(maxChromaAt(0.5, 200, { gamut: undefined })).toBe(
      maxChromaAt(0.5, 200, { gamut: srgb }),
    );
  });
});

describe('the sRGB default', () => {
  it('equals passing the srgb descriptor, bit for bit', () => {
    const colors = [
      BLUE,
      NAVY,
      parse('#777'),
      oklch(0.7, 0.35, 150),
      oklch(0.4, 0.3, 30),
      oklch(0.95, 0.2, 100),
    ];
    for (const color of colors) {
      for (const precision of ['exact', '8bit'] as const) {
        expect(relativeLuminance(color, { precision, gamut: srgb })).toBe(
          relativeLuminance(color, { precision }),
        );
        expect(contrastAPCA(color, WHITE, { precision, gamut: srgb })).toBe(
          contrastAPCA(color, WHITE, { precision }),
        );
        expect(contrastRatio(color, NAVY, { precision, gamut: srgb })).toBe(
          contrastRatio(color, NAVY, { precision }),
        );
      }
      expect(inGamut(color, srgb)).toBe(inSrgbGamut(color));
      expect(toGamut(color, srgb)).toEqual(toSrgbGamut(color));
    }
    expect(ensureContrast(BLUE, WHITE, { gamut: srgb })).toEqual(
      ensureContrast(BLUE, WHITE),
    );
  });
});

describe('generic gamut functions', () => {
  it('agree with the named functions', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const c of [0.05, 0.2, 0.33, 0.45]) {
        for (const l of [0.02, 0.3, 0.6, 0.9]) {
          const color = oklch(l, c, h);
          expect(inGamut(color, displayP3)).toBe(inP3Gamut(color));
          expect(inGamut(color, rec2020)).toBe(inRec2020Gamut(color));
          expect(toGamut(color, displayP3)).toEqual(toP3Gamut(color));
          expect(toGamut(color, rec2020, { method: 'css' })).toEqual(
            toRec2020Gamut(color, { method: 'css' }),
          );
        }
      }
    }
  });

  it('toGamutInto writes into out and returns it', () => {
    const out = oklch(0, 0, 0);
    const color = oklch(0.7, 0.5, 150);
    expect(toGamutInto(out, color, rec2020)).toBe(out);
    expect(out).toEqual(toRec2020Gamut(color));
  });
});

describe.each<[string, Gamut, Gamut]>([
  ['a renamed copy of rec2020', rec2020, { ...rec2020, id: 'custom-wide' }],
  ['a structured clone of displayP3', displayP3, structuredClone(displayP3)],
  ['a structured clone of srgb', srgb, structuredClone(srgb)],
  [
    'a JSON round trip of rec2020',
    rec2020,
    JSON.parse(JSON.stringify(rec2020)) as Gamut,
  ],
])('a custom descriptor: %s', (_label, builtIn, custom) => {
  it('is a different object from the built-in', () => {
    expect(custom).not.toBe(builtIn);
  });

  it('gives the same gamut geometry', () => {
    for (const hue of [20, 150, 264]) {
      expect(maxChromaAt(0.6, hue, { gamut: custom })).toBe(
        maxChromaAt(0.6, hue, { gamut: builtIn }),
      );
      for (const method of ['direct', 'lut'] as const) {
        expect(maxChromaForHue(hue, { gamut: custom, method })).toEqual(
          maxChromaForHue(hue, { gamut: builtIn, method }),
        );
      }
      for (const samplingMode of ['uniform', 'adaptive'] as const) {
        expect(
          gamutBoundaryPath(hue, { gamut: custom, samplingMode, steps: 16 }),
        ).toEqual(
          gamutBoundaryPath(hue, { gamut: builtIn, samplingMode, steps: 16 }),
        );
      }
      expect(chromaBand(hue, 0.25, { gamut: custom })).toEqual(
        chromaBand(hue, 0.25, { gamut: builtIn }),
      );
      const color = oklch(0.7, 0.5, hue);
      expect(inGamut(color, custom)).toBe(inGamut(color, builtIn));
      expect(toGamut(color, custom)).toEqual(toGamut(color, builtIn));
    }
  });

  it('gives the same contrast results', () => {
    const vivid = oklch(0.75, 0.45, 145);
    for (const precision of ['exact', '8bit'] as const) {
      expect(contrastRatio(vivid, NAVY, { gamut: custom, precision })).toBe(
        contrastRatio(vivid, NAVY, { gamut: builtIn, precision }),
      );
      expect(contrastAPCA(vivid, NAVY, { gamut: custom, precision })).toBe(
        contrastAPCA(vivid, NAVY, { gamut: builtIn, precision }),
      );
    }
    expect(contrastRegionPaths(WHITE, 150, { gamut: custom })).toEqual(
      contrastRegionPaths(WHITE, 150, { gamut: builtIn }),
    );
    expect(ensureContrast(vivid, WHITE, { gamut: custom })).toEqual(
      ensureContrast(vivid, WHITE, { gamut: builtIn }),
    );
  });

  it.each([
    ['oklch l/c', definePlane({ fixed: { h: 264 } })],
    ['display-p3 r/g', definePlane({ model: 'display-p3', fixed: { b: 0 } })],
    [
      'hct h/c',
      definePlane({
        model: 'hct',
        x: { channel: 'h' },
        y: { channel: 'c' },
        fixed: { t: 60 },
      }),
    ],
  ])('gives the same plane query results on an %s plane', (_name, plane) => {
    const expected = runPlaneQueries(plane, gamutQueries(builtIn));
    const actual = runPlaneQueries(plane, gamutQueries(custom));
    expect(actual).toHaveLength(expected.length);
    actual.forEach((result, index) => {
      const want = expected[index];
      // Results carry the descriptor that went in; everything else is equal.
      if ('gamut' in result) expect(result.gamut).toBe(custom);
      expect({ ...result, gamut: undefined }).toEqual({
        ...want,
        gamut: undefined,
      });
    });
  });
});

describe('gamut identity is by id', () => {
  it('keys plane query caches on the id, not the descriptor contents', () => {
    const plane = definePlane({ fixed: { h: 264 } });
    const key = createPlaneQueryKey(plane, {
      kind: 'gamutRegion',
      gamut: displayP3,
    });
    expect(key).toContain('"gamut":{"id":"display-p3"}');
    expect(key).not.toContain('lmsToLinear');
    expect(
      createPlaneQueryKey(plane, {
        kind: 'gamutRegion',
        gamut: structuredClone(displayP3),
      }),
    ).toBe(key);
    expect(
      createPlaneQueryKey(plane, {
        kind: 'gamutRegion',
        gamut: { ...displayP3, id: 'other' },
      }),
    ).not.toBe(key);
    expect(createPlaneQueryKey(plane, { kind: 'gamutRegion' })).not.toBe(key);
  });

  it('picks id-specific solvers for clones', () => {
    const p3Plane = sense(
      definePlane({ model: 'display-p3', fixed: { b: 0 } }),
    );
    expect(p3Plane.gamutRegion({ gamut: displayP3 }).solver).toBe(
      'domain-edge',
    );
    expect(
      p3Plane.gamutRegion({ gamut: structuredClone(displayP3) }).solver,
    ).toBe('domain-edge');
    // Same data under another id is a different gamut to the solver policy.
    expect(
      p3Plane.gamutRegion({ gamut: { ...displayP3, id: 'my-p3' } }).solver,
    ).toBe('implicit-contour');
  });

  it('does not let a custom gamut reuse another gamut hue-cusp table', () => {
    const custom: Gamut = { ...rec2020, id: 'cusp-cache-check' };
    const wide = maxChromaForHue(150, { gamut: custom });
    const narrow = maxChromaForHue(150, { gamut: srgb });
    expect(wide.c).toBeGreaterThan(narrow.c + 0.1);
    expect(wide).toEqual(maxChromaForHue(150, { gamut: rec2020 }));
  });
});

describe('a gamut descriptor through the packed ABI', () => {
  const plane = definePlane({ fixed: { h: 150 } });

  it.each<[string, Gamut]>([
    ['rec2020', rec2020],
    ['a custom gamut', { ...rec2020, id: 'custom-wide' }],
    ['a structured clone', structuredClone(displayP3)],
  ])(
    'round-trips %s through pack, structured clone and unpack',
    (_n, gamut) => {
      // The worker path: the request is cloned into the worker, the packed
      // result is cloned (buffers transferred) back out.
      const request = structuredClone({ plane, queries: gamutQueries(gamut) });
      const packed = runPackedPlaneQueries(request);
      const received = structuredClone(packed, {
        transfer: getPackedPlaneQueryTransferables(packed),
      });
      const results = unpackPlaneQueryResults(received);
      const direct = runPlaneQueries(plane, gamutQueries(gamut));
      expect(results.map((result) => result.kind)).toEqual(
        direct.map((result) => result.kind),
      );
      results.forEach((result, index) => {
        const want = direct[index];
        if (!('gamut' in want)) {
          expect('gamut' in result).toBe(false);
          return;
        }
        const got = (result as { gamut: Gamut }).gamut;
        // Same shape as went in: a full, usable descriptor.
        expect(got).toEqual(gamut);
        expect(got.id).toBe(gamut.id);
        expect(maxChromaAt(0.6, 150, { gamut: got })).toBe(
          maxChromaAt(0.6, 150, { gamut }),
        );
      });
    },
  );
});

describe('contrast in any gamut', () => {
  it('contrastRatio accepts rec2020 and clips to it', () => {
    const gray = parse('#777');
    // In-gamut colors measure the same in every gamut (no clipping).
    expect(contrastRatio(gray, WHITE, { gamut: rec2020 })).toBeCloseTo(
      contrastRatio(gray, WHITE),
      12,
    );
    // Between P3 and Rec. 2020: measured unclipped in Rec. 2020, clipped
    // in Display P3.
    const vivid = oklch(0.8, 0.33, 150);
    expect(inRec2020Gamut(vivid)).toBe(true);
    expect(inP3Gamut(vivid)).toBe(false);
    const inRec = relativeLuminance(vivid, { gamut: rec2020 });
    const inP3 = relativeLuminance(vivid, { gamut: displayP3 });
    expect(Math.abs(inRec - inP3)).toBeGreaterThan(1e-4);
  });

  it("quantizes '8bit' in the gamut's own encoding", () => {
    // A Rec. 2020 gray: equal channels, so the display model reduces to one
    // channel quantized with the 2.4 power curve.
    const gray = parse('color(rec2020 0.42 0.42 0.42)');
    const byte = Math.round(0.42 * 255) / 255;
    const expected = rec2020ToLinearChannel(byte);
    expect(
      relativeLuminance(gray, { gamut: rec2020, precision: '8bit' }),
    ).toBeCloseTo(expected, 6);
    // The sRGB curve would quantize the same light to a different level.
    const viaSrgbCurve = srgbToLinearChannel(
      Math.round(linearToSrgbChannel(rec2020ToLinearChannel(0.42)) * 255) / 255,
    );
    expect(Math.abs(expected - viaSrgbCurve)).toBeGreaterThan(1e-4);
  });

  it('ensureContrast accepts rec2020 and returns an in-gamut passing color', () => {
    const vivid = oklch(0.85, 0.45, 150);
    const result = ensureContrast(vivid, WHITE, { gamut: rec2020 });
    expect(inRec2020Gamut(result)).toBe(true);
    expect(
      contrastRatio(result, WHITE, { gamut: rec2020 }),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(result, WHITE, { gamut: rec2020 })).toBeCloseTo(
      4.5,
      6,
    );
    expect(
      tryEnsureContrast(vivid, WHITE, { gamut: rec2020, threshold: 22 }),
    ).toBeNull();
  });
});

describe('review regressions', () => {
  const RGB_PLANE = definePlane({
    model: 'rgb',
    x: { channel: 'r' },
    y: { channel: 'g' },
    fixed: { b: 0 },
  });

  // A gamut strictly inside sRGB: sRGB red maps to (1.2, -0.1, -0.1).
  const k = 1 / 1.3;
  const fromLinearSrgb = [
    [1.2, -0.1, -0.1],
    [-0.1, 1.2, -0.1],
    [-0.1, -0.1, 1.2],
  ] as const;
  const multiply = (
    a: readonly (readonly number[])[],
    b: readonly (readonly number[])[],
  ) =>
    a.map((row) =>
      [0, 1, 2].map(
        (j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j],
      ),
    );
  const narrow = {
    ...srgb,
    id: 'narrow-test',
    fromLinearSrgb,
    toLinearSrgb: [
      [1.1 * k, 0.1 * k, 0.1 * k],
      [0.1 * k, 1.1 * k, 0.1 * k],
      [0.1 * k, 0.1 * k, 1.1 * k],
    ],
    lmsToLinear: multiply(fromLinearSrgb, srgb.lmsToLinear),
  } as unknown as Gamut;

  it('keeps the domain-edge shortcut for gamuts that contain sRGB', () => {
    for (const gamut of [srgb, planeDisplayP3, planeRec2020]) {
      const region = sense(RGB_PLANE).gamutRegion({ gamut });
      expect(region.solver).toBe('domain-edge');
    }
  });

  it('does not report an sRGB-model plane as fully inside a narrower gamut', () => {
    const red: Color = parse('#ff0000');
    expect(inGamut(red, narrow)).toBe(false);
    expect(inGamut(parse('#808080'), narrow)).toBe(true);
    const region = sense(RGB_PLANE).gamutRegion({ gamut: narrow });
    expect(region.solver).toBe('implicit-contour');
    expect(region.viewportRelation).not.toBe('inside');
  });

  it('never gives a string gamut the cache key of a descriptor', () => {
    const valid = createPlaneQueryKey(RGB_PLANE, {
      kind: 'gamutRegion',
      gamut: planeDisplayP3,
    });
    for (const gamut of ['display-p3', 'srgb', undefined]) {
      expect(
        createPlaneQueryKey(RGB_PLANE, {
          kind: 'gamutRegion',
          gamut,
        } as unknown as PlaneQuery),
      ).not.toBe(valid);
    }
    expect(
      createPlaneQueryKey(RGB_PLANE, {
        kind: 'gamutRegion',
        gamut: structuredClone(planeDisplayP3),
      }),
    ).toBe(valid);
  });
});
