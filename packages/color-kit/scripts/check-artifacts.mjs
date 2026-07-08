import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const require = createRequire(import.meta.url);

async function assertDistFile(relativePath) {
  const targetPath = path.join(packageRoot, relativePath);
  try {
    await access(targetPath);
  } catch {
    throw new Error(
      `Missing packaged artifact: ${path.relative(packageRoot, targetPath)}`,
    );
  }
}

await import('./test-exports.mjs');

await assertDistFile('dist/wasm/generated/color_kit_core_wasm.js');
await assertDistFile('dist/wasm/generated/color_kit_core_wasm_bg.wasm');

const wasm = await import('color-kit/wasm');
const esmBackend = await wasm.loadWasmPlaneComputeBackend();
assert.equal(esmBackend?.kind, 'wasm');

wasm.clearWasmPlaneComputeBackendFactory();

const cjsWasm = require('color-kit/wasm');
const cjsBackend = await cjsWasm.loadWasmPlaneComputeBackend();
assert.equal(cjsBackend?.kind, 'wasm');
