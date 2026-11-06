import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { parseLocalDatabaseUrl } from '../backend/src/config/env.ts';

export function localSettings(native) {
  const port = (key, fallback) => {
    const value = Number(process.env[key] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65_535) throw new Error(`Invalid ${key}`);
    return value;
  };
  const nativeUrl = native ? parseLocalDatabaseUrl(process.env.DATABASE_URL ?? '') : undefined;
  if (nativeUrl && !/^\/[a-z_][a-z0-9_]{0,62}$/.test(new URL(nativeUrl).pathname)) {
    throw new Error('Use a simple PostgreSQL database name for local operations');
  }
  const pgPort = nativeUrl ? Number(new URL(nativeUrl).port || '5432') : port('LOCAL_PG_PORT', 15432);
  const smtpPort = port('LOCAL_SMTP_PORT', 11025);
  const mailpitPort = port('LOCAL_MAILPIT_PORT', 18025);
  if (new Set([3000, 3001, 5173, pgPort, smtpPort, mailpitPort]).size !== 6) {
    throw new Error('Local ports must be distinct from each other and from 3000, 3001 and 5173');
  }
  const password = process.env.LOCAL_POSTGRES_PASSWORD;
  if (!native && !/^[a-f0-9]{64}$/.test(password ?? '')) {
    throw new Error('Set LOCAL_POSTGRES_PASSWORD to a local secret generated with openssl rand -hex 32');
  }
  const databaseUrl = nativeUrl ?? `postgres://aevumstack:${password}@127.0.0.1:${pgPort}/aevumstack_dev`;
  return { databaseUrl, smtpPort, mailpitPort };
}

export function composeProjectName(value = process.env.LOCAL_COMPOSE_PROJECT) {
  if (value === undefined) return 'aevumstack-local';
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(value)) {
    throw new Error('LOCAL_COMPOSE_PROJECT must be a lowercase Docker Compose project name');
  }
  return value;
}

export function composeArgs() {
  const host = process.env.DOCKER_CONTEXT || !process.env.DOCKER_HOST
    ? execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    : process.env.DOCKER_HOST;
  if (!/^(unix|npipe):\/\//.test(host)) throw new Error('Select a local Docker context');
  return ['compose', '-f', 'compose.yaml', '-p', composeProjectName(),
    ...(existsSync('.env.local-runtime') ? ['--env-file', '.env.local-runtime'] : [])];
}

export const composeEnv = () => ({ ...process.env, COMPOSE_DISABLE_ENV_FILE: '1' });

export async function healthy(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1_000), redirect: 'error' })).ok;
  } catch { return false; }
}

export function smtpReady(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.setEncoding('utf8');
    socket.setTimeout(1_000);
    let greeting = '';
    function finish(ok) { socket.destroy(); resolve(ok); }
    socket.on('data', (chunk) => {
      greeting += chunk;
      if (greeting.includes('\n') || greeting.length > 1024) finish(/^220[ -]/.test(greeting));
    });
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
    socket.once('end', () => finish(false));
  });
}
