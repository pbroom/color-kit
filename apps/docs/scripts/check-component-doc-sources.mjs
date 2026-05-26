import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const docsRoot = path.resolve(path.dirname(scriptPath), '..');
const componentContentDir = path.join(docsRoot, 'src/content/components');
const docsRegistryPath = path.join(docsRoot, 'src/content/docs-registry.ts');
const componentDocsPath = path.join(
  docsRoot,
  'src/content/components/component-docs-data.tsx',
);

function formatList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function findDuplicates(items) {
  const seen = new Set();
  const duplicates = new Set();

  for (const item of items) {
    if (seen.has(item)) {
      duplicates.add(item);
    } else {
      seen.add(item);
    }
  }

  return [...duplicates].sort();
}

function assertSameSet(label, left, right) {
  const leftDuplicates = findDuplicates(left);
  const rightDuplicates = findDuplicates(right);

  if (leftDuplicates.length || rightDuplicates.length) {
    const details = [
      leftDuplicates.length
        ? `Duplicated in docs navigation:\n${formatList(leftDuplicates)}`
        : '',
      rightDuplicates.length
        ? `Duplicated in component docs data:\n${formatList(rightDuplicates)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    throw new Error(`${label} contain duplicates.\n\n${details}`);
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const missing = [...leftSet].filter((item) => !rightSet.has(item));
  const extra = [...rightSet].filter((item) => !leftSet.has(item));

  if (!missing.length && !extra.length) {
    return;
  }

  const details = [
    missing.length
      ? `Missing from component docs data:\n${formatList(missing)}`
      : '',
    extra.length ? `Missing from docs navigation:\n${formatList(extra)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  throw new Error(`${label} are out of sync.\n\n${details}`);
}

async function findMdxFiles(dir, relativeDir = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryRelativePath = path.join(relativeDir, entry.name);
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return findMdxFiles(entryPath, entryRelativePath);
      }

      return entry.isFile() && entry.name.endsWith('.mdx')
        ? [path.join('src/content/components', entryRelativePath)]
        : [];
    }),
  );

  return files.flat();
}

const staleMdxFiles = (await findMdxFiles(componentContentDir)).sort();

if (staleMdxFiles.length > 0) {
  throw new Error(
    [
      'Component docs are routed from component-docs-data.tsx.',
      'Do not add hand-authored component MDX files unless generation wiring is restored.',
      '',
      formatList(staleMdxFiles),
    ].join('\n'),
  );
}

const [docsRegistrySource, componentDocsSource] = await Promise.all([
  readFile(docsRegistryPath, 'utf8'),
  readFile(componentDocsPath, 'utf8'),
]);

const navSlugs = [
  ...docsRegistrySource.matchAll(/path:\s*['"]components\/([^'"]+)['"]/g),
].map((match) => match[1]);

const dataSlugs = [
  ...componentDocsSource.matchAll(/slug:\s*['"]([^'"]+)['"]/g),
].map((match) => match[1]);

assertSameSet('Component docs slugs', navSlugs, dataSlugs);
