/* global console, process */
/**
 * Plane-engine benchmark. Prints one JSON document on stdout.
 *
 * For every scenario it records three kinds of numbers:
 *
 * - `output`: path count, point count and a hash of the result with every
 *   number rounded to 6 decimals. Deterministic.
 * - `work`: solver work counters summed from `inspectPlaneQueries` traces
 *   (scalar-field samples, marching-squares cells and segments, solver
 *   points). Deterministic.
 * - timing: `medianMs` per call, and `relative`, the same time divided by a
 *   calibration workload (plain OKLCH → sRGB conversions) timed in the same
 *   round on the same machine. Only `relative` is comparable across machines.
 *
 * `plane-bench-check.mjs` gates these against `plane-bench.baseline.json`.
 * Run after build: pnpm --filter @color-kit/core build && pnpm --filter @color-kit/core bench:plane
 */

import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = resolve(here, '../dist/index.js');

if (!existsSync(distEntry)) {
  console.error(
    'Missing packages/core/dist/index.js. Run `pnpm --filter @color-kit/core build` first.',
  );
  process.exit(1);
}

const {
  definePlane,
  inspectPlaneQueries,
  parse,
  sense,
  toRgb,
  toSvgPath,
  toSvgCompoundPath,
} = await import(distEntry);

/** Untimed rounds before measuring, so the JIT has settled. */
const WARMUP = 3;
/** Timed rounds. Each round times the calibration loop, then every scenario. */
const ROUNDS = 15;
/** Each timed sample repeats its workload until it lasts about this long. */
const TARGET_SAMPLE_MS = 20;
/** Conversions per calibration call. */
const CALIBRATION_COLORS = 2000;
const HUES = [0, 45, 90, 135, 180, 225, 270, 315];
const THRESHOLDS = [3, 4.5, 7];
const WORK_COUNTERS = [
  'sampleCount',
  'cellCount',
  'segmentCount',
  'pointCount',
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}

/**
 * Hashes a result with every number rounded to 6 decimals, so last-bit
 * floating-point differences between platforms do not change the hash but
 * any visible change to the geometry does.
 */
function hashResult(value) {
  const hash = createHash('sha256');
  const visit = (node) => {
    if (typeof node === 'number') {
      const fixed = node.toFixed(6);
      hash.update(`${fixed === '-0.000000' ? '0.000000' : fixed};`);
    } else if (Array.isArray(node)) {
      hash.update('[');
      node.forEach(visit);
      hash.update(']');
    } else if (node !== null && typeof node === 'object') {
      hash.update('{');
      for (const key of Object.keys(node).sort()) {
        hash.update(`${key}:`);
        visit(node[key]);
      }
      hash.update('}');
    } else {
      hash.update(`${String(node)};`);
    }
  };
  visit(value);
  return hash.digest('hex').slice(0, 16);
}

const lcPlane = definePlane({
  model: 'oklch',
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0, 0.4] },
  fixed: { h: 0, alpha: 1 },
});
const hcPlane = definePlane({
  model: 'oklch',
  x: { channel: 'h', range: [0, 360] },
  y: { channel: 'c', range: [0, 0.4] },
  fixed: { l: 0.7, alpha: 1 },
});
const hlPlane = definePlane({
  model: 'oklch',
  x: { channel: 'h', range: [0, 360] },
  y: { channel: 'l', range: [0, 1] },
  fixed: { c: 0.15, alpha: 1 },
});
const oklabPlane = definePlane({ model: 'oklab' });
const hctPlane = definePlane({ model: 'hct' });
const query = sense(lcPlane);
const reference = parse('#ffffff');

const INTERACTIVE = { initialSamples: 8, errorTolerance: 0.004, maxDepth: 3 };

/**
 * `run` is the timed workload. `inspect` lists the same queries as
 * `[plane, queries]` groups so their solver traces can be summed into `work`.
 */
