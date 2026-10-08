import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Makes `vite preview` serve the prerendered site the way Vercel does with
 * `cleanUrls` + `trailingSlash: false`: `/concepts/x` → `concepts/x/index.html`,
 * and unknown paths → `404.html` with a 404 status, instead of Vite's SPA
 * fallback to the home page (which would hydrate the wrong markup).
 */
export function previewStaticPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'color-kit:preview-static',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const [pathname = '/', query = ''] = (req.url ?? '/').split('?');
        if (path.extname(pathname) || pathname.startsWith('/@')) {
          return next();
        }
        const trimmed = pathname.replace(/\/+$/, '');
        const candidate = path.join(outDir, trimmed, 'index.html');
        if (existsSync(candidate)) {
          req.url = `${trimmed}/index.html${query ? `?${query}` : ''}`;
        } else {
          res.statusCode = 404;
          req.url = '/404.html';
        }
        next();
      });
    },
  };
}
