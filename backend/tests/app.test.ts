import { request as httpRequest } from 'node:http';
import { gzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, REQUEST_BODY_LIMIT } from '../src/app.js';
import type { AppConfig } from '../src/config/env.js';
import { createTestDatabase, type TestDatabase } from './helpers/database.js';

const config: AppConfig = {
  databaseUrl: 'postgres://test:test@127.0.0.1:5432/unused',
  host: '127.0.0.1',
  port: 3001,
  allowedOrigins: new Set(['http://localhost:5173', 'http://127.0.0.1:5173']),
  idempotencyHmacKey: 'integration-test-key-material-is-not-a-real-secret',
  rateLimitMax: 100,
  rateLimitWindowMs: 60_000,
};
const allowedHeaders = { origin: 'http://localhost:5173', 'content-type': 'application/json' };

function payload(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Ada Example',
    businessName: 'Example Studio',
    contactInfo: 'ada@example.test',
    offer: { type: 'website', id: 'business' },
    description: 'A small booking-enabled website.',
    website: '',
    submissionId: randomUUID(),
    ...overrides,
  };
}

describe('Fastify enquiry API against isolated PostgreSQL', () => {
  let database: TestDatabase;
  let app: FastifyInstance;

  beforeAll(async () => {
    database = await createTestDatabase();
    app = buildApp({ config, pool: database.pool });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await database.database.close();
  });

  it('applies the migration and persists an enquiry before returning the accepted receipt', async () => {
    const request = payload();
    const response = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders, payload: request });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: true, submissionId: request.submissionId, status: 'received' });

    const saved = await database.pool.query('SELECT * FROM enquiries WHERE submission_id = $1', [request.submissionId]);
    expect(saved.rowCount).toBe(1);
    expect(saved.rows[0]).toMatchObject({
      submission_id: request.submissionId,
      full_name: 'Ada Example',
      business_name: 'Example Studio',
      contact_info: 'ada@example.test',
      offer_type: 'website_package',
      offer_id: 'business',
      status: 'received',
    });
    expect(saved.rows[0].payload_hmac).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.rows[0].payload_hmac).not.toContain('Ada Example');
  });

  it('rejects invalid payloads, unknown offers, malformed UUIDs and filled honeypots', async () => {
    for (const bad of [
      payload({ fullName: '' }),
      payload({ offer: { type: 'website', id: 'unknown' } }),
      payload({ submissionId: 'not-a-uuid' }),
      payload({ website: 'automated submission' }),
    ]) {
      const response = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders, payload: bad });
      expect(response.statusCode).toBe(400);
      expect(response.json()).not.toHaveProperty('accepted', true);
    }
  });

  it('enforces the 32 KiB request body limit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/enquiries',
      headers: allowedHeaders,
      payload: `{"padding":"${'x'.repeat(REQUEST_BODY_LIMIT)}"}`,
    });
    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({ error: 'request_too_large' });
  });

  it('requires an exact allowed Origin and JSON content type', async () => {
    const disallowed = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { ...allowedHeaders, origin: 'http://localhost.evil.test:5173' }, payload: payload() });
    expect(disallowed.statusCode).toBe(403);
    const missingOrigin = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { 'content-type': 'application/json' }, payload: payload() });
    expect(missingOrigin.statusCode).toBe(403);
    const wrongType = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { origin: allowedHeaders.origin, 'content-type': 'text/plain' }, payload: 'not json' });
    expect(wrongType.statusCode).toBe(415);
    const wrongCharset = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { origin: allowedHeaders.origin, 'content-type': 'application/json; charset=latin1' }, payload: payload() });
    expect(wrongCharset.statusCode).toBe(415);
    expect(disallowed.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects unsupported media and foreign origins before parsing a malformed body', async () => {
    const url = '/api/v1/enquiries';
    const body = '{malformed';
    const wrongType = await app.inject({
      method: 'POST', url, headers: { ...allowedHeaders, 'content-type': 'application/xml' }, payload: body,
    });
    expect(wrongType.statusCode).toBe(415);
    expect(wrongType.json()).toEqual({ error: 'json_required' });
    const foreign = await app.inject({
      method: 'POST', url, headers: { ...allowedHeaders, origin: 'http://127.0.0.1:9999' }, payload: body,
    });
    expect(foreign.statusCode).toBe(403);
    expect(foreign.json()).toEqual({ error: 'origin_not_allowed' });
    const malformed = await app.inject({ method: 'POST', url, headers: allowedHeaders, payload: body });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({ error: 'invalid_request' });
  });

  it('returns generic, non-cacheable routing errors without reflecting path or query contents', async () => {
    const marker = 'synthetic-private-marker';
    for (const [url, status, error] of [
      ['/missing?input=' + marker, 404, 'not_found'],
      ['/%E0%A4%A/' + marker, 400, 'invalid_request'],
    ] as const) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual({ error });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).not.toContain(marker);
    }
  });

  it('returns the same accepted receipt for the same normalized content and UUID', async () => {
    const request = payload({ description: 'First line\r\nsecond line' });
    const first = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders, payload: request });
    const retry = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders, payload: { ...request, fullName: ' Ada Example ', description: 'First line\nsecond line' } });
    expect(first.statusCode).toBe(202);
    expect(retry.statusCode).toBe(202);
    expect(retry.json()).toEqual(first.json());
    const saved = await database.pool.query('SELECT count(*)::int AS total FROM enquiries WHERE submission_id = $1', [request.submissionId]);
    expect(saved.rows[0].total).toBe(1);
  });

  it('does not overwrite or duplicate a UUID submitted with changed content', async () => {
    const request = payload();
    expect((await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders, payload: request })).statusCode).toBe(202);
    const changed = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders, payload: { ...request, description: 'Changed brief' } });
    expect(changed.statusCode).toBe(409);
    const saved = await database.pool.query('SELECT count(*)::int AS total, min(description) AS description FROM enquiries WHERE submission_id = $1', [request.submissionId]);
    expect(saved.rows[0]).toEqual({ total: 1, description: request.description });
  });

  it('handles concurrent identical submissions without creating duplicate records', async () => {
    const request = payload();
    const [left, right] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders, payload: request }),
      app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders, payload: request }),
    ]);
    expect([left.statusCode, right.statusCode]).toEqual([202, 202]);
    const saved = await database.pool.query('SELECT count(*)::int AS total FROM enquiries WHERE submission_id = $1', [request.submissionId]);
    expect(saved.rows[0].total).toBe(1);
  });

  it('distinguishes support-plan IDs from website-package IDs in persisted records', async () => {
    const request = payload({ offer: { type: 'support', id: 'support-growth' } });
    const response = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders, payload: request });
    expect(response.statusCode).toBe(202);
    const saved = await database.pool.query('SELECT offer_type, offer_id FROM enquiries WHERE submission_id = $1', [request.submissionId]);
    expect(saved.rows[0]).toEqual({ offer_type: 'support_plan', offer_id: 'support-growth' });
  });

  it('keeps liveness independent of the database and readiness tied to database health', async () => {
    const live = await app.inject({ method: 'GET', url: '/api/health/live' });
    const ready = await app.inject({ method: 'GET', url: '/api/health/ready' });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: 'alive' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: 'ready' });
  });

  it('sets no-store and baseline API security headers', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health/live' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });
});

