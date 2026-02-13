import { defineConfig } from 'tsup';

export default defineConfig({
  // Intentionally ship compiler-safe source without React Compiler precompilation.
  // The current library pipeline relies on tsup/esbuild, while docs precompile via Vite+Babel.
  entry: {
    index: 'src/index.ts',
    'workers/contrast-region.worker': 'src/workers/contrast-region.worker.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  external: ['react', 'react-dom'],
});
