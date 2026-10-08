// Prerenders every route in the registry to static HTML.
//
// Inputs: the client build in `dist/` (its `index.html` is the template and
// `.vite/manifest.json` maps route modules to chunks) and the SSR bundle in
// `.ssr/entry-server.js` (`vite build --ssr`). Output: `dist/<route>/index.html`
// per route, `dist/index.html` for home and `dist/404.html` for unknown paths,
// each with its own <title>, description, canonical link and modulepreload
// for the route chunk. The theme pre-paint script is part of the template and
// is preserved as-is.

import { Buffer } from 'node:buffer';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { PassThrough } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import console from 'node:console';
import process from 'node:process';
import { prerenderToNodeStream } from 'react-dom/static';

const docsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const distDir = path.join(docsRoot, 'dist');
const ssrEntry = path.join(docsRoot, '.ssr', 'entry-server.js');

// Absolute canonical URLs when the deploy URL is known (Vercel sets this).
const siteOrigin = process.env.DOCS_SITE_URL
  ? process.env.DOCS_SITE_URL.replace(/\/$/, '')
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '';

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

async function renderToString(element) {
  const { prelude } = await prerenderToNodeStream(element, {
    // Never outline large Suspense boundaries into hidden segments plus a
    // reveal script: static pages must ship their content inline.
    progressiveChunkSize: Number.MAX_SAFE_INTEGER,
    onError(error) {
      throw error;
    },
  });
  const chunks = [];
  const sink = new PassThrough();
  prelude.pipe(sink);
  for await (const chunk of sink) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function closure(manifest, keys) {
  const seen = new Set();
  const files = [];
  const visit = (key) => {
    const chunk = manifest[key];
    if (!chunk || seen.has(key)) return;
    seen.add(key);
    files.push(chunk.file);
    for (const child of chunk.imports ?? []) visit(child);
  };
  keys.forEach(visit);
  return files;
}

/** Chunks a route needs beyond what the entry script already preloads. */
function preloadsFor(manifest, sources) {
  const entry = new Set(closure(manifest, ['index.html']));
  return closure(manifest, sources).filter((file) => !entry.has(file));
}

function outputFile(route) {
  if (route.kind === 'not-found') return path.join(distDir, '404.html');
  if (route.path === '/') return path.join(distDir, 'index.html');
  return path.join(
    distDir,
    ...route.path.split('/').filter(Boolean),
    'index.html',
  );
}

async function main() {
  const started = performance.now();
  const template = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const manifest = JSON.parse(
    await readFile(path.join(distDir, '.vite', 'manifest.json'), 'utf8'),
  );
  const { documentTitle, routes, notFoundRoute, renderApp } = await import(
    pathToFileURL(ssrEntry).href
  );
  const all = [...routes, notFoundRoute];

  for (const route of all) {
    const html = await renderToString(renderApp(route.path));
    const canonical =
      route.kind === 'not-found'
        ? '<meta name="robots" content="noindex" />'
        : `<link rel="canonical" href="${escapeHtml(`${siteOrigin}${route.path}`)}" />`;
    const head = [
      canonical,
      `<meta property="og:title" content="${escapeHtml(documentTitle(route))}" />`,
      `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
      ...preloadsFor(manifest, [route.source, ...(route.alsoLoads ?? [])]).map(
        (file) => `<link rel="modulepreload" crossorigin href="/${file}" />`,
      ),
    ].join('\n    ');
    // Function replacers: page text may contain `$` patterns.
    const page = template
      .replace(
        /<title>[^<]*<\/title>/,
        () => `<title>${escapeHtml(documentTitle(route))}</title>`,
      )
      .replace(
        /(<meta\s+name="description"\s+content=")[^"]*(")/,
        (_, open, close) => `${open}${escapeHtml(route.description)}${close}`,
      )
      .replace('<!--head-meta-->', () => head)
      .replace('<!--app-html-->', () => html);
    if (!page.includes(html) || page.includes('<!--app-html-->')) {
      throw new Error(`Template injection failed for ${route.path}`);
    }
    const file = outputFile(route);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, page);
  }

  await rm(path.join(docsRoot, '.ssr'), { recursive: true, force: true });
  const seconds = ((performance.now() - started) / 1000).toFixed(2);
  console.log(`prerendered ${all.length} routes in ${seconds}s`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
