// Step 1 of the API reference: TypeDoc converts every public entry point of
// the `color-kit` facade from source and writes its JSON model to
// `.typedoc/api.json`. `normalize.mjs` turns that into the site's model.
//
// Each entry gets a tiny wrapper (`export * from '<source>'`) tagged with
// `@module <import path>`, so TypeDoc groups symbols by the specifier users
// write. A symbol exported from several entries is converted once; the other
// entries get a reference to it, which is how the normalizer recognizes
// re-exports by declaration identity.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import console from 'node:console';
import { Application, LogLevel } from 'typedoc';
import { docsRoot, readEntryPoints, repoRoot } from './entries.mjs';

export const typedocDir = path.join(docsRoot, '.typedoc');
export const typedocJson = path.join(typedocDir, 'api.json');

function importSpecifier(fromDir, sourcePath) {
  const relative = path
    .relative(fromDir, path.join(repoRoot, sourcePath))
    .split(path.sep)
    .join('/')
    .replace(/\.tsx?$/, '.js');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

/** Most specific first, so TypeDoc's primary reflection sits in the deepest entry. */
function bySpecificity(a, b) {
  return b.sourceDir.split('/').length - a.sourceDir.split('/').length;
}

export async function runTypedoc() {
  const started = performance.now();
  const entries = readEntryPoints();
  const entriesDir = path.join(typedocDir, 'entries');
  await rm(typedocDir, { recursive: true, force: true });
  await mkdir(entriesDir, { recursive: true });

  const entryFiles = [];
  for (const entry of [...entries].sort(bySpecificity)) {
    const file = path.join(entriesDir, `${entry.slug}.ts`);
    await writeFile(
      file,
      [
        '/**',
        ` * @module ${entry.importPath}`,
        ' */',
        `export * from '${importSpecifier(entriesDir, entry.source)}';`,
        '',
      ].join('\n'),
    );
    entryFiles.push(file);
  }

  const tsconfig = path.join(typedocDir, 'tsconfig.json');
  await writeFile(
    tsconfig,
    JSON.stringify(
      {
        extends: path.relative(
          typedocDir,
          path.join(repoRoot, 'tsconfig.json'),
        ),
        compilerOptions: {
          noEmit: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          // Resolve sibling workspace packages from source so the reference
          // does not depend on package build order (`pnpm build` runs the
          // docs build alongside the package builds, which clear `dist`).
          paths: {
            '@color-kit/core': [
              path.join(repoRoot, 'packages/core/src/index.ts'),
            ],
            '@color-kit/core/*': [
              path.join(repoRoot, 'packages/core/src/*/index.ts'),
            ],
            '@color-kit/driver': [
              path.join(repoRoot, 'packages/driver/src/index.ts'),
            ],
          },
        },
        include: ['entries/*.ts'],
      },
      null,
      2,
    ),
  );

  const app = await Application.bootstrapWithPlugins({
    name: 'color-kit',
    entryPoints: entryFiles,
    entryPointStrategy: 'resolve',
    tsconfig,
    excludePrivate: true,
    excludeProtected: true,
    excludeInternal: true,
    excludeExternals: true,
    // Members in declaration order; the normalizer orders symbols itself.
    sort: ['source-order'],
    disableSources: false,
    sourceLinkTemplate: '{path}#L{line}',
    disableGit: true,
    basePath: repoRoot,
    validation: {
      notExported: false,
      invalidLink: false,
      notDocumented: false,
    },
    logLevel: LogLevel.Error,
    plugin: [],
  });

  const project = await app.convert();
  if (!project) {
    throw new Error('TypeDoc failed to convert the color-kit entry points.');
  }
  await app.generateJson(project, typedocJson);
  if (app.logger.hasErrors()) {
    throw new Error('TypeDoc reported errors while converting the API.');
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(2);
  console.log(
    `typedoc: ${entries.length} entry points → ${path.relative(docsRoot, typedocJson)} in ${seconds}s`,
  );
  return { entries, json: typedocJson };
}
