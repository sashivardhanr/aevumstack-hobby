import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { siteURL } from './site-config.mjs';
const pages = ['index.html', 'privacy/index.html', 'terms/index.html'];
const hashes = new Set();
for (const page of pages) {
  const html = fs.readFileSync(`dist/${page}`, 'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\bsrc=/.test(match[1]) && match[2]) hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  }
}
// The built app is served on HTTP loopback. WebKit upgrades even its same-origin assets if this policy asks it to.
const csp = `default-src 'self'; script-src 'self' ${[...hashes].join(' ')}; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`.replace(/ +/g, ' ');
// Meta enforces the portable subset even on static hosts that ignore _headers.
for (const page of pages) {
  const file = `dist/${page}`;
  const html = fs.readFileSync(file, 'utf8').replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/g, '');
  fs.writeFileSync(file, html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`));
}
fs.writeFileSync('dist/_headers', `/*\n  Content-Security-Policy: ${csp}; frame-ancestors 'none'\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`);
fs.writeFileSync('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteURL}/sitemap.xml\n`);
fs.writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/privacy/', '/terms/'].map(route => `<url><loc>${siteURL}${route}</loc></url>`).join('')}</urlset>\n`);
console.log('Generated sitemap, robots.txt, CSP and static host headers.');
