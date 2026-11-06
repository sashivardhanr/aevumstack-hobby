import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
assert(!tracked.some(name => /(^|\/)\.env($|\.)/.test(name) && !name.endsWith('.example')), 'Private environment file tracked');

const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:ghp|github_pat)_[a-zA-Z0-9_]{20,}\b/,
  /\bre_[a-zA-Z0-9]{24,}\b/,
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = dir + '/' + entry.name;
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const builtFiles = walk('dist');
const activeFiles = ['frontend', 'backend', 'scripts', 'tests', 'docs'].flatMap(walk);
const files = new Set([...tracked, ...activeFiles, ...builtFiles]);
const serverSettings = /RESEND_API_KEY|UPSTASH_REDIS_REST_TOKEN|TURNSTILE_SECRET_KEY|CONTACT_HASH_SECRET|DATABASE_URL|IDEMPOTENCY_HMAC_KEY|LOCAL_POSTGRES_PASSWORD|SMTP_HOST|SMTP_PORT/;
const privateOutputPath = /\/(?:\.env(?:\.|\/|$)|node_modules(?:\/|$)|backups(?:\/|$))|\.dump$/i;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    assert(!pattern.test(content), 'Possible credential in ' + file + '. Inspect locally without logging the value.');
  }
  if (file.startsWith('dist/')) {
    assert(!privateOutputPath.test(file), 'Private deployment content in ' + file);
    assert(!serverSettings.test(content), 'Server-only configuration leaked into ' + file);
  }
}

console.log('Credential-pattern and deployment-content checks passed (' + files.size + ' files). This is not a full secret/history audit.');
