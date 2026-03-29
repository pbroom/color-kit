import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptPath = fileURLToPath(import.meta.url);
const docsRoot = path.resolve(path.dirname(scriptPath), '..');

const demoComponentPath = path.join(
  docsRoot,
  'src/components/plane-api-demos.tsx',
);
const playgroundSourcePath = path.join(
  docsRoot,
  'src/components/plane-api-playground.demo.tsx',
);
const pagePath = path.join(docsRoot, 'src/content/api/plane-api.mdx');

const [demoComponentSource, playgroundSource, pageSource] = await Promise.all([
  readFile(demoComponentPath, 'utf8'),
  readFile(playgroundSourcePath, 'utf8'),
  readFile(pagePath, 'utf8'),
]);

const playgroundChecks = [
  {
    label: 'quick-start fixed channels',
    pattern:
      /definePlane\(\{\s*fixed:\s*\{\s*h:\s*250,\s*alpha:\s*1\s*\}\s*\}\)/,
  },
  {
    label: 'quick-start fluent query',
    pattern: /sense\(\s*plane\s*\)/,
  },
  {
    label: 'quick-start svg output options',
    pattern: /toSvgPath\([^)]*closeLoop:\s*true,\s*precision:\s*2[^)]*\)/s,
  },
];

function assertPatternInSource(source, sourceLabel, patternLabel, pattern) {
  if (!pattern.test(source)) {
    throw new Error(
      `Missing ${patternLabel} in ${sourceLabel}. Keep quick-start demo and snippet aligned.`,
    );
  }
}

const demoComponentChecks = [
  {
    label: 'shared playground demo import',
    pattern: /plane-api-playground\.demo/,
  },
  {
    label: 'shared playground source import',
    pattern: /plane-api-playground-source/,
  },
  {
    label: 'lazy sandpack import',
    pattern: /plane-api-playground\.sandpack/,
  },
];

const pageChecks = [
  {
    label: 'quick-start demo import',
    pattern: /from\s*['"]@\/components\/plane-api-demos['"]/,
  },
  {
    label: 'quick-start snippet component',
    pattern: /<PlaneQuickStartSnippet\s*\/>/,
  },
  {
    label: 'quick-start playground component',
    pattern: /<PlaneQuickStartPlayground\s*\/>/,
  },
];

for (const { label, pattern } of playgroundChecks) {
  assertPatternInSource(
    playgroundSource,
    'plane-api-playground.demo.tsx',
    label,
    pattern,
  );
}

for (const { label, pattern } of demoComponentChecks) {
  assertPatternInSource(
    demoComponentSource,
    'plane-api-demos.tsx',
    label,
    pattern,
  );
}

for (const { label, pattern } of pageChecks) {
  assertPatternInSource(pageSource, 'plane-api.mdx', label, pattern);
}
