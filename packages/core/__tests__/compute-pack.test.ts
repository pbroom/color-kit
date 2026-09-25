import { describe, expect, it } from 'vitest';
import {
  definePlane,
  getPackedPlaneQueryTransferables,
  packPlaneQueryResults,
  parse,
  runPackedPlaneQueries,
  runPlaneQueries,
  unpackPlaneQueryResults,
  type PackedPlaneQueryResult,
  type PlaneQueryResult,
} from '../src/index.js';

function makePackedBoundaryResult(): PackedPlaneQueryResult {
  return {
    abiVersion: 2,
    queryDescriptors: [
      {
        kind: 'gamutBoundary',
        pathStart: 0,
        pathCount: 1,
        gamut: 'srgb',
        hue: 0,
      },
    ],
    pathRanges: Uint32Array.from([0, 2]),
    pointXY: Float32Array.from([0, 0, 1, 1]),
    pointLC: Float32Array.from([0, 0, 1, 1]),
    pointColorLcha: Float32Array.from(
      Array.from({ length: 8 }, () => Number.NaN),
    ),
  };
}

function expectInvalidPackedResult(packed: PackedPlaneQueryResult): void {
  expect(() => unpackPlaneQueryResults(packed)).toThrow(
    /Invalid packed plane query result/,
  );
}

function expectBoundaryPointsClose(
  actual: Array<{ x: number; y: number; l: number; c: number }>,
  expected: Array<{ x: number; y: number; l: number; c: number }>,
): void {
  expect(actual).toHaveLength(expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    expect(actual[index].x).toBeCloseTo(expected[index].x, 5);
    expect(actual[index].y).toBeCloseTo(expected[index].y, 5);
    expect(actual[index].l).toBeCloseTo(expected[index].l, 5);
    expect(actual[index].c).toBeCloseTo(expected[index].c, 5);
  }
}

function expectPlanePointsClose(
  actual: Array<{ x: number; y: number }>,
  expected: Array<{ x: number; y: number }>,
): void {
  expect(actual).toHaveLength(expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    expect(actual[index].x).toBeCloseTo(expected[index].x, 5);
    expect(actual[index].y).toBeCloseTo(expected[index].y, 5);
  }
}

function expectColorPointsClose(
  actual: Array<{
    x: number;
    y: number;
    color: { l: number; c: number; h: number; alpha: number };
  }>,
  expected: Array<{
    x: number;
    y: number;
    color: { l: number; c: number; h: number; alpha: number };
  }>,
): void {
  expect(actual).toHaveLength(expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    expect(actual[index].x).toBeCloseTo(expected[index].x, 5);
    expect(actual[index].y).toBeCloseTo(expected[index].y, 5);
    // Color payload uses Float32Array packing, so compare at float32-friendly precision.
    expect(actual[index].color.l).toBeCloseTo(expected[index].color.l, 4);
    expect(actual[index].color.c).toBeCloseTo(expected[index].color.c, 4);
    expect(actual[index].color.h).toBeCloseTo(expected[index].color.h, 4);
    expect(actual[index].color.alpha).toBeCloseTo(
      expected[index].color.alpha,
      4,
    );
  }
}

