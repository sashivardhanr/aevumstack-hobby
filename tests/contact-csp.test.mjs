import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
function finalizedWithKey(siteKey) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aevum-csp-'));
  try {
    fs.cpSync('dist',path.join(root,'dist'),{recursive:true});
    for (const route of ['index.html','privacy/index.html','terms/index.html']) {
      const file=path.join(root,'dist',route);
      fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/g,''));
    }
    execFileSync(process.execPath,[path.resolve('scripts/finalize-build.mjs')],{cwd:root,env:{...process.env,PUBLIC_SITE_URL:'https://aevumstack.dev',PUBLIC_FORM_ENDPOINT:'http://unapproved.example',PUBLIC_TURNSTILE_SITE_KEY:siteKey,RESEND_API_KEY:'local-private-canary-never-public'},stdio:'pipe'});
    return fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
test('Vite CSP ignores legacy contact and bot settings',()=>{
 const html=finalizedWithKey('invalid site key');const csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
 assert.match(csp,/frame-src 'none'/);
 assert.match(csp,/connect-src 'self';/);
 assert(!csp.includes('challenges.cloudflare.com'));
 assert(!csp.includes("'unsafe-inline'"));assert(!csp.includes("'unsafe-eval'"));assert(!html.includes('local-private-canary-never-public'));
});
test('unconfigured bot protection adds no Cloudflare permission; same-origin API remains permitted',()=>{
 const html=finalizedWithKey('');const csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
 assert(!csp.includes('challenges.cloudflare.com'));assert.match(csp,/connect-src 'self'/);assert.match(csp,/frame-src 'none'/);
});
