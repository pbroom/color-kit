/* global console, process */

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
  createPlaneQuery,
  resolvePlaneDefinition,
  parse,
  toSvgPath,
  toSvgCompoundPath,
} = await import(distEntry);

const WARMUP = 2;
const ROUNDS = 5;
const HUES = [0, 45, 90, 135, 180, 225, 270, 315];
const THRESHOLDS = [3, 4.5, 7];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function time(fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { elapsedMs: end - start, result };
}

function runCase(label, fn) {
  for (let i = 0; i < WARMUP; i += 1) fn();
  const elapsed = [];
  let result = null;
  for (let i = 0; i < ROUNDS; i += 1) {
    const run = time(fn);
    elapsed.push(run.elapsedMs);
    result = run.result;
  }
  return {
    label,
    medianMs: Number(median(elapsed).toFixed(3)),
    runsMs: elapsed.map((value) => Number(value.toFixed(3))),
    result,
  };
}

const plane = resolvePlaneDefinition({
  model: 'oklch',
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0, 0.4] },
  fixed: { h: 0, alpha: 1 },
});
const query = createPlaneQuery(plane);
const reference = parse('#ffffff');

const boundary = runCase('plane.gamutBoundary adaptive', () =>
  HUES.map((hue) =>
    query.gamutBoundary({
      gamut: 'display-p3',
      hue,
      samplingMode: 'adaptive',
      adaptiveTolerance: 0.001,
    }),
  ),
);

const contrast = runCase('plane.contrastRegion adaptive', () =>
  THRESHOLDS.map((threshold) =>
    query.contrastRegion({
      reference,
      threshold,
      samplingMode: 'adaptive',
      lightnessSteps: 48,
      chromaSteps: 48,
    }),
  ),
);

const compile = runCase('plane.compile svg', () => {
  const boundaryPath = query.gamutBoundary({
    gamut: 'srgb',
    hue: 220,
    samplingMode: 'adaptive',
  });
  const contrastRegion = query.contrastRegion({
    reference,
    threshold: 4.5,
    samplingMode: 'adaptive',
    lightnessSteps: 48,
    chromaSteps: 48,
  });

  const dA = toSvgPath(boundaryPath.points);
  const dB = toSvgCompoundPath(contrastRegion.paths, { closeLoop: true });
  return { pathA: dA.length, pathB: dB.length };
});

const boundaryPointCount = boundary.result.reduce(
  (total, current) => total + current.points.length,
  0,
);
const contrastPointCount = contrast.result.reduce(
  (total, current) =>
    total + current.paths.reduce((sum, path) => sum + path.length, 0),
  0,
);

console.log(
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      rounds: ROUNDS,
      warmup: WARMUP,
      summary: {
        boundaryMedianMs: boundary.medianMs,
        contrastMedianMs: contrast.medianMs,
        compileMedianMs: compile.medianMs,
        boundaryPointCount,
        contrastPointCount,
      },
      cases: [boundary, contrast, compile],
    },
    null,
    2,
  ),
);
