import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import rehypeSlug from 'rehype-slug';
import rehypeShiki from '@shikijs/rehype';
import { resolve } from 'node:path';
import { highlightPlugin } from './plugins/highlight';
import { previewStaticPlugin } from './plugins/preview-static';
import { routeDataPlugin } from './plugins/route-data';
import {
  codeMetaTransformer,
  cssVariablesColorReplacements,
  cssVariablesTheme,
} from './plugins/shiki-theme';

const core = (file: string) =>
  resolve(__dirname, '../../packages/core/src', file);

/** `color-kit` subpaths (and their `@color-kit/*` twins) resolve to source. */
const CORE_ENTRIES: Record<string, string> = {
  '': 'index.ts',
  '/core': 'index.ts',
  '/plane': 'plane/index.ts',
  '/compute': 'compute/index.ts',
  '/hct': 'hct/index.ts',
  '/interop': 'interop/index.ts',
};

/** Hard budget for any single emitted chunk, in minified kB. */
export const CHUNK_BUDGET_KB = 200;

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    routeDataPlugin(),
    highlightPlugin(),
    previewStaticPlugin(),
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [
          remarkGfm,
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: 'frontmatter' }],
        ],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypeShiki,
            {
              theme: cssVariablesTheme,
              colorReplacements: cssVariablesColorReplacements,
              transformers: [codeMetaTransformer],
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
      ...Object.entries(CORE_ENTRIES).flatMap(([subpath, file]) => {
        const specifiers = [`color-kit${subpath}`];
        if (subpath !== '/core') {
          specifiers.push(`@color-kit/core${subpath}`);
        }
        return specifiers.map((specifier) => ({
          find: new RegExp(`^${specifier.replace('/', '\\/')}$`),
          replacement: core(file),
        }));
      }),
      {
        find: /^(?:color-kit|@color-kit)\/driver$/,
        replacement: resolve(__dirname, '../../packages/driver/src/index.ts'),
      },
      {
        find: /^(?:color-kit|@color-kit)\/react$/,
        replacement: resolve(__dirname, '../../packages/react/src/index.ts'),
      },
      {
        find: /^@color-kit\/react\/color-input$/,
        replacement: resolve(
          __dirname,
          '../../packages/react/src/color-input.tsx',
        ),
      },
    ],
    dedupe: ['@base-ui/react', 'react', 'react-dom', 'react-router'],
  },
  build: {
    target: 'es2022',
    // The client manifest drives prerender modulepreloads and the budget check.
    manifest: !isSsrBuild,
    // The SSR bundle only feeds scripts/prerender.mjs; it needs no assets.
    copyPublicDir: !isSsrBuild,
    chunkSizeWarningLimit: CHUNK_BUDGET_KB,
    rollupOptions: isSsrBuild
      ? undefined
      : {
          output: {
            // React DOM alone is ~180 kB; keep it out of the app entry so
            // no chunk crosses the budget and the app chunk caches apart.
            manualChunks(id: string) {
              if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
                return 'vendor-react';
              }
              return undefined;
            },
          },
        },
  },
  worker: {
    format: 'es' as const,
  },
}));
