import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const schedulerRequest = {
  plane: {
    model: 'oklch',
    x: { channel: 'l', range: [0, 1] },
    y: { channel: 'c', range: [0, 0.4] },
    fixed: { h: 275, alpha: 1 },
  },
  queries: [
    {
      kind: 'gamutBoundary',
      gamut: 'srgb',
      hue: 275,
      steps: 8,
    },
  ],
  priority: 'drag',
  quality: 'preview',
  performanceProfile: 'balanced',
};

function assertSharedDefaultSchedulerTelemetry(rootEntry, computeEntry) {
  rootEntry.resetDefaultPlaneComputeTelemetry();
  assert.equal(
    rootEntry.getDefaultPlaneComputeTelemetrySnapshot().buckets.length,
    0,
  );

  computeEntry.runScheduledPlaneCompute(schedulerRequest);
  assert.equal(
    rootEntry.getDefaultPlaneComputeTelemetrySnapshot().buckets.length,
    1,
  );

  rootEntry.resetDefaultPlaneComputeTelemetry();
  assert.equal(
    computeEntry.getDefaultPlaneComputeTelemetrySnapshot().buckets.length,
    0,
  );
}

const root = await import('color-kit');
const core = await import('color-kit/core');
const driver = await import('color-kit/driver');
const plane = await import('color-kit/plane');
const compute = await import('color-kit/compute');
const hct = await import('color-kit/hct');
const react = await import('color-kit/react');
const wasm = await import('color-kit/wasm');

assert.equal(typeof root.definePlane, 'function');
assert.equal(typeof root.sense, 'function');
assert.equal(typeof core.definePlane, 'function');
assert.equal(typeof core.toSvgPath, 'function');
assert.equal(typeof driver.createColorState, 'function');
assert.equal(typeof driver.colorFromColorAreaPosition, 'function');
assert.equal(typeof driver.parseColorInputExpression, 'function');
assert.equal(typeof driver.getSliderGradientStyles, 'function');
assert.equal(typeof plane.definePlane, 'function');
assert.equal(typeof plane.sense, 'function');
assert.equal(typeof compute.createPlaneComputeScheduler, 'function');
assert.equal(typeof compute.runPlaneCompute, 'function');
assert.equal(typeof compute.runScheduledPlaneCompute, 'function');
assert.equal(
  typeof compute.getDefaultPlaneComputeTelemetrySnapshot,
  'function',
);
assert.equal(typeof compute.resetDefaultPlaneComputeTelemetry, 'function');
assert.equal(typeof hct.maxHctChromaForHue, 'function');
assert.equal(typeof react.Color, 'function');
assert.equal(typeof react.useColor, 'function');
assert.equal(typeof wasm.loadWasmPlaneComputeBackend, 'function');
assert.equal(typeof wasm.createWasmAwarePlaneComputeScheduler, 'function');

// Subpath entries must share module state with the root barrel (chunk
// splitting), otherwise module-level singletons like the default compute
// scheduler would be duplicated per entry point.
assert.equal(
  root.createJsPlaneComputeBackend,
  compute.createJsPlaneComputeBackend,
);
assert.equal(
  root.createJsPlaneComputeBackend,
  core.createJsPlaneComputeBackend,
);
assert.equal(root.definePlane, plane.definePlane);
assertSharedDefaultSchedulerTelemetry(root, compute);
assertSharedDefaultSchedulerTelemetry(core, compute);

const cjsRoot = require('color-kit');
const cjsCore = require('color-kit/core');
const cjsDriver = require('color-kit/driver');
const cjsPlane = require('color-kit/plane');
const cjsCompute = require('color-kit/compute');
const cjsHct = require('color-kit/hct');
const cjsReact = require('color-kit/react');
const cjsWasm = require('color-kit/wasm');

assert.equal(typeof cjsRoot.definePlane, 'function');
assert.equal(typeof cjsCore.definePlane, 'function');
assert.equal(typeof cjsDriver.createColorState, 'function');
assert.equal(typeof cjsPlane.definePlane, 'function');
assert.equal(typeof cjsCompute.createPlaneComputeScheduler, 'function');
assert.equal(typeof cjsCompute.runScheduledPlaneCompute, 'function');
assert.equal(
  typeof cjsCompute.getDefaultPlaneComputeTelemetrySnapshot,
  'function',
);
assert.equal(typeof cjsCompute.resetDefaultPlaneComputeTelemetry, 'function');
assert.equal(typeof cjsHct.maxHctChromaForHue, 'function');
assert.equal(typeof cjsReact.Color, 'function');
assert.equal(typeof cjsWasm.loadWasmPlaneComputeBackend, 'function');
assert.equal(
  cjsRoot.createJsPlaneComputeBackend,
  cjsCompute.createJsPlaneComputeBackend,
);
assert.equal(
  cjsRoot.createJsPlaneComputeBackend,
  cjsCore.createJsPlaneComputeBackend,
);
assert.equal(cjsRoot.definePlane, cjsPlane.definePlane);
assertSharedDefaultSchedulerTelemetry(cjsRoot, cjsCompute);
assertSharedDefaultSchedulerTelemetry(cjsCore, cjsCompute);
