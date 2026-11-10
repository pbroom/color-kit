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
// of the root barrel: compute lives only on `@pbroom/color-kit/compute`, and the
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
  // Array interop, advanced plane APIs and generic math helpers are
  // subpath-only (or internal): the root keeps the everyday toolkit plus the
  // plane essentials.
  'toLinearSrgbArray',
  'packColors',
  'runPlaneQuery',
  'PlaneQueryCache',
  'unionRegions',
  'inspectPlaneQuery',
  'getPlaneContrastPoint',
  'clamp',
  'round',
  'lerp',
];

function assertNotOnRoot(rootEntry) {
  for (const name of NOT_ON_ROOT) {
    assert.equal(name in rootEntry, false, `${name} must not be on the root`);
  }
}

// The plane renderer's shader sources and benchmark-selected renderer are
// internal, and @pbroom/color-kit/react ships hooks only: the UI components it used
// to export were removed, not moved.
const NOT_ON_REACT = [
  'BENCHMARK_SELECTED_COLOR_PLANE_RENDERER',
  'COLOR_PLANE_VERTEX_SHADER_SOURCE',
  'COLOR_PLANE_FRAGMENT_SHADER_SOURCE',
  'ColorArea',
  'ColorPlane',
  'ColorSlider',
  'ColorStringInput',
  'ColorInput',
  'ContrastRegionLayer',
  'GamutBoundaryLayer',
  'Thumb',
];

const REACT_HOOKS = [
  'useColor',
  'useColorContext',
  'useMultiColor',
  'useColorStoreSelector',
  'useColorPlaneRenderer',
  'useGamutBoundary',
  'useChromaBand',
  'useContrastRegion',
  'useFallbackPoints',
  'useAdaptiveQuality',
];

function assertReactHooks(reactEntry) {
  for (const name of REACT_HOOKS) {
    assert.equal(typeof reactEntry[name], 'function', `${name} is missing`);
  }
}

function assertNotOnReact(reactEntry) {
  for (const name of NOT_ON_REACT) {
    assert.equal(name in reactEntry, false, `${name} must not be public`);
  }
}

const root = await import('@pbroom/color-kit');
const core = await import('@pbroom/color-kit/core');
const driver = await import('@pbroom/color-kit/driver');
const plane = await import('@pbroom/color-kit/plane');
const compute = await import('@pbroom/color-kit/compute');
const hct = await import('@pbroom/color-kit/hct');
const interop = await import('@pbroom/color-kit/interop');
const react = await import('@pbroom/color-kit/react');

assert.equal(typeof root.definePlane, 'function');
assert.equal(typeof root.sense, 'function');
assert.equal(typeof core.definePlane, 'function');
assert.equal(typeof core.toSvgPath, 'function');
assert.equal(typeof root.deltaEOK, 'function');
assert.equal(typeof root.deltaE2000, 'function');
assert.equal(root.deltaE2000, core.deltaE2000);
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
assert.equal(typeof plane.runPlaneQuery, 'function');
assert.equal(typeof plane.PlaneQueryCache, 'function');
assert.equal(root.toSvgPath, plane.toSvgPath);
// Contrast point solvers: the lightness-only helpers are on the root, the
// plane query on `sense()` and the plane entry.
assert.equal(typeof root.ensureContrast, 'function');
assert.equal(typeof root.tryEnsureContrast, 'function');
assert.equal(root.ensureContrast, core.ensureContrast);
assert.equal(typeof plane.getPlaneContrastPoint, 'function');
{
  const white = root.parse('#ffffff');
  const fixed = root.ensureContrast(root.parse('#3b82f6'), white);
  assert.equal(root.toHex(fixed), '#2c72e5');
  assert.ok(root.contrastRatio(fixed, white) >= 4.5);
  assert.equal(
    root.tryEnsureContrast(white, root.parse('#808080'), { threshold: 21 }),
    null,
  );
  const solved = root
    .sense(root.definePlane({ fixed: { h: 264 } }))
    .contrastPoint({
      point: { x: 0.8, y: 0 },
      reference: white,
      gamut: root.srgb,
    });
  assert.equal(solved.kind, 'contrastPoint');
  assert.equal(solved.status, 'adjusted');
  assert.ok(root.inSrgbGamut(solved.point.color));
  assert.ok(solved.contrast >= 4.5);
  const [roundTripped] = compute.unpackPlaneQueryResults(
    compute.packPlaneQueryResults([solved]),
  );
  assert.equal(roundTripped.status, 'adjusted');
  assert.equal(roundTripped.contrast, solved.contrast);
}
assert.equal(typeof react.Color, 'function');
assertReactHooks(react);
// The control-kit-backed `color-input` subpath was removed with ColorInput.
await assert.rejects(import('@pbroom/color-kit/react/color-input'), {
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
});

