import { PassThrough } from 'node:stream';
import { prerenderToNodeStream } from 'react-dom/static';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderApp } from '../entry-server';
import { matchRoute, navigation, notFoundRoute, routes } from './routes';

async function render(url: string): Promise<string> {
  const { prelude } = await prerenderToNodeStream(renderApp(url), {
    progressiveChunkSize: Number.MAX_SAFE_INTEGER,
    onError(error) {
      throw error;
    },
  });
  const sink = new PassThrough();
  prelude.pipe(sink);
  const chunks: Buffer[] = [];
  for await (const chunk of sink) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

describe('route registry', () => {
  it('has every fixed section and unique canonical paths', () => {
    const paths = routes.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of ['/', '/start', '/api', '/api/map']) {
      expect(paths).toContain(path);
    }
    for (const path of paths) {
      expect(path === '/' || !path.endsWith('/')).toBe(true);
    }
  });

  it('discovers MDX content from frontmatter', () => {
    const concepts = routes.filter((route) => route.kind === 'concept');
    const guides = routes.filter((route) => route.kind === 'guide');
    expect(concepts.length).toBeGreaterThan(0);
    expect(guides.length).toBeGreaterThan(0);
    for (const route of [...concepts, ...guides]) {
      expect(route.title).not.toBe('');
      expect(route.description).not.toBe('');
    }
  });

  it('lists API entry points in package order', () => {
    const entries = routes
      .filter((route) => route.kind === 'api-entry')
      .map((route) => route.entry);
    expect(entries.slice(0, 7)).toEqual([
      'core',
      'plane',
      'interop',
      'compute',
      'hct',
      'driver',
      'react',
    ]);
  });

  it('orders the sidebar Start, Concepts, Guides, API, Map', () => {
    expect(navigation.map((group) => group.id)).toEqual([
      'start',
      'concepts',
      'guides',
      'api',
      'map',
    ]);
  });

  it('matches trailing slashes and unknown paths', () => {
    expect(matchRoute('/start/').path).toBe('/start');
    expect(matchRoute('/start/index.html').path).toBe('/start');
    expect(matchRoute('/nope')).toBe(notFoundRoute);
  });
});

/**
 * The first render of a route kind pulls in its module graph (MDX compile,
 * content frame, API data) through Vite's transform pipeline. That cold
 * start takes seconds locally and more on CI runners, so warm every route
 * module once up front and give the suite a budget sized for a cold runner.
 */
const COLD_START_TIMEOUT_MS = 30_000;

describe('prerender smoke', { timeout: COLD_START_TIMEOUT_MS }, () => {
  beforeAll(async () => {
    await Promise.all([...routes, notFoundRoute].map((route) => route.load()));
  }, COLD_START_TIMEOUT_MS);

  it.each([...routes, notFoundRoute].map((route) => [route.path, route]))(
    '%s renders one <h1> with its landmarks',
    async (path) => {
      const html = await render(path);
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
      // Content is inline, never an outlined Suspense segment.
      expect(html).not.toContain('<template id="B:');
      expect(html).toContain('<main id="main"');
      expect(html).toContain('class="skip-link"');
      expect(html).toContain('<header class="site-header"');
      expect(html).toContain('<footer class="site-footer"');
    },
  );
});
