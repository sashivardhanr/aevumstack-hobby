import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { runner } from 'node-pg-migrate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig, parseLocalDatabaseUrl } from '../src/config/env.js';
import { createMailpitSender, MAILPIT_RECIPIENT } from '../src/modules/notifications/mailpit.js';
import { claimNotification, finalizeNotification } from '../src/modules/notifications/outbox.js';
import { processNotification } from '../src/modules/notifications/worker.js';

const url = process.env.PHASE3_TEST_DATABASE_URL;
const smtpPort = process.env.PHASE3_TEST_MAILPIT_SMTP_PORT;
const httpPort = process.env.PHASE3_TEST_MAILPIT_HTTP_PORT;
const hmacKey = 'synthetic-key-for-isolated-phase3-tests';
if (process.env.PHASE3_REQUIRE_NATIVE === '1' && (!url || !smtpPort || !httpPort)) {
  throw new Error('Set all three PHASE3_TEST_* settings for the native verification suite');
}
const mailpitPort = (port: string | undefined) => {
  const number = Number(port);
  if (!Number.isInteger(number) || number < 1 || number > 65_535) throw new Error('Invalid Mailpit test port');
  return number;
};

describe.skipIf(!url)('native PostgreSQL verification', () => {
  const schema = `phase3_${randomUUID().replaceAll('-', '')}`;
  const historicalId = randomUUID();
  let admin: Pool;
  let pool: Pool;
  let otherPool: Pool;
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    const databaseUrl = parseLocalDatabaseUrl(url ?? '');
    if (new URL(databaseUrl).pathname !== '/aevumstack_phase3_test') {
      throw new Error('Use a dedicated local aevumstack_phase3_test database');
    }
    admin = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pgConfig = { connectionString: databaseUrl, options: `-c search_path=${schema}`, statement_timeout: 4000 };
    pool = new Pool(pgConfig);
    otherPool = new Pool(pgConfig);
    const migrationOptions = {
      databaseUrl, schema, migrationsSchema: schema, migrationsTable: 'pgmigrations',
      dir: resolve('backend/migrations'), direction: 'up' as const, log: () => undefined,
    };
    await runner({ ...migrationOptions, count: 1 });
    const historicalHmac = createHmac('sha256', hmacKey).update(JSON.stringify({
      fullName: 'Historical test', businessName: null, contactInfo: 'old@example.invalid',
      offerType: 'website_package', offerId: 'business', description: 'Synthetic',
    })).digest('hex');
    await pool.query(`INSERT INTO enquiries
      (submission_id, full_name, contact_info, offer_type, offer_id, description, payload_hmac)
      VALUES ($1, 'Historical test', 'old@example.invalid', 'website_package', 'business', 'Synthetic', $2)`, [historicalId, historicalHmac]);
    await runner(migrationOptions);
    app = buildApp({
      config: loadConfig({
        DATABASE_URL: databaseUrl, API_ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
        IDEMPOTENCY_HMAC_KEY: hmacKey, API_RATE_LIMIT_MAX: '100',
      }),
      pool,
      onClose: async () => {},
    });
  });

  afterAll(async () => {
    try {
      await app?.close();
      await Promise.all([pool?.end(), otherPool?.end()]);
      await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin?.end();
    }
  });

  function request() {
    return {
      submissionId: randomUUID(), fullName: 'Synthetic & Example', businessName: 'Local Fixture',
      contactInfo: 'visitor@example.invalid', offer: { type: 'support', id: 'care' }, description: 'Sample <img src=x> enquiry',
    };
  }

  const submit = (payload: ReturnType<typeof request>) => app.inject({
    method: 'POST', url: '/api/v1/enquiries', headers: { origin: 'http://127.0.0.1:5173' }, payload,
  });

  it('migrates existing enquiries without backfill and commits simultaneous API submissions once', async () => {
    expect((await submit({
      submissionId: historicalId, fullName: 'Historical test', businessName: '',
      contactInfo: 'old@example.invalid', offer: { type: 'website', id: 'business' }, description: 'Synthetic',
    })).statusCode).toBe(202);
    expect((await pool.query('SELECT 1 FROM enquiries WHERE submission_id = $1', [historicalId])).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM email_outbox WHERE enquiry_id = $1', [historicalId])).rowCount).toBe(0);
    const input = request();
    const results = await Promise.all([submit(input), submit(input)]);
    expect(results.map((result) => result.statusCode)).toEqual([202, 202]);
    expect(results[0].json()).toEqual({ accepted: true, submissionId: input.submissionId, status: 'received' });
    expect((await otherPool.query('SELECT 1 FROM enquiries JOIN email_outbox ON submission_id = enquiry_id WHERE submission_id = $1',
      [input.submissionId])).rowCount).toBe(1);
    expect((await submit({ ...input, description: 'Changed' })).statusCode).toBe(409);
    await pool.query("UPDATE email_outbox SET available_at = now() + interval '1 day' WHERE enquiry_id = $1", [input.submissionId]);
  });

  it('returns 503 and rolls back the enquiry if outbox insertion fails', async () => {
    const input = request();
    await pool.query('ALTER TABLE email_outbox ADD CONSTRAINT reject_new_jobs CHECK (false) NOT VALID');
    try {
      expect((await submit(input)).statusCode).toBe(503);
      expect((await otherPool.query('SELECT 1 FROM enquiries WHERE submission_id = $1', [input.submissionId])).rowCount).toBe(0);
      expect((await otherPool.query('SELECT 1 FROM email_outbox WHERE enquiry_id = $1', [input.submissionId])).rowCount).toBe(0);
    } finally {
      await pool.query('ALTER TABLE email_outbox DROP CONSTRAINT reject_new_jobs');
    }
  });

  it('skips a locked row, claims once across independent sessions and fences stale workers', async () => {
    const input = request();
    expect((await submit(input)).statusCode).toBe(202);
    const lock = await pool.connect();
    try {
      await lock.query('BEGIN');
      await lock.query('SELECT 1 FROM email_outbox WHERE enquiry_id = $1 FOR UPDATE', [input.submissionId]);
      expect(await claimNotification(otherPool, 5)).toBeUndefined();
    } finally {
      try { await lock.query('ROLLBACK'); } finally { lock.release(); }
    }
    const claims = (await Promise.all([claimNotification(pool, 5), claimNotification(otherPool, 5)])).filter((item) => item !== undefined);
    expect(claims).toHaveLength(1);
    const original = claims[0];
    expect(original.submission_id).toBe(input.submissionId);
    await pool.query(`UPDATE email_outbox SET locked_at = now() - interval '2 minutes',
      lease_expires_at = now() - interval '1 minute' WHERE enquiry_id = $1`, [input.submissionId]);
    expect(await finalizeNotification(pool, original, 5)).toBe(false);
    const replacement = await claimNotification(otherPool, 5);
    expect(replacement).toMatchObject({ job_id: original.job_id, attempt_count: 2 });
    expect(replacement!.claim_token).not.toBe(original.claim_token);
    expect(await finalizeNotification(pool, original, 5, 'smtp_temporary')).toBe(false);
    expect(await finalizeNotification(otherPool, replacement!, 5)).toBe(true);
  });

  it.skipIf(!smtpPort || !httpPort)('retains an enquiry through a real SMTP connection failure and captures the retry in Mailpit', async () => {
    const input = request();
    expect((await submit(input)).statusCode).toBe(202);

    // Acquire a free loopback port, then close it to simulate an unavailable listener.
    const probe = createServer();
    await new Promise<void>((done, fail) => {
      probe.once('error', fail);
      probe.listen(0, '127.0.0.1', done);
    });
    const closedPort = (probe.address() as { port: number }).port;
    await new Promise<void>((done, fail) => probe.close((error) => error ? fail(error) : done()));

    await processNotification(pool, createMailpitSender({ host: '127.0.0.1', port: closedPort }), 5);
    const pending = await otherPool.query('SELECT * FROM email_outbox WHERE enquiry_id = $1', [input.submissionId]);
    expect(pending.rows[0]).toMatchObject({ status: 'pending', attempt_count: 1, last_error_code: 'smtp_temporary' });
    expect((await otherPool.query('SELECT 1 FROM enquiries WHERE submission_id = $1', [input.submissionId])).rowCount).toBe(1);
    expect((await app.inject({ method: 'GET', url: '/api/health/ready' })).statusCode).toBe(200);

    await pool.query('UPDATE email_outbox SET available_at = now() WHERE enquiry_id = $1', [input.submissionId]);
    await processNotification(pool, createMailpitSender({ host: '127.0.0.1', port: mailpitPort(smtpPort) }), 5);
    const sent = await otherPool.query('SELECT status, attempt_count FROM email_outbox WHERE enquiry_id = $1', [input.submissionId]);
    expect(sent.rows).toEqual([{ status: 'sent', attempt_count: 2 }]);

    const base = `http://127.0.0.1:${mailpitPort(httpPort)}/api/v1`;
    const list = await fetch(`${base}/messages`, { redirect: 'error', signal: AbortSignal.timeout(3000) });
    expect(list.ok).toBe(true);
    const entries = (await list.json()).messages as { ID: string; MessageID: string }[];
    const matches = entries.filter((entry) => entry.MessageID?.includes(pending.rows[0].id));
    expect(matches).toHaveLength(1);
    const response = await fetch(`${base}/message/${encodeURIComponent(matches[0].ID)}`,
      { redirect: 'error', signal: AbortSignal.timeout(3000) });
    expect(response.ok).toBe(true);
    const message = await response.json();
    expect(message.To.map((recipient: { Address: string }) => recipient.Address)).toEqual([MAILPIT_RECIPIENT]);
    expect(message.Text).toContain(input.submissionId);
    expect(message.Text).toContain('Support plan: care');
    expect(message.HTML).toContain('&lt;img src=x&gt;');
    expect(message.HTML).not.toContain('<img');
  });
});
