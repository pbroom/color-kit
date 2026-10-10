import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHighlighter, type Highlighter } from 'shiki';
import type { Plugin } from 'vite';
import { evalExample, evalLifecycle, loadBuildModule } from './eval-example';
import {
  codeMetaTransformer,
  cssVariablesColorReplacements,
  cssVariablesTheme,
} from './shiki-theme';

const QUERY = '?highlighted';
const PREFIX = '\0color-kit-highlighted:';
const BUILD_QUERY = '?build';
const BUILD_PREFIX = '\0color-kit-build:';
// The virtual id must not end in a source extension, or the MDX and React
// plugins (which strip queries before filtering) would transform it again.
const SUFFIX = '.highlighted';

const LANG_BY_EXTENSION: Record<string, string> = {
  '.ts': 'ts',
  '.mts': 'ts',
  '.tsx': 'tsx',
  '.js': 'js',
  '.mjs': 'js',
  '.jsx': 'jsx',
  '.json': 'json',
  '.css': 'css',
  '.html': 'html',
  '.sh': 'bash',
  '.mdx': 'mdx',
};

let highlighterPromise: Promise<Highlighter> | null = null;

/** Shared build-time highlighter (also used by `rehype-shiki` via the same theme). */
export function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [cssVariablesTheme],
    langs: [...new Set(Object.values(LANG_BY_EXTENSION))],
  });
  return highlighterPromise;
}

/** Normalize line endings and trailing whitespace the same way everywhere. */
export function normalizeSource(source: string): string {
  return source.replace(/\r\n/g, '\n').trimEnd();
}

/** Highlight `code` into theme-agnostic HTML (`<pre class="shiki">…`). */
export async function highlightToHtml(
  code: string,
  lang: string,
  title?: string,
): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang,
    theme: cssVariablesTheme.name!,
    colorReplacements: cssVariablesColorReplacements,
    transformers: [codeMetaTransformer],
    meta: title ? { __raw: `title="${title}"` } : undefined,
  });
}

/**
 * Build-time source and data imports for docs examples.
 *
 * `import html, { code, lang, filename } from './file.tsx?highlighted'`
 *
 * Resolves the file like any other import, reads it from disk, and returns
 * build-time Shiki HTML (CSS-variables theme) as the default export. No
 * highlighter ships to the browser. Types live in `mdx.d.ts`. When the
 * file has `// →` markers, they are evaluated first (see
 * `plugins/eval-example.ts`), so `html` and `code` show computed results.
 *
 * `import value, { named } from './data.ts?build'`
 *
 * Runs the module in Node at build time and inlines its exports as JSON:
 * the computation and its dependencies never reach the browser. Exports
 * must be JSON-serializable.
 */
export function highlightPlugin(): Plugin {
  const inputs = new Map<string, Set<string>>();
  return {
    name: 'color-kit:highlighted',
    enforce: 'pre',
    ...evalLifecycle(),
    // The virtual .highlighted suffix bypasses JS import analysis, so watched
    // files need explicit HMR edges as well as Rollup's addWatchFile entries.
    handleHotUpdate({ file, modules, server }) {
      const affected = new Set(modules);
      for (const [id, dependencies] of inputs) {
        if (!dependencies.has(file)) continue;
        const module = server.moduleGraph.getModuleById(id);
        if (module) {
          server.moduleGraph.invalidateModule(module);
          affected.add(module);
        }
      }
      return [...affected];
    },
    async resolveId(source, importer) {
      const query = source.endsWith(QUERY)
        ? QUERY
        : source.endsWith(BUILD_QUERY)
          ? BUILD_QUERY
          : null;
      if (!query) {
        return null;
      }
      const resolved = await this.resolve(
        source.slice(0, -query.length),
        importer,
        { skipSelf: true },
      );
      if (!resolved) {
        return null;
      }
      const prefix = query === QUERY ? PREFIX : BUILD_PREFIX;
      return `${prefix}${resolved.id.split('?')[0]}${SUFFIX}`;
    },
    async load(id) {
      if (!id.startsWith(BUILD_PREFIX) && !id.startsWith(PREFIX)) return null;
      const dependencies = new Set<string>();
      // Keep the last successful graph while evaluating: a broken dependency
      // must still invalidate this module when the author fixes it.
      if (!inputs.has(id)) inputs.set(id, dependencies);
      const watch = (file: string) => {
        dependencies.add(file);
        this.addWatchFile(file);
      };
      if (id.startsWith(BUILD_PREFIX)) {
        const file = id.slice(BUILD_PREFIX.length, -SUFFIX.length);
        watch(file);
        const exports = await loadBuildModule(file, watch);
        inputs.set(id, dependencies);
        return Object.entries(exports)
          .map(([name, value]) => {
            const json = JSON.stringify(value);
            if (json === undefined) {
              throw new Error(
                `${file}: export \`${name}\` is not JSON-serializable`,
              );
            }
            return name === 'default'
              ? `export default ${json};`
              : `export const ${name} = ${json};`;
          })
          .join('\n');
      }
      const file = id.slice(PREFIX.length, -SUFFIX.length);
      watch(file);
      const source = normalizeSource(await readFile(file, 'utf8'));
      const code = await evalExample(file, source, undefined, watch);
      inputs.set(id, dependencies);
      const lang = LANG_BY_EXTENSION[path.extname(file)] ?? 'text';
      const filename = path.basename(file);
      const html = await highlightToHtml(code, lang, filename);
      return [
        `export const code = ${JSON.stringify(code)};`,
        `export const lang = ${JSON.stringify(lang)};`,
        `export const filename = ${JSON.stringify(filename)};`,
        `export default ${JSON.stringify(html)};`,
      ].join('\n');
    },
  };
}
