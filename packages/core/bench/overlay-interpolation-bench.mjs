/* global console, process */
/**
 * Benchmark point count and compute time for gamut boundary and contrast
 * region paths across quality options (uniform, adaptive, simplifyTolerance).
 * Run after build: pnpm --filter @color-kit/core build && node bench/overlay-interpolation-bench.mjs
 */

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

const { gamutBoundaryPath, contrastRegionPaths, fromHex } = await import(
  distEntry
);

const WARMUP = 2;
const MEASURE_ROUNDS = 5;
const HUE = 180;

function timeMs(fn) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function median(times) {
  const s = [...times].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

console.log('--- Gamut boundary (hue=180, srgb) ---\n');

const uniform64 = () => gamutBoundaryPath(HUE, { gamut: 'srgb', steps: 64 });
for (let i = 0; i < WARMUP; i++) uniform64();
const t1 = [];
for (let i = 0; i < MEASURE_ROUNDS; i++) t1.push(timeMs(uniform64));
const p1 = uniform64();
console.log(
  `uniform steps=64:     points=${p1.length}  median=${median(t1).toFixed(2)}ms`,
);

const uniformSimplify = () =>
  gamutBoundaryPath(HUE, {
    gamut: 'srgb',
    steps: 64,
    simplifyTolerance: 0.0015,
  });
for (let i = 0; i < WARMUP; i++) uniformSimplify();
const t2 = [];
for (let i = 0; i < MEASURE_ROUNDS; i++) t2.push(timeMs(uniformSimplify));
const p2 = uniformSimplify();
console.log(
  `uniform+simplify:    points=${p2.length}  median=${median(t2).toFixed(2)}ms  (tol=0.0015)`,
);

const adaptive = () =>
  gamutBoundaryPath(HUE, {
    gamut: 'srgb',
    samplingMode: 'adaptive',
    adaptiveTolerance: 0.001,
    adaptiveMaxDepth: 12,
  });
for (let i = 0; i < WARMUP; i++) adaptive();
const t3 = [];
for (let i = 0; i < MEASURE_ROUNDS; i++) t3.push(timeMs(adaptive));
const p3 = adaptive();
console.log(
  `adaptive tol=0.001:   points=${p3.length}  median=${median(t3).toFixed(2)}ms`,
);

console.log('\n--- Contrast region (reference=#fff, hue=200, AA) ---\n');

const ref = fromHex('#ffffff');
const contrastDefaults = () =>
  contrastRegionPaths(ref, 200, {
    level: 'AA',
    gamut: 'srgb',
  });
for (let i = 0; i < WARMUP; i++) contrastDefaults();
const ct1 = [];
for (let i = 0; i < MEASURE_ROUNDS; i++) ct1.push(timeMs(contrastDefaults));
const cp1 = contrastDefaults();
const total1 = cp1.reduce((s, path) => s + path.length, 0);
console.log(
  `defaults:            paths=${cp1.length} totalPoints=${total1}  median=${median(ct1).toFixed(2)}ms`,
);

const contrastSimplify = () =>
  contrastRegionPaths(ref, 200, {
    level: 'AA',
    gamut: 'srgb',
    simplifyTolerance: 0.002,
  });
for (let i = 0; i < WARMUP; i++) contrastSimplify();
const ct2 = [];
for (let i = 0; i < MEASURE_ROUNDS; i++) ct2.push(timeMs(contrastSimplify));
const cp2 = contrastSimplify();
const total2 = cp2.reduce((s, path) => s + path.length, 0);
console.log(
  `defaults+simplify:   paths=${cp2.length} totalPoints=${total2}  median=${median(ct2).toFixed(2)}ms  (tol=0.002)`,
);

const contrastInteractive = () =>
  contrastRegionPaths(ref, 200, {
    level: 'AA',
    gamut: 'srgb',
    initialSamples: 8,
    errorTolerance: 0.004,
    maxDepth: 3,
  });
for (let i = 0; i < WARMUP; i++) contrastInteractive();
const ct3 = [];
for (let i = 0; i < MEASURE_ROUNDS; i++) ct3.push(timeMs(contrastInteractive));
const cp3 = contrastInteractive();
const total3 = cp3.reduce((s, path) => s + path.length, 0);
console.log(
  `interactive 8/0.004/3: paths=${cp3.length} totalPoints=${total3}  median=${median(ct3).toFixed(2)}ms  (useContrastRegion defaults)`,
);

console.log(
  '\nRecommended defaults: simplifyTolerance 0.001–0.002; adaptiveTolerance 0.001.',
);
