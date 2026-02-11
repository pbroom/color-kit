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
      data[index] = Math.round(rgb.r);
      data[index + 1] = Math.round(rgb.g);
      data[index + 2] = Math.round(rgb.b);
      data[index + 3] = Math.round((rgb.alpha ?? color.alpha) * 255);
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

function benchmarkCpu(profile) {
  const times = [];
  for (let i = 0; i < profile.iterations; i += 1) {
    const start = performance.now();
    renderPixels(profile.width, profile.height, 'requested', 'display-p3');
    const end = performance.now();
    times.push(end - start);
  }
  return times;
}

function benchmarkGpuPrototype(profile) {
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
  const cpu = summarize(benchmarkCpu(profile));
  const gpuPrototype = summarize(benchmarkGpuPrototype(profile));

  output.profiles[profile.name] = {
    config: {
      width: profile.width,
      height: profile.height,
      iterations: profile.iterations,
    },
    cpu,
    gpuPrototype,
  };
}

const desktopCpu = output.profiles.desktop.cpu;
const mobileCpu = output.profiles.mobile.cpu;
const desktopGpu = output.profiles.desktop.gpuPrototype;
const mobileGpu = output.profiles.mobile.gpuPrototype;

const cpuPass =
  desktopCpu.medianFps >= 90 &&
  desktopCpu.p95Ms <= 11 &&
  mobileCpu.medianFps >= 55 &&
  mobileCpu.p95Ms <= 18;

const gpuPass =
  desktopGpu.medianFps >= 90 &&
  desktopGpu.p95Ms <= 11 &&
  mobileGpu.medianFps >= 55 &&
  mobileGpu.p95Ms <= 18;

const avgCpu = (desktopCpu.medianMs + mobileCpu.medianMs) / 2;
const avgGpu = (desktopGpu.medianMs + mobileGpu.medianMs) / 2;

output.decision = {
  selectedRenderer: avgGpu <= avgCpu ? 'gpu' : 'cpu',
  cpuPass,
  gpuPass,
  note: 'GPU is preferred by default with CPU fallback for unsupported contexts.',
};

console.log(JSON.stringify(output, null, 2));
