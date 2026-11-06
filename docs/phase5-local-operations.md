# Phase 5 local operations

## Prerequisites and startup

Use Node.js 26, npm, and a local Docker engine with Docker Compose and support for `up --wait`. Compose runs PostgreSQL 18.6 and Mailpit 1.33.0. Fastify and the worker run on the host. This keeps application connections on loopback, including when Compose provides the services. The Compose project defaults to `aevumstack-local`. Set `LOCAL_COMPOSE_PROJECT` in `.env.local-runtime` to use a separate project and named database volume for an isolated local instance. Keep the same project name and credentials when reopening that instance; changing the project name selects a different volume and does not migrate existing data.

Create your local settings file once, from the repository root. Keep its HMAC key across restarts and backups.

```sh
(umask 077
  if [ -e .env.local-runtime ]; then exit 1; fi
  printf 'LOCAL_POSTGRES_PASSWORD=%s\nIDEMPOTENCY_HMAC_KEY=%s\n' \
    "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env.local-runtime
)
npm ci
npm run local:up
```

Use [the built site](http://127.0.0.1:3000) and [the Mailpit inbox](http://127.0.0.1:18025). The startup command builds the site and backend, waits for both containers, probes Mailpit HTTP and SMTP, applies pending database migrations, and starts Fastify and the worker. It waits for the API schema probe and the worker’s database check before announcing readiness. Migrations can run again on each startup. The Compose password initializes the database role when the volume is new. Changing the setting later does not rotate the password in an existing volume.

Run `npm run local:status` in a second terminal to see Compose state, API liveness, database and schema readiness, and both Mailpit listeners. The command exits nonzero if a probe fails. The worker is supervised by the foreground startup command, which exits if either host process exits unexpectedly.

Stop the foreground command with Ctrl+C or SIGTERM. It shuts down its API and worker, allowing the worker to finish its current attempt. Then run `npm run local:down` to stop the two Compose services and retain their containers and PostgreSQL volume. If startup fails after Compose has started, inspect status and use the same stop command to stop the infrastructure. The next startup uses the same database volume. Mailpit is a capture inbox and its mailbox is disposable. If it clears across a restart, PostgreSQL still retains the sent status and the worker does not replay those jobs.

| Service | Host access |
| --- | --- |
| Fastify and built Vite site | `127.0.0.1:3000` |
| PostgreSQL | `127.0.0.1:15432` |
| Mailpit SMTP | `127.0.0.1:11025` |
| Mailpit inbox and HTTP readiness | `127.0.0.1:18025` |

Set `LOCAL_PG_PORT`, `LOCAL_SMTP_PORT`, or `LOCAL_MAILPIT_PORT` in `.env.local-runtime` if an existing service uses a default port. Use distinct ports. If 3000 is busy, stop the process you own or use the separate Vite workflow. Leave unrelated processes and their data in place. The API exposes `/api/health/live` and `/api/health/ready`. Readiness checks PostgreSQL schema availability independently of SMTP. Accepted enquiries remain stored during an SMTP outage and the worker retries eligible jobs.

## Native host workflow and development

With an existing dedicated loopback PostgreSQL database and a loopback Mailpit capture listener, set `DATABASE_URL`, `IDEMPOTENCY_HMAC_KEY`, and the Mailpit port settings. Run `npm run local:host` and check it with `npm run local:status -- --host`. Stop the API and worker with Ctrl+C. Use the native services’ original stop commands to stop PostgreSQL and Mailpit. The [Mailpit capture flags](phase3-outbox.md) also apply in this mode.

For the Vite development server, use the [Phase 4 workflow](phase4-integration.md) with `.env`, Fastify on port 3001, and Vite on 5173. The local runtime uses `.env.local-runtime` and Fastify on port 3000. The app does not accept Compose DNS names, external database or SMTP hosts, or SMTP credentials. Compose publishes loopback ports only, with Mailpit configured for the synthetic recipient and no forwarding or relay. Docker administrators and other software running as your user can access local secrets and data.

Fastify serves the three built pages, known public files, and fingerprinted JavaScript and CSS from the Vite manifest. HTML and API responses use `no-store`, public files use `no-cache`, and fingerprinted assets use immutable caching. Built pages retain canonical metadata and the generated security policy. The build manifest, source, backups, and environment files have no public routes.

## Backup and restore

Use the commands from the repository root. The Compose workflow uses the PostgreSQL clients inside the database container. With native PostgreSQL, pass `--host` as the first argument and put compatible `pg_dump` and `pg_restore` clients on PATH.

```sh
npm run db:backup
npm run db:verify
npm run db:restore -- aevumstack-ARCHIVE_ID.dump aevumstack_restore_verification
npm run db:verify -- aevumstack_restore_verification
```

Replace the archive placeholder with the basename printed by the backup command, without the `backups/` prefix. For native tools use, for example, `npm run db:backup -- --host` and `npm run db:restore -- --host aevumstack-ARCHIVE_ID.dump aevumstack_restore_verification`. The custom-format dump includes schema, migration history, enquiries, and outbox records. The command writes into the ignored `backups/` directory with owner-only permissions and removes incomplete archives on failure. Archives may contain customer PII. Restore only trusted archives you created.

Restore creates a separate database with a name starting `aevumstack_restore_`. If the target exists, the command fails and leaves it intact. A restore uses one transaction. If it fails after database creation, the new database remains available for inspection. Keep the application and worker pointed at the source during verification. A restored database can contain pending jobs and should not receive a worker automatically.

Verification prints the migration names, record counts, outbox state counts, orphan count, and a digest of the submission IDs and their outbox relationships and states. Pause writes and the worker for an exact source-to-restore comparison. The archive does not contain the HMAC key. Keep the original key separately if restored submissions must accept an identical retry with the same UUID. A different key causes conflicts for those UUIDs.

## Reproduce verification

```sh
docker compose --env-file .env.local-runtime config --quiet
npm test
npm run typecheck
npm run test:security
npm audit --audit-level=low

PHASE5_TEST_DATABASE_URL='postgres://test_user@127.0.0.1:5432/aevumstack_phase5_test' \
PHASE5_TEST_MAILPIT_SMTP_PORT=11025 PHASE5_TEST_MAILPIT_HTTP_PORT=18025 \
npm run test:local-runtime
```

The runtime suite uses Chromium, native PostgreSQL clients on PATH, a local capture-only Mailpit, and a dedicated test role with permission to create databases. It creates uniquely named source and restore databases and removes only those databases and the synthetic archive it creates. It exercises the real host startup command, same-origin browser submissions, process restart, real mail capture, SMTP and database outages, and backup integrity. Keep port 3000 free. Use the Phase 3 and 4 guides to reproduce their native and development-proxy suites.

To verify the Compose volume itself, start the Compose workflow, send a synthetic enquiry and wait for Mailpit capture. Stop the API and worker, run `npm run db:verify`, then run `npm run local:down` and restart. Compare the verification output and check the mailbox for newly repeated deliveries. To exercise volume reuse across container recreation, use `docker compose --env-file .env.local-runtime down` after stopping the host processes and restart with `npm run local:up`. Keep the named volume. The runtime and rate limit are for local operation. Public hosting, SMTP delivery, and PII retention remain separate decisions.