function expectQueryResultClose(
  actual: PlaneQueryResult,
  expected: PlaneQueryResult,
): void {
  expect(actual.kind).toBe(expected.kind);

  if (actual.kind === 'gamutBoundary' && expected.kind === 'gamutBoundary') {
    expect(actual.gamut).toBe(expected.gamut);
    expect(actual.hue).toBeCloseTo(expected.hue, 6);
    expectBoundaryPointsClose(actual.points, expected.points);
    return;
  }

  if (actual.kind === 'gamutRegion' && expected.kind === 'gamutRegion') {
    expect(actual.gamut).toBe(expected.gamut);
    expect(actual.scope).toBe(expected.scope);
    expect(actual.solver).toBe(expected.solver);
    expect(actual.viewportRelation).toBe(expected.viewportRelation);
    expect(actual.boundaryPaths).toHaveLength(expected.boundaryPaths.length);
    for (let index = 0; index < actual.boundaryPaths.length; index += 1) {
      expectPlanePointsClose(
        actual.boundaryPaths[index],
        expected.boundaryPaths[index],
      );
    }
    expect(actual.visibleRegion.paths).toHaveLength(
      expected.visibleRegion.paths.length,
    );
    for (let index = 0; index < actual.visibleRegion.paths.length; index += 1) {
      expectPlanePointsClose(
        actual.visibleRegion.paths[index],
        expected.visibleRegion.paths[index],
      );
    }
    return;
  }

  if (
    actual.kind === 'contrastBoundary' &&
    expected.kind === 'contrastBoundary'
  ) {
    expect(actual.hue).toBeCloseTo(expected.hue, 6);
    expectBoundaryPointsClose(actual.points, expected.points);
    return;
  }

  if (actual.kind === 'contrastRegion' && expected.kind === 'contrastRegion') {
    expect(actual.hue).toBeCloseTo(expected.hue, 6);
    expect(actual.paths).toHaveLength(expected.paths.length);
    for (let index = 0; index < actual.paths.length; index += 1) {
      expectBoundaryPointsClose(actual.paths[index], expected.paths[index]);
    }
    return;
  }

  if (actual.kind === 'chromaBand' && expected.kind === 'chromaBand') {
    expect(actual.hue).toBeCloseTo(expected.hue, 6);
    expectBoundaryPointsClose(actual.points, expected.points);
    return;
  }

  if (actual.kind === 'fallbackPoint' && expected.kind === 'fallbackPoint') {
    expect(actual.gamut).toBe(expected.gamut);
    expectColorPointsClose([actual.point], [expected.point]);
    return;
  }

  if (actual.kind === 'gradient' && expected.kind === 'gradient') {
    expectColorPointsClose(actual.points, expected.points);
    return;
  }

  throw new Error(
    `Unsupported query result pair: ${actual.kind}/${expected.kind}`,
  );
}

