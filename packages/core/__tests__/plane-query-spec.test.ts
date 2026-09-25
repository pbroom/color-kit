import { describe, expect, it } from 'vitest';
import {
  createPlaneComputeScheduler,
  definePlane,
  fromHex,
  packPlaneQueryResults,
  parse,
  runPlaneQueries,
  unpackPlaneQueryResults,
  type PlaneComputeRequest,
  type PlaneDefinition,
  type PlaneQuery,
  type PlaneQueryResult,
} from '../src/index.js';
import {
  getPlaneQuerySpec,
  PLANE_QUERY_KINDS,
  PLANE_QUERY_SPECS,
} from '../src/plane/query-specs/index.js';

const ALL_KINDS = [
  'gamutBoundary',
  'gamutRegion',
  'contrastBoundary',
  'contrastRegion',
  'chromaBand',
  'fallbackPoint',
  'gradient',
] as const;

/** Rounds every float32-packed geometry value, leaving descriptor fields. */
function float32Geometry<T>(value: T, key?: string): T {
  if (typeof value === 'number') {
    return (key === 'hue' ? value : Math.fround(value)) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => float32Geometry(entry)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entry]) => [
        entryKey,
        float32Geometry(entry, entryKey),
      ]),
    ) as T;
  }
  return value;
}

function queriesForEveryKind(hue: number): PlaneQuery[] {
  return [
    { kind: 'gamutBoundary', gamut: 'display-p3', hue, steps: 24 },
    { kind: 'gamutRegion', gamut: 'srgb' },
    {
      kind: 'contrastBoundary',
      reference: parse('#ffffff'),
      hue,
      threshold: 4.5,
    },
    {
      kind: 'contrastRegion',
      reference: parse('#111827'),
      hue,
      metric: 'apca',
    },
    { kind: 'chromaBand', hue, requestedChroma: 0.12, steps: 16 },
    {
      kind: 'fallbackPoint',
      color: { l: 0.72, c: 0.38, h: hue, alpha: 1 },
      gamut: 'display-p3',
    },
    {
      kind: 'gradient',
      from: parse('#2563eb'),
      to: parse('#ef4444'),
      steps: 9,
    },
  ];
}

const ROUND_TRIP_PLANES: Array<[string, PlaneDefinition]> = [
  [
    'oklch l/c',
    {
      model: 'oklch',
      x: { channel: 'l', range: [0, 1] },
      y: { channel: 'c', range: [0, 0.4] },
      fixed: { h: 250 },
    },
  ],
  [
    'rgb r/g',
    {
      model: 'rgb',
      x: { channel: 'r' },
      y: { channel: 'g' },
      fixed: { b: 180 },
    },
  ],
  ['hsl h/s', { model: 'hsl', x: { channel: 'h' }, y: { channel: 's' } }],
];

describe('plane query spec registry', () => {
  it('registers every query kind under its own key', () => {
    expect([...PLANE_QUERY_KINDS].sort()).toEqual([...ALL_KINDS].sort());
    for (const kind of ALL_KINDS) {
      expect(PLANE_QUERY_SPECS[kind].kind).toBe(kind);
      expect(getPlaneQuerySpec(kind)).toBe(PLANE_QUERY_SPECS[kind]);
    }
  });

  it('rejects unknown kinds', () => {
    expect(() =>
      getPlaneQuerySpec('mystery' as unknown as (typeof ALL_KINDS)[number]),
    ).toThrow(/Unsupported plane query kind: mystery/);
  });

  describe.each(ROUND_TRIP_PLANES)('pack/unpack on %s', (_name, plane) => {
    const resolvedPlane = definePlane(plane as PlaneDefinition<'oklch'>);
    const results = runPlaneQueries(resolvedPlane, queriesForEveryKind(30));

    it.each(ALL_KINDS)('round-trips %s', (kind) => {
      const result = results.find(
        (entry): entry is PlaneQueryResult => entry.kind === kind,
      );
      expect(result).toBeDefined();
      const [unpacked] = unpackPlaneQueryResults(
        packPlaneQueryResults([result!]),
      );
      expect(unpacked).toEqual(float32Geometry(result));
    });

    it('round-trips every kind in one batch', () => {
      const unpacked = unpackPlaneQueryResults(packPlaneQueryResults(results));
      expect(unpacked).toEqual(float32Geometry(results));
    });
  });
});

/**
 * Golden scheduler bucket keys and budgets captured from the pre-registry
 * scheduler (main @ d992bc1) so the registry refactor keeps telemetry
 * buckets stable.
 */
