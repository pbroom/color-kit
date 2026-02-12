/* global console */

import { spawn } from 'node:child_process';
import net from 'node:net';
import { chromium } from 'playwright';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseThumbPosition(value) {
  const [xRaw, yRaw] = String(value).split(',');
  return {
    x: toNumber(xRaw),
    y: toNumber(yRaw),
  };
}

function changedEnough(samples, minimumDelta = 0.02) {
  if (samples.length < 2) {
    return false;
  }

  let maxDelta = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const prev = parseThumbPosition(samples[index - 1]);
    const next = parseThumbPosition(samples[index]);
    if (!Number.isFinite(prev.x) || !Number.isFinite(prev.y)) continue;
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) continue;

    const delta = Math.hypot(next.x - prev.x, next.y - prev.y);
    if (delta > maxDelta) {
      maxDelta = delta;
    }
  }

  return maxDelta >= minimumDelta;
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve an open local port.'));
        return;
      }
      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

function waitForUrl(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Keep polling until timeout.
      }

      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(poll, 250);
    };
    void poll();
  });
}

async function main() {
  let devServer = null;
  let url = process.env.COLOR_AREA_DRAG_TEST_URL;
  let browser = null;
  let page = null;

  try {
    if (!url) {
      const port = await findOpenPort();
      url = `http://127.0.0.1:${port}/docs/components/color-area`;
      const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
      devServer = spawn(
        pnpmBin,
        [
          'exec',
          'vite',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--strictPort',
        ],
        {
          cwd: new URL('..', import.meta.url),
          env: process.env,
          stdio: 'pipe',
        },
      );
      devServer.on('error', (error) => {
        // eslint-disable-next-line no-console
        console.error(`Failed to launch docs dev server: ${String(error)}`);
      });
      await waitForUrl(url);
    }

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({
      viewport: { width: 1400, height: 1000 },
    });

    await page.goto(url, { waitUntil: 'networkidle' });

    const area = page.locator('[data-color-area]').first();
    await area.waitFor();
    await area.scrollIntoViewIfNeeded();

    const thumb = page.locator('[data-color-area-thumb]').first();
    const box = await area.boundingBox();
    if (!box) {
      throw new Error('Could not resolve color area geometry.');
    }

    const startX = box.x + box.width * 0.2;
    const startY = box.y + box.height * 0.8;
    const endX = box.x + box.width * 0.8;
    const endY = box.y + box.height * 0.2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();

    const samples = [];
    for (let index = 0; index <= 30; index += 1) {
      const t = index / 30;
      await page.mouse.move(
        startX + (endX - startX) * t,
        startY + (endY - startY) * t,
      );
      const position = await thumb.evaluate((node) => {
        return `${node.getAttribute('data-x')},${node.getAttribute('data-y')}`;
      });
      samples.push(position);
    }
    await page.mouse.up();

    const uniqueCount = new Set(samples).size;
    const movedDuringDrag = changedEnough(samples);
    const summary = {
      url: String(url),
      uniqueThumbPositions: uniqueCount,
      movedDuringDrag,
      first: samples[0] ?? null,
      last: samples.at(-1) ?? null,
    };

    console.log(JSON.stringify(summary, null, 2));

    if (!movedDuringDrag || uniqueCount < 4) {
      throw new Error(
        'ColorArea drag did not produce continuous thumb movement. ' +
          `unique=${uniqueCount} moved=${movedDuringDrag}`,
      );
    }
  } finally {
    await page?.close();
    await browser?.close();
    if (devServer) {
      devServer.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
