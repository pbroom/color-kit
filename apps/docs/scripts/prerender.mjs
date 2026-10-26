// Prerenders every route in the registry to static HTML.
//
// Inputs: the client build in `dist/` (its `index.html` is the template and
// `.vite/manifest.json` maps route modules to chunks) and the SSR bundle in
// `.ssr/entry-server.js` (`vite build --ssr`). Output: `dist/<route>/index.html`
// per route, `dist/index.html` for home and `dist/404.html` for unknown paths,
// each with its own <title>, description, canonical link and modulepreload
// for the route chunk. The theme pre-paint script is part of the template and
// is preserved as-is.
//
// Category pages (`/api/<entry>/<domain>`) also modulepreload their symbol
// data parts and MDX notes, so hydration does not wait on a request chain.
//
// Retired symbol pages (`/api/<entry>/<Symbol>`, before symbols became rows
// on their category page) get a tiny redirect stub each: a script that
// keeps any old member anchor (`#prop-hex` → `#Color-prop-hex`), a meta
// refresh for no-JS readers, a canonical link to the row, and `noindex`.
// Static files work on any host (and `vite preview`) with no redirect table
// to keep in sync with the generated API; the stubs carry no
// `data-pagefind-body`, so search never indexes them.

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

function closure(manifest, keys, field = 'file') {
  const seen = new Set();
  const files = [];
  const visit = (key) => {
    const chunk = manifest[key];
    if (!chunk || seen.has(key)) return;
    seen.add(key);
    files.push(...[chunk[field] ?? []].flat());
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

/**
 * Stylesheets imported by the route's chunks (Vite splits CSS per chunk).
 * Linked up front so prerendered markup paints styled before hydration.
 */
function stylesheetsFor(manifest, sources) {
  const entry = new Set(closure(manifest, ['index.html'], 'css'));
  return [...new Set(closure(manifest, sources, 'css'))].filter(
    (file) => !entry.has(file),
  );
}

/** Modules a category page renders from: its data parts and symbol notes. */
function domainSources(manifest, route, apiSymbols) {
  const prefix = `src/generated/api/domains/${route.entry}/${route.domain}/`;
  const notes = new Set(
    apiSymbols
      .filter(
        (symbol) =>
          symbol.entry === route.entry && symbol.domain === route.domain,
      )
      .map((symbol) => `src/content/api/${route.entry}/${symbol.name}.mdx`),
  );
  return Object.keys(manifest).filter(
    (key) => key.startsWith(prefix) || notes.has(key),
  );
}

/** The redirect stub for a retired symbol page. */
function legacyStub(symbol) {
  const target = symbol.href;
  const page = target.split('#')[0];
  const title = `${symbol.name} · color-kit`;
  // Old member and parameter anchors map into the row's panel.
  const script = `(function(){var h=location.hash.slice(1),n=${JSON.stringify(
    symbol.name,
  )},t=${JSON.stringify(target)};if(/^(prop|param)-/.test(h)){try{h=decodeURIComponent(h)}catch(e){}t=${JSON.stringify(
    `${page}#`,
  )}+encodeURIComponent(n+'-'+h)}location.replace(t)})();`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${escapeHtml(`${siteOrigin}${target}`)}" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(target)}" />
    <script>${script}</script>
  </head>
  <body>
    <p><a href="${escapeHtml(target)}">${escapeHtml(symbol.name)}</a> moved to its category page.</p>
  </body>
</html>
`;
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
  const { apiSymbols, documentTitle, routes, notFoundRoute, renderApp } =
    await import(pathToFileURL(ssrEntry).href);
  const all = [...routes, notFoundRoute];

  for (const route of all) {
    const html = await renderToString(renderApp(route.path));
    const canonical =
      route.kind === 'not-found'
        ? '<meta name="robots" content="noindex" />'
        : `<link rel="canonical" href="${escapeHtml(`${siteOrigin}${route.path}`)}" />`;
    const sources = [
      route.source,
      ...(route.alsoLoads ?? []),
      ...(route.kind === 'api-domain'
        ? domainSources(manifest, route, apiSymbols)
        : []),
    ];
    const head = [
      canonical,
      `<meta property="og:title" content="${escapeHtml(documentTitle(route))}" />`,
      `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
      ...stylesheetsFor(manifest, sources).map(
        (file) => `<link rel="stylesheet" crossorigin href="/${file}" />`,
      ),
      ...preloadsFor(manifest, sources).map(
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

  const pages = new Set(all.map((route) => outputFile(route).toLowerCase()));
  for (const symbol of apiSymbols) {
    const file = path.join(
      distDir,
      ...decodeURIComponent(symbol.legacyPath).split('/').filter(Boolean),
      'index.html',
    );
    // Never let a stub replace a page (case-insensitive file systems).
    if (pages.has(file.toLowerCase())) {
      throw new Error(`${symbol.legacyPath} would overwrite a page`);
    }
    pages.add(file.toLowerCase());
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, legacyStub(symbol));
  }

  await rm(path.join(docsRoot, '.ssr'), { recursive: true, force: true });
  const seconds = ((performance.now() - started) / 1000).toFixed(2);
  console.log(
    `prerendered ${all.length} routes and ${apiSymbols.length} symbol redirects in ${seconds}s`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
