import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const packageJson = JSON.parse(
  readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
);

// Licensing: the MIT license and the bundled third-party notices must ship in
// the tarball.
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  assert.ok(
    packageJson.files.includes(file),
    `package.json "files" must include ${file}`,
  );
  assert.ok(
    existsSync(path.join(packageRoot, file)),
    `${file} is missing from packages/color-kit (run the facade build)`,
  );
}

// Nothing in the facade may import an undeclared or unpublished package:
// every bare specifier in the built JS/DTS must be the package itself or a
// declared peer.
const declaredPeers = Object.keys(packageJson.peerDependencies ?? {});
assert.equal(packageJson.dependencies, undefined);
const allowedBarePackages = new Set(['color-kit', ...declaredPeers]);
// The trailing lookahead skips computed specifiers such as tsup's
// `require('u' + 'rl')` import.meta.url shim.
const specifierPattern =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)(["'])([^"'./][^"']*)\1(?=\s*(?:[);,]|$))/gm;

function packageNameOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(entryPath);
    else yield entryPath;
  }
}

const undeclared = new Set();
for (const file of walk(path.join(packageRoot, 'dist'))) {
  if (!/\.(c?js|d\.c?ts)$/.test(file)) continue;
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(specifierPattern)) {
    const name = packageNameOf(match[2]);
    if (name.startsWith('node:') || allowedBarePackages.has(name)) continue;
    undeclared.add(`${name} (${path.relative(packageRoot, file)})`);
  }
}
assert.deepEqual(
  [...undeclared],
  [],
  'dist imports packages that are not declared peers',
);

// Keep a stable release-check entrypoint for future runtime artifact assertions.
await import('./test-exports.mjs');
