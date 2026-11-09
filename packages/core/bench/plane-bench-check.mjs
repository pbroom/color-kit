/* global console, process */
/**
 * Ratcheting gate for the plane benchmark.
 *
 * Runs `plane-bench.mjs` several times in fresh processes, takes the median
 * timing ratio per scenario, and compares the run with
 * `plane-bench.baseline.json`. See README.md in this directory for what is
 * gated and when updating the baseline is legitimate.
 *
 *   node bench/plane-bench-check.mjs                 compare, exit 1 on regression
 *   node bench/plane-bench-check.mjs --out <file>    also write the measured JSON
 *   node bench/plane-bench-check.mjs --runs <n>      bench processes to run (default 5)
 *   node bench/plane-bench-check.mjs --from <file>   use a measured JSON (e.g. the CI artifact) instead of running
 *   node bench/plane-bench-check.mjs --update        rewrite the baseline; timing only tightens
 *   node bench/plane-bench-check.mjs --update --accept-slower   also record slower timing
 *   node bench/plane-bench-check.mjs --update --no-timing       record no timing (timing stays report-only)
 */

import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const benchPath = resolve(here, 'plane-bench.mjs');
const baselinePath = resolve(here, 'plane-bench.baseline.json');

/**
 * Work counters are exact on one runtime, but root-finding takes a few more
 * or fewer steps when `Math` functions differ in the last bit: Node 24 takes
 * up to 1.5% more contrast samples than Node 20/22. So a run on a different
 * runtime than the baseline's may exceed it by this fraction; a run on the
 * same runtime may not exceed it at all.
 */
const WORK_TOLERANCE_OTHER_RUNTIME = 0.03;
/**
 * Fail when a timing ratio exceeds baseline × this. Only applied on the
 * baseline's runtime: the ratio shifts 20-50% between Node majors alone.
 */
const TIMING_FAIL_RATIO = 1.5;
/** Suggest tightening when a timing ratio is below baseline × this. */
const TIMING_TIGHTEN_RATIO = 0.7;
/**
 * Refuse to record a timing baseline when the bench processes disagree by
 * more than this (max / min): the machine is too busy to trust the number.
 */
const TIMING_RECORD_MAX_SPREAD = 1.25;
/** `--update` leaves a timing baseline alone when the new ratio is within this fraction of it. */
const TIMING_RECORD_NOISE = 0.05;
const DEFAULT_RUNS = 5;

