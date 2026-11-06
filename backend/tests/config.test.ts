import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

const validEnvironment = {
  DATABASE_URL: 'postgres://local:local@127.0.0.1:5432/aevumstack_test',
  API_HOST: '127.0.0.1',
  API_PORT: '3001',
  API_ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  IDEMPOTENCY_HMAC_KEY: 'test-only-key-material-that-is-at-least-32-bytes',
};

describe('server-only startup configuration', () => {
  it('loads a loopback-only development configuration', () => {
    const config = loadConfig(validEnvironment);
    expect(config.host).toBe('127.0.0.1');
    expect(config.allowedOrigins.has('http://localhost:5173')).toBe(true);
    expect(config.rateLimitMax).toBe(5);
  });

  it('rejects missing, short, or example HMAC keys', () => {
    expect(() => loadConfig({ ...validEnvironment, IDEMPOTENCY_HMAC_KEY: '' })).toThrow('Invalid server configuration');
    expect(() => loadConfig({ ...validEnvironment, IDEMPOTENCY_HMAC_KEY: 'short' })).toThrow('Invalid server configuration');
    expect(() => loadConfig({ ...validEnvironment, IDEMPOTENCY_HMAC_KEY: 'replace-this-placeholder-with-at-least-32-random-bytes' })).toThrow('must be a private random value');
  });

  it('rejects remote databases and wildcard or non-loopback origins', () => {
    expect(() => loadConfig({ ...validEnvironment, DATABASE_URL: 'postgres://user:pass@db.example.test:5432/prod' })).toThrow('local PostgreSQL');
    expect(() => loadConfig({ ...validEnvironment, API_ALLOWED_ORIGINS: '*' })).toThrow('exact HTTP loopback origins');
    expect(() => loadConfig({ ...validEnvironment, API_ALLOWED_ORIGINS: 'https://aevumstack.dev' })).toThrow('exact HTTP loopback origins');
    expect(() => loadConfig({ ...validEnvironment, API_ALLOWED_ORIGINS: 'http://localhost:5173/path' })).toThrow('exact HTTP loopback origins');
  });

  it('accepts the host runtime origin and rejects Compose DNS, host overrides, and public binds', () => {
    expect(loadConfig({ ...validEnvironment, API_PORT: '3000', API_ALLOWED_ORIGINS: 'http://127.0.0.1:3000' })
      .allowedOrigins.has('http://127.0.0.1:3000')).toBe(true);
    expect(() => loadConfig({ ...validEnvironment, DATABASE_URL: 'postgres://local@postgres/aevumstack_dev' })).toThrow('local PostgreSQL');
    expect(() => loadConfig({ ...validEnvironment, DATABASE_URL: validEnvironment.DATABASE_URL + '?host=db.example.test' })).toThrow('local PostgreSQL');
    expect(() => loadConfig({ ...validEnvironment, API_HOST: '0.0.0.0' })).toThrow('Invalid server configuration');
  });
});