describe('plane compute packing', () => {
  it('round-trips batched plane query results through packed transfer format', () => {
    const resolvedPlane = definePlane({
      model: 'oklch',
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.4] },
      fixed: { h: 250, alpha: 1 },
    });

    const queries = [
      {
        kind: 'gamutBoundary' as const,
        gamut: 'display-p3' as const,
        samplingMode: 'adaptive' as const,
      },
      {
        kind: 'gamutRegion' as const,
        gamut: 'srgb' as const,
        scope: 'viewport' as const,
      },
      {
        kind: 'contrastBoundary' as const,
        reference: parse('#ffffff'),
        threshold: 4.5,
        lightnessSteps: 24,
        chromaSteps: 24,
      },
      {
        kind: 'contrastRegion' as const,
        reference: parse('#111827'),
        threshold: 3,
        lightnessSteps: 20,
        chromaSteps: 20,
      },
      {
        kind: 'chromaBand' as const,
        requestedChroma: 0.22,
        samplingMode: 'adaptive' as const,
      },
      {
        kind: 'fallbackPoint' as const,
        color: { l: 0.82, c: 0.34, h: 10, alpha: 1 },
        gamut: 'srgb' as const,
      },
      {
        kind: 'gradient' as const,
        from: parse('#2563eb'),
        to: parse('#ef4444'),
        steps: 9,
      },
    ];

    const expected = runPlaneQueries(resolvedPlane, queries);
    const packed = packPlaneQueryResults(expected);
    const unpacked = unpackPlaneQueryResults(packed);

    expect(unpacked).toHaveLength(expected.length);
    for (let index = 0; index < unpacked.length; index += 1) {
      expectQueryResultClose(unpacked[index], expected[index]);
    }
  });

  it('rejects gamut-region descriptors without regionPathStart', () => {
    expect(() =>
      unpackPlaneQueryResults({
        abiVersion: 2,
        queryDescriptors: [
          {
            kind: 'gamutRegion',
            pathStart: 0,
            pathCount: 1,
            regionPathCount: 1,
            gamut: 'srgb',
            scope: 'viewport',
            solver: 'implicit-contour',
            viewportRelation: 'intersects',
          } as unknown as PackedPlaneQueryResult['queryDescriptors'][number],
        ],
        pathRanges: Uint32Array.from([0, 2, 2, 3]),
        pointXY: Float32Array.from([0, 0, 1, 0, 0, 0, 1, 1, 0, 1]),
        pointLC: Float32Array.from(new Array(10).fill(Number.NaN)),
        pointColorLcha: Float32Array.from(new Array(20).fill(Number.NaN)),
      }),
    ).toThrow(/missing required field "regionPathStart"/);
  });

  it('rejects malformed packed path range buffers', () => {
    expectInvalidPackedResult({
      ...makePackedBoundaryResult(),
      pathRanges: Uint32Array.from([0]),
    });
  });

  it('rejects malformed point buffers', () => {
    expectInvalidPackedResult({
      ...makePackedBoundaryResult(),
      pointXY: Float32Array.from([0, 0, 1]),
    });

    expectInvalidPackedResult({
      ...makePackedBoundaryResult(),
      pointLC: Float32Array.from([0, 0]),
    });

    expectInvalidPackedResult({
      ...makePackedBoundaryResult(),
      pointColorLcha: Float32Array.from([0, 0, 0, 1]),
    });
  });

  it('rejects descriptor ranges outside packed paths', () => {
    expectInvalidPackedResult({
      ...makePackedBoundaryResult(),
      queryDescriptors: [
        {
          kind: 'gamutBoundary',
          pathStart: 1,
          pathCount: 1,
          gamut: 'srgb',
          hue: 0,
        },
      ],
    });
  });

  it('rejects path ranges outside packed points', () => {
    expectInvalidPackedResult({
      ...makePackedBoundaryResult(),
      pathRanges: Uint32Array.from([1, 2]),
    });
  });

  it('rejects gamut-region visible ranges outside packed paths', () => {
    expectInvalidPackedResult({
      ...makePackedBoundaryResult(),
      queryDescriptors: [
        {
          kind: 'gamutRegion',
          pathStart: 0,
          pathCount: 1,
          regionPathStart: 1,
          regionPathCount: 1,
          gamut: 'srgb',
          scope: 'viewport',
          solver: 'implicit-contour',
          viewportRelation: 'intersects',
        },
      ],
    });
  });

  it('keeps packed LC/LCHA schema stable for non-OKLCH planes', () => {
    const rgbPlane = definePlane({
      model: 'rgb',
      x: { channel: 'r', range: [0, 255] },
      y: { channel: 'g', range: [0, 255] },
      fixed: { b: 180, alpha: 1 },
    });

    const results = runPlaneQueries(rgbPlane, [
      {
        kind: 'gamutBoundary',
        gamut: 'srgb',
      },
      {
        kind: 'gamutRegion',
        gamut: 'display-p3',
      },
      {
        kind: 'fallbackPoint',
        color: parse('#ef4444'),
        gamut: 'display-p3',
      },
      {
        kind: 'gradient',
        from: parse('#2563eb'),
        to: parse('#ef4444'),
        steps: 5,
      },
    ]);

    const packed = packPlaneQueryResults(results);
    expect(packed.pointLC.length).toBe(packed.pointXY.length);
    for (let index = 0; index < packed.pointLC.length; index += 1) {
      expect(Number.isNaN(packed.pointLC[index])).toBe(true);
    }

    const unpacked = unpackPlaneQueryResults(packed);
    expect(unpacked).toHaveLength(4);
    expect(unpacked[0]).toMatchObject({ kind: 'gamutBoundary', points: [] });
    expect(unpacked[1]).toMatchObject({
      kind: 'gamutRegion',
      solver: 'domain-edge',
      viewportRelation: 'inside',
    });
    expect(unpacked[2]).toMatchObject({ kind: 'fallbackPoint' });
    expect(unpacked[3]).toMatchObject({ kind: 'gradient' });
  });

  it('returns transferable buffers for worker postMessage', () => {
    const resolvedPlane = definePlane({
      model: 'oklch',
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.4] },
      fixed: { h: 25, alpha: 1 },
    });

    const packed = runPackedPlaneQueries({
      plane: resolvedPlane,
      queries: [
        {
          kind: 'gamutBoundary',
          gamut: 'srgb',
          samplingMode: 'adaptive',
        },
      ],
    });
    const transferables = getPackedPlaneQueryTransferables(packed);

    expect(transferables).toHaveLength(4);
    expect(transferables[0]).toBe(packed.pathRanges.buffer);
    expect(transferables[1]).toBe(packed.pointXY.buffer);
    expect(transferables[2]).toBe(packed.pointLC.buffer);
    expect(transferables[3]).toBe(packed.pointColorLcha.buffer);
  });
});

