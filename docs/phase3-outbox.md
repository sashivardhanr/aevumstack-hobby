# Phase 3 local enquiry notifications

## Start PostgreSQL, Mailpit, API and worker

Use Node 26 and a dedicated PostgreSQL 14+ development database on loopback. Copy the example environment file locally, set the database URL, and generate a private HMAC key. The migration, API and worker accept loopback database URLs without query parameters. Run `npm ci` and `npm run db:migrate`.

Start Mailpit in its own terminal with a clean environment. Use a Mailpit binary from the [official releases](https://github.com/axllent/mailpit/releases).

```sh
env -i PATH="$PATH" mailpit --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025 \
  --disable-version-check --smtp-disable-rdns \
  --smtp-allowed-recipients '^enquiries@aevumstack[.]invalid$'
```

Run `npm run dev:api` and `npm run dev:worker` in separate terminals. The worker defaults to SMTP at `127.0.0.1:1025`. The supported SMTP environment settings are `SMTP_HOST` (literal `127.0.0.1` or `::1`) and `SMTP_PORT`. Other `SMTP_*` settings fail startup. The adapter uses a fixed synthetic sender and recipient under `aevumstack.invalid`. Contact details appear in the notification body. Use the Mailpit capture listener with relay, forwarding and webhooks disabled. The local Mailpit web interface can display enquiry data, so keep it bound to loopback and use synthetic submissions.

Submit a synthetic enquiry using the API with the default local origin and ports.

```sh
curl --fail-with-body -sS -w '\nHTTP %{http_code}\n' http://127.0.0.1:3001/api/v1/enquiries \
  -H 'Origin: http://127.0.0.1:5173' -H 'Content-Type: application/json' \
  --data '{"submissionId":"e6924fe5-d12c-47ca-a2e9-7f412914a264","fullName":"Synthetic Example","businessName":"Local Fixture","contactInfo":"visitor@example.invalid","offer":{"type":"support","id":"care"},"description":"Example support enquiry for local Mailpit capture.","website":""}'
```

Check the receipt for `202` and `status: received`. Open [the local Mailpit inbox](http://127.0.0.1:8025) and look for “New AEVUM STACK enquiry” with that submission ID and the support-plan classification. Repeating the same request uses the existing enquiry and job. Generate a new UUID for a new synthetic enquiry. Stop the worker with Ctrl+C or SIGTERM. It finishes the current claim and closes the database pool. An abrupt exit leaves the claim for lease recovery.

## Transaction and delivery state

Migration `002_create_email_outbox.js` adds a forward-only table. Each job references `enquiries.submission_id` and is unique by enquiry and notification type. The row stores delivery state, attempt count, next availability, claim token and lease timestamps, completion time and a safe error code. Partial indexes cover pending availability and processing lease expiry. The worker joins the enquiry when it claims a job and renders the two message formats in memory.

New enquiries and notification intents commit in one transaction. If either insert fails, PostgreSQL rolls back the transaction and the API returns a failure. Existing Phase 2 enquiries stay as recorded. An identical retry for a historical enquiry returns its existing acknowledgement and leaves the outbox alone. Any future historical backfill requires a deliberate decision. The API readiness probe checks database schema availability independently of SMTP. The receipt retains its existing meaning of durable acceptance.

## Claims, retries and operations

Workers use `FOR UPDATE SKIP LOCKED` to claim one eligible row in a short SQL statement. SMTP starts after the claim commits. Each claim increments the attempt count and receives a random token with a 60-second lease. A completion update requires the current token and an unexpired lease. The SMTP adapter has a 15-second deadline. Idle workers wait two seconds before polling again.

- `pending` jobs are eligible at `available_at`.
- `processing` jobs may be reclaimed after lease expiry. Expired attempts count toward the limit. Exhausted jobs become `failed` on a subsequent poll.
- Temporary failures retry after 5, 10, 20, 40 seconds and so on, with a five-minute cap. `OUTBOX_MAX_ATTEMPTS` defaults to 5 and accepts 1–20. Use the same setting across worker processes.
- SMTP 5xx rejections and exhausted attempts remain as `failed` with a safe error code. Inspect the status and code locally before deciding whether to issue another notification.
- `sent` records SMTP acceptance. If SMTP accepted the message but the worker lost the response, crashed, or could not persist the outcome, another worker may deliver a duplicate. The stable Message-ID helps correlate attempts and does not guarantee deduplication.

Inspect outbox state without selecting contact data.

```sql
SELECT enquiry_id, status, attempt_count, available_at, sent_at, last_error_code
FROM email_outbox ORDER BY created_at DESC LIMIT 20;
```

A Mailpit outage leaves the enquiry and its notification intent durable. The worker logs generic database failure events and records fixed delivery error codes. Mailpit capture data and the enquiry database remain local. Production SMTP, hosting, and retention decisions are deferred.

## Verification

`npm run test:backend` runs the embedded PostgreSQL and mock transport coverage without external services. The native and Mailpit tests are opt-in. To run all native tests, create a dedicated local database named `aevumstack_phase3_test` and start an isolated Mailpit as above. Use a test database role that can create schemas. Each run creates and drops its own randomly named schema.

```sh
PHASE3_TEST_DATABASE_URL='postgres://test_user@127.0.0.1:5432/aevumstack_phase3_test' \
PHASE3_TEST_MAILPIT_SMTP_PORT=1025 PHASE3_TEST_MAILPIT_HTTP_PORT=8025 \
npm run test:backend:native
```

The native suite applies both migrations, checks historical rows, runs concurrent API submissions and worker claims on separate PostgreSQL sessions, holds an actual row lock, tests lease recovery, and inspects Mailpit after an SMTP refusal and retry. PGlite remains useful for database state and retry tests in the default suite.
