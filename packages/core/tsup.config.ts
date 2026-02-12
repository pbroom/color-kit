import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  // Bundle ESM-only deps so the CJS export remains require()-compatible.
  noExternal: ['@material/material-color-utilities'],
});
