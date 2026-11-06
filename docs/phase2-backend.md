# Phase 2 — Local Fastify and PostgreSQL foundation

This document describes the original Phase 2 checkpoint. See the [Phase 3 guide](phase3-outbox.md) for the current transaction, readiness check, and worker behavior.

## Local prerequisites and startup

- Node.js 26.x and npm.
- PostgreSQL 14 or later, installed locally or run in a local container with its host port bound to loopback.
- A dedicated development database named `aevumstack_dev`; do not use production credentials or data.

Copy `.env.example` to `.env`, replace `IDEMPOTENCY_HMAC_KEY` with at least 32 random bytes, and set a local PostgreSQL URL for `aevumstack_dev`. The API startup validation rejects a non-loopback database host, wildcard origins, non-loopback API bind addresses, a short HMAC key, and the example placeholder. The existing `PUBLIC_*`, Vercel/Resend/Turnstile/Upstash entries remain legacy Phase 1 examples and are not read by this API.

```sh
npm ci
npm run db:migrate
npm run dev:api
```

The API binds to `127.0.0.1:3001` by default. The browser origins are explicit loopback origins on Vite's default port. If the Vite development port changes, add that exact loopback origin to `API_ALLOWED_ORIGINS`. Do not add `*`.

`npm run db:migrate` uses `node-pg-migrate` and applies the files in `backend/migrations`. The initial migration creates the enquiry table and indexes. Migrations are forward/backward tracked by the migration tool; do not edit an already-applied migration to change a deployed schema.

## Environment variables

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Server only | Local PostgreSQL connection for the API and migration command. The application rejects non-loopback hosts in Phase 2. |
| `API_HOST` | No | Server only | API bind address; defaults to `127.0.0.1`, and accepts only `127.0.0.1` or `::1`. |
| `API_PORT` | No | Server only | API port; defaults to `3001`. |
| `API_ALLOWED_ORIGINS` | Yes | Server only | Comma-separated exact local HTTP origins; no path, wildcard, or remote origins. |
| `IDEMPOTENCY_HMAC_KEY` | Yes | Server only | Private random key (at least 32 bytes) used to HMAC canonical enquiry content. Keep out of `VITE_*` variables and browser assets. |
| `API_RATE_LIMIT_MAX` | No | Server only | POST attempts allowed per loopback address in the window; defaults to `5`. |
| `API_RATE_LIMIT_WINDOW_MS` | No | Server only | Fixed-window duration in milliseconds; defaults to `60000`. |

The variables beginning `PUBLIC_` in `.env.example` belong to the retained website/Vercel setup. No Phase 2 backend code reads them. There are no test database credentials: tests create a fresh embedded PostgreSQL database in memory.

## API behavior

- `POST /api/v1/enquiries` accepts only JSON, up to 32 KiB, and requires an exact allowed `Origin` header.
- The server validates all fields with Zod, rejects unknown properties, rejects a filled honeypot, and limits attempts by the socket's direct remote address. It ignores `X-Forwarded-For` and does not enable CORS.
- The source offer allowlist is `business`, `starter`, `growth`, `pro`, `care`, `support-growth`, `automation`, and `custom`. The source uses `?package=` for website packages and `?plan=` for `care`, `support-growth`, and `automation`. The API keeps these IDs distinct in `offer_type` and `offer_id` columns while retaining the Phase 1 request property named `package`. The request contract should be revisited in Phase 4 before connecting the form; no plan is silently relabeled as a website package.
- **Open Phase 4 contract question:** keep the legacy string field and derive the category from the approved ID, or change the request to an explicit discriminated offer (`type` plus `id`). Phase 2 does not choose a new public contract; it accepts only the existing source IDs and preserves their category internally.
- Names and contact data are trimmed. An empty trimmed business name becomes SQL `NULL`. Description CRLF and CR newlines become LF, then surrounding whitespace is trimmed. The submission UUID and empty honeypot are not part of the payload identity. `botToken` is rejected because no bot verification service is active in Phase 2.
- Canonical identity is the JSON encoding (stable field order) of normalized `fullName`, nullable `businessName`, `contactInfo`, `offerType`, `offerId`, and `description`. The server stores only an HMAC-SHA-256 of those fields, never an unhashed payload digest. A retry with identical normalized content returns the same acknowledgement; changed content with that UUID returns `409`.
- A `202` response is sent only after the transaction commits. It means `received` by the database, not email delivery. Database failure returns a generic `503` without acceptance.
- `GET /api/health/live` checks only the process. `GET /api/health/ready` runs `SELECT 1`; failure returns a generic `503`.

## Database shape

`enquiries.submission_id` is the UUID primary key and therefore the unique idempotency key. The row stores normalized fields, an HMAC, the source-derived offer category, `status='received'`, and timestamps. Checks constrain category/ID combinations and the HMAC format. Indexes support chronological and status/chronological reads. SQL writes are parameterized.

The initial transaction writes a single enquiry row. A future email outbox can be inserted in the same transaction in a later phase; this phase does not claim that notifications are queued, delivered, or retried.

The pinned `node-pg-migrate` release currently constrains its glob dependency to a vulnerable major range. The lockfile overrides only its migration-file discovery dependency to patched `glob` 14.0.2 and `minimatch` 11.0.4. Their Node 26 support and the migration runner's `glob(dir, options)` usage were checked, and the test suite exercises migration discovery through this code path. Revisit and remove these overrides when an upstream `node-pg-migrate` release includes the fix.

## Security scope and limits

- The API listener and accepted DB host are loopback-only in this phase. This is not a public deployment configuration.
- Allowed-origin checks are not authentication or spam-proofing. The in-memory rate limiter is process-local and resets at restart; it is suitable only for this local single-instance phase.
- There is no CAPTCHA, durable distributed rate limit, proxy trust, CORS, SMTP, outbox, or public hosting.
- Fastify request logging is disabled; explicit events contain only a static reason or database error code, not payloads, connection strings, SQL values, or raw driver messages. Health failures are generic.
- API responses use `no-store`, `nosniff`, `DENY`, `no-referrer`, and a restrictive JSON API CSP. HSTS is intentionally not set for local HTTP.
- Contact PII is stored in the local database. Owner-approved retention and deletion policy remains unresolved; use synthetic data in development and clear the local database when appropriate.

## Test database

The backend suite starts PGlite (the PostgreSQL engine compiled to WebAssembly), applies the real `node-pg-migrate` migration, and connects through the real `pg` client adapter. The database is created for the test run and closed afterward; no external database or email service is used. PGlite is single-connection, so these tests exercise PostgreSQL SQL and migration behavior plus parallel API requests, but they do not reproduce multi-session scheduling/locking under a native PostgreSQL server. Run the same integration suite against an isolated native test database before relying on native concurrency behavior in a later release.

Phase 3 email/outbox, Phase 4 browser/API integration, and Phase 5 Docker infrastructure are explicitly deferred.
