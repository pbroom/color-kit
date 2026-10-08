/* global console, process, requestAnimationFrame, PerformanceObserver, window, performance, MutationObserver, Element, document */

// Profiles ColorArea drags on the /api/react examples page.
//
// Two scenarios, each a 220-step diagonal drag across one example's area:
// - `requested`: "ColorArea with ColorPlane" (plane + two gamut boundaries)
// - `analysis`: "ContrastRegionLayer" (plane + a contrast region solved in a
//   worker while dragging)
//
// The page is measured from outside, so the examples stay plain user code:
// an init script records every animation frame's duration, long tasks, and
// the latency from each pointer move to the thumb's next position change.
//
//   COLOR_AREA_PROFILE_URL  page to profile (default: dev server /api/react)
//   COLOR_AREA_PROFILE_OUT  JSON output path

import fs from 'node:fs/promises';
import path from 'node:path';

const SCENARIOS = [
  { name: 'requested', example: 'ColorArea with ColorPlane' },
  { name: 'analysis', example: 'ContrastRegionLayer' },
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1),
  );
  return sorted[index];
}

const round = (value) => Number(value.toFixed(3));

function summarize({ frames, latencies, longTasks }) {
  const refresh = percentile(frames, 0.5) || 16.7;
  return {
    frames: frames.length,
    frameMedianMs: round(percentile(frames, 0.5)),
    frameP95Ms: round(percentile(frames, 0.95)),
    updateSamples: latencies.length,
    updateMedianMs: round(percentile(latencies, 0.5)),
    updateP95Ms: round(percentile(latencies, 0.95)),
    droppedFrames: frames.filter((frame) => frame > refresh * 1.5).length,
    longTasks: longTasks.length,
    longestTaskMs: round(Math.max(0, ...longTasks)),
  };
}

/** Installed before any page script: frame, long-task and latency probes. */
function installProbes() {
  const probe = {
    recording: false,
    frames: [],
    latencies: [],
    longTasks: [],
    pendingMove: null,
    lastFrame: 0,
  };
  globalThis.__ckProbe = probe;

  const tick = (now) => {
    if (probe.recording && probe.lastFrame) {
      probe.frames.push(now - probe.lastFrame);
    }
    probe.lastFrame = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  try {
    new PerformanceObserver((list) => {
      if (!probe.recording) return;
      for (const entry of list.getEntries()) {
        probe.longTasks.push(entry.duration);
      }
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    // Long-task timing is Chromium-only; the other numbers still hold.
  }

  window.addEventListener(
    'pointermove',
    () => {
      if (probe.recording && probe.pendingMove === null) {
        probe.pendingMove = performance.now();
      }
    },
    true,
  );

  new MutationObserver((records) => {
    if (!probe.recording || probe.pendingMove === null) return;
    if (
      records.some(
        (record) =>
          record.target instanceof Element &&
          record.target.hasAttribute('data-color-area-thumb'),
      )
    ) {
      probe.latencies.push(performance.now() - probe.pendingMove);
      probe.pendingMove = null;
    }
  }).observe(document, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-x', 'data-y'],
  });
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to import playwright. Install it first (pnpm add -D playwright -w). Details: ${details}`,
    );
  }
}

async function collectScenario(page, { name, example }) {
  const area = page
    .getByRole('figure', { name: example })
    .locator('[data-color-area]')
    .first();
  await area.waitFor();
  await area.scrollIntoViewIfNeeded();
  // Let lazy layers (worker, WebGL) settle before measuring.
  await page.waitForTimeout(300);
  const box = await area.boundingBox();
  if (!box) {
    throw new Error(`Could not resolve the "${example}" area bounding box.`);
  }

  await page.evaluate(() => {
    const probe = globalThis.__ckProbe;
    probe.frames = [];
    probe.latencies = [];
    probe.longTasks = [];
    probe.pendingMove = null;
    probe.recording = true;
  });

  const startX = box.x + box.width * 0.1;
  const endX = box.x + box.width * 0.9;
  const startY = box.y + box.height * 0.9;
  const endY = box.y + box.height * 0.1;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 220;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    await page.mouse.move(
      startX + (endX - startX) * t,
      startY + (endY - startY) * t,
    );
  }
  await page.mouse.up();
  await page.waitForTimeout(120);

  const samples = await page.evaluate(() => {
    const probe = globalThis.__ckProbe;
    probe.recording = false;
    return {
      frames: probe.frames,
      latencies: probe.latencies,
      longTasks: probe.longTasks,
    };
  });

  return { scenario: name, example, ...summarize(samples) };
}

async function main() {
  const url =
    process.env.COLOR_AREA_PROFILE_URL ?? 'http://localhost:5173/api/react';
  const outputPath =
    process.env.COLOR_AREA_PROFILE_OUT ??
    path.resolve('apps/docs/bench/results.color-area.docs.json');

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
  });
  await page.addInitScript(installProbes);

  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    const scenarios = [];
    for (const scenario of SCENARIOS) {
      scenarios.push(await collectScenario(page, scenario));
    }

    const output = {
      timestamp: new Date().toISOString(),
      url,
      targets: {
        interactionMedianMs: '<= 8',
        longTaskMs: '<= 50',
      },
      scenarios,
    };

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      outputPath,
      `${JSON.stringify(output, null, 2)}\n`,
      'utf8',
    );

    console.log(`Wrote docs profiling output to ${outputPath}`);
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
