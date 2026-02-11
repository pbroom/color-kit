/* global console */

import { performance } from 'node:perf_hooks';
import { toP3Gamut, toRgb, toSrgbGamut } from '@color-kit/core';

const BASE = { l: 0.62, c: 0.25, h: 235, alpha: 1 };
const AXES = {
  x: { channel: 'c', range: [0, 0.4] },
  y: { channel: 'l', range: [0, 1] },
};

const PROFILES = [
  { name: 'desktop', width: 512, height: 512, iterations: 4 },
  { name: 'mobile', width: 256, height: 256, iterations: 6 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sampleColor(base, xNorm, yNorm, source, gamut) {
  const x = clamp(xNorm, 0, 1);
  const y = clamp(yNorm, 0, 1);
  const xRange = AXES.x.range;
  const yRange = AXES.y.range;

  const sampled = {
    ...base,
    [AXES.x.channel]: xRange[0] + x * (xRange[1] - xRange[0]),
    [AXES.y.channel]: yRange[0] + (1 - y) * (yRange[1] - yRange[0]),
  };

  if (source === 'requested') {
    return sampled;
  }
  return gamut === 'display-p3' ? toP3Gamut(sampled) : toSrgbGamut(sampled);
}

function renderPixels(width, height, source, gamut) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const yNorm = height <= 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const xNorm = width <= 1 ? 0 : x / (width - 1);
      const color = sampleColor(BASE, xNorm, yNorm, source, gamut);
      const rgb = toRgb(color);
      const index = (y * width + x) * 4;
      data[index] = Math.round(rgb.r * 255);
      data[index + 1] = Math.round(rgb.g * 255);
      data[index + 2] = Math.round(rgb.b * 255);
      data[index + 3] = Math.round(color.alpha * 255);
    }
  }

  return data;
}

function percentile(values, p) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1),
  );
  return sorted[idx];
}

function benchmarkCanvas2d(profile) {
  const times = [];
  for (let i = 0; i < profile.iterations; i += 1) {
    const start = performance.now();
    renderPixels(profile.width, profile.height, 'requested', 'display-p3');
    const end = performance.now();
    times.push(end - start);
  }
  return times;
}

function benchmarkWebglPrototype(profile) {
  const times = [];
  for (let i = 0; i < profile.iterations; i += 1) {
    const start = performance.now();
    const pixels = renderPixels(
      profile.width,
      profile.height,
      'requested',
      'display-p3',
    );
    // Simulate upload + blit overhead from a CPU-backed texture path.
    const staging = new Uint8Array(pixels.length);
    staging.set(pixels);
    const scratch = new Uint8Array(staging.length);
    scratch.set(staging);
    const end = performance.now();
    times.push(end - start);
  }
  return times;
}

function summarize(times) {
  const median = percentile(times, 0.5);
  const p95 = percentile(times, 0.95);
  return {
    samples: times.map((value) => Number(value.toFixed(3))),
    medianMs: Number(median.toFixed(3)),
    p95Ms: Number(p95.toFixed(3)),
    medianFps: Number((1000 / median).toFixed(2)),
  };
}

const output = {
  timestamp: new Date().toISOString(),
  targets: {
    desktop: {
      medianFps: '>= 90',
      p95Ms: '<= 11',
    },
    mobile: {
      medianFps: '>= 55',
      p95Ms: '<= 18',
    },
  },
  profiles: {},
};

for (const profile of PROFILES) {
  const canvas2d = summarize(benchmarkCanvas2d(profile));
  const webglPrototype = summarize(benchmarkWebglPrototype(profile));

  output.profiles[profile.name] = {
    config: {
      width: profile.width,
      height: profile.height,
      iterations: profile.iterations,
    },
    canvas2d,
    webglPrototype,
  };
}

const desktopCanvas = output.profiles.desktop.canvas2d;
const mobileCanvas = output.profiles.mobile.canvas2d;
const desktopWebgl = output.profiles.desktop.webglPrototype;
const mobileWebgl = output.profiles.mobile.webglPrototype;

const canvasPass =
  desktopCanvas.medianFps >= 90 &&
  desktopCanvas.p95Ms <= 11 &&
  mobileCanvas.medianFps >= 55 &&
  mobileCanvas.p95Ms <= 18;

const webglPass =
  desktopWebgl.medianFps >= 90 &&
  desktopWebgl.p95Ms <= 11 &&
  mobileWebgl.medianFps >= 55 &&
  mobileWebgl.p95Ms <= 18;

output.decision = {
  selectedRenderer: canvasPass || !webglPass ? 'canvas2d' : 'webgl',
  canvasPass,
  webglPass,
  note: 'Canvas2D is selected by this benchmark gate in the current repository baseline.',
};

console.log(JSON.stringify(output, null, 2));