describe('database failures, rate limiting and shutdown', () => {
  it('never accepts an enquiry when persistence fails and does not expose driver details', async () => {
    const privateMessage = 'password=secret client=private@example.test';
    let logOutput = '';
    const loggerStream = new Writable({
      write(chunk, _encoding, callback) {
        logOutput += chunk.toString();
        callback();
      },
    });
    const failingPool = {
      query: async () => { throw Object.assign(new Error(privateMessage), { code: '08006' }); },
      connect: async () => { throw Object.assign(new Error(privateMessage), { code: '08006' }); },
      end: async () => undefined,
    } as unknown as Pool;
    const failureApp = buildApp({ config, pool: failingPool, onClose: async () => undefined, loggerStream });
    const request = payload();
    const response = await failureApp.inject({ method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders, payload: request });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'temporarily_unavailable' });
    expect(response.body).not.toContain('password');
    expect(response.body).not.toContain('private@example.test');
    const readiness = await failureApp.inject({ method: 'GET', url: '/api/health/ready' });
    expect(readiness.statusCode).toBe(503);
    expect(readiness.body).not.toContain(privateMessage);
    expect((await failureApp.inject({ method: 'GET', url: '/api/health/live' })).statusCode).toBe(200);
    await failureApp.close();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(logOutput).toContain('08006');
    expect(logOutput).not.toContain('password=secret');
    expect(logOutput).not.toContain('private@example.test');
  });

  it('limits accepted attempts without trusting forwarded client IP headers', async () => {
    const limitedConfig = { ...config, rateLimitMax: 1 };
    const inertPool = { query: async () => ({ rows: [] }), connect: async () => { throw new Error('rate limit should reject before DB'); } } as unknown as Pool;
    const limitedApp = buildApp({ config: limitedConfig, pool: inertPool, onClose: async () => undefined });
    const headers = { ...allowedHeaders, 'x-forwarded-for': '203.0.113.9' };
    expect((await limitedApp.inject({ method: 'POST', url: '/api/v1/enquiries', headers, payload: payload() })).statusCode).toBe(503);
    const blocked = await limitedApp.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { ...headers, 'x-forwarded-for': '198.51.100.4' }, payload: payload() });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    await limitedApp.close();
  });

  it('counts malformed JSON attempts toward the rate limit without reaching the database', async () => {
    let connections = 0;
    const pool = { connect: async () => { connections++; throw new Error('not expected'); } } as unknown as Pool;
    const limited = buildApp({ config: { ...config, rateLimitMax: 1 }, pool, onClose: async () => undefined });
    try {
      const request = { method: 'POST', url: '/api/v1/enquiries', headers: allowedHeaders } as const;
      expect((await limited.inject({ ...request, payload: '{malformed' })).statusCode).toBe(400);
      const blocked = await limited.inject({ ...request, payload: payload() });
      expect(blocked.statusCode).toBe(429);
      expect(connections).toBe(0);
    } finally {
      await limited.close();
    }
  });

  it('closes the pool exactly once during application shutdown', async () => {
    let closeCount = 0;
    const closablePool = {
      query: async () => ({ rows: [{ '?column?': 1 }] }),
      connect: async () => { throw new Error('not used'); },
      end: async () => { closeCount += 1; },
    } as unknown as Pool;
    const closableApp = buildApp({ config, pool: closablePool });
    await closableApp.ready();
    await closableApp.close();
    expect(closeCount).toBe(1);
  });
});

