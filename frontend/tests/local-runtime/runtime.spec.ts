import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { statSync, unlinkSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { parseLocalDatabaseUrl } from '../../../backend/src/config/env';

const origin = 'http://127.0.0.1:3000';
const mailpitPort = Number(process.env.PHASE5_TEST_MAILPIT_HTTP_PORT ?? '18025');
const smtpPort = Number(process.env.PHASE5_TEST_MAILPIT_SMTP_PORT ?? '11025');
for (const port of [mailpitPort, smtpPort]) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('Invalid Mailpit test port');
}
const databaseUrl = new URL(parseLocalDatabaseUrl(process.env.PHASE5_TEST_DATABASE_URL ?? ''));
if (databaseUrl.pathname !== '/aevumstack_phase5_test') throw new Error('Use the dedicated loopback aevumstack_phase5_test database');
const admin = new Pool({ connectionString: databaseUrl.href, connectionTimeoutMillis: 3_000 });
const suffix = randomUUID().replaceAll('-', '').slice(0, 20);
const sourceName = `aevumstack_phase5_${suffix}`;
const restoreName = `aevumstack_restore_${suffix}`;
const source = new URL(databaseUrl);
source.pathname = '/' + sourceName;
const pool = new Pool({ connectionString: source.href });
let databaseOutage = false;
pool.on('error', (error) => {
  if (!databaseOutage) throw error;
});
const env = {
  PATH: process.env.PATH, DATABASE_URL: source.href, IDEMPOTENCY_HMAC_KEY: randomUUID(),
  LOCAL_MAILPIT_PORT: String(mailpitPort),
};
let smtpUp = true;
let runtime: ChildProcess | undefined;
let done: Promise<number | null> | undefined;
let archive: string | undefined;
let sourceCreated = false;
let restoreCreated = false;

// An isolated TCP forwarder lets the worker lose and regain its real Mailpit SMTP connection.
const smtp = createServer((socket) => {
  if (!smtpUp) { socket.destroy(); return; }
  const upstream = connect({ host: '127.0.0.1', port: smtpPort });
  socket.pipe(upstream).pipe(socket);
  socket.on('error', () => upstream.destroy());
  upstream.on('error', () => socket.destroy());
  socket.once('close', () => upstream.destroy());
  upstream.once('close', () => socket.destroy());
});