type MutableDescriptor = Record<string, unknown>;

function strictFixture(): PackedPlaneQueryResult {
  const resolvedPlane = definePlane({
    model: 'oklch',
    x: { channel: 'l', range: [0, 1] },
    y: { channel: 'c', range: [0, 0.4] },
    fixed: { h: 250, alpha: 1 },
  });
  return packPlaneQueryResults(
    runPlaneQueries(resolvedPlane, [
      { kind: 'gamutBoundary', gamut: 'srgb', steps: 8 },
      { kind: 'gamutRegion', gamut: 'srgb' },
      {
        kind: 'contrastBoundary',
        reference: parse('#ffffff'),
        threshold: 4.5,
      },
      {
        kind: 'contrastRegion',
        reference: parse('#111827'),
        threshold: 3,
      },
      { kind: 'chromaBand', requestedChroma: 0.1, steps: 8 },
      {
        kind: 'fallbackPoint',
        color: { l: 0.7, c: 0.3, h: 250, alpha: 1 },
        gamut: 'srgb',
      },
      {
        kind: 'gradient',
        from: parse('#2563eb'),
        to: parse('#ef4444'),
        steps: 4,
      },
    ]),
  );
}

function clonePacked(packed: PackedPlaneQueryResult): PackedPlaneQueryResult {
  return {
    abiVersion: packed.abiVersion,
    queryDescriptors: packed.queryDescriptors.map((descriptor) => ({
      ...descriptor,
    })),
    pathRanges: packed.pathRanges.slice(),
    pointXY: packed.pointXY.slice(),
    pointLC: packed.pointLC.slice(),
    pointColorLcha: packed.pointColorLcha.slice(),
  };
}

function withDescriptor(
  kind: string,
  mutate: (descriptor: MutableDescriptor) => void,
): PackedPlaneQueryResult {
  const packed = clonePacked(strictFixture());
  const descriptor = packed.queryDescriptors.find(
    (entry) => entry.kind === kind,
  ) as unknown as MutableDescriptor | undefined;
  if (!descriptor) throw new Error(`fixture has no ${kind} descriptor`);
  mutate(descriptor);
  return packed;
}

function firstPointOf(packed: PackedPlaneQueryResult, kind: string): number {
  const descriptor = packed.queryDescriptors.find(
    (entry) => entry.kind === kind,
  );
  if (!descriptor) throw new Error(`fixture has no ${kind} descriptor`);
  for (
    let path = descriptor.pathStart;
    path < descriptor.pathStart + descriptor.pathCount;
    path += 1
  ) {
    if (packed.pathRanges[path * 2 + 1] > 0) {
      return packed.pathRanges[path * 2];
    }
  }
  throw new Error(`fixture ${kind} descriptor has no points`);
}

function expectDecodeError(
  packed: PackedPlaneQueryResult,
  message: RegExp,
): void {
  expect(() => unpackPlaneQueryResults(packed)).toThrow(
    /^Invalid packed plane query result: /,
  );
  expect(() => unpackPlaneQueryResults(packed)).toThrow(message);
}

