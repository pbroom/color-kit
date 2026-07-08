import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
    'plane/index': 'src/plane/index.ts',
    'compute/index': 'src/compute/index.ts',
    'hct/index': 'src/hct/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  // Share chunks between the root barrel and subpath entries so module-level
  // state (e.g. the default compute scheduler) stays a single instance no
  // matter which entry point a consumer imports.
  splitting: true,
  // Preserve the previous dist during watch rebuilds so downstream DTS builds
  // do not resolve against a briefly-empty package export surface.
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  minify: false,
  // Bundle ESM-only deps so the CJS export remains require()-compatible.
  noExternal: ['@material/material-color-utilities'],
}));
