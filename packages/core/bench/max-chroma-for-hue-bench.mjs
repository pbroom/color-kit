/* global console */

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

const { maxChromaAt, maxChromaForHue } = await import(distEntry);

const HUE_COUNT = 4096;
const WARMUP_ROUNDS = 2;
const MEASURE_ROUNDS = 5;
const SCAN_STEPS = 64;
const GAMUTS = ['srgb', 'display-p3'];

function hueList(count) {
  return Array.from({ length: count }, (_, index) => (index / count) * 360);
}

function summarize(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const mean = times.reduce((sum, value) => sum + value, 0) / times.length;
  const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)] ?? 0;
  return {
    runs: times.map((value) => Number(value.toFixed(3))),
    meanMs: Number(mean.toFixed(3)),
    medianMs: Number(median.toFixed(3)),
    p95Ms: Number(p95.toFixed(3)),
  };
}

function runCase(name, gamut, hues, fn) {
  for (let round = 0; round < WARMUP_ROUNDS; round += 1) {
    fn(hues, gamut);
  }

  const times = [];
  let checksum = 0;
  for (let round = 0; round < MEASURE_ROUNDS; round += 1) {
    const start = performance.now();
    checksum = fn(hues, gamut);
    const end = performance.now();
    times.push(end - start);
  }

  const stats = summarize(times);
  return {
    name,
    gamut,
    hues: hues.length,
    checksum: Number(checksum.toFixed(6)),
    opsPerSecond: Number(((hues.length / stats.meanMs) * 1000).toFixed(0)),
    ...stats,
  };
}

function benchDirect(hues, gamut) {
  let checksum = 0;
  for (const hue of hues) {
    const cusp = maxChromaForHue(hue, { gamut, method: 'direct' });
    checksum += cusp.l * 0.001 + cusp.c;
  }
  return checksum;
}

function benchLut(hues, gamut) {
  let checksum = 0;
  for (const hue of hues) {
    const cusp = maxChromaForHue(hue, { gamut, method: 'lut' });
    checksum += cusp.l * 0.001 + cusp.c;
  }
  return checksum;
}

function benchScan(hues, gamut) {
  let checksum = 0;
  for (const hue of hues) {
    let max = 0;
    for (let index = 0; index <= SCAN_STEPS; index += 1) {
      const l = index / SCAN_STEPS;
      const c = maxChromaAt(l, hue, { gamut });
      if (c > max) max = c;
    }
    checksum += max;
  }
  return checksum;
}

const hues = hueList(HUE_COUNT);
const results = [];

for (const gamut of GAMUTS) {
  results.push(runCase('maxChromaForHue:lut', gamut, hues, benchLut));
  results.push(runCase('maxChromaForHue:direct', gamut, hues, benchDirect));
  results.push(
    runCase(`scan:maxChromaAt:${SCAN_STEPS}`, gamut, hues, benchScan),
  );
}

const grouped = new Map();
for (const result of results) {
  const key = result.gamut;
  const group = grouped.get(key) ?? [];
  group.push(result);
  grouped.set(key, group);
}

const speedups = [];
for (const [gamut, group] of grouped) {
  const lut = group.find((item) => item.name === 'maxChromaForHue:lut');
  const direct = group.find((item) => item.name === 'maxChromaForHue:direct');
  const scan = group.find((item) => item.name.startsWith('scan:maxChromaAt:'));
  if (!lut || !direct || !scan) continue;

  speedups.push({
    gamut,
    lutVsScan: Number((scan.meanMs / lut.meanMs).toFixed(1)),
    directVsScan: Number((scan.meanMs / direct.meanMs).toFixed(1)),
    lutVsDirect: Number((direct.meanMs / lut.meanMs).toFixed(1)),
  });
}

console.log(
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      hues: HUE_COUNT,
      warmupRounds: WARMUP_ROUNDS,
      measureRounds: MEASURE_ROUNDS,
      scanSteps: SCAN_STEPS,
      results,
      speedups,
    },
    null,
    2,
  ),
);
