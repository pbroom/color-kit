import { readdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Options } from 'tsup';
type Plugin = NonNullable<Options['esbuildPlugins']>[number];

const MATERIAL_PACKAGE = '@material/material-color-utilities';

/**
 * `@material/material-color-utilities` does not declare `sideEffects`, and its
 * barrel re-exports modules whose classes run static initializers (for example
 * `MaterialDynamicColors`). Because we inline the package, those initializers
 * would otherwise be retained even though core only uses `Hct` and
 * `argbFromRgb`. Every module in the package is pure at import time, so mark
 * them side-effect free and let esbuild drop what core never references.
 */
const materialSideEffectFree: Plugin = {
  name: 'material-side-effect-free',
  setup(build) {
    build.onResolve({ filter: /.*/ }, async (args) => {
      if (args.pluginData === MATERIAL_PACKAGE) return undefined;
      const isMaterialBarrel = args.path === MATERIAL_PACKAGE;
      const isMaterialInternal =
        args.path.startsWith('.') &&
        args.importer.includes(
          `${path.sep}${MATERIAL_PACKAGE.replace('/', path.sep)}${path.sep}`,
        );
      if (!isMaterialBarrel && !isMaterialInternal) return undefined;
      const result = await build.resolve(args.path, {
        kind: args.kind,
        importer: args.importer,
        resolveDir: args.resolveDir,
        pluginData: MATERIAL_PACKAGE,
      });
      if (result.errors.length > 0) return { errors: result.errors };
      return { ...result, sideEffects: false };
    });
  },
};

// Public entry points. These are the only paths exposed through `exports`
// and the only ones that get `.d.ts` output.
const publicEntries = {
  index: 'src/index.ts',
  'plane/index': 'src/plane/index.ts',
  'compute/index': 'src/compute/index.ts',
  'hct/index': 'src/hct/index.ts',
  'interop/index': 'src/interop/index.ts',
};

/**
 * Every runtime source module, as a sorted `{ outName: srcPath }` map. A
 * stable, explicit entry order keeps chunk hashes deterministic across builds.
 */
function sourceModuleEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .map((file) => file.split(path.sep).join('/'))
    .filter(
      (file) =>
        file.endsWith('.ts') &&
        !file.endsWith('.d.ts') &&
        !file.endsWith('.test.ts') &&
        !file.endsWith('.typecheck.ts'),
    )
    .sort();
  for (const file of files) {
    entries[file.slice(0, -'.ts'.length)] = `src/${file}`;
  }
  return entries;
}

export default defineConfig((options) => ({
  // Emit every source module as its own JS entry (preserve-modules style).
  // With `sideEffects: false`, consumer bundlers can then drop whole unused
  // modules, including the inlined Material HCT solver and the plane/compute
  // engines, instead of statement-level shaking one large shared chunk where
  // static class initializers and property reads look side-effectful.
  entry: sourceModuleEntries(),
  format: ['esm', 'cjs'],
  dts: { entry: publicEntries },
  // Splitting keeps shared code (e.g. the default compute scheduler) as a
  // single module instance no matter which entry point a consumer imports.
  splitting: true,
  // Preserve the previous dist during watch rebuilds so downstream DTS builds
  // do not resolve against a briefly-empty package export surface.
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  minify: false,
  // Bundle ESM-only deps so the CJS export remains require()-compatible.
  noExternal: [MATERIAL_PACKAGE],
  esbuildPlugins: [materialSideEffectFree],
}));
