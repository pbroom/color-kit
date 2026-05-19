import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  minify: false,
  external: ['@base-ui/react', 'radix-ui', 'react', 'react-dom'],
}));
