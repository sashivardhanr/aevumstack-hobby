import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const pages = ['index.html', 'privacy/index.html', 'terms/index.html'];
let checked = 0;
const canonical = new Set();
for (const page of pages) {
  const html = fs.readFileSync(`dist/${page}`, 'utf8');
  for (const pattern of [/<title>[^<]+<\/title>/, /<meta name="description" content="[^"]+"/, /<meta property="og:image" content="https:\/\//, /http-equiv="Content-Security-Policy"/]) { assert.match(html, pattern); checked++; }
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.doesNotMatch(policy, /(?:^|;)\s*upgrade-insecure-requests\b/i, 'Loopback builds must not upgrade assets to HTTPS');
  checked++;
  assert(!policy.includes("'unsafe-inline'") && !policy.includes("'unsafe-eval'")); checked++;
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\bsrc=/.test(script[1]) && script[2]) {
      const hash=createHash('sha256').update(script[2]).digest('base64');
      assert(policy.includes(`'sha256-${hash}'`), `${page}: inline script CSP hash missing`); checked++;
    }
  }
  const url = html.match(/rel="canonical" href="([^"]+)"/)[1];
  assert(!canonical.has(url), 'Canonical URLs must be distinct'); canonical.add(url); checked++;
  for (const [, value] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|data:)/.test(value)) continue;
    const link = new URL(value.replaceAll('&amp;', '&'), `https://local.test/${page.replace('index.html', '')}`);
    const name = decodeURIComponent(link.pathname).replace(/^\//, '');
    const dest = path.join('dist', name);
    const file = fs.existsSync(dest) && fs.statSync(dest).isFile() ? dest : path.join(dest, 'index.html');
    assert(fs.existsSync(file), `${page}: missing target ${value}`);
    if (link.hash && file.endsWith('.html')) {
      const target = decodeURIComponent(link.hash.slice(1));
      assert(fs.readFileSync(file, 'utf8').includes(`id="${target}"`), `${page}: missing fragment ${value}`);
    }
    checked++;
  }
}
for (const file of ['robots.txt', 'sitemap.xml', '_headers']) { assert(fs.existsSync(`dist/${file}`)); checked++; }
console.log(`Site metadata and internal links: ${checked} checks passed, 0 failed.`);
