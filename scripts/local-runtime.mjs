import { execFileSync, fork, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { loadConfig } from '../backend/src/config/env.ts';
import { loadWorkerConfig } from '../backend/src/config/worker.ts';
import { composeArgs, composeEnv, healthy, localSettings, smtpReady } from './local-settings.mjs';

const origin = 'http://127.0.0.1:3000';
const [action, option] = process.argv.slice(2);
const native = option === '--host';
const children = [];
const shutdown = new AbortController();

function compose(args, options = {}) {
  try {
    execFileSync('docker', [...composeArgs(), ...args], { env: composeEnv(), stdio: 'inherit', ...options });
  } catch {
    throw new Error('Compose command failed. Check the local Docker engine, configuration and published ports.');
  }
}

async function status(settings) {
  const checks = await Promise.all([
    healthy(origin + '/api/health/live'),
    healthy(origin + '/api/health/ready'),
    healthy(`http://127.0.0.1:${settings.mailpitPort}/readyz`),
    smtpReady(settings.smtpPort),
  ]);
  for (const [i, label] of ['API process', 'Database and migrations via API', 'Mailpit HTTP', 'Mailpit SMTP'].entries()) {
    console.log(`${label}: ${checks[i] ? 'ready' : 'unavailable'}`);
  }
  return checks;
}

function childResult(child) {
  return new Promise((resolve) => {
    child.once('error', () => resolve(false));
    child.once('exit', (code) => resolve(code === 0));
  });
}

async function checkPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', () => reject(new Error('Port 3000 is already occupied or unavailable')));
    probe.listen(3000, '127.0.0.1', () => probe.close(resolve));
  });
}

async function up(settings) {
  const env = {
    ...process.env, DATABASE_URL: settings.databaseUrl, API_HOST: '127.0.0.1', API_PORT: '3000',
    API_ALLOWED_ORIGINS: origin, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(settings.smtpPort),
  };
  loadConfig(env);
  loadWorkerConfig(env);
  await checkPort();

  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
  if (shutdown.signal.aborted) return;
  if (!native) compose(['up', '-d', '--wait', '--wait-timeout', '90']);
  if (shutdown.signal.aborted) return;
  const inbox = `http://127.0.0.1:${settings.mailpitPort}`;
  if (!await healthy(inbox + '/readyz') || !await smtpReady(settings.smtpPort)) {
    throw new Error('Mailpit HTTP or SMTP is unavailable. Check the configured loopback ports.');
  }
  execFileSync(process.execPath, ['backend/dist/db/migrate.js'], { env, stdio: 'inherit' });
  if (shutdown.signal.aborted) return;

  const api = spawn(process.execPath, ['backend/dist/server.js', '--static'], { env, stdio: 'inherit' });
  const apiExited = childResult(api);
  children.push({ child: api, exited: apiExited });
  let apiReady = false;
  for (let attempt = 0; attempt < 25 && !shutdown.signal.aborted; attempt++) {
    if (api.exitCode !== null || api.signalCode !== null) break;
    if (await healthy(origin + '/api/health/ready')) {
      apiReady = true;
      break;
    }
    await delay(200);
  }
  if (shutdown.signal.aborted) return;
  if (!apiReady) throw new Error('Fastify did not become ready on port 3000');

  const worker = fork('backend/dist/worker.js', [], { env, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const workerExited = childResult(worker);
  children.push({ child: worker, exited: workerExited });
  const started = new Promise((resolve) => worker.once('message', (message) => resolve(message === 'ready')));
  const timeout = AbortSignal.timeout(8_000);
  const startupStopped = AbortSignal.any([shutdown.signal, timeout]);
  const startupCancelled = new Promise((resolve) => startupStopped.addEventListener('abort', () => resolve(false), { once: true }));
  const workerReady = await Promise.race([started, workerExited.then(() => false), apiExited.then(() => false), startupCancelled]);
  if (shutdown.signal.aborted) return;
  if (!workerReady) throw new Error('The local worker did not become ready');

  console.log(`Local application ready at ${origin}. Mailpit inbox at ${inbox}. Press Ctrl+C to stop the API and worker.`);
  const stopped = new Promise((resolve) => shutdown.signal.addEventListener('abort', () => resolve(), { once: true }));
  await Promise.race([apiExited, workerExited, stopped]);
  if (!shutdown.signal.aborted) throw new Error('The local API or worker exited unexpectedly');
}

async function main() {
  if (option && !native || process.argv.length > 4 || !['up', 'down', 'status'].includes(action)) {
    throw new Error('Usage: local-runtime.mjs up|down|status [--host]');
  }
  const settings = localSettings(native);
  if (action === 'down') {
    if (native) throw new Error('Stop your native database and Mailpit with their original commands');
    compose(['stop']);
    return;
  }
  if (action === 'status') {
    if (!native) compose(['ps', '-a']);
    if (!(await status(settings)).every(Boolean)) process.exitCode = 1;
    return;
  }

  const stop = () => shutdown.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    if (!native) compose(['version'], { stdio: 'ignore' });
    await up(settings);
  } finally {
    for (const { child } of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    }
    const limit = setTimeout(() => {
      for (const { child } of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 35_000);
    try {
      const exits = await Promise.all(children.map(({ exited }) => exited));
      if (shutdown.signal.aborted && exits.some((ok) => !ok)) process.exitCode = 1;
    } finally { clearTimeout(limit); }
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}

main().catch((error) => {
  // Only print explicit errors owned by this script. Child errors may contain arguments or environment details.
  console.error(error.code ? 'Local runtime command failed. Check prerequisites and configuration.' : error.message);
  process.exitCode = 1;
});