const scenarios = [
  {
    id: 'boundary',
    label: 'plane.gamutBoundary adaptive',
    run: () =>
      HUES.map((hue) =>
        query.gamutBoundary({
          gamut: 'display-p3',
          hue,
          samplingMode: 'adaptive',
          adaptiveTolerance: 0.001,
        }),
      ),
    inspect: [
      [
        lcPlane,
        HUES.map((hue) => ({
          kind: 'gamutBoundary',
          gamut: 'display-p3',
          hue,
          samplingMode: 'adaptive',
          adaptiveTolerance: 0.001,
        })),
      ],
    ],
  },
  {
    id: 'contrast',
    label: 'plane.contrastRegion defaults',
    run: () =>
      THRESHOLDS.map((threshold) =>
        query.contrastRegion({ reference, threshold }),
      ),
    inspect: [
      [
        lcPlane,
        THRESHOLDS.map((threshold) => ({
          kind: 'contrastRegion',
          reference,
          threshold,
        })),
      ],
    ],
  },
  {
    // The React useContrastRegion defaults, tuned for interactive use.
    id: 'contrastInteractive',
    label: 'plane.contrastRegion interactive',
    run: () =>
      THRESHOLDS.map((threshold) =>
        query.contrastRegion({ reference, threshold, ...INTERACTIVE }),
      ),
    inspect: [
      [
        lcPlane,
        THRESHOLDS.map((threshold) => ({
          kind: 'contrastRegion',
          reference,
          threshold,
          ...INTERACTIVE,
        })),
      ],
    ],
  },
  {
    id: 'compile',
    label: 'plane.compile svg',
    run: () => {
      const boundaryPath = query.gamutBoundary({
        gamut: 'srgb',
        hue: 220,
        samplingMode: 'adaptive',
      });
      const contrastRegion = query.contrastRegion({
        reference,
        threshold: 4.5,
      });

      const dA = toSvgPath(boundaryPath.points);
      const dB = toSvgCompoundPath(contrastRegion.paths, { closeLoop: true });
      return { pathA: dA.length, pathB: dB.length, hash: hashResult([dA, dB]) };
    },
    inspect: [
      [
        lcPlane,
        [
          {
            kind: 'gamutBoundary',
            gamut: 'srgb',
            hue: 220,
            samplingMode: 'adaptive',
          },
          { kind: 'contrastRegion', reference, threshold: 4.5 },
        ],
      ],
    ],
  },
  {
    // Closed-form solvers: analytic-lc, analytic-hc and analytic-hct.
    id: 'gamutRegionAnalytic',
    label: 'plane.gamutRegion analytic',
    run: () => [
      sense(lcPlane).gamutRegion({ gamut: 'srgb' }),
      sense(hcPlane).gamutRegion({ gamut: 'display-p3' }),
      sense(hctPlane).gamutRegion({ gamut: 'srgb' }),
    ],
    inspect: [
      [lcPlane, [{ kind: 'gamutRegion', gamut: 'srgb' }]],
      [hcPlane, [{ kind: 'gamutRegion', gamut: 'display-p3' }]],
      [hctPlane, [{ kind: 'gamutRegion', gamut: 'srgb' }]],
    ],
  },
  {
    // Scalar field + adaptive marching squares (implicit-contour solver).
    id: 'gamutRegionImplicit',
    label: 'plane.gamutRegion implicit',
    run: () => [
      sense(oklabPlane).gamutRegion({ gamut: 'srgb' }),
      sense(oklabPlane).gamutRegion({ gamut: 'display-p3', scope: 'full' }),
      sense(hlPlane).gamutRegion({ gamut: 'srgb' }),
    ],
    inspect: [
      [
        oklabPlane,
        [
          { kind: 'gamutRegion', gamut: 'srgb' },
          { kind: 'gamutRegion', gamut: 'display-p3', scope: 'full' },
        ],
      ],
      [hlPlane, [{ kind: 'gamutRegion', gamut: 'srgb' }]],
    ],
  },
];

