import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

const pages = { '/': 'index.html', '/privacy/': 'privacy/index.html', '/terms/': 'terms/index.html' };
const publicFiles = {
  'favicon.svg': 'image/svg+xml',
  'favicon.png': 'image/png',
  'images/aevum-clock-logo.png': 'image/png',
  'images/studio-v1.png': 'image/png',
  'images/signal-social.png': 'image/png',
  'styles/global.css': 'text/css; charset=utf-8',
  'styles/home.css': 'text/css; charset=utf-8',
  'robots.txt': 'text/plain; charset=utf-8',
  'sitemap.xml': 'application/xml; charset=utf-8',
};

function readBuildFile(root: string, relative: string): Buffer {
  let current = root;
  if (!lstatSync(current).isDirectory()) throw new Error('Invalid static build directory');
  const segments = relative.split('/');
  for (const [i, segment] of segments.entries()) {
    current = join(current, segment);
    const stat = lstatSync(current);
    if (i === segments.length - 1 ? !stat.isFile() : !stat.isDirectory()) {
      throw new Error('Invalid file in static build');
    }
  }
  return readFileSync(current);
}

export function registerStaticSite(app: FastifyInstance, root: string): void {
  const headers = readBuildFile(root, '_headers').toString('utf8');
  const csp = headers.match(/^  Content-Security-Policy: (.+)$/m)?.[1];
  if (!csp) throw new Error('The static build is missing its content security policy');

  const manifest = JSON.parse(readBuildFile(root, '.vite/manifest.json').toString('utf8')) as Record<
    string, { file: string; css?: string[]; assets?: string[] }
  >;
  const bundles = new Set(Object.values(manifest)
    .flatMap(({ file, css, assets }) => [file, ...(css ?? []), ...(assets ?? [])])
    .filter((file) => /^assets\/[\w-]+-[\w-]{8}\.(?:js|css)$/.test(file)));
  if (!bundles.size) throw new Error('The static build is missing its bundles');

  function addRoute(url: string, file: string, type: string, cache: string) {
    const content = readBuildFile(root, file);
    app.get(url, async (_request, reply) => {
      reply.header('cache-control', cache);
      if (type.startsWith('text/html')) {
        reply.header('content-security-policy', csp);
        reply.header('referrer-policy', 'strict-origin-when-cross-origin');
        reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
      }
      return reply.type(type).send(content);
    });
  }

  for (const [url, file] of Object.entries(pages)) addRoute(url, file, 'text/html; charset=utf-8', 'no-store');
  for (const [file, type] of Object.entries(publicFiles)) addRoute('/' + file, file, type, 'no-cache');
  for (const file of bundles) {
    const type = file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8';
    addRoute('/' + file, file, type, 'public, max-age=31536000, immutable');
  }
  for (const route of ['/privacy', '/terms']) {
    app.get(route, async (_request, reply) => reply.redirect(route + '/', 308));
  }
}
