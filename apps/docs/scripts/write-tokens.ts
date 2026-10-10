// Writes src/styles/tokens.css from src/styles/tokens.ts. Runs through
// vite-node so the `color-kit` alias resolves to workspace source.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderTokensCss } from '../src/styles/tokens';

const target = fileURLToPath(
  new URL('../src/styles/tokens.css', import.meta.url),
);
writeFileSync(target, renderTokensCss());
console.log(`wrote ${target}`);
