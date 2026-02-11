/* global console */

import fs from 'node:fs/promises';
import path from 'node:path';

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1),
  );
  return sorted[index];
}

function summarize(frames) {
  const frameTimes = frames.map((frame) => frame.frameTimeMs);
  const updateTimes = frames.map((frame) => frame.updateDurationMs);

  return {
    samples: frames.length,
    frameMedianMs: Number(percentile(frameTimes, 0.5).toFixed(3)),
    frameP95Ms: Number(percentile(frameTimes, 0.95).toFixed(3)),
    updateMedianMs: Number(percentile(updateTimes, 0.5).toFixed(3)),
    updateP95Ms: Number(percentile(updateTimes, 0.95).toFixed(3)),
    droppedFrames: frames.filter((frame) => frame.droppedFrame).length,
    longTasks: frames.filter((frame) => frame.longTask).length,
  };
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

async function collectScenario(page, scenarioName) {
  await page.evaluate(() => {
    window.__ckPerfFrames = [];
  });

  const area = page.locator('[data-color-area]').first();
  await area.waitFor();
  const box = await area.boundingBox();
  if (!box) {
    throw new Error('Could not resolve [data-color-area] bounding box.');
  }

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
  await page.waitForTimeout(80);

  const frames = await page.evaluate(() => {
    return window.__ckPerfFrames ?? [];
  });

  return {
    scenario: scenarioName,
    ...summarize(frames),
  };
}

async function setScenario(page, mode) {
  const selector = page.locator(
    'select[aria-label="Select color area demo scenario"]',
  );
  if (!(await selector.count())) {
    return;
  }

  await selector.selectOption(mode === 'analysis' ? 'analysis' : 'requested');
  await page.waitForTimeout(120);
}

async function main() {
  const url =
    process.env.COLOR_AREA_PROFILE_URL ??
    'http://localhost:5173/docs/components/color-area';
  const outputPath =
    process.env.COLOR_AREA_PROFILE_OUT ??
    path.resolve('apps/docs/bench/results.color-area.docs.json');

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    await setScenario(page, 'requested');
    const requested = await collectScenario(page, 'requested');

    await setScenario(page, 'analysis');
    const analysis = await collectScenario(page, 'analysis');

    const output = {
      timestamp: new Date().toISOString(),
      url,
      targets: {
        interactionMedianMs: '<= 8',
        longTaskMs: '<= 50',
      },
      scenarios: [requested, analysis],
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
