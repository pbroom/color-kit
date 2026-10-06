// size-limit entry point. Budgets live in `.size-limit.json`; this wrapper
// (selected via `size-limit --config .size-limit.js`) only adjusts esbuild.
//
// The facade ships preserve-modules output with `"sideEffects": false`, so
// entry files contain bare `import "../chunk-*.js"` statements that esbuild
// correctly drops while measuring. Its `ignored-bare-import` warning is
// expected for these bundles and not actionable, so silence it.
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const checks = JSON.parse(
  readFileSync(new URL('./.size-limit.json', import.meta.url), 'utf8'),
);

/** @param {import('esbuild').BuildOptions} config */
const quietIgnoredBareImports = (config) => ({
  ...config,
  logOverride: { ...config.logOverride, 'ignored-bare-import': 'silent' },
});

export default checks.map((check) => ({
  ...check,
  modifyEsbuildConfig: quietIgnoredBareImports,
}));