const REQUIRED_DESCRIPTOR_FIELDS: Array<[string, string]> = [
  ...['pathStart', 'pathCount', 'gamut', 'hue'].map(
    (field) => ['gamutBoundary', field] as [string, string],
  ),
  ...[
    'pathStart',
    'pathCount',
    'regionPathStart',
    'regionPathCount',
    'gamut',
    'scope',
    'solver',
    'viewportRelation',
  ].map((field) => ['gamutRegion', field] as [string, string]),
  ...['pathStart', 'pathCount', 'hue'].map(
    (field) => ['contrastBoundary', field] as [string, string],
  ),
  ...['pathStart', 'pathCount', 'hue'].map(
    (field) => ['contrastRegion', field] as [string, string],
  ),
  ...['pathStart', 'pathCount', 'hue'].map(
    (field) => ['chromaBand', field] as [string, string],
  ),
  ...['pathStart', 'pathCount', 'gamut'].map(
    (field) => ['fallbackPoint', field] as [string, string],
  ),
  ...['pathStart', 'pathCount'].map(
    (field) => ['gradient', field] as [string, string],
  ),
];

describe('strict packed plane query ABI', () => {
  it('decodes the unmodified fixture', () => {
    const packed = strictFixture();
    expect(packed.abiVersion).toBe(2);
    expect(unpackPlaneQueryResults(packed)).toHaveLength(7);
  });

  it.each(REQUIRED_DESCRIPTOR_FIELDS)(
    'rejects a %s descriptor missing %s',
    (kind, field) => {
      expectDecodeError(
        withDescriptor(kind, (descriptor) => {
          delete descriptor[field];
        }),
        new RegExp(`missing required field "${field}"`),
      );
    },
  );

  it.each([
    ['gamutBoundary', 'gamut', 'rec2020'],
    ['fallbackPoint', 'gamut', 'rec2020'],
    ['gamutRegion', 'gamut', 'rec2020'],
    ['gamutRegion', 'scope', 'everything'],
    ['gamutRegion', 'solver', 'guess'],
    ['gamutRegion', 'viewportRelation', 'nearby'],
  ])('rejects %s with an invalid %s', (kind, field, value) => {
    expectDecodeError(
      withDescriptor(kind, (descriptor) => {
        descriptor[field] = value;
      }),
      new RegExp(`invalid ${field}`),
    );
  });

  it.each([
    'gamutBoundary',
    'contrastBoundary',
    'contrastRegion',
    'chromaBand',
  ])('rejects a non-finite %s hue', (kind) => {
    for (const hue of [Number.NaN, Number.POSITIVE_INFINITY, '30']) {
      expectDecodeError(
        withDescriptor(kind, (descriptor) => {
          descriptor.hue = hue;
        }),
        /hue must be a finite number/,
      );
    }
  });

  it('rejects unknown kinds', () => {
    expectDecodeError(
      withDescriptor('gradient', (descriptor) => {
        descriptor.kind = 'sparkle';
      }),
      /unknown kind "sparkle"/,
    );
  });

  it.each([
    ['missing', undefined],
    ['old', 1],
    ['future', 3],
    ['string', '2'],
  ])('rejects a %s abiVersion', (_label, abiVersion) => {
    const packed = clonePacked(strictFixture()) as unknown as Record<
      string,
      unknown
    >;
    if (abiVersion === undefined) {
      delete packed.abiVersion;
    } else {
      packed.abiVersion = abiVersion;
    }
    expectDecodeError(
      packed as unknown as PackedPlaneQueryResult,
      /abiVersion must be 2/,
    );
  });

  it.each(['gamutBoundary', 'contrastRegion', 'chromaBand'])(
    'rejects NaN lightness/chroma in %s points',
    (kind) => {
      const packed = clonePacked(strictFixture());
      const point = firstPointOf(packed, kind);
      packed.pointLC[point * 2 + 1] = Number.NaN;
      expectDecodeError(packed, /non-finite l\/c/);
    },
  );

  it.each(['fallbackPoint', 'gradient'])(
    'rejects NaN color channels in %s points',
    (kind) => {
      const packed = clonePacked(strictFixture());
      const point = firstPointOf(packed, kind);
      packed.pointColorLcha[point * 4 + 2] = Number.NaN;
      expectDecodeError(packed, /non-finite color/);
    },
  );

  it('rejects NaN plane coordinates', () => {
    const packed = clonePacked(strictFixture());
    packed.pointXY[firstPointOf(packed, 'gamutRegion') * 2] = Number.NaN;
    expectDecodeError(packed, /non-finite x\/y/);
  });

  it.each([0, 2])('rejects a fallbackPoint path with %i points', (count) => {
    const packed = clonePacked(strictFixture());
    const descriptor = packed.queryDescriptors.find(
      (entry) => entry.kind === 'fallbackPoint',
    )!;
    const offset = descriptor.pathStart * 2;
    const start = packed.pathRanges[offset];
    packed.pathRanges[offset + 1] = count;
    if (count === 2) {
      // Borrow the next point so the range stays inside the point buffers.
      expect(start + 2).toBeLessThanOrEqual(packed.pointXY.length / 2);
    }
    expectDecodeError(packed, /must contain exactly 1 point/);
  });

  it.each(['gamutBoundary', 'contrastBoundary', 'chromaBand', 'gradient'])(
    'rejects a single-path %s descriptor with pathCount 0',
    (kind) => {
      expectDecodeError(
        withDescriptor(kind, (descriptor) => {
          descriptor.pathCount = 0;
        }),
        /pathCount must be 1, received 0/,
      );
    },
  );

  it('rejects a regionPathStart that does not follow the boundary paths', () => {
    expectDecodeError(
      withDescriptor('gamutRegion', (descriptor) => {
        descriptor.regionPathStart = (descriptor.regionPathStart as number) + 1;
      }),
      /regionPathStart must equal pathStart \+ pathCount/,
    );
  });

  it('rejects overlapping descriptor ranges', () => {
    expectDecodeError(
      withDescriptor('contrastBoundary', (descriptor) => {
        descriptor.pathStart = (descriptor.pathStart as number) - 1;
      }),
      /contiguous and ordered/,
    );
  });

  it('rejects out-of-order descriptors', () => {
    const packed = clonePacked(strictFixture());
    const [first, second, ...rest] = packed.queryDescriptors;
    packed.queryDescriptors = [second, first, ...rest];
    expectDecodeError(packed, /contiguous and ordered/);
  });

  it('rejects paths not covered by any descriptor', () => {
    const packed = clonePacked(strictFixture());
    packed.queryDescriptors = packed.queryDescriptors.slice(0, -1);
    expectDecodeError(packed, /descriptors cover \d+ paths but pathRanges/);
  });

  it('rejects truncated pointLC buffers', () => {
    const packed = clonePacked(strictFixture());
    packed.pointLC = packed.pointLC.slice(0, packed.pointLC.length - 2);
    expectDecodeError(packed, /pointLC length must match/);
  });

  it('rejects non-integer path offsets', () => {
    expectDecodeError(
      withDescriptor('gradient', (descriptor) => {
        descriptor.pathStart = 0.5;
      }),
      /pathStart must be a non-negative integer/,
    );
  });
});

