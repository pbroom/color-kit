import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import rehypeShiki from '@shikijs/rehype';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          [
            rehypeShiki,
            {
              themes: {
                light: 'github-light',
                dark: 'github-dark-default',
              },
            },
          ],
        ],
      }),
    },
    react({
      include: /\.(tsx|ts|jsx|js|mdx|md)$/,
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, './src') },
      {
        find: /^color-kit$/,
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
      {
        find: /^color-kit\/core$/,
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
      {
        find: /^color-kit\/react$/,
        replacement: resolve(__dirname, '../../packages/react/src/index.ts'),
      },
      {
        find: /^color-kit\/wasm$/,
        replacement: resolve(
          __dirname,
          '../../packages/core-wasm/src/index.ts',
        ),
      },
      {
        find: /^@color-kit\/core-wasm$/,
        replacement: resolve(
          __dirname,
          '../../packages/core-wasm/src/index.ts',
        ),
      },
      {
        find: /^@color-kit\/core$/,
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
      {
        find: /^@color-kit\/react$/,
        replacement: resolve(__dirname, '../../packages/react/src/index.ts'),
      },
    ],
    dedupe: [
      '@base-ui/react',
      'class-variance-authority',
      'clsx',
      'lucide-react',
      'radix-ui',
      'react',
      'react-dom',
      'tailwind-merge',
    ],
  },
  worker: {
    format: 'es',
  },
});
