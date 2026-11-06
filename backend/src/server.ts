import { loadConfig } from './config/env.js';
import { resolve } from 'node:path';
import { buildApp } from './app.js';
import { createPool } from './db/pool.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const pool = createPool(config.databaseUrl);
  const app = buildApp({ config, pool, staticRoot: process.argv.includes('--static') ? resolve('dist') : undefined });
  pool.on('error', (error) => {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : 'database_error';
    app.log.error({ event: 'database.pool_error', code }, 'Database connection error');
  });

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info({ event: 'api.started', host: config.host, port: config.port }, 'Local enquiry API started');
  } catch (error) {
    app.log.error({ event: 'api.start_failed', code: typeof error === 'object' && error !== null && 'code' in error ? error.code : 'startup_error' }, 'API startup failed');
    await app.close();
    process.exitCode = 1;
    return;
  }

  let closing = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (closing) return;
    closing = true;
    app.log.info({ event: 'api.shutdown', signal }, 'Stopping local enquiry API');
    try {
      await app.close();
    } catch {
      app.log.error({ event: 'api.shutdown_failed' }, 'API shutdown failed');
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(() => {
  // Configuration parse errors intentionally avoid echoing environment values.
  process.stderr.write('API startup failed. Check configuration and the compiled site.\n');
  process.exitCode = 1;
});