describe('unpackPlaneQueryResults() buffer checks', () => {
  const BUFFER_FIELDS = [
    ['pathRanges', 'Uint32Array'],
    ['pointXY', 'Float32Array'],
    ['pointLC', 'Float32Array'],
    ['pointColorLcha', 'Float32Array'],
  ] as const;

  it.each(BUFFER_FIELDS)('rejects a missing %s buffer', (field) => {
    const packed = makePackedBoundaryResult() as unknown as Record<
      string,
      unknown
    >;
    delete packed[field];
    expectDecodeError(
      packed as unknown as PackedPlaneQueryResult,
      new RegExp(`${field} is required`),
    );
  });

  it.each(BUFFER_FIELDS)(
    'rejects a %s buffer of the wrong typed-array type',
    (field, typeName) => {
      const packed = makePackedBoundaryResult() as unknown as Record<
        string,
        unknown
      >;
      packed[field] = Float64Array.from(packed[field] as ArrayLike<number>);
      expectDecodeError(
        packed as unknown as PackedPlaneQueryResult,
        new RegExp(`${field} must be a ${typeName}`),
      );
    },
  );

  it('rejects plain arrays in place of typed arrays', () => {
    const packed = makePackedBoundaryResult() as unknown as Record<
      string,
      unknown
    >;
    packed.pointXY = [0, 0, 1, 1];
    expectDecodeError(
      packed as unknown as PackedPlaneQueryResult,
      /pointXY must be a Float32Array/,
    );
  });
});

