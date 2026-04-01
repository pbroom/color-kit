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
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const distRoot = path.join(packageRoot, 'dist');
const skipWasmGenerated = /^(1|true)$/i.test(
  process.env.COLOR_KIT_SKIP_WASM_GENERATED ?? '',
);

const coreDistRoot = path.join(repoRoot, 'packages', 'core', 'dist');
const reactDistRoot = path.join(repoRoot, 'packages', 'react', 'dist');
const wasmDistRoot = path.join(repoRoot, 'packages', 'core-wasm', 'dist');

const rewriteRules = [
  [/(["'])@color-kit\/core\1/g, '$1color-kit$1'],
  [/(["'])@color-kit\/core-wasm\1/g, '$1color-kit/wasm$1'],
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

async function copyDirectory(sourceDir, targetDir, rewriteImports) {
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath, rewriteImports);
      continue;
    }

    if (rewriteImports && shouldRewriteFile(sourcePath)) {
      const source = await readFile(sourcePath, 'utf8');
      await writeFile(targetPath, rewriteSpecifiers(source));
      continue;
    }

    await copyFile(sourcePath, targetPath);
  }
}

async function main() {
  await assertPathExists(coreDistRoot, 'core build output');
  await assertPathExists(reactDistRoot, 'react build output');
  await assertPathExists(wasmDistRoot, 'wasm build output');
  if (!skipWasmGenerated) {
    await assertPathExists(
      path.join(wasmDistRoot, 'generated', 'color_kit_core_wasm.js'),
      'wasm generated bindings',
    );
    await assertPathExists(
      path.join(wasmDistRoot, 'generated', 'color_kit_core_wasm_bg.wasm'),
      'wasm binary',
    );
  }

  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });

  await copyDirectory(coreDistRoot, distRoot, false);
  await copyDirectory(coreDistRoot, path.join(distRoot, 'core'), false);
  await copyDirectory(reactDistRoot, path.join(distRoot, 'react'), true);
  await copyDirectory(wasmDistRoot, path.join(distRoot, 'wasm'), true);
}

await main();