function command(file: string, args: string[], overrides = {}) {
  return execFileSync(process.execPath, [file, ...args], {
    env: { ...env, ...overrides }, encoding: 'utf8', timeout: 12_000, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function startRuntime() {
  runtime = spawn(process.execPath, ['scripts/local-runtime.mjs', 'up', '--host'], {
    env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const child = runtime;
  done = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  let output = '';
  const ready = new Promise<void>((resolve, reject) => {
    child.stdout!.on('data', (chunk) => {
      output += chunk;
      if (output.includes('Local application ready')) resolve();
    });
    child.stderr!.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', () => reject(new Error('Runtime exited before readiness\n' + output)));
  });
  await ready;
}

async function stopRuntime() {
  if (!runtime || !done) return;
  if (runtime.exitCode === null && runtime.signalCode === null) runtime.kill('SIGTERM');
  expect(await done).toBe(0);
  runtime = undefined;
}

async function job(id: string) {
  return (await pool.query(`SELECT e.submission_id, o.id, o.status, o.attempt_count
    FROM enquiries e JOIN email_outbox o ON e.submission_id = o.enquiry_id
    WHERE e.submission_id = $1`, [id])).rows;
}

async function captured(jobId: string) {
  const mailpit = `http://127.0.0.1:${mailpitPort}/api/v1`;
  const list = await fetch(mailpit + '/messages', { signal: AbortSignal.timeout(3_000), redirect: 'error' });
  expect(list.ok).toBe(true);
  const { messages } = await list.json() as { messages: { ID: string; MessageID: string }[] };
  return messages.filter((entry) => entry.MessageID?.includes(jobId));
}

test.beforeAll(async () => {
  await admin.query(`CREATE DATABASE "${sourceName}" TEMPLATE template0`);
  sourceCreated = true;
  await new Promise<void>((resolve, reject) => {
    smtp.once('error', reject);
    smtp.listen(0, '127.0.0.1', resolve);
  });
  Object.assign(env, { LOCAL_SMTP_PORT: String((smtp.address() as { port: number }).port) });
  await startRuntime();
});

test.afterAll(async () => {
  try {
    await stopRuntime();
  } finally {
    try {
      await new Promise<void>((resolve) => smtp.close(() => resolve()));
      await pool.end();
      if (archive) unlinkSync('backups/' + archive);
      if (restoreCreated) await admin.query(`DROP DATABASE "${restoreName}"`);
      if (sourceCreated) await admin.query(`DROP DATABASE "${sourceName}"`);
    } finally { await admin.end(); }
  }
});

test('built same-origin website persists an enquiry across restart and verifies a separate restored archive', async ({ page, request }) => {
  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  for (const path of ['/', '/privacy/', '/terms/']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    expect(response?.headers()).toMatchObject({
      'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'content-security-policy': expect.stringContaining("connect-src 'self'"),
    });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://aevumstack.dev' + path);
    expect((await page.reload())?.status()).toBe(200);
  }
  expect((await request.get('/robots.txt')).headers()['content-type']).toContain('text/plain');
  expect((await request.get('/sitemap.xml')).headers()['content-type']).toContain('application/xml');
  expect((await request.get('/styles/home.css')).headers()['cache-control']).toBe('no-cache');
  await page.goto('/?plan=care#contact');
  const script = await page.locator('script[type=module][src]').getAttribute('src');
  const bundle = await request.get(script!);
  expect(bundle.headers()).toMatchObject({ 'cache-control': 'public, max-age=31536000, immutable', 'content-type': 'text/javascript; charset=utf-8' });
  expect(await bundle.text()).not.toMatch(/DATABASE_URL|IDEMPOTENCY_HMAC_KEY|SMTP_HOST|LOCAL_POSTGRES_PASSWORD/);
  expect(await bundle.text()).not.toContain(env.IDEMPOTENCY_HMAC_KEY);
  for (const path of ['/.env', '/.env.local-runtime', '/backups/example.dump', '/backend/src/app.ts', '/docs/phase5-local-operations.md', '/.vite/manifest.json', '/_headers', '/assets/unlisted-12345678.js']) {
    expect((await request.get(path)).status()).toBe(404);
  }
  await expect(page.locator('#selected-package')).toHaveValue('care');
  await page.locator('#full-name').fill('Synthetic Runtime');
  await page.locator('#business-name').fill('Local Fixture');
  await page.locator('#contact-info').fill('runtime@example.invalid');
  await page.locator('#project-description').fill('Synthetic local operations verification');
  const receipt = page.waitForResponse((response) => response.url() === origin + '/api/v1/enquiries');
  await page.locator('#form-submit-btn').click();
  const accepted = await receipt;
  const payload = accepted.request().postDataJSON();
  expect(accepted.status()).toBe(202);
  expect(await accepted.request().headerValue('origin')).toBe(origin);
  expect(await accepted.json()).toEqual({ accepted: true, submissionId: payload.submissionId, status: 'received' });
  await expect(page.locator('#contact-announcement')).toHaveText('Enquiry received.');
  await expect.poll(() => job(payload.submissionId)).toEqual([expect.objectContaining({ status: 'sent', attempt_count: 1 })]);
  const [saved] = await job(payload.submissionId);
  expect(await captured(saved.id)).toHaveLength(1);
  const [mail] = await captured(saved.id);
  const message = await request.get(`http://127.0.0.1:${mailpitPort}/api/v1/message/${mail.ID}`);
  expect((await message.json()).Text).toContain('Support plan: care');

  await stopRuntime();
  await startRuntime();
  const retry = await request.post('/api/v1/enquiries', { headers: { Origin: origin }, data: payload });
  expect(retry.status()).toBe(202);
  expect(await job(payload.submissionId)).toEqual([saved]);
  expect(await captured(saved.id)).toHaveLength(1);

  smtpUp = false;
  try {
    const status = () => command('scripts/local-runtime.mjs', ['status', '--host']);
    expect(() => status()).toThrow();
    const pending = { ...payload, submissionId: randomUUID(), description: 'Synthetic enquiry during SMTP outage' };
    const queued = await request.post('/api/v1/enquiries', { headers: { Origin: origin }, data: pending });
    expect(queued.status()).toBe(202);
    await expect.poll(() => job(pending.submissionId)).toEqual([expect.objectContaining({ status: 'pending', attempt_count: 1 })]);
    expect((await request.get('/api/health/ready')).status()).toBe(200);

    // Stop claims before taking the backup and comparing source and restore.
    await stopRuntime();
    const before = JSON.parse(command('scripts/local-db.mjs', ['verify', '--host']));
    expect(before).toMatchObject({ enquiries: 2, jobs: 2, orphan_jobs: 0, states: { sent: 1, pending: 1 } });
    const path = command('scripts/local-db.mjs', ['backup', '--host']);
    archive = path.split('/').at(-1)!;
    expect(statSync(path).mode & 0o777).toBe(0o600);
    let result: string;
    try {
      result = command('scripts/local-db.mjs', ['restore', '--host', archive, restoreName]);
    } catch (error) {
      restoreCreated = String((error as { stdout?: string }).stdout ?? '').includes(`Created ${restoreName}\n`);
      throw error;
    }
    restoreCreated = true;
    expect(JSON.parse(result.split('\n').at(-1)!)).toEqual(before);
    expect(() => command('scripts/local-db.mjs', ['restore', '--host', archive!, restoreName])).toThrow();
    expect(JSON.parse(command('scripts/local-db.mjs', ['verify', '--host', restoreName]))).toEqual(before);
    expect(() => command('scripts/local-db.mjs', ['backup', '--host'], {
      DATABASE_URL: 'postgres://phase5@127.0.0.1:1/aevumstack_unreachable',
    })).toThrow();
  } finally { smtpUp = true; }
  await startRuntime();
});

test('database outage makes readiness and submissions fail while liveness stays healthy', async ({ request }) => {
  databaseOutage = true;
  await admin.query(`ALTER DATABASE "${sourceName}" ALLOW_CONNECTIONS false`);
  try {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [sourceName]);
    expect((await request.get('/api/health/live')).status()).toBe(200);
    expect((await request.get('/api/health/ready')).status()).toBe(503);
    expect(() => command('scripts/local-runtime.mjs', ['status', '--host'])).toThrow();
    const response = await request.post('/api/v1/enquiries', {
      headers: { Origin: origin },
      data: {
        submissionId: randomUUID(), fullName: 'Synthetic Runtime', businessName: 'Local Fixture',
        contactInfo: 'runtime@example.invalid', offer: { type: 'website', id: 'business' },
        description: 'Synthetic database outage',
      },
    });
    expect(response.status()).toBe(503);
  } finally {
    await admin.query(`ALTER DATABASE "${sourceName}" ALLOW_CONNECTIONS true`);
    databaseOutage = false;
  }
  expect((await request.get('/api/health/ready')).status()).toBe(200);
});
