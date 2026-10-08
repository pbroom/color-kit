import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { expect, it, vi } from 'vitest';
import { highlightPlugin } from '../../plugins/highlight';

it('refreshes evaluated output when an aliased transitive input changes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'color-kit-eval-'));
  const dependency = path.join(root, 'value.ts');
  await writeFile(dependency, 'export const value = 1;');
  await writeFile(
    path.join(root, 'bridge.ts'),
    "export { value } from '@value';",
  );
  await writeFile(
    path.join(root, 'data.ts'),
    "export { value as default } from './bridge';",
  );
  await writeFile(
    path.join(root, 'snippet.ts'),
    "import { value } from './bridge';\nvalue; // →",
  );
  const server = await createServer({
    configFile: false,
    root,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@value': dependency } },
    plugins: [highlightPlugin()],
    server: { middlewareMode: true, ws: false },
  });
  try {
    const build = () => server.transformRequest('/data.ts?build');
    const highlighted = () =>
      server.transformRequest('/snippet.ts?highlighted');
    expect((await build())?.code).toContain('export default 1');
    expect((await highlighted())?.code).toContain('value; // → 1');
    // Both outer modules must observe the dependency reached via the bridge.
    await writeFile(dependency, 'export const value = 2;');
    await vi.waitFor(
      async () => {
        expect((await build())?.code).toContain('export default 2');
        expect((await highlighted())?.code).toContain('value; // → 2');
      },
      { timeout: 5000 },
    );
    await writeFile(
      dependency,
      "throw new Error('broken dependency'); export const value = 0;",
    );
    await vi.waitFor(
      async () => {
        await expect(build()).rejects.toThrow('broken dependency');
        await expect(highlighted()).rejects.toThrow('broken dependency');
      },
      { timeout: 5000 },
    );
    await writeFile(dependency, 'export const value = 3;');
    await vi.waitFor(
      async () => {
        expect((await build())?.code).toContain('export default 3');
        expect((await highlighted())?.code).toContain('value; // → 3');
      },
      { timeout: 5000 },
    );
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
}, 20000);
