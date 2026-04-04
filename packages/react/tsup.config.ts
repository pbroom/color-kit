import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  // Intentionally ship compiler-safe source without React Compiler precompilation.
  // The current library pipeline relies on tsup/esbuild, while docs precompile via Vite+Babel.
  entry: {
    index: 'src/index.ts',
    'workers/contrast-region.worker': 'src/workers/contrast-region.worker.ts',
    'workers/plane-query.worker': 'src/workers/plane-query.worker.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  // Preserve prior outputs during watch rebuilds so DTS resolution stays valid
  // while upstream workspace packages finish writing fresh declarations.
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  minify: false,
  external: ['react', 'react-dom'],
}));