describe('packPlaneQueryResults() producer checks', () => {
  const plane = definePlane({
    model: 'oklch',
    x: { channel: 'l', range: [0, 1] },
    y: { channel: 'c', range: [0, 0.4] },
    fixed: { h: 250, alpha: 1 },
  });

  it('rejects non-finite lightness/chroma', () => {
    const [boundary] = runPlaneQueries(plane, [
      { kind: 'gamutBoundary', gamut: 'srgb', steps: 4 },
    ]);
    if (boundary.kind !== 'gamutBoundary') throw new Error('unexpected kind');
    boundary.points[1] = { ...boundary.points[1], c: Number.NaN };
    expect(() => packPlaneQueryResults([boundary])).toThrow(
      /Cannot pack plane query result: query 0 \(gamutBoundary\) point 1 c is not finite/,
    );
  });

  it('rejects non-finite colors', () => {
    const [gradient] = runPlaneQueries(plane, [
      {
        kind: 'gradient',
        from: parse('#000000'),
        to: parse('#ffffff'),
        steps: 3,
      },
    ]);
    if (gradient.kind !== 'gradient') throw new Error('unexpected kind');
    gradient.points[2] = {
      ...gradient.points[2],
      color: { ...gradient.points[2].color, h: Number.NaN },
    };
    expect(() => packPlaneQueryResults([gradient])).toThrow(
      /point 2 color\.h is not finite/,
    );
  });

  it('rejects finite coordinates that overflow Float32', () => {
    const [boundary] = runPlaneQueries(plane, [
      { kind: 'gamutBoundary', gamut: 'srgb', steps: 4 },
    ]);
    if (boundary.kind !== 'gamutBoundary') throw new Error('unexpected kind');
    boundary.points[1] = { ...boundary.points[1], x: 1e40 };
    expect(() => packPlaneQueryResults([boundary])).toThrow(
      /Cannot pack plane query result: query 0 \(gamutBoundary\) point 1 x is outside the Float32 range \(1e\+40\)/,
    );
  });

  it('rejects finite colors that overflow Float32', () => {
    const [gradient] = runPlaneQueries(plane, [
      {
        kind: 'gradient',
        from: parse('#000000'),
        to: parse('#ffffff'),
        steps: 3,
      },
    ]);
    if (gradient.kind !== 'gradient') throw new Error('unexpected kind');
    gradient.points[0] = {
      ...gradient.points[0],
      color: { ...gradient.points[0].color, c: Number.MAX_VALUE },
    };
    expect(() => packPlaneQueryResults([gradient])).toThrow(
      /point 0 color\.c is outside the Float32 range/,
    );
  });

  it('packs values at the Float32 limit', () => {
    const [boundary] = runPlaneQueries(plane, [
      { kind: 'gamutBoundary', gamut: 'srgb', steps: 4 },
    ]);
    if (boundary.kind !== 'gamutBoundary') throw new Error('unexpected kind');
    const float32Max = 3.4028234663852886e38;
    boundary.points[1] = { ...boundary.points[1], l: float32Max };
    const packed = packPlaneQueryResults([boundary]);
    expect(Number.isFinite(packed.pointLC[2])).toBe(true);
    expect(() => unpackPlaneQueryResults(packed)).not.toThrow();
  });
});