const args = process.argv.slice(2);
function flag(name) {
  return args.includes(name);
}
function option(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const update = flag('--update');
const acceptSlower = flag('--accept-slower');
const noTiming = flag('--no-timing');
const fromPath = option('--from');
const outPath = option('--out');
let runs = Number(option('--runs') ?? DEFAULT_RUNS);
if (!Number.isInteger(runs) || runs < 1) {
  console.error('--runs must be a positive integer.');
  process.exit(2);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Node major, platform and architecture: what timing ratios depend on. */
function runtimeKey(environment) {
  if (!environment) return 'unknown';
  const major = String(environment.node).replace(/^v/, '').split('.')[0];
  return `node ${major} ${environment.platform}/${environment.arch}`;
}

function measure() {
  const reports = [];
  for (let index = 0; index < runs; index += 1) {
    const stdout = execFileSync(process.execPath, [benchPath], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    reports.push(JSON.parse(stdout));
  }

  const first = reports[0];
  const scenarios = {};
  const unstable = [];
  for (const entry of first.cases) {
    const samples = reports.map((report) =>
      report.cases.find((candidate) => candidate.id === entry.id),
    );
    const deterministic = JSON.stringify([entry.output, entry.work]);
    if (
      samples.some(
        (sample) =>
          JSON.stringify([sample.output, sample.work]) !== deterministic,
      )
    ) {
      unstable.push(entry.id);
    }
    const relativeRuns = samples.map((sample) => sample.relative);
    scenarios[entry.id] = {
      label: entry.label,
      solvers: entry.solvers,
      output: entry.output,
      work: entry.work,
      timing: {
        relative: Number(median(relativeRuns).toFixed(4)),
        relativeRuns,
        medianMs: median(samples.map((sample) => sample.medianMs)),
      },
    };
  }

  return {
    timestamp: first.timestamp,
    environment: first.environment,
    runs,
    calibration: {
      label: first.calibration.label,
      medianMs: median(reports.map((report) => report.calibration.medianMs)),
    },
    unstable,
    scenarios,
  };
}

function toBaseline(measured, previous) {
  const sameRuntime =
    runtimeKey(previous?.recordedWith) === runtimeKey(measured.environment);
  const scenarios = {};
  const kept = [];
  const noisy = [];
  for (const [id, scenario] of Object.entries(measured.scenarios)) {
    const entry = {
      label: scenario.label,
      output: scenario.output,
      work: scenario.work,
    };
    if (!noTiming) {
      const { relativeRuns } = scenario.timing;
      const spread = Math.max(...relativeRuns) / Math.min(...relativeRuns);
      if (spread > TIMING_RECORD_MAX_SPREAD) noisy.push(id);
      let relative = scenario.timing.relative;
      const before = sameRuntime
        ? previous.scenarios?.[id]?.timing?.relative
        : undefined;
      if (before !== undefined) {
        const change = relative / before;
        if (Math.abs(change - 1) <= TIMING_RECORD_NOISE) {
          // Within run-to-run noise: keep the committed number.
          relative = before;
        } else if (change > 1 && !acceptSlower) {
          // Ratchet: accepting an output or work change must not quietly
          // loosen the timing baseline. It only moves up with --accept-slower.
          relative = before;
          kept.push(id);
        }
      }
      entry.timing = { relative };
    }
    scenarios[id] = entry;
  }
  return {
    baseline: {
      version: 1,
      note: 'Generated by `pnpm --filter @color-kit/core bench:plane:update`. See packages/core/bench/README.md before editing or regenerating.',
      recordedWith: measured.environment,
      calibration: measured.calibration.label,
      scenarios,
    },
    kept,
    noisy,
  };
}

function formatTable(rows) {
  const widths = rows[0].map((_, column) =>
    Math.max(...rows.map((row) => String(row[column]).length)),
  );
  return rows
    .map((row) =>
      row
        .map((cell, column) => String(cell).padEnd(widths[column]))
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
}

function percent(ratio) {
  const delta = (ratio - 1) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

function compare(measured, baseline) {
  const sameRuntime =
    runtimeKey(baseline.recordedWith) === runtimeKey(measured.environment);
  const workTolerance = sameRuntime ? 0 : WORK_TOLERANCE_OTHER_RUNTIME;
  const failures = [];
  const notices = [];
  const rows = [
    ['scenario', 'metric', 'baseline', 'measured', 'change', 'limit', 'status'],
  ];
  const push = (id, metric, base, value, change, limit, status) =>
    rows.push([id, metric, base, value, change, limit, status]);

  for (const id of measured.unstable) {
    failures.push(
      `${id}: output or work counters differed between bench runs on this machine; the scenario is not deterministic.`,
    );
  }

  for (const id of Object.keys(baseline.scenarios)) {
    if (!measured.scenarios[id]) {
      failures.push(
        `${id}: scenario is in the baseline but was not measured. Restore it, or update the baseline if it was removed on purpose.`,
      );
    }
  }

  for (const [id, scenario] of Object.entries(measured.scenarios)) {
    const base = baseline.scenarios[id];
    if (!base) {
      failures.push(
        `${id}: scenario has no baseline entry. Run bench:plane:update to record it.`,
      );
      push(id, 'all', '-', '-', '-', '-', 'FAIL (no baseline)');
      continue;
    }

    for (const key of ['pathCount', 'pointCount', 'hash']) {
      const before = base.output[key];
      const after = scenario.output[key];
      const same = before === after;
      if (!same) {
        failures.push(
          `${id}: output ${key} changed (${before} -> ${after}). The query result is different.`,
        );
      }
      push(
        id,
        `output.${key}`,
        before,
        after,
        same ? '=' : 'changed',
        'exact',
        same ? 'ok' : 'FAIL',
      );
    }

    for (const [key, before] of Object.entries(base.work)) {
      const after = scenario.work[key];
      // Counters a solver never touches (closed-form queries) are noise.
      if (before === 0 && after === 0) continue;
      const limit = Math.floor(before * (1 + workTolerance));
      const tighten = Math.ceil(before * (1 - workTolerance));
      let status = 'ok';
      if (after === undefined || after > limit) {
        status = 'FAIL';
        failures.push(
          `${id}: work.${key} rose from ${before} to ${after} (limit ${limit}). The solver does more work.`,
        );
      } else if (after < tighten) {
        status = 'better';
        notices.push(`${id}: work.${key} dropped from ${before} to ${after}.`);
      }
      push(
        id,
        `work.${key}`,
        before,
        after,
        before === after || before === 0 || after === undefined
          ? '='
          : percent(after / before),
        `<= ${limit}`,
        status,
      );
    }

    const before = base.timing?.relative;
    const after = scenario.timing.relative;
    if (before === undefined || !sameRuntime) {
      push(
        id,
        'timing.relative',
        before ?? '-',
        after,
        before === undefined ? '-' : percent(after / before),
        'not gated',
        'report only',
      );
      continue;
    }
    const limit = before * TIMING_FAIL_RATIO;
    let status = 'ok';
    if (after > limit) {
      status = 'FAIL';
      failures.push(
        `${id}: timing ratio rose from ${before} to ${after} (${percent(after / before)}, limit ${limit.toFixed(4)}). Runs: ${scenario.timing.relativeRuns.join(', ')}.`,
      );
    } else if (after < before * TIMING_TIGHTEN_RATIO) {
      status = 'better';
      notices.push(
        `${id}: timing ratio dropped from ${before} to ${after} (${percent(after / before)}).`,
      );
    }
    push(
      id,
      'timing.relative',
      before,
      after,
      percent(after / before),
      `<= ${limit.toFixed(4)}`,
      status,
    );
  }

  return { failures, notices, sameRuntime, table: formatTable(rows) };
}

const measured = fromPath
  ? JSON.parse(readFileSync(resolve(process.cwd(), fromPath), 'utf8'))
  : measure();
runs = measured.runs;
if (outPath) {
  writeFileSync(
    resolve(process.cwd(), outPath),
    `${JSON.stringify(measured, null, 2)}\n`,
  );
}

const previous = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, 'utf8'))
  : null;

if (update) {
  if (measured.unstable.length > 0) {
    console.error(
      `Refusing to write a baseline: ${measured.unstable.join(', ')} gave different output or work counters between runs.`,
    );
    process.exit(1);
  }
  const { baseline, kept, noisy } = toBaseline(measured, previous);
  if (noisy.length > 0) {
    console.error(
      `Refusing to write a baseline: timing for ${noisy.join(', ')} varied by more than ${Math.round((TIMING_RECORD_MAX_SPREAD - 1) * 100)}% between bench runs. Rerun on a quiet machine, or pass --no-timing to record output and work only.`,
    );
    process.exit(1);
  }
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Wrote ${baselinePath}`);
  if (kept.length > 0) {
    console.log(
      `Kept the previous (faster) timing baseline for: ${kept.join(', ')}. Pass --accept-slower to record the slower timing.`,
    );
  }
  process.exit(0);
}

if (!previous) {
  console.error(
    `Missing ${baselinePath}. Run \`pnpm --filter @color-kit/core bench:plane:update\`.`,
  );
  process.exit(1);
}

const { failures, notices, sameRuntime, table } = compare(measured, previous);
const env = measured.environment;
console.log(
  `Plane bench gate: ${runs} runs on ${runtimeKey(env)} (${env.node}); baseline recorded on ${runtimeKey(previous.recordedWith)}.`,
);
console.log(
  `Calibration: ${measured.calibration.medianMs} ms per call (${measured.calibration.label}). timing.relative = scenario time / calibration time, median of ${runs} runs.`,
);
console.log(
  sameRuntime
    ? `Same runtime as the baseline: work counters may not rise, timing fails above baseline x ${TIMING_FAIL_RATIO}.\n`
    : `Different runtime from the baseline: work counters may rise ${WORK_TOLERANCE_OTHER_RUNTIME * 100}%, timing is report-only.\n`,
);
console.log(table);

const inActions = process.env.GITHUB_ACTIONS === 'true';
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Plane bench gate: ${failures.length > 0 ? 'failed' : 'passed'}\n\n\`\`\`\n${table}\n\`\`\`\n`,
  );
}

if (notices.length > 0) {
  console.log(
    '\nBetter than the baseline. Tighten it with `pnpm --filter @color-kit/core bench:plane:update` and commit the result:',
  );
  for (const notice of notices) {
    console.log(`  - ${notice}`);
    if (inActions) console.log(`::notice title=Plane bench::${notice}`);
  }
}

if (failures.length > 0) {
  console.error(`\nPlane bench gate FAILED (${failures.length}):`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
    if (inActions) console.log(`::error title=Plane bench::${failure}`);
  }
  console.error(
    '\nIf the change is intended, see packages/core/bench/README.md, then run `pnpm --filter @color-kit/core bench:plane:update` and commit the baseline.',
  );
  process.exit(1);
}

console.log('\nPlane bench gate passed.');
