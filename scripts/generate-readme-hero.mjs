#!/usr/bin/env node
// Generates the README hero image (.github/assets/readme-hero.svg) with the
// color-kit engine itself: one OKLCH lightness x chroma plane at a fixed hue,
// queried for its sRGB and Display P3 gamut boundaries and the WCAG AA
// contrast contour against white, then compiled to SVG paths.
//
// Uses the built core package, so run `pnpm build` first, then
//   pnpm readme:hero

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const coreEntry = path.join(repoRoot, 'packages', 'core', 'dist', 'index.js');
const outFile = path.join(repoRoot, '.github', 'assets', 'readme-hero.svg');

let core;
try {
  core = await import(pathToFileURL(coreEntry).href);
} catch {
  console.error(
    `Could not load ${path.relative(repoRoot, coreEntry)}. Run \`pnpm build\` first.`,
  );
  process.exit(1);
}

const { definePlane, sense, toSvgPath, parse, toCss, toHex, toSrgbGamut } =
  core;

// ---------------------------------------------------------------------------
// Query the engine
// ---------------------------------------------------------------------------

const HUE = 264;
const CHROMA_MAX = 0.34;
const reference = parse('#ffffff');

const plane = definePlane({
  model: 'oklch',
  x: { channel: 'l', range: [0, 1] },
  y: { channel: 'c', range: [0, CHROMA_MAX] },
  fixed: { h: HUE, alpha: 1 },
});
const query = sense(plane);

const srgb = query.gamutBoundary({ gamut: 'srgb', steps: 160 });
const p3 = query.gamutBoundary({ gamut: 'display-p3', steps: 160 });
const contrast = query.contrastRegion({
  reference,
  level: 'AA',
  gamut: 'display-p3',
});

// ---------------------------------------------------------------------------
// Layout: plane coordinates are normalized (0..1, y up); SVG y points down.
// ---------------------------------------------------------------------------

const WIDTH = 960;
const HEIGHT = 380;
const PLOT = { left: 64, right: 932, top: 72, bottom: 324 };
const plotWidth = PLOT.right - PLOT.left;
const plotHeight = PLOT.bottom - PLOT.top;

const toView = (point) => ({
  x: PLOT.left + point.x * plotWidth,
  y: PLOT.bottom - point.y * plotHeight,
});
const fromLc = (l, c) => toView({ x: l, y: c / CHROMA_MAX });
const svgPath = (points, closeLoop = false) =>
  toSvgPath(points.map(toView), { scale: 1, precision: 1, closeLoop });
const round = (value) => Math.round(value * 10) / 10;

const cusp = (points) => points.reduce((a, b) => (b.c > a.c ? b : a));
const srgbCusp = cusp(srgb.points);
const p3Cusp = cusp(p3.points);

// The AA contour runs from the lightness axis up to the gamut edge. Closing it
// back along the axis to L = 0 and clipping to the P3 region gives the filled
// "passes AA on white" area.
const contour = contrast.paths.reduce((a, b) => (b.length > a.length ? b : a));
const contourOrdered =
  contour[0].y <= contour.at(-1).y ? contour : [...contour].reverse();
const contourTop = contourOrdered.at(-1);
const passRegion = [
  { x: 0, y: 0 },
  ...contourOrdered,
  { x: contourTop.x, y: 1 },
  { x: 0, y: 1 },
];

// sRGB fill: a lightness ramp of in-gamut colors at this hue.
const rampStops = Array.from({ length: 11 }, (_, index) => {
  const l = index / 10;
  const color = toSrgbGamut({ l, c: 0.14, h: HUE, alpha: 1 });
  return `<stop offset="${l}" stop-color="${toHex(color)}"/>`;
}).join('');

// The P3-only band uses the P3 cusp color, with an sRGB hex fallback.
const p3Accent = { l: p3Cusp.l, c: p3Cusp.c, h: HUE, alpha: 1 };
const p3Fill = toCss(p3Accent, 'display-p3');
const p3Fallback = toHex(toSrgbGamut(p3Accent));

const aaLabel = fromLc(0.22, 0.03);
const srgbLabel = fromLc(srgbCusp.l - 0.02, srgbCusp.c * 0.52);
const p3LabelAnchor = fromLc(p3Cusp.l, p3Cusp.c);
const contourLabel = fromLc(
  contourTop.l,
  (contourTop.c / CHROMA_MAX) * 0.5 * CHROMA_MAX,
);

const xTicks = [0, 0.25, 0.5, 0.75, 1]
  .map((l) => {
    const { x } = fromLc(l, 0);
    return `<line class="tick" x1="${round(x)}" y1="${PLOT.bottom}" x2="${round(x)}" y2="${PLOT.bottom + 5}"/><text class="muted" x="${round(x)}" y="${PLOT.bottom + 20}" text-anchor="middle">${l}</text>`;
  })
  .join('');
