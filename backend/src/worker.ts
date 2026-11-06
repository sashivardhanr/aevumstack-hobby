import { parseLocalDatabaseUrl } from './config/env.js';
import { loadWorkerConfig } from './config/worker.js';
import { createPool } from './db/pool.js';
import { createMailpitSender } from './modules/notifications/mailpit.js';
import { runWorker } from './modules/notifications/worker.js';

async function main(): Promise<void> {
  const config = loadWorkerConfig(process.env);
  const sender = createMailpitSender(config.smtp);
  const pool = createPool(parseLocalDatabaseUrl(process.env.DATABASE_URL ?? ''));
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  const reportDatabaseError = () => process.stderr.write('{"event":"outbox.database_error"}\n');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  pool.on('error', reportDatabaseError);
  try {
    if (process.send) {
      await pool.query('SELECT 1 FROM email_outbox LIMIT 0');
      process.send('ready');
      process.disconnect?.();
    }
    await runWorker(pool, sender, config.maxAttempts, shutdown.signal, reportDatabaseError);
  } finally {
    try {
      await pool.end();
    } finally {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    }
  }
}

main().catch(() => {
  process.stderr.write('{"event":"outbox.worker_failed"}\n');
  process.exitCode = 1;
});
