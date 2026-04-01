import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const root = await import('color-kit');
const core = await import('color-kit/core');
const react = await import('color-kit/react');
const wasm = await import('color-kit/wasm');

assert.equal(typeof root.definePlane, 'function');
assert.equal(typeof root.sense, 'function');
assert.equal(typeof core.definePlane, 'function');
assert.equal(typeof core.toSvgPath, 'function');
assert.equal(typeof react.Color, 'function');
assert.equal(typeof react.useColor, 'function');
assert.equal(typeof wasm.loadWasmPlaneComputeBackend, 'function');
assert.equal(typeof wasm.createWasmAwarePlaneComputeScheduler, 'function');

const cjsRoot = require('../dist/index.cjs');
const cjsCore = require('../dist/core/index.cjs');
const cjsReact = require('../dist/react/index.cjs');
const cjsWasm = require('../dist/wasm/index.cjs');

assert.equal(typeof cjsRoot.definePlane, 'function');
assert.equal(typeof cjsCore.definePlane, 'function');
assert.equal(typeof cjsReact.Color, 'function');
assert.equal(typeof cjsWasm.loadWasmPlaneComputeBackend, 'function');
