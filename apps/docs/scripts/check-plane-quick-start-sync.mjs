import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptPath = fileURLToPath(import.meta.url);
const docsRoot = path.resolve(path.dirname(scriptPath), '..');

const demoPath = path.join(docsRoot, 'src/components/plane-api-demos.tsx');
const pagePath = path.join(docsRoot, 'src/content/api/plane-api.mdx');

const [demoSource, pageSource] = await Promise.all([
  readFile(demoPath, 'utf8'),
  readFile(pagePath, 'utf8'),
]);

const checks = [
  {
    label: 'quick-start fixed channels',
    pattern:
      /definePlane\(\{\s*fixed:\s*\{\s*h:\s*250,\s*alpha:\s*1\s*\}\s*\}\)/,
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

for (const { label, pattern } of checks) {
  assertPatternInSource(demoSource, 'plane-api-demos.tsx', label, pattern);
  assertPatternInSource(pageSource, 'plane-api.mdx', label, pattern);
}
