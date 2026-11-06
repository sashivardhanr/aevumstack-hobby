import { isIP } from 'node:net';
import { z } from 'zod';

export interface AppConfig {
  databaseUrl: string;
  host: '127.0.0.1' | '::1';
  port: number;
  allowedOrigins: ReadonlySet<string>;
  idempotencyHmacKey: string;
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

const rawConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_HOST: z.enum(['127.0.0.1', '::1']).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  API_ALLOWED_ORIGINS: z.string().min(1),
  IDEMPOTENCY_HMAC_KEY: z.string().min(32),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(5),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
});

export function parseLocalDatabaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid local PostgreSQL URL');
  }

  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !isLocal || parsed.pathname === '/' || !parsed.pathname || parsed.search || parsed.hash) {
    throw new Error('DATABASE_URL must point to a local PostgreSQL database during Phase 2');
  }
  if (parsed.hostname === 'localhost') parsed.hostname = '127.0.0.1';
  return parsed.href;
}

function parseAllowedOrigins(value: string): ReadonlySet<string> {
  const origins = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (origins.length === 0) throw new Error('API_ALLOWED_ORIGINS must contain at least one explicit local origin');

  const validated = origins.map((origin) => {
    if (origin === '*') throw new Error('API_ALLOWED_ORIGINS must contain exact HTTP loopback origins only during Phase 2');
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('API_ALLOWED_ORIGINS must contain valid origins');
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    const local = ['localhost', '127.0.0.1', '::1'].includes(hostname) || isIP(hostname) === 4 && hostname.startsWith('127.');
    if (parsed.origin !== origin || parsed.protocol !== 'http:' || !local || origin === '*') {
      throw new Error('API_ALLOWED_ORIGINS must contain exact HTTP loopback origins only during Phase 2');
    }
    return parsed.origin;
  });

  return new Set(validated);
}

export function loadConfig(environment: NodeJS.ProcessEnv | Record<string, string | undefined>): AppConfig {
  const parsed = rawConfigSchema.safeParse(environment);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => String(issue.path[0] ?? 'configuration')).join(', ');
    throw new Error(`Invalid server configuration: ${missing}`);
  }

  if (Buffer.byteLength(parsed.data.IDEMPOTENCY_HMAC_KEY, 'utf8') < 32 || /replace-this-placeholder/i.test(parsed.data.IDEMPOTENCY_HMAC_KEY)) {
    throw new Error('IDEMPOTENCY_HMAC_KEY must be a private random value of at least 32 bytes');
  }

  return {
    databaseUrl: parseLocalDatabaseUrl(parsed.data.DATABASE_URL),
    host: parsed.data.API_HOST,
    port: parsed.data.API_PORT,
    allowedOrigins: parseAllowedOrigins(parsed.data.API_ALLOWED_ORIGINS),
    idempotencyHmacKey: parsed.data.IDEMPOTENCY_HMAC_KEY,
    rateLimitMax: parsed.data.API_RATE_LIMIT_MAX,
    rateLimitWindowMs: parsed.data.API_RATE_LIMIT_WINDOW_MS,
  };
}
