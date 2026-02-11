/* global console */

import { performance } from 'node:perf_hooks';
import {
  contrastRegionPaths,
  gamutBoundaryPath,
  toP3Gamut,
  toSrgbGamut,
} from '@color-kit/core';

const BASE_COLOR = { l: 0.62, c: 0.26, h: 235, alpha: 1 };
const LC_AXES = {
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0, 0.4] },
};
const HL_AXES = {
  x: { channel: 'h', range: [0, 360] },
  y: { channel: 'l', range: [0, 1] },
};

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1),
  );
  return sorted[index];
}

function colorFromPosition(color, axes, xNorm, yNorm) {
  const x = Math.max(0, Math.min(1, xNorm));
  const y = Math.max(0, Math.min(1, yNorm));
  const xValue = axes.x.range[0] + x * (axes.x.range[1] - axes.x.range[0]);
  const yValue =
    axes.y.range[0] + (1 - y) * (axes.y.range[1] - axes.y.range[0]);
  return {
    ...color,
    [axes.x.channel]: xValue,
    [axes.y.channel]: yValue,
  };
}

function summarize(samples) {
  const medianMs = percentile(samples, 0.5);
  const p95Ms = percentile(samples, 0.95);
  const droppedFrames = samples.filter((value) => value > 16.67).length;
  const longTasks = samples.filter((value) => value > 50).length;

  return {
    samples: samples.map((value) => Number(value.toFixed(3))),
    medianMs: Number(medianMs.toFixed(3)),
    p95Ms: Number(p95Ms.toFixed(3)),
    droppedFrames,
    droppedFrameRate: Number((droppedFrames / samples.length).toFixed(3)),
    longTasks,
  };
}

function runDragScenario({ name, steps, axes, withAnalysis }) {
  const samples = [];
  let requested = BASE_COLOR;

  for (let index = 0; index < steps; index += 1) {
    const xNorm = index / Math.max(1, steps - 1);
    const yNorm = 1 - xNorm;

    const start = performance.now();
    requested = colorFromPosition(requested, axes, xNorm, yNorm);
    const displayedP3 = toP3Gamut(requested);

    // Emulate linked consumers in docs (displayed + fallback markers).
    toSrgbGamut(requested);
    toP3Gamut(requested);

    if (withAnalysis) {
      gamutBoundaryPath(requested.h, { gamut: 'display-p3', steps: 48 });
      gamutBoundaryPath(requested.h, { gamut: 'srgb', steps: 48 });
      contrastRegionPaths(displayedP3, requested.h, {
        gamut: 'display-p3',
        threshold: 4.5,
        lightnessSteps: 28,
        chromaSteps: 28,
      });
    }

    const end = performance.now();
    samples.push(end - start);
  }

  return {
    name,
    steps,
    analysis: withAnalysis,
    ...summarize(samples),
  };
}

const scenarios = [
  {
    name: 'drag-lc-default',
    steps: 420,
    axes: LC_AXES,
    withAnalysis: false,
  },
  {
    name: 'drag-hl-default',
    steps: 420,
    axes: HL_AXES,
    withAnalysis: false,
  },
  {
    name: 'drag-lc-analysis',
    steps: 220,
    axes: LC_AXES,
    withAnalysis: true,
  },
];

const results = scenarios.map(runDragScenario);
const aggregateSamples = results.flatMap((result) => result.samples);

const output = {
  timestamp: new Date().toISOString(),
  targets: {
    medianInteractionMs: '<= 8',
    longTaskMs: '<= 50',
  },
  scenarios: results,
  aggregate: summarize(aggregateSamples),
};

console.log(JSON.stringify(output, null, 2));
