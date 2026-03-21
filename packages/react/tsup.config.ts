import { defineConfig } from 'tsup';

const isWatchMode = process.argv.includes('--watch');

export default defineConfig({
  // Intentionally ship compiler-safe source without React Compiler precompilation.
  // The current library pipeline relies on tsup/esbuild, while docs precompile via Vite+Babel.
  entry: {
    index: 'src/index.ts',
    'workers/contrast-region.worker': 'src/workers/contrast-region.worker.ts',
    'workers/plane-query.worker': 'src/workers/plane-query.worker.ts',
  },
  format: ['esm', 'cjs'],
  // The root dev flow performs an initial full build before entering watch mode.
  // Skipping DTS in watch avoids transient workspace-resolution races while core
  // rebuilds, but production builds still emit declarations.
  dts: !isWatchMode,
  clean: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  external: ['react', 'react-dom'],
});