// Calibration: object-returning OKLCH → sRGB conversions, the same kind of
// floating-point and short-lived-object work the plane solvers do.
const calibrationColors = Array.from(
  { length: CALIBRATION_COLORS },
  (_, index) => ({
    l: 0.05 + 0.9 * ((index * 0.6180339887) % 1),
    c: 0.3 * ((index * 0.7548776662) % 1),
    h: (index * 137.50776405) % 360,
    alpha: 1,
  }),
);
let calibrationSink = 0;
function calibrate() {
  let sum = 0;
  for (let index = 0; index < calibrationColors.length; index += 1) {
    const rgb = toRgb(calibrationColors[index]);
    sum += rgb.r + rgb.g + rgb.b;
  }
  calibrationSink += sum;
  return sum;
}

/** Times `iterations` calls and returns milliseconds per call. */
function sample(fn, iterations) {
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) fn();
  return (performance.now() - start) / iterations;
}

/** Picks how many calls make one sample last about TARGET_SAMPLE_MS. */
function pickIterations(fn) {
  let iterations = 1;
  for (;;) {
    const elapsed = sample(fn, iterations) * iterations;
    if (elapsed >= TARGET_SAMPLE_MS / 2) {
      return Math.max(1, Math.round((iterations * TARGET_SAMPLE_MS) / elapsed));
    }
    iterations *= 2;
  }
}

const workloads = [
  { fn: calibrate, runsMs: [] },
  ...scenarios.map((scenario) => ({
    fn: scenario.run,
    runsMs: [],
    relativeRuns: [],
  })),
];
for (const workload of workloads) {
  workload.iterations = pickIterations(workload.fn);
}
for (let roundIndex = -WARMUP; roundIndex < ROUNDS; roundIndex += 1) {
  // Calibration and scenarios are interleaved so each ratio compares samples
  // taken a few milliseconds apart, under the same machine load.
  let calibrationMs = 0;
  workloads.forEach((workload, index) => {
    const elapsed = sample(workload.fn, workload.iterations);
    if (index === 0) calibrationMs = elapsed;
    if (roundIndex < 0) return;
    workload.runsMs.push(elapsed);
    if (index > 0) workload.relativeRuns.push(elapsed / calibrationMs);
  });
}

if (!Number.isFinite(calibrationSink)) {
  throw new Error('Calibration workload produced a non-finite checksum.');
}

const cases = scenarios.map((scenario, index) => {
  const workload = workloads[index + 1];
  const result = scenario.run();
  const work = Object.fromEntries(WORK_COUNTERS.map((key) => [key, 0]));
  const output = { pathCount: 0, pointCount: 0, hash: hashResult(result) };
  const solvers = new Set();
  for (const [plane, queries] of scenario.inspect) {
    const inspections = inspectPlaneQueries(plane, queries, {
      level: 'summary',
    });
    for (const { trace } of inspections) {
      for (const key of WORK_COUNTERS) work[key] += trace.summary[key];
      output.pathCount += trace.summary.resultPathCount;
      output.pointCount += trace.summary.resultPointCount;
      if (trace.summary.solver) solvers.add(trace.summary.solver);
    }
  }
  return {
    id: scenario.id,
    label: scenario.label,
    medianMs: round(median(workload.runsMs), 4),
    relative: round(median(workload.relativeRuns), 4),
    iterations: workload.iterations,
    runsMs: workload.runsMs.map((value) => round(value, 4)),
    relativeRuns: workload.relativeRuns.map((value) => round(value, 4)),
    solvers: [...solvers],
    output,
    work,
    result,
  };
});

const byId = Object.fromEntries(cases.map((entry) => [entry.id, entry]));

console.log(
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      rounds: ROUNDS,
      warmup: WARMUP,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      calibration: {
        label: `toRgb x ${CALIBRATION_COLORS} (OKLCH → sRGB)`,
        medianMs: round(median(workloads[0].runsMs), 4),
        iterations: workloads[0].iterations,
        runsMs: workloads[0].runsMs.map((value) => round(value, 4)),
      },
      summary: {
        boundaryMedianMs: byId.boundary.medianMs,
        contrastMedianMs: byId.contrast.medianMs,
        contrastInteractiveMedianMs: byId.contrastInteractive.medianMs,
        compileMedianMs: byId.compile.medianMs,
        boundaryPointCount: byId.boundary.output.pointCount,
        contrastPointCount: byId.contrast.output.pointCount,
      },
      cases,
    },
    null,
    2,
  ),
);