describe('Fastify wire protocol on loopback', () => {
  let database: TestDatabase;
  let listener: FastifyInstance;
  let address: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    listener = buildApp({ config, pool: database.pool });
    address = await listener.listen({ host: '127.0.0.1', port: 0 });
  });
  afterAll(async () => {
    await listener.close();
    await database.database.close();
  });

  function post(parts: (string | Buffer)[], headers: Record<string, string> = {}, finish = true, origin = address) {
    return new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: unknown }>((resolve, reject) => {
      const req = httpRequest(origin + '/api/v1/enquiries', {
        method: 'POST', headers: { ...allowedHeaders, ...headers }, agent: false,
        signal: AbortSignal.timeout(7000),
      }, response => {
        response.setEncoding('utf8');
        let body = '';
        response.on('data', chunk => { body += chunk; });
        response.on('error', reject);
        response.on('end', () => {
          try {
            resolve({ status: response.statusCode!, headers: response.headers, body: JSON.parse(body) });
          } catch (error) { reject(error); }
        });
      });
      req.on('error', reject);
      for (const part of parts) req.write(part);
      if (finish) req.end();
    });
  }

  it.each([
    ['foreign Origin', '{', { origin: 'http://127.0.0.1:9999' }, 403, 'origin_not_allowed'],
    ['unsupported media', '<xml/>', { 'content-type': 'application/xml' }, 415, 'json_required'],
    ['malformed JSON', '{"private-marker":', {}, 400, 'invalid_request'],
  ] as const)('rejects %s safely', async (_label, body, headers, status, error) => {
    const result = await post([body], headers);
    expect(result).toMatchObject({ status, body: { error }, headers: { 'cache-control': 'no-store' } });
  });

  it.each(['gzip bytes', 'mislabeled JSON'])('rejects unsupported encoding for %s', async kind => {
    const input = JSON.stringify(payload());
    const result = await post([kind === 'gzip bytes' ? gzipSync(input) : input], { 'content-encoding': 'gzip' });
    expect(result).toMatchObject({ status: 415, body: { error: 'unsupported_content_encoding' } });
  });

  it('rejects malformed UTF-8 instead of persisting a replacement character', async () => {
    const input = payload({ description: 'wire-marker' });
    const [prefix, suffix] = JSON.stringify(input).split('wire-marker');
    const result = await post([Buffer.from(prefix), Buffer.from([0xff]), Buffer.from(suffix)]);
    expect(result).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
    expect((await database.pool.query('SELECT 1 FROM enquiries WHERE submission_id = $1', [input.submissionId])).rowCount).toBe(0);
  });

  it('rejects oversized fixed-length and chunked uploads before persistence', async () => {
    const first = '{"padding":"';
    const padding = 'x'.repeat(REQUEST_BODY_LIMIT);
    const last = '"}';
    for (const headers of [
      { 'content-length': String(first.length + padding.length + last.length) },
      { 'transfer-encoding': 'chunked' },
    ] as Record<string, string>[]) {
      const result = await post([first, padding, last], headers);
      expect(result.status).toBe(413);
      expect(result.body).toEqual({ error: 'request_too_large' });
    }
  });

  it('closes an incomplete body with a bounded safe response and keeps liveness', async () => {
    const result = await post(['{"unfinished":'], { 'content-length': '500' }, false);
    expect(result.status).toBe(408);
    expect(result.headers.connection).toBe('close');
    expect(result.body).toEqual({ error: 'request_timeout' });
    expect((await fetch(address + '/api/health/live')).status).toBe(200);
  }, 9000);

  it('commits one enquiry and outbox record for a same-UUID retry', async () => {
    const input = payload({ description: 'Synthetic UTF-8 enquiry — café' });
    const encoded = Buffer.from(JSON.stringify(input));
    const split = encoded.indexOf(Buffer.from('é')) + 1;
    const first = await post([encoded.subarray(0, split), encoded.subarray(split)]);
    expect(first.status).toBe(202);
    expect(first.body).toEqual({ accepted: true, submissionId: input.submissionId, status: 'received' });
    expect(await post([JSON.stringify({ ...input, description: '  ' + input.description + '  ' })]))
      .toMatchObject({ status: 202, body: first.body });
    const conflict = await post([JSON.stringify({ ...input, description: 'Changed wire request' })]);
    expect(conflict).toMatchObject({ status: 409, body: { error: 'submission_conflict' } });
    const { rows } = await database.pool.query(
      'SELECT description, (SELECT count(*)::int FROM email_outbox WHERE enquiry_id = $1) AS jobs FROM enquiries WHERE submission_id = $1',
      [input.submissionId],
    );
    expect(rows).toEqual([{ description: input.description, jobs: 1 }]);
  });

  it('applies rate limits to the actual socket and ignores forwarded IPs', async () => {
    const limited = buildApp({ config: { ...config, rateLimitMax: 1 }, pool: database.pool, onClose: async () => {} });
    const url = await limited.listen({ host: '127.0.0.1', port: 0 });
    try {
      expect(await post(['{'], { 'x-forwarded-for': '203.0.113.19' }, true, url)).toMatchObject({ status: 400 });
      const blocked = await post([JSON.stringify(payload())], { 'x-forwarded-for': '203.0.113.20' }, true, url);
      expect(blocked).toMatchObject({ status: 429, body: { error: 'rate_limited' } });
      expect(blocked.headers['retry-after']).toMatch(/^\d+$/);
    } finally {
      await limited.close();
    }
  });
});
