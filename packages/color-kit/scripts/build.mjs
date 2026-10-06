import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const distRoot = path.join(packageRoot, 'dist');

const coreDistRoot = path.join(repoRoot, 'packages', 'core', 'dist');
const driverDistRoot = path.join(repoRoot, 'packages', 'driver', 'dist');
const reactDistRoot = path.join(repoRoot, 'packages', 'react', 'dist');

// `@color-kit/react`'s `color-input` entry depends on the unpublished
// `@color-kit/control-kit` peer, so the facade does not ship it until
// control-kit is published. Its shared chunks stay (the root react entry uses
// them); only the entry's own files are skipped.
const excludedReactEntryFiles = new Set([
  'color-input.js',
  'color-input.js.map',
  'color-input.cjs',
  'color-input.cjs.map',
  'color-input.d.ts',
  'color-input.d.cts',
]);

const rewriteRules = [
  // Order matters: rewrite the longer specifiers before the bare core one.
  [/(["'])@color-kit\/driver\1/g, '$1color-kit/driver$1'],
  [
    /(["'])@color-kit\/core\/(plane|compute|hct|interop)\1/g,
    '$1color-kit/$2$1',
  ],
  [/(["'])@color-kit\/core\1/g, '$1color-kit$1'],
];

function shouldRewriteFile(filePath) {
  return (
    filePath.endsWith('.js') ||
    filePath.endsWith('.cjs') ||
    filePath.endsWith('.d.ts') ||
    filePath.endsWith('.d.cts')
  );
}

function rewriteSpecifiers(text) {
  return rewriteRules.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
}

async function assertPathExists(targetPath, label) {
  try {
    await stat(targetPath);
  } catch {
    throw new Error(
      `Missing ${label} at ${path.relative(repoRoot, targetPath)}. Run the source package builds first.`,
    );
  }
}

async function copyDirectory(
  sourceDir,
  targetDir,
  rewriteImports,
  excludedFiles = new Set(),
) {
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() && excludedFiles.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath, rewriteImports);
      continue;
    }

    if (rewriteImports && shouldRewriteFile(sourcePath)) {
      const source = await readFile(sourcePath, 'utf8');
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, rewriteSpecifiers(source));
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }
}

async function main() {
  await assertPathExists(coreDistRoot, 'core build output');
  await assertPathExists(driverDistRoot, 'driver build output');
  await assertPathExists(reactDistRoot, 'react build output');

  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });

  await copyDirectory(coreDistRoot, distRoot, false);
  await copyDirectory(driverDistRoot, path.join(distRoot, 'driver'), true);
  await copyDirectory(
    reactDistRoot,
    path.join(distRoot, 'react'),
    true,
    excludedReactEntryFiles,
  );

  // Ship the repository's MIT license with the tarball (single source of
  // truth at the repo root; the copy is gitignored).
  await copyFile(
    path.join(repoRoot, 'LICENSE'),
    path.join(packageRoot, 'LICENSE'),
  );
}

await main();
