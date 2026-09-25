/* global console, process, gc, setTimeout */
/**
 * Allocating API vs allocation-free `*Into` variants: ns/op, bytes allocated
 * per op, and GC count over 1e6 iterations.
 *
 * Run after build:
 *   pnpm --filter @color-kit/core build && pnpm --filter @color-kit/core bench:into
 *
 * The script needs `--expose-gc` (the package script passes it). Set
 * `COLOR_KIT_BENCH_BASELINE=/path/to/other/dist/index.js` to add columns for
 * another build's allocating API (for example the pre-`*Into` release).
 *
 * B/op is heap growth over the timed run with a young generation large
 * enough that no scavenge runs inside it, so it equals what the loop
 * allocated. V8 scalar-replaces short-lived objects that do not escape once a
 * call is fully inlined, so the allocating column is what survives
 * optimization in this tight monomorphic loop, not a count of object literals
 * in the source. Real call sites that do not inline (large loop bodies,
 * polymorphic callers, other engines) keep those allocations.
 *
 * GC counts come from a child process with Node's default young generation
 * (`INTO_BENCH_GC_ONLY=1`), where allocation shows up as scavenges.
 */

import { spawnSync } from 'node:child_process';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

if (typeof gc !== 'function') {
  console.error('Run with `node --expose-gc` (use `pnpm bench:into`).');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = resolve(here, '../dist/index.js');
if (!existsSync(distEntry)) {
  console.error(
    'Missing packages/core/dist/index.js. Run `pnpm --filter @color-kit/core build` first.',
  );
  process.exit(1);
}

const kit = await import(pathToFileURL(distEntry).href);
const baselinePath = process.env.COLOR_KIT_BENCH_BASELINE;
const baseline = baselinePath
  ? await import(pathToFileURL(resolve(baselinePath)).href)
  : null;

const ITERATIONS = 1_000_000;
const SAMPLES = 1024;

// Deterministic inputs (mulberry32).
let seed = 0xc0105;
function random() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const colors = Array.from({ length: SAMPLES }, () => ({
  l: 0.05 + random() * 0.9,
  c: random() * 0.2,
  h: random() * 360,
  alpha: 1,
}));
// Mostly out of sRGB, so gamut mapping runs its bisection.
const vivid = colors.map((color) => ({ ...color, c: 0.2 + random() * 0.2 }));
const rgbs = colors.map((color) => kit.toRgb(color));
const MASK = SAMPLES - 1;

/**
 * Each case: [name, allocating loop body, Into loop body, out factory]. The
 * bodies are compiled into their own function per API and variant (see
 * `compile`), so every loop has private type feedback and none of them
 * turns polymorphic because an earlier run called a different build.
 * Results are summed into a Float64Array so they are neither dead-code
 * eliminated nor boxed as heap numbers.
 */
const newColor = () => ({ l: 0, c: 0, h: 0, alpha: 1 });
const newRgb = () => ({ r: 0, g: 0, b: 0, alpha: 1 });
const newLab = () => ({ L: 0, a: 0, b: 0, alpha: 1 });
const A = 'colors[i & MASK]';
const B = 'colors[(i + 1) & MASK]';

const CASES = [
  ['toOklab', `api.toOklab(${A}).a`, `api.toOklabInto(out, ${A}).a`, newLab],
  [
    'toLinearSrgb',
    `api.oklabToLinearRgb(api.toOklab(${A})).g`,
    `api.toLinearSrgbInto(out, ${A}).g`,
    newRgb,
  ],
  ['toRgb', `api.toRgb(${A}).g`, `api.toRgbInto(out, ${A}).g`, newRgb],
  [
    'fromRgb',
    'api.fromRgb(rgbs[i & MASK]).c',
    'api.fromRgbInto(out, rgbs[i & MASK]).c',
    newColor,
  ],
  ['toP3', `api.toP3(${A}).g`, `api.toP3Into(out, ${A}).g`, newRgb],
  [
    'mix (default)',
    `api.mix(${A}, ${B}, (i & 255) / 255).h`,
    `api.mixInto(out, ${A}, ${B}, (i & 255) / 255).h`,
    newColor,
  ],
  [
    'mix (linear-srgb)',
    `api.mix(${A}, ${B}, 0.5, LINEAR_SRGB).c`,
    `api.mixInto(out, ${A}, ${B}, 0.5, LINEAR_SRGB).c`,
    newColor,
  ],
  [
    'interpolate (oklch longer)',
    `api.interpolate(${A}, ${B}, 0.3, OKLCH_LONGER).h`,
    `api.interpolateInto(out, ${A}, ${B}, 0.3, OKLCH_LONGER).h`,
    newColor,
  ],
  [
    'toSrgbGamut (out of gamut)',
    'api.toSrgbGamut(vivid[i & MASK]).c',
    'api.toSrgbGamutInto(out, vivid[i & MASK]).c',
    newColor,
  ],
  [
    'toP3Gamut (out of gamut)',
    'api.toP3Gamut(vivid[i & MASK]).c',
    'api.toP3GamutInto(out, vivid[i & MASK]).c',
    newColor,
  ],
];

const SINK = new Float64Array(1);
const CONTEXT = {
  colors,
  vivid,
  rgbs,
  MASK,
  SINK,
  LINEAR_SRGB: { space: 'linear-srgb' },
  OKLCH_LONGER: { space: 'oklch', hue: 'longer' },
};

function compile(api, body, out) {
  const factory = new Function(
    'api',
    'ctx',
    'out',
    `const { colors, vivid, rgbs, MASK, SINK, LINEAR_SRGB, OKLCH_LONGER } = ctx;
     return function run(start, end) {
       for (let i = start; i < end; i += 1) SINK[0] += ${body};
     };`,
  );
  return factory(api, CONTEXT, out);
}

let gcCount = 0;
const observer = new PerformanceObserver((list) => {
  gcCount += list.getEntries().length;
});
observer.observe({ entryTypes: ['gc'] });
// GC entries are delivered asynchronously; yield so they land.
const flush = () => new Promise((done) => setTimeout(done, 0));

async function measure(run, iterations) {
  // Warm up with several calls so the loop itself (not just an OSR entry)
  // is optimized before anything is measured.
  for (let pass = 0; pass < 5; pass += 1) run(0, 100_000);
  gc();
  await flush();

  // One timed run. The young generation is sized (see the package script)
  // so a run that allocates ~100 B/op still fits without a scavenge; heap
  // growth over the run is then what the loop allocated. If a GC does run,
  // the growth undercounts, so B/op is reported as n/a.
  gcCount = 0;
  const heapBefore = process.memoryUsage().heapUsed;
  const start = performance.now();
  run(0, iterations);
  const ms = performance.now() - start;
  const heapAfter = process.memoryUsage().heapUsed;
  await flush();
  const gcs = gcCount;
  return {
    nsPerOp: (ms * 1e6) / iterations,
    bytesPerOp:
      gcs === 0 ? Math.max(0, heapAfter - heapBefore) / iterations : Number.NaN,
    gcs,
  };
}

const fmt = (value, digits = 1) =>
  Number.isNaN(value) ? 'n/a' : Number(value.toFixed(digits));

if (process.env.INTO_BENCH_GC_ONLY) {
  // Child mode: default heap sizing, report scavenges per variant as JSON.
  const counts = {};
  for (const [name, allocBody, intoBody, makeOut] of CASES) {
    counts[name] = {
      alloc: (await measure(compile(kit, allocBody), ITERATIONS)).gcs,
      into: (await measure(compile(kit, intoBody, makeOut()), ITERATIONS)).gcs,
    };
  }
  observer.disconnect();
  process.stdout.write(JSON.stringify(counts));
  process.exit(0);
}

const child = spawnSync(
  process.execPath,
  ['--expose-gc', fileURLToPath(import.meta.url)],
  { env: { ...process.env, INTO_BENCH_GC_ONLY: '1' }, encoding: 'utf8' },
);
const gcCounts = child.status === 0 ? JSON.parse(child.stdout) : {};

const rows = [];
for (const [name, allocBody, intoBody, makeOut] of CASES) {
  const row = { op: name };
  if (baseline) {
    const base = await measure(compile(baseline, allocBody), ITERATIONS);
    row['baseline ns/op'] = fmt(base.nsPerOp);
    row['baseline B/op'] = fmt(base.bytesPerOp);
  }
  const alloc = await measure(compile(kit, allocBody), ITERATIONS);
  const zero = await measure(compile(kit, intoBody, makeOut()), ITERATIONS);
  row['alloc ns/op'] = fmt(alloc.nsPerOp);
  row['alloc B/op'] = fmt(alloc.bytesPerOp);
  row['alloc GCs'] = gcCounts[name]?.alloc ?? 'n/a';
  row['Into ns/op'] = fmt(zero.nsPerOp);
  row['Into B/op'] = fmt(zero.bytesPerOp);
  row['Into GCs'] = gcCounts[name]?.into ?? 'n/a';
  row.speedup = `${fmt(alloc.nsPerOp / zero.nsPerOp, 2)}x`;
  rows.push(row);
}
observer.disconnect();

console.log(
  `\nAllocating vs *Into (${ITERATIONS.toLocaleString()} iterations per op; ` +
    `B/op = heap growth / iterations; GCs = scavenges at default heap size; ` +
    `node ${process.version})`,
);
console.table(rows);
console.log(`checksum ${SINK[0].toFixed(3)}`);
