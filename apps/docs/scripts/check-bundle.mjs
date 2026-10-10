// Bundle budgets for the docs build. Fails the build when:
// - any emitted JS chunk exceeds 200 kB minified, or
// - the JS the home page loads up front (entry + its static imports + the
//   home route chunk, which prerender modulepreloads) exceeds 110 kB gzip.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import console from 'node:console';
import process from 'node:process';

const CHUNK_LIMIT = 200 * 1000;
const HOME_GZIP_LIMIT = 110 * 1000;
const HOME_SOURCE = 'src/routes/home/index.tsx';

const docsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const distDir = path.join(docsRoot, 'dist');
const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

const manifest = JSON.parse(
  await readFile(path.join(distDir, '.vite', 'manifest.json'), 'utf8'),
);

const failures = [];
const assets = (await readdir(path.join(distDir, 'assets'))).filter((file) =>
  file.endsWith('.js'),
);
let largest = { file: '', size: 0 };
for (const file of assets) {
  const { byteLength } = await readFile(path.join(distDir, 'assets', file));
  if (byteLength > largest.size) largest = { file, size: byteLength };
  if (byteLength > CHUNK_LIMIT) {
    failures.push(
      `${file} is ${kb(byteLength)} minified (limit ${kb(CHUNK_LIMIT)})`,
    );
  }
}

function staticClosure(keys) {
  const seen = new Set();
  const visit = (key) => {
    if (seen.has(key) || !manifest[key]) return;
    seen.add(key);
    for (const child of manifest[key].imports ?? []) visit(child);
  };
  keys.forEach(visit);
  return [...seen]
    .map((key) => manifest[key].file)
    .filter((f) => f.endsWith('.js'));
}

const homeFiles = [...new Set(staticClosure(['index.html', HOME_SOURCE]))];
let homeGzip = 0;
for (const file of homeFiles) {
  homeGzip += gzipSync(await readFile(path.join(distDir, file)), {
    level: 9,
  }).byteLength;
}
if (homeGzip > HOME_GZIP_LIMIT) {
  failures.push(
    `home initial JS is ${kb(homeGzip)} gzip (limit ${kb(HOME_GZIP_LIMIT)}): ${homeFiles.join(', ')}`,
  );
}

console.log(
  `bundle: ${assets.length} JS chunks, largest ${largest.file} ${kb(largest.size)} (limit ${kb(CHUNK_LIMIT)}); home initial JS ${kb(homeGzip)} gzip across ${homeFiles.length} files (limit ${kb(HOME_GZIP_LIMIT)})`,
);

if (failures.length > 0) {
  for (const failure of failures) console.error(`budget exceeded: ${failure}`);
  process.exit(1);
}