function goldenCases(): Array<{
  name: string;
  request: PlaneComputeRequest;
  budget: number;
  bucketKey: string;
}> {
  const reference = fromHex('#ffffff');
  const dark = fromHex('#1a1a2e');
  const red = fromHex('#ff0000');
  const blue = fromHex('#0000ff');
  const lc: PlaneDefinition = {
    model: 'oklch',
    x: { channel: 'l', range: [0, 1] },
    y: { channel: 'c', range: [0, 0.4] },
    fixed: { h: 250 },
  };
  return [
    {
      name: 'gamut boundary',
      request: {
        plane: lc,
        queries: [{ kind: 'gamutBoundary', gamut: 'display-p3', steps: 64 }],
      },
      budget: 64,
      bucketKey:
        'gamutBoundary|gamutRegion:none|contrast:none|priority:idle|quality:medium|profile:balanced|budget:xs',
    },
    {
      name: 'gamut region default scope',
      request: { plane: lc, queries: [{ kind: 'gamutRegion', gamut: 'srgb' }] },
      budget: 4096,
      bucketKey:
        'gamutRegion|gamutRegion:srgb:viewport:oklch:l/c|contrast:none|priority:idle|quality:medium|profile:balanced|budget:lg',
    },
    {
      name: 'rgb full gamut region',
      request: {
        plane: { model: 'rgb', x: { channel: 'r' }, y: { channel: 'g' } },
        queries: [{ kind: 'gamutRegion', gamut: 'display-p3', scope: 'full' }],
      },
      budget: 6144,
      bucketKey:
        'gamutRegion|gamutRegion:display-p3:full:rgb:r/g|contrast:none|priority:idle|quality:medium|profile:balanced|budget:xl',
    },
    {
      name: 'contrast region hybrid wcag',
      request: {
        plane: lc,
        queries: [{ kind: 'contrastRegion', reference, metric: 'wcag' }],
      },
      budget: 1891,
      bucketKey:
        'contrastRegion|gamutRegion:none|contrast:wcag:hybrid|priority:idle|quality:medium|profile:balanced|budget:lg',
    },
    {
      name: 'contrast boundary adaptive apca',
      request: {
        plane: lc,
        queries: [
          {
            kind: 'contrastBoundary',
            reference: dark,
            metric: 'apca',
            apcaPolarity: 'positive',
            samplingMode: 'adaptive',
            adaptiveBaseSteps: 12,
          },
        ],
      },
      budget: 511,
      bucketKey:
        'contrastBoundary|gamutRegion:none|contrast:apca:adaptive:positive:sample-text|priority:idle|quality:medium|profile:balanced|budget:md',
    },
    {
      name: 'contrast region uniform drag',
      request: {
        plane: lc,
        priority: 'drag',
        quality: 'high',
        performanceProfile: 'performance',
        queries: [
          {
            kind: 'contrastRegion',
            reference,
            samplingMode: 'uniform',
            lightnessSteps: 32,
            chromaSteps: 32,
          },
        ],
      },
      budget: 1024,
      bucketKey:
        'contrastRegion|gamutRegion:none|contrast:wcag:uniform|priority:drag|quality:high|profile:performance|budget:md',
    },
    {
      name: 'mixed light queries',
      request: {
        plane: lc,
        queries: [
          { kind: 'chromaBand', requestedChroma: 0.1, steps: 24 },
          { kind: 'fallbackPoint', color: red, gamut: 'srgb' },
          { kind: 'gradient', from: red, to: blue, steps: 8 },
        ],
      },
      budget: 33,
      bucketKey:
        'chromaBand+fallbackPoint+gradient|gamutRegion:none|contrast:none|priority:idle|quality:medium|profile:balanced|budget:xs',
    },
    {
      name: 'hsl region plus apca contrast',
      request: {
        plane: { model: 'hsl', x: { channel: 'h' }, y: { channel: 's' } },
        queries: [
          { kind: 'gamutRegion' },
          {
            kind: 'contrastRegion',
            reference,
            metric: 'apca',
            apcaRole: 'sample-background',
            hybridErrorTolerance: 0.0005,
            hybridMaxDepth: 9,
          },
        ],
      },
      budget: 11586,
      bucketKey:
        'contrastRegion+gamutRegion|gamutRegion:srgb:viewport:hsl:h/s|contrast:apca:hybrid:absolute:sample-background|priority:idle|quality:medium|profile:balanced|budget:xl',
    },
  ];
}

describe('scheduler golden telemetry keys', () => {
  it.each(goldenCases().map((entry) => [entry.name, entry] as const))(
    '%s',
    (_name, entry) => {
      const budget = entry.request.queries.reduce(
        (total, query) => total + getPlaneQuerySpec(query.kind).budget(query),
        0,
      );
      expect(Math.max(1, budget)).toBe(entry.budget);

      const scheduler = createPlaneComputeScheduler();
      const response = scheduler.run(entry.request);
      expect(response.schedule?.bucketKey).toBe(entry.bucketKey);
    },
  );
});
