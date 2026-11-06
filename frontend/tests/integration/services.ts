import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runner } from 'node-pg-migrate';
import { Pool } from 'pg';
import { parseLocalDatabaseUrl } from '../../../backend/src/config/env';

export const origin = 'http://127.0.0.1:5173';
export const endpoint = '/api/v1/enquiries';

export async function closedLoopbackPort() {
  const socket = createServer();
  await new Promise<void>((done, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', done);
  });
  const { port } = socket.address() as { port: number };
  await new Promise<void>((done, reject) => socket.close((error) => error ? reject(error) : done()));
  return port;
}

function testPort(value: string | undefined) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Set both Phase 4 Mailpit test ports');
  return port;
}

async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((done) => child.once('exit', () => done()));
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 8_000);
  try { await exited; } finally { clearTimeout(timer); }
}

export function createServices() {
  const databaseUrl = parseLocalDatabaseUrl(process.env.PHASE4_TEST_DATABASE_URL ?? '');
  if (new URL(databaseUrl).pathname !== '/aevumstack_phase4_test') {
    throw new Error('Use a dedicated loopback aevumstack_phase4_test database');
  }
  const smtpPort = testPort(process.env.PHASE4_TEST_MAILPIT_SMTP_PORT);
  const mailpit = `http://127.0.0.1:${testPort(process.env.PHASE4_TEST_MAILPIT_HTTP_PORT)}/api/v1`;
  const schema = `phase4_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
  const options = `-c search_path=${schema}`;
  const pool = new Pool({ connectionString: databaseUrl, options, connectionTimeoutMillis: 3000 });
  const key = randomUUID();
  let api: ChildProcess | undefined;
  let worker: ChildProcess | undefined;

  function start(entry: string, overrides: NodeJS.ProcessEnv = {}, signalReady = false) {
    return spawn(process.execPath, ['--import', 'tsx', entry], {
      env: {
        PATH: process.env.PATH, DATABASE_URL: databaseUrl, PGOPTIONS: options,
        API_HOST: '127.0.0.1', API_PORT: '3001', API_ALLOWED_ORIGINS: origin,
        API_RATE_LIMIT_MAX: '100', IDEMPOTENCY_HMAC_KEY: key,
        SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtpPort), ...overrides,
      },
      stdio: signalReady ? ['ignore', 'ignore', 'ignore', 'ipc'] : 'ignore',
    });
  }

  return {
    pool,
    databaseUrl,
    async migrate() {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await runner({
        databaseUrl, schema, migrationsSchema: schema, migrationsTable: 'pgmigrations',
        dir: resolve('backend/migrations'), direction: 'up', log: () => undefined,
      });
    },
    async startApi(overrides: NodeJS.ProcessEnv = {}) {
      await stop(api);
      const live = 'http://127.0.0.1:3001/api/health/live';
      if (await fetch(live, { signal: AbortSignal.timeout(300) }).then(() => true, () => false)) {
        throw new Error('Port 3001 is already serving HTTP');
      }
      api = start('backend/src/server.ts', overrides);
      for (let i = 0; i < 60; i++) {
        if (api.exitCode !== null) break;
        if (await fetch(live, { signal: AbortSignal.timeout(300) }).then((res) => res.ok, () => false)) return;
        await delay(100);
      }
      throw new Error('The isolated API did not start on port 3001');
    },
    async startWorker(port = smtpPort) {
      await stop(worker);
      const child = start('backend/src/worker.ts', { SMTP_PORT: String(port) }, true);
      worker = child;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error('The isolated outbox worker did not become ready')), 10_000);
        const exited = () => finish(new Error('The isolated outbox worker exited before readiness'));
        const ready = (message: unknown) => {
          if (message === 'ready') finish();
        };
        function finish(error?: Error) {
          clearTimeout(timer);
          child.off('message', ready);
          child.off('exit', exited);
          child.off('error', finish);
          if (error) reject(error);
          else resolve();
        }
        child.on('message', ready);
        child.once('exit', exited);
        child.once('error', finish);
      });
    },
    async stopWorker() { await stop(worker); },
    async job(id: string) {
      const result = await pool.query(`
        SELECT e.offer_type, e.offer_id, o.id, o.status, o.attempt_count, o.last_error_code
        FROM enquiries e LEFT JOIN email_outbox o ON e.submission_id = o.enquiry_id
        WHERE e.submission_id = $1
      `, [id]);
      return result.rows;
    },
    async messages(jobId: string) {
      const response = await fetch(`${mailpit}/messages`, { signal: AbortSignal.timeout(3000), redirect: 'error' });
      if (!response.ok) throw new Error('Local Mailpit is unavailable');
      const { messages } = await response.json() as { messages: { ID: string; MessageID: string }[] };
      return Promise.all(messages.filter((entry) => entry.MessageID?.includes(jobId)).map(async ({ ID }) => {
        const res = await fetch(`${mailpit}/message/${encodeURIComponent(ID)}`, {
          signal: AbortSignal.timeout(3000), redirect: 'error',
        });
        if (!res.ok) throw new Error('Mailpit message was unavailable');
        return res.json();
      }));
    },
    async close() {
      try {
        await Promise.all([stop(worker), stop(api)]);
        await pool.end();
        await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await admin.end();
      }
    },
  };
}