// Subpath entries must share module state with the root barrel (chunk
// splitting), otherwise module-level state would be duplicated per entry
// point.
assert.equal(root.definePlane, plane.definePlane);
assert.equal(root.definePlane, core.definePlane);
// Gamuts are descriptor objects, exported from the root and plane entries
// (one object each, shared by every entry).
for (const [name, id] of [
  ['srgb', 'srgb'],
  ['displayP3', 'display-p3'],
  ['rec2020', 'rec2020'],
  ['a98Rgb', 'a98-rgb'],
]) {
  assert.equal(root[name].id, id, `root.${name}.id`);
  assert.equal(root[name], plane[name], `plane.${name}`);
  assert.equal(root[name], core[name], `core.${name}`);
}
assert.equal(typeof root.assertGamut, 'function');
assert.equal(root.assertGamut, plane.assertGamut);
for (const name of ['inGamut', 'toGamut', 'toGamutInto']) {
  assert.equal(typeof root[name], 'function', `root.${name}`);
}
for (const name of ['assertGamutTarget', 'assertDisplayGamut']) {
  assert.equal(name in root, false, `root.${name} was removed`);
  assert.equal(name in plane, false, `plane.${name} was removed`);
}
// The old string form throws instead of silently meaning sRGB.
assert.throws(
  () => root.maxChromaAt(0.6, 250, { gamut: 'display-p3' }),
  /maxChromaAt\(\): gamut "display-p3" is not a Gamut object/,
);
assert.equal(
  root.maxChromaAt(0.6, 250, { gamut: root.displayP3 }),
  0.21923828125,
);
assert.ok(
  root.contrastRatio(root.parse('#777'), root.parse('#fff'), {
    gamut: root.rec2020,
  }) > 4,
);
// Adobe RGB (1998) is a descriptor only: no named helpers.
assert.equal(
  root.inGamut(root.parse('color(a98-rgb 0 1 0)'), root.a98Rgb),
  true,
  'inGamut(a98Rgb)',
);
assert.equal(root.maxChromaAt(0.8, 150, { gamut: plane.a98Rgb }), 0.367578125);
for (const name of ['inA98Gamut', 'toA98Gamut', 'inA98RgbGamut']) {
  assert.equal(name in root, false, `root.${name} does not exist`);
}
// The driver names its two display gamuts by string and maps them to core
// descriptors; Rec. 2020 is not a display gamut there.
assert.equal(typeof driver.assertDisplayGamut, 'function');
assert.equal(driver.displayGamutDescriptor('display-p3'), root.displayP3);
assert.equal(driver.displayGamutDescriptor('srgb'), root.srgb);
for (const name of ['inRec2020Gamut', 'toRec2020Gamut', 'toRec2020GamutInto']) {
  assert.equal(typeof root[name], 'function', `root.${name}`);
  assert.equal(root[name], core[name], `core.${name}`);
}
assert.equal(root.LINEAR_SRGB_TO_LINEAR_REC2020.length, 3);
assert.equal(
  root.inRec2020Gamut(root.parse('color(rec2020 0 1 0)')),
  true,
  'inRec2020Gamut',
);
assert.equal(
  root.toCss(root.parse('color(rec2020 0 1 0)'), 'rec2020'),
  'color(rec2020 0 1 0)',
);
assert.equal(
  plane.sense(plane.definePlane({ model: 'oklch' })).gamutBoundary({
    gamut: plane.rec2020,
  }).gamut,
  plane.rec2020,
);
assert.throws(
  () =>
    driver.createColorState(root.parse('#3b82f6'), { activeGamut: 'rec2020' }),
  /unknown gamut "rec2020"/,
);
assertNotOnRoot(root);
assertNotOnRoot(core);
assertNotOnReact(react);
assertDefaultSchedulerTelemetry(compute);

const cjsRoot = require('@pbroom/color-kit');
const cjsCore = require('@pbroom/color-kit/core');
const cjsDriver = require('@pbroom/color-kit/driver');
const cjsPlane = require('@pbroom/color-kit/plane');
const cjsCompute = require('@pbroom/color-kit/compute');
const cjsHct = require('@pbroom/color-kit/hct');
const cjsInterop = require('@pbroom/color-kit/interop');
const cjsReact = require('@pbroom/color-kit/react');

assert.equal(typeof cjsRoot.definePlane, 'function');
assert.equal(typeof cjsCore.definePlane, 'function');
assert.equal(typeof cjsRoot.deltaEOK, 'function');
assert.equal(typeof cjsRoot.deltaE2000, 'function');
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
assert.equal(typeof cjsInterop.packColors, 'function');
assert.equal(typeof cjsRoot.ensureContrast, 'function');
assert.equal(typeof cjsRoot.tryEnsureContrast, 'function');
assert.equal(typeof cjsPlane.getPlaneContrastPoint, 'function');
assert.equal(typeof cjsReact.Color, 'function');
assertReactHooks(cjsReact);
assert.throws(() => require('@pbroom/color-kit/react/color-input'), {
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
});
assert.equal(cjsRoot.definePlane, cjsPlane.definePlane);
assert.equal(cjsRoot.definePlane, cjsCore.definePlane);
assert.equal(cjsRoot.assertGamut, cjsPlane.assertGamut);
assert.equal(cjsRoot.rec2020, cjsPlane.rec2020);
assert.equal(cjsRoot.a98Rgb, cjsPlane.a98Rgb);
assert.equal(cjsRoot.a98Rgb.id, 'a98-rgb');
assert.equal(cjsRoot.displayP3.id, 'display-p3');
assert.equal(cjsDriver.displayGamutDescriptor('display-p3'), cjsRoot.displayP3);
assert.equal(typeof cjsRoot.inRec2020Gamut, 'function');
assert.equal(typeof cjsRoot.toRec2020Gamut, 'function');
assert.equal(typeof cjsRoot.toRec2020GamutInto, 'function');
assertNotOnRoot(cjsRoot);
assertNotOnRoot(cjsCore);
assertNotOnReact(cjsReact);
assertDefaultSchedulerTelemetry(cjsCompute);
