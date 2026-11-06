import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { composeArgs, composeEnv, localSettings } from './local-settings.mjs';

const [action, ...args] = process.argv.slice(2);
const native = args[0] === '--host';
if (native) args.shift();
const restoreName = /^aevumstack_restore_[a-z0-9_]{1,35}$/;
const archiveName = /^aevumstack-[a-zA-Z0-9_-]+\.dump$/;
const backupDir = 'backups';

function protectDirectory() {
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const stat = lstatSync(backupDir);
  if (!stat.isDirectory() || stat.mode & 0o077) throw new Error('Use an owner-only, regular backups directory (chmod 700 backups)');
}

function runTool(tool, flags, descriptor, databaseUrl) {
  const url = new URL(databaseUrl);
  const io = tool === 'pg_dump' ? ['ignore', descriptor, 'ignore'] : [descriptor, 'ignore', 'ignore'];
  try {
    if (!native) {
      execFileSync('docker', [...composeArgs(), 'exec', '-T', 'postgres', tool,
        '--username', 'aevumstack', '--dbname', url.pathname.slice(1), '--no-password', ...flags],
      { env: composeEnv(), stdio: io });
    } else {
      execFileSync(tool, ['--no-password', '--dbname', decodeURIComponent(url.pathname.slice(1)), ...flags], {
        env: {
          PATH: process.env.PATH,
          PGHOST: url.hostname.replace(/^\[|\]$/g, ''), PGPORT: url.port || '5432',
          PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
          PGCONNECT_TIMEOUT: '5',
        },
        stdio: io,
      });
    }
  } catch {
    throw new Error(`${tool} failed. Check the local database, archive and PostgreSQL client version.`);
  }
}

async function withDatabase(databaseUrl, operation) {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
  try {
    await client.connect();
    return await operation(client);
  } finally { await client.end(); }
}

async function verify(databaseUrl) {
  const expected = readdirSync('backend/migrations').filter((name) => name.endsWith('.js'))
    .sort().map((name) => name.slice(0, -3));
  const { rows: [snapshot] } = await withDatabase(databaseUrl, (client) => client.query(`
    SELECT
      (SELECT array_agg(name ORDER BY id) FROM public.pgmigrations) AS migrations,
      (SELECT count(*)::int FROM public.enquiries) AS enquiries,
      (SELECT count(*)::int FROM public.email_outbox) AS jobs,
      (SELECT count(*)::int FROM public.email_outbox o LEFT JOIN public.enquiries e
        ON e.submission_id = o.enquiry_id WHERE e.submission_id IS NULL) AS orphan_jobs,
      (SELECT coalesce(jsonb_object_agg(status, total), '{}'::jsonb) FROM (
        SELECT status, count(*)::int AS total FROM public.email_outbox GROUP BY status
      ) counts) AS states,
      (SELECT string_agg(submission_id::text, ',' ORDER BY submission_id) FROM public.enquiries) AS submissions,
      (SELECT string_agg(concat_ws(':', id, enquiry_id, notification_type, status, attempt_count),
        ',' ORDER BY id) FROM public.email_outbox) AS relationships
  `));
  if (snapshot.orphan_jobs || JSON.stringify(snapshot.migrations) !== JSON.stringify(expected)) {
    throw new Error('Database verification failed: migration version or outbox relationship mismatch');
  }
  const { submissions, relationships, ...summary } = snapshot;
  return { ...summary, identity_sha256: createHash('sha256').update(JSON.stringify([submissions, relationships])).digest('hex') };
}

async function main() {
  const { databaseUrl } = localSettings(native);
  if (action === 'backup' && !args.length) {
    protectDirectory();
    const path = join(backupDir, `aevumstack-${randomUUID()}.dump`);
    const fd = openSync(path, 'wx', 0o600);
    try {
      runTool('pg_dump', ['--format=custom'], fd, databaseUrl);
      if (fstatSync(fd).size === 0) throw new Error('The backup is empty');
    } catch (error) {
      closeSync(fd);
      unlinkSync(path);
      throw error;
    }
    closeSync(fd);
    console.log(path);
    return;
  }

  if (action === 'restore' && args.length === 2 && archiveName.test(args[0]) && restoreName.test(args[1])) {
    const [file, name] = args;
    const target = new URL(databaseUrl);
    if (decodeURIComponent(target.pathname.slice(1)) === name) throw new Error('Restore requires a separate database');
    target.pathname = '/' + name;
    protectDirectory();
    const fd = openSync(join(backupDir, file), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      if (!fstatSync(fd).isFile() || !fstatSync(fd).size) throw new Error('Select a nonempty regular backup file');
      const maintenance = new URL(databaseUrl);
      maintenance.pathname = '/postgres';
      try {
        await withDatabase(maintenance.href, (client) => client.query(`CREATE DATABASE "${name}" TEMPLATE template0`));
      } catch {
        throw new Error('Could not create the separate restore database. It may already exist.');
      }
      console.log(`Created ${name}`);
      runTool('pg_restore', ['--single-transaction', '--no-owner', '--no-privileges'], fd, target.href);
      console.log(JSON.stringify(await verify(target.href)));
    } finally { closeSync(fd); }
    return;
  }

  if (action === 'verify' && (args.length === 0 || args.length === 1 && restoreName.test(args[0]))) {
    const target = new URL(databaseUrl);
    if (args.length) target.pathname = '/' + args[0];
    console.log(JSON.stringify(await verify(target.href)));
    return;
  }

  throw new Error('Use backup [--host], restore [--host] <archive basename> <aevumstack_restore_name>, or verify [--host] [restore name]');
}

main().catch((error) => {
  console.error(error.code ? 'Database operation failed. Check the local database and backup file.' : error.message);
  process.exitCode = 1;
});
