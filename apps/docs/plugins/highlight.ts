import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHighlighter, type Highlighter } from 'shiki';
import type { Plugin } from 'vite';
import {
  codeMetaTransformer,
  cssVariablesColorReplacements,
  cssVariablesTheme,
} from './shiki-theme';

const QUERY = '?highlighted';
const PREFIX = '\0color-kit-highlighted:';
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
 * `import html, { code, lang, filename } from './file.tsx?highlighted'`
 *
 * Resolves the file like any other import, reads it from disk, and returns
 * build-time Shiki HTML (CSS-variables theme) as the default export. No
 * highlighter ships to the browser. Types live in `src/highlighted.d.ts`.
 */
export function highlightPlugin(): Plugin {
  return {
    name: 'color-kit:highlighted',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!source.endsWith(QUERY)) {
        return null;
      }
      const resolved = await this.resolve(
        source.slice(0, -QUERY.length),
        importer,
        { skipSelf: true },
      );
      if (!resolved) {
        return null;
      }
      return `${PREFIX}${resolved.id.split('?')[0]}${SUFFIX}`;
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) {
        return null;
      }
      const file = id.slice(PREFIX.length, -SUFFIX.length);
      this.addWatchFile(file);
      const code = normalizeSource(await readFile(file, 'utf8'));
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
