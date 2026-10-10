// Generates the API reference for the published `color-kit` entry points with
// TypeDoc, straight from the workspace sources, so it cannot drift from the
// code. Output goes to `public/reference/` (gitignored); Vite copies it into
// the docs build, where it is served at `/reference/`.
//
// Each public subpath gets a tiny wrapper entry (`export * from ...`) tagged
// with `@module <subpath>`, so the reference is organised by the import path
// users actually write rather than by internal source file names.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Application, LogLevel } from 'typedoc';

const docsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repoRoot = path.resolve(docsRoot, '..', '..');
const workDir = path.join(docsRoot, '.typedoc');
const entriesDir = path.join(workDir, 'entries');
const outDir = path.join(docsRoot, 'public', 'reference');

/**
 * Public subpaths of the `color-kit` facade (see
 * packages/color-kit/package.json `exports`). `color-kit/core` is an alias of
 * the root entry, so it is documented once as `color-kit`.
 */
const entryPoints = [
  {
    module: 'color-kit',
    source: 'packages/core/src/index.ts',
    summary:
      'The core engine: OKLCH-canonical conversion, contrast, harmony, manipulation, gamut mapping, and plane queries. `color-kit/core` is an alias of this entry.',
  },
  {
    module: 'color-kit/plane',
    source: 'packages/core/src/plane/index.ts',
    summary:
      'Plane definitions and queries (`definePlane`, `sense`, `toSvgPath`) without the rest of the engine.',
  },
  {
    module: 'color-kit/compute',
    source: 'packages/core/src/compute/index.ts',
    summary: 'Plane compute scheduling on the JS backend, with telemetry.',
  },
  {
    module: 'color-kit/hct',
    source: 'packages/core/src/hct/index.ts',
    summary:
      'HCT color space helpers, isolating the bundled Material color utilities solver.',
  },
  {
    module: 'color-kit/interop',
    source: 'packages/core/src/interop/index.ts',
    summary:
      'Tuple and typed-array interop for GPU pipelines, three.js, and WebGL/WebGPU.',
  },
  {
    module: 'color-kit/driver',
    source: 'packages/driver/src/index.ts',
    summary:
      'Framework-agnostic interaction driver: color state, area/slider/input coordinate mapping, and expression parsing.',
  },
  {
    module: 'color-kit/react',
    source: 'packages/react/src/index.ts',
    summary: 'Headless React primitives and hooks built on the driver.',
  },
];

function toImportSpecifier(fromDir, sourcePath) {
  const relative = path
    .relative(fromDir, path.join(repoRoot, sourcePath))
    .split(path.sep)
    .join('/')
    .replace(/\.tsx?$/, '.js');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

async function writeEntries() {
  await rm(workDir, { recursive: true, force: true });
  await mkdir(entriesDir, { recursive: true });

  const entryFiles = [];
  for (const entry of entryPoints) {
    const fileName = `${entry.module.replace(/\//g, '__')}.ts`;
    const filePath = path.join(entriesDir, fileName);
    await writeFile(
      filePath,
      [
        '/**',
        ` * ${entry.summary}`,
        ' *',
        ` * \`\`\`ts`,
        ` * import { ... } from '${entry.module}';`,
        ' * ```',
        ' *',
        ` * @module ${entry.module}`,
        ' */',
        `export * from '${toImportSpecifier(entriesDir, entry.source)}';`,
        '',
      ].join('\n'),
    );
    entryFiles.push(filePath);
  }

  const tsconfigPath = path.join(workDir, 'tsconfig.json');
  await writeFile(
    tsconfigPath,
    JSON.stringify(
      {
        extends: path.relative(workDir, path.join(repoRoot, 'tsconfig.json')),
        compilerOptions: {
          noEmit: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          // Resolve sibling workspace packages from source so the reference
          // does not depend on package build order (`pnpm build` runs this
          // concurrently with the package builds, which clear `dist`).
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

  const readmePath = path.join(workDir, 'README.md');
  await writeFile(
    readmePath,
    [
      'Generated from the source of every public `color-kit` entry point. Pick a module below, or use the search.',
      '',
      '| Import path | What it contains |',
      '| --- | --- |',
      ...entryPoints.map(
        (entry) => `| \`${entry.module}\` | ${entry.summary} |`,
      ),
      '',
      'Back to the [color-kit docs](/docs/introduction).',
      '',
    ].join('\n'),
  );

  return { entryFiles, tsconfigPath, readmePath };
}

async function main() {
  const { entryFiles, tsconfigPath, readmePath } = await writeEntries();

  const app = await Application.bootstrapWithPlugins({
    name: 'color-kit',
    entryPoints: entryFiles,
    entryPointStrategy: 'resolve',
    tsconfig: tsconfigPath,
    readme: readmePath,
    out: outDir,
    excludePrivate: true,
    excludeProtected: true,
    excludeInternal: true,
    excludeExternals: true,
    sort: ['kind', 'alphabetical'],
    gitRevision: 'main',
    hideGenerator: true,
    githubPages: false,
    cleanOutputDir: true,
    navigationLinks: { Docs: '/docs/introduction' },
    validation: { notExported: false, invalidLink: true, notDocumented: false },
    logLevel: LogLevel.Warn,
  });

  const project = await app.convert();
  if (!project) {
    throw new Error('TypeDoc failed to convert the color-kit entry points.');
  }

  await app.generateOutputs(project);

  if (app.logger.hasErrors()) {
    throw new Error('TypeDoc reported errors while generating the reference.');
  }

  console.log(
    `API reference written to ${path.relative(repoRoot, outDir)} (${entryPoints.length} entry points).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
