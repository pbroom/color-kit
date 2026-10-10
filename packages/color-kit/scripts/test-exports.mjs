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

function assertDefaultSchedulerTelemetry(computeEntry) {
  computeEntry.resetDefaultPlaneComputeTelemetry();
  assert.equal(
    computeEntry.getDefaultPlaneComputeTelemetrySnapshot().buckets.length,
    0,
  );

  computeEntry.runScheduledPlaneCompute(schedulerRequest);
  assert.equal(
    computeEntry.getDefaultPlaneComputeTelemetrySnapshot().buckets.length,
    1,
  );

  computeEntry.resetDefaultPlaneComputeTelemetry();
  assert.equal(
    computeEntry.getDefaultPlaneComputeTelemetrySnapshot().buckets.length,
    0,
  );
}

// The compute engine and the marching-squares contour helpers are not part
// of the root barrel: compute lives only on `color-kit/compute`, and the
// contour helpers are internal.
const NOT_ON_ROOT = [
  'createJsPlaneComputeBackend',
  'createPlaneComputeScheduler',
  'runPlaneCompute',
  'runScheduledPlaneCompute',
  'getDefaultPlaneComputeTelemetrySnapshot',
  'resetDefaultPlaneComputeTelemetry',
  'packPlaneQueryResults',
  'unpackPlaneQueryResults',
  'buildContourPaths',
  'contourEdgeKey',
  'interpolateZero',
  'PLANE_DEFAULT_RANGES',
];

function assertNotOnRoot(rootEntry) {
  for (const name of NOT_ON_ROOT) {
    assert.equal(name in rootEntry, false, `${name} must not be on the root`);
  }
}

const root = await import('color-kit');
const core = await import('color-kit/core');
const driver = await import('color-kit/driver');
const plane = await import('color-kit/plane');
const compute = await import('color-kit/compute');
const hct = await import('color-kit/hct');
const interop = await import('color-kit/interop');
const react = await import('color-kit/react');

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
assert.equal(typeof interop.toLinearSrgbArray, 'function');
assert.equal(typeof interop.packColors, 'function');
assert.equal(root.toLinearSrgbArray, interop.toLinearSrgbArray);
assert.equal(root.packColors, interop.packColors);
assert.equal(typeof react.Color, 'function');
assert.equal(typeof react.useColor, 'function');
assert.equal('ColorInput' in react, false);
// ColorInput depends on the unpublished @color-kit/control-kit, so the facade
// does not expose `color-kit/react/color-input` until control-kit is published.
await assert.rejects(import('color-kit/react/color-input'), {
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
});

// Subpath entries must share module state with the root barrel (chunk
// splitting), otherwise module-level state would be duplicated per entry
// point.
assert.equal(root.definePlane, plane.definePlane);
assert.equal(root.definePlane, core.definePlane);
assertNotOnRoot(root);
assertNotOnRoot(core);
assertDefaultSchedulerTelemetry(compute);

const cjsRoot = require('color-kit');
const cjsCore = require('color-kit/core');
const cjsDriver = require('color-kit/driver');
const cjsPlane = require('color-kit/plane');
const cjsCompute = require('color-kit/compute');
const cjsHct = require('color-kit/hct');
const cjsInterop = require('color-kit/interop');
const cjsReact = require('color-kit/react');

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
assert.equal(typeof cjsInterop.toLinearSrgbArray, 'function');
assert.equal(cjsRoot.packColors, cjsInterop.packColors);
assert.equal(typeof cjsReact.Color, 'function');
assert.equal('ColorInput' in cjsReact, false);
assert.throws(() => require('color-kit/react/color-input'), {
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
});
assert.equal(cjsRoot.definePlane, cjsPlane.definePlane);
assert.equal(cjsRoot.definePlane, cjsCore.definePlane);
assertNotOnRoot(cjsRoot);
assertNotOnRoot(cjsCore);
assertDefaultSchedulerTelemetry(cjsCompute);
