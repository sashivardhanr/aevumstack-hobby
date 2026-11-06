import { resolve } from 'node:path';
import { runner } from 'node-pg-migrate';
import { parseLocalDatabaseUrl } from '../config/env.js';

try {
  const migrations = await runner({
    databaseUrl: parseLocalDatabaseUrl(process.env.DATABASE_URL ?? ''),
    dir: resolve('backend/migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => undefined,
  });
  console.log(`Applied ${migrations.length} local database migration(s)`);
} catch {
  process.stderr.write('Local database migration failed. Check the loopback database and migration state.\n');
  process.exitCode = 1;
}
