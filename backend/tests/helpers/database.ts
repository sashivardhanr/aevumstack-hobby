import { resolve } from 'node:path';
import { Client, Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { createPgConfig } from '@electric-sql/pglite/node-postgres';
import { runner } from 'node-pg-migrate';

export interface TestDatabase {
  database: PGlite;
  pool: Pool;
  close: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const database = new PGlite();
  await database.waitReady;
  const connectionConfig = createPgConfig(database);
  const migrationClient = new Client(connectionConfig);
  await migrationClient.connect();
  try {
    await runner({
      direction: 'up',
      dbClient: migrationClient,
      dir: resolve(process.cwd(), 'backend/migrations', '*.js'),
      migrationsTable: 'phase2_test_migrations',
      useGlob: true,
      noLock: true,
      log: () => undefined,
    });
  } finally {
    await migrationClient.end();
  }

  const pool = new Pool(connectionConfig);
  return {
    database,
    pool,
    close: async () => {
      await pool.end();
      await database.close();
    },
  };
}
