# Phase 4 local enquiry integration

## Run the complete workflow

Use a dedicated loopback PostgreSQL database and the Mailpit capture listener described in the [local outbox guide](phase3-outbox.md). Set the database URL and a private HMAC key in the server environment. Set `API_ALLOWED_ORIGINS=http://127.0.0.1:5173` and keep the API at `127.0.0.1:3001`.

Run `npm ci` and `npm run db:migrate`. Start `npm run dev:api`, `npm run dev:worker`, and `npm run dev` in separate terminals. Open [the local website](http://127.0.0.1:5173). Select a website package or support plan, submit a synthetic brief, and check the receipt on the form. Look for the corresponding notification in [the local Mailpit inbox](http://127.0.0.1:8025). The worker may deliver later if SMTP is temporarily unavailable.

Vite binds to port 5173 with strict port handling and proxies `/api` to Fastify on port 3001. The browser sends requests to the same origin. The proxy preserves the Origin header, and Fastify validates it against its exact allowlist. Both Vite and Fastify run with CORS disabled for this workflow. The built frontend also uses the same relative endpoint. Serving the built site and API behind a shared origin outside Vite development belongs to Phase 5.

## Request and receipt

`POST /api/v1/enquiries` accepts JSON in this shape.

```json
{
  "submissionId": "e6924fe5-d12c-47ca-a2e9-7f412914a264",
  "fullName": "Synthetic Example",
  "businessName": "Local Fixture",
  "contactInfo": "visitor@example.invalid",
  "offer": { "type": "website", "id": "business" },
  "description": "Synthetic project description.",
  "website": ""
}
```

`website` offers allow `business`, `starter`, `growth`, `pro`, and `custom`. `support` offers allow `care`, `support-growth`, and `automation`. The empty root-level `website` field is the existing honeypot. The previous `package` body property is retired. Existing `?package=...#contact` and `?plan=...#contact` links retain their category and selection behavior. The stored offer types, IDs, HMAC inputs, and migrations are unchanged. A Phase 3 submission can be retried using the new representation and the original UUID.

The form confirms receipt only for HTTP 202 with `accepted: true`, `status: "received"`, and the matching `submissionId`. The receipt reflects the PostgreSQL commit. Direct email and WhatsApp remain separate contact options.

The form disables submission while a request is in flight. A request times out after 15 seconds. A timeout, connection failure, or unrecognized response can follow an accepted submission, so the form explains the uncertainty and offers a retry. It keeps the UUID for the same normalized brief and assigns a new UUID to materially changed content. This memory lasts for the current page instance. Reloading or leaving the page loses it. Contact details are not written to browser storage or the URL. Field errors are associated with their inputs, the first invalid field receives focus, and receipt and retry feedback is announced through a live status region.

## Repeatable browser verification

Create a dedicated loopback database named `aevumstack_phase4_test` and run isolated Mailpit. Use a test database role that can create schemas. Keep Vite port 5173 and Fastify port 3001 free. Install the pinned test runner's Chromium if needed.

```sh
npx playwright install chromium
PHASE4_TEST_DATABASE_URL='postgres://test_user@127.0.0.1:5432/aevumstack_phase4_test' \
PHASE4_TEST_MAILPIT_SMTP_PORT=1025 PHASE4_TEST_MAILPIT_HTTP_PORT=8025 \
npm run test:integration
```

The suite starts Vite and the real backend processes, creates and removes an isolated schema, and checks PostgreSQL and Mailpit directly. It temporarily uses closed loopback ports to exercise database and SMTP connection failures. The timeout test forwards the browser's request to Fastify, observes the committed receipt, withholds the response from the browser, and advances the browser clock. Tests use synthetic inputs. The retained browser suite still runs via `npm run test:e2e` with an explicitly configured `BROWSER_PATH`.

The local rate limit is shared by visitors behind the development proxy and resets with the API process. Production hosting, public abuse controls, production SMTP, and retention remain separate decisions.
