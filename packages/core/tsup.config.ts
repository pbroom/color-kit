import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // Preserve the previous dist during watch rebuilds so downstream DTS builds
  // do not resolve against a briefly-empty package export surface.
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  minify: false,
  // Bundle ESM-only deps so the CJS export remains require()-compatible.
  noExternal: ['@material/material-color-utilities'],
}));
