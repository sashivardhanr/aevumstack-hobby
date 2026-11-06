import pg from 'pg';

const { Pool } = pg;

export function createPool(connectionString: string): pg.Pool {
  return new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 7_000,
    statement_timeout: 6_000,
    application_name: 'aevumstack-enquiry-api',
  });
}
