// `pnpm docs:api`: TypeDoc JSON → normalized API model.
//
// Runs under vite-node (see the `docs:api` script) so it can share the
// build-time Shiki setup in `plugins/` with the rest of the site, on every
// supported Node version.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import console from 'node:console';
import process from 'node:process';
import { getHighlighter } from '../../plugins/highlight';
import {
  codeMetaTransformer,
  cssVariablesColorReplacements,
  cssVariablesTheme,
} from '../../plugins/shiki-theme';
import { docsRoot } from './entries.mjs';
import { normalize, writeModel } from './normalize.mjs';
import { runTypedoc } from './typedoc.mjs';

async function main() {
  const started = performance.now();
  const [{ entries, json }, highlighter] = await Promise.all([
    runTypedoc(),
    getHighlighter(),
  ]);
  const project = JSON.parse(await readFile(json, 'utf8'));
  const highlight = (code, lang) =>
    highlighter.codeToHtml(code, {
      lang,
      theme: cssVariablesTheme.name,
      colorReplacements: cssVariablesColorReplacements,
      transformers: [codeMetaTransformer],
    });
  const result = normalize({ project, entries, highlight });
  await writeModel(docsRoot, result);
  const seconds = ((performance.now() - started) / 1000).toFixed(2);
  const reexports = result.entries.reduce(
    (sum, entry) => sum + entry.reexports.length,
    0,
  );
  console.log(
    `api: ${result.symbols.length} symbol pages, ${reexports} re-exports, ${entries.length} entries → ${path.relative(docsRoot, path.join(docsRoot, 'src/generated'))} in ${seconds}s`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
