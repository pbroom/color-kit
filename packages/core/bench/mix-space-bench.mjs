/* global console, process */
/**
 * Compare mix() mid-points across interpolation spaces (linear light vs
 * OKLCH vs gamma-encoded sRGB), plus a rough throughput number per space.
 * Run after build: pnpm --filter @color-kit/core build && pnpm --filter @color-kit/core bench:mix-space
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

const { mix, parse, toHex, toOklab, inSrgbGamut, srgbToLinear, toRgb } =
  await import(distEntry);

const SPACES = [
  ['default (legacy OKLCH)', undefined],
  ['oklch', { space: 'oklch' }],
  ['oklab', { space: 'oklab' }],
  ['srgb', { space: 'srgb' }],
  ['linear-srgb', { space: 'linear-srgb' }],
  ['p3', { space: 'p3' }],
  ['linear-p3', { space: 'linear-p3' }],
];

const PAIRS = [
  ['red ↔ lime', '#ff0000', '#00ff00'],
  ['red ↔ blue', '#ff0000', '#0000ff'],
  ['blue ↔ yellow', '#0000ff', '#ffff00'],
  ['black ↔ white', '#000000', '#ffffff'],
];

/** Unrounded WCAG relative luminance (Y) straight from linear sRGB. */
function luminance(color) {
  const lin = srgbToLinear(toRgb(color));
  return 0.2126 * lin.r + 0.7152 * lin.g + 0.0722 * lin.b;
}

for (const [label, fromHex, toHexValue] of PAIRS) {
  const a = parse(fromHex);
  const b = parse(toHexValue);
  const rows = SPACES.map(([space, options]) => {
    const mid = mix(a, b, 0.5, options);
    return {
      space,
      hex: toHex(mid),
      'OKLab L': Number(toOklab(mid).L.toFixed(4)),
      'OKLCH C': Number(mid.c.toFixed(4)),
      'OKLCH h': Number(mid.h.toFixed(1)),
      'luminance Y': Number(luminance(mid).toFixed(4)),
      'in sRGB': inSrgbGamut(mid),
    };
  });
  console.log(`\n${label} (t = 0.5)`);
  console.table(rows);
}

const ITERATIONS = 200_000;
const a = parse('#3b82f6');
const b = parse('#ef4444');
const timing = SPACES.map(([space, options]) => {
  for (let i = 0; i < 10_000; i += 1) mix(a, b, i / 10_000, options);
  const start = performance.now();
  let sink = 0;
  for (let i = 0; i < ITERATIONS; i += 1) {
    sink += mix(a, b, i / ITERATIONS, options).l;
  }
  const ms = performance.now() - start;
  return {
    space,
    'ns / mix': Number(((ms * 1e6) / ITERATIONS).toFixed(1)),
    sink: Number(sink.toFixed(2)),
  };
});
console.log(`\nThroughput (${ITERATIONS} mixes of #3b82f6 ↔ #ef4444)`);
console.table(timing);
