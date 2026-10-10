// Entry points of the published `color-kit` facade, derived from
// `packages/color-kit/package.json#exports`. Shared by the TypeDoc step, the
// normalizer and the drift test so the three can never disagree.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const docsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
export const repoRoot = path.resolve(docsRoot, '..', '..');
export const facadeRoot = path.join(repoRoot, 'packages', 'color-kit');

/**
 * Where each `dist/` subtree of the facade comes from (see
 * `packages/color-kit/scripts/build.mjs`): `dist/driver` and `dist/react` are
 * copies of those packages' builds; everything else is `@color-kit/core`.
 */
const DIST_PACKAGES = { driver: 'driver', react: 'react' };

/**
 * Display metadata the package manifest cannot carry: package order (the
 * order the site lists entry points in) and a one-line description. An
 * export subpath missing here is still documented, after these, with a
 * generic description.
 */
export const ENTRY_META = {
  core: {
    order: 0,
    summary:
      'The engine: OKLCH-canonical conversion, contrast, gamut mapping, harmony, manipulation and plane queries.',
  },
  plane: {
    order: 1,
    summary:
      'Define 2D color planes and query their gamut and contrast regions, boundaries and paths.',
  },
  interop: {
    order: 2,
    summary:
      'Tuples, packed buffers and allocation-free writers for canvas, WebGL, WebGPU and three.js.',
  },
  compute: {
    order: 3,
    summary: 'Schedule plane compute on the JS backend, with telemetry.',
  },
  hct: {
    order: 4,
    summary: 'Material HCT conversion, gamut limits and tonal helpers.',
  },
  driver: {
    order: 5,
    summary:
      'Headless picker state: color state, area and slider coordinate mapping, input parsing.',
  },
  react: {
    order: 6,
    summary:
      'React state and plane hooks on top of the driver: Color, useColor, useColorPlaneRenderer and geometry hooks.',
  },
};

function typesPath(target) {
  if (typeof target === 'string') return target;
  return target?.import?.types ?? target?.types ?? null;
}

/**
 * @typedef {object} EntryPoint
 * @property {string} slug URL slug (`core`, `plane`, …).
 * @property {string} importPath Specifier users write (`color-kit/plane`).
 * @property {string[]} aliases Other specifiers that resolve to the same files.
 * @property {string} subpath The `exports` key (`.`, `./plane`, …).
 * @property {string[]} subpaths Every `exports` key served by this entry.
 * @property {string} dts Built facade declaration file, relative to the facade.
 * @property {string} source Source entry file, relative to the repo root.
 * @property {string} sourceDir Directory whose files this entry owns.
 * @property {number} order
 * @property {string} summary
 */

/** @returns {EntryPoint[]} entry points in package order. */
export function readEntryPoints() {
  const manifest = JSON.parse(
    readFileSync(path.join(facadeRoot, 'package.json'), 'utf8'),
  );
  const byDts = new Map();
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    const dts = typesPath(target);
    if (!dts || !dts.endsWith('.d.ts')) continue; // ./package.json
    const importPath =
      subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`;
    const existing = byDts.get(dts);
    if (existing) {
      existing.aliases.push(importPath);
      existing.subpaths.push(subpath);
      continue;
    }
    // ./dist/plane/index.d.ts → ['plane']; ./dist/index.d.ts → []
    const parts = dts
      .replace(/^\.\/dist\/?/, '')
      .replace(/\/?index\.d\.ts$/, '')
      .split('/')
      .filter(Boolean);
    const pkg = DIST_PACKAGES[parts[0]] ?? 'core';
    const rest = DIST_PACKAGES[parts[0]] ? parts.slice(1) : parts;
    const sourceDir = path.posix.join('packages', pkg, 'src', ...rest);
    const source = path.posix.join(sourceDir, 'index.ts');
    if (!existsSync(path.join(repoRoot, source))) {
      throw new Error(
        `Cannot find the source for ${importPath} (${dts}); expected ${source}.`,
      );
    }
    const slug = parts.length === 0 ? 'core' : parts.join('-');
    const meta = ENTRY_META[slug];
    byDts.set(dts, {
      slug,
      importPath,
      aliases: [],
      subpath,
      subpaths: [subpath],
      dts: dts.replace(/^\.\//, ''),
      source,
      sourceDir,
      order: meta?.order ?? 100,
      summary: meta?.summary ?? `The ${importPath} entry point.`,
    });
  }
  return [...byDts.values()].sort(
    (a, b) => a.order - b.order || a.slug.localeCompare(b.slug),
  );
}