const yTicks = [0, 0.1, 0.2, 0.3]
  .map((c) => {
    const { y } = fromLc(0, c);
    return `<line class="tick" x1="${PLOT.left - 5}" y1="${round(y)}" x2="${PLOT.left}" y2="${round(y)}"/><text class="muted" x="${PLOT.left - 9}" y="${round(y) + 4}" text-anchor="end">${c}</text>`;
  })
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
<title id="title">color-kit plane query: sRGB and Display P3 gamut boundaries with a WCAG AA contrast region</title>
<desc id="desc">An OKLCH lightness by chroma plane at hue ${HUE}. The filled sRGB gamut sits inside the larger Display P3 gamut, and a hatched region marks colors with at least 4.5:1 WCAG contrast against white. Every shape was computed by color-kit with definePlane, sense, and toSvgPath.</desc>
<style>
  svg { --text: #1f2328; --muted: #59636e; --line: #d1d9e0; --contour: #1f2328; }
  @media (prefers-color-scheme: dark) {
    svg { --text: #f0f6fc; --muted: #9198a1; --line: #3d444d; --contour: #f0f6fc; }
  }
  text { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 13px; fill: var(--text); }
  .title { font-size: 17px; font-weight: 600; }
  .muted { fill: var(--muted); font-size: 12px; }
  .code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; fill: var(--muted); }
  .label { font-weight: 600; }
  .axis, .tick { stroke: var(--line); stroke-width: 1; }
  .p3-fill { fill: ${p3Fallback}; fill: ${p3Fill}; }
  .p3-edge { fill: none; stroke: ${p3Fallback}; stroke: ${p3Fill}; stroke-width: 2; stroke-dasharray: 5 4; }
  .srgb-edge { fill: none; stroke: var(--text); stroke-opacity: 0.55; stroke-width: 1.5; }
  .hatch { stroke: #ffffff; stroke-opacity: 0.45; stroke-width: 1.5; }
  .contour { fill: none; stroke: var(--contour); stroke-width: 2.5; }
  .leader { stroke: var(--muted); stroke-width: 1; fill: none; }
</style>
<defs>
  <linearGradient id="srgb-ramp" gradientUnits="userSpaceOnUse" x1="${PLOT.left}" y1="0" x2="${PLOT.right}" y2="0">${rampStops}</linearGradient>
  <pattern id="aa-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><line class="hatch" x1="0" y1="0" x2="0" y2="7"/></pattern>
  <clipPath id="p3-clip"><path d="${svgPath(p3.points, true)}"/></clipPath>
</defs>
<text class="title" x="${PLOT.left}" y="30">One OKLCH plane, queried as geometry</text>
<text class="code" x="${PLOT.left}" y="50">definePlane({ model: 'oklch', x: 'l', y: 'c', h: ${HUE} }) → sense() → gamutBoundary · contrastRegion → toSvgPath</text>
<line class="axis" x1="${PLOT.left}" y1="${PLOT.bottom}" x2="${PLOT.right}" y2="${PLOT.bottom}"/>
<line class="axis" x1="${PLOT.left}" y1="${PLOT.top}" x2="${PLOT.left}" y2="${PLOT.bottom}"/>
${xTicks}
${yTicks}
<path class="p3-fill" d="${svgPath(p3.points, true)}"/>
<path fill="url(#srgb-ramp)" d="${svgPath(srgb.points, true)}"/>
<path fill="url(#aa-hatch)" clip-path="url(#p3-clip)" d="${svgPath(passRegion, true)}"/>
<path class="srgb-edge" d="${svgPath(srgb.points)}"/>
<path class="p3-edge" d="${svgPath(p3.points)}"/>
<path class="contour" d="${svgPath(contourOrdered)}"/>
<text class="label" x="${round(srgbLabel.x)}" y="${round(srgbLabel.y)}" text-anchor="middle" style="fill:#ffffff">sRGB</text>
<path class="leader" d="M ${round(p3LabelAnchor.x + 4)} ${round(p3LabelAnchor.y - 3)} L ${round(p3LabelAnchor.x + 46)} ${round(p3LabelAnchor.y - 22)}"/>
<text class="label" x="${round(p3LabelAnchor.x + 50)}" y="${round(p3LabelAnchor.y - 22)}">Display P3 only</text>
<text class="muted" x="${round(p3LabelAnchor.x + 50)}" y="${round(p3LabelAnchor.y - 7)}">max C ${p3Cusp.c.toFixed(3)} vs ${srgbCusp.c.toFixed(3)} in sRGB</text>
<rect x="${round(aaLabel.x - 6)}" y="${round(aaLabel.y - 15)}" width="246" height="21" rx="4" style="fill:#ffffff;fill-opacity:0.9"/>
<text class="label" x="${round(aaLabel.x)}" y="${round(aaLabel.y)}" style="fill:#1f2328">Passes WCAG AA (4.5:1) on white</text>
<path class="leader" d="M ${round(contourLabel.x + 3)} ${round(contourLabel.y)} L ${round(contourLabel.x + 40)} ${round(contourLabel.y)}"/>
<text x="${round(contourLabel.x + 44)}" y="${round(contourLabel.y + 4)}">contrast contour</text>
<text class="muted" x="${PLOT.right}" y="${PLOT.bottom + 40}" text-anchor="end">Lightness (L) →</text>
<text class="muted" transform="translate(${PLOT.left - 44} ${PLOT.top + 2}) rotate(-90)" text-anchor="end">Chroma (C) →</text>
</svg>
`;

await writeFile(outFile, svg);
console.log(`Wrote ${path.relative(repoRoot, outFile)} (${svg.length} bytes).`);
