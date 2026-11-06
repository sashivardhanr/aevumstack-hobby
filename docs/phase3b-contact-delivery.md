# Phase 3B — Vercel Functions + Resend contact delivery

Date: 5 November 2026 (Asia/Kolkata). Branch: `phase3/production-readiness`.

**Implementation status: locally implemented and tested; live delivery remains disabled and unverified.** No accounts, subscriptions, DNS changes, deployment, real enquiries, commits or pushes were made. Phase 3A's dependency versions, static Astro design and prior hardening are retained.

## Checkpoint

Before changing source, saved a checkpoint of 45 tracked/untracked source/config/documentation/assets files under `artifacts/phase3b/checkpoint/`:

- `phase3a-source.tar.gz`: complete source snapshot, including prior uncommitted Phase 3/3A work.
- `tracked-changes.patch`: binary-capable diff against the baseline for tracked files, excluding the three protected artifacts.
- `manifest.json`: base commit, branch, source hashes and protected-file hashes.

The archive excludes `audit-results.json`, `desktop-screenshot.png`, `mobile-screenshot.png`, ignored private environment files, dependencies and generated outputs. Git's index/refs were not modified. This is a local review/rollback checkpoint, **not a Git commit**. Restore only explicitly selected source files if needed; never use a blanket reset over user work.

## Architecture and Vercel routing

```text
Browser → same-origin POST /api/contact
        → method/media/origin/body/schema checks
        → Vercel-derived IP → atomic Redis attempt limits
        → Cloudflare Turnstile Siteverify (hostname + action)
        → atomic Redis UUID/payload claim + delivery budget
        → Resend POST /emails (stable idempotency key)
        → Redis acceptance record
        → { accepted: true, submissionId: <matching UUID> }
```

The site keeps `output: 'static'`, `dist`, the existing Astro preset, full `npm run build` and existing security headers. The new root `api/contact.js` exports Vercel's documented Node Web Standard `fetch` handler. Implementation helpers live outside the public API directory in `server/contact/`; Vercel's Node builder traces their relative imports. `vercel.json` adds only a 20-second maximum duration for this function (alongside formatting changes).

Vercel documents automatic functions from a root `api/` directory with static project builds; this does not require an Astro SSR adapter or an Astro route in `src/pages/api`. No catch-all rewrites, legacy `builds`, manual `.vercel/output`, or static API file are introduced. **Deploy the complete project through the existing Vercel project, not `dist` alone**. An upload containing only `dist` cannot contain the Node function. A future adapter/custom Build Output API configuration would need to include the API function explicitly and be reverified.

`npm run test:functions` checks source/config coexistence, imports the Web handler under the selected runtime, checks the disabled response and verifies all three static outputs remain present. Browser QA mounts the same core handler on its loopback server with delivery forcibly disabled. These checks verify local compatibility; **Vercel packaging, function tracing, actual routing, runtime headers and environment scopes still require a separately approved preview build**. No linked Vercel project credentials or platform build/deployment were used, and local checks are not presented as a deployed routing test.

Sources: [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js), [function configuration](https://vercel.com/docs/project-configuration/vercel-json), [supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Vercel request headers](https://vercel.com/docs/headers/request-headers).

## Server behavior

- POST only; other methods return 405 with `Allow: POST`. JSON with UTF-8 is supported; other content types/encodings return 415.
- Maximum JSON body is **32 KiB**, checked against advertised length and bytes actually read. Streaming body reads time out after 2 seconds. Invalid UTF-8, malformed JSON, arrays/null, unknown fields and unsupported package identifiers are rejected.
- Independently runs field validation on the server: name 100, business 160, contact 254 and brief 5,000 characters; required trimmed values; valid email/phone; package/support-plan allowlist; empty honeypot; no control-character/header or bidi-control injection. UUIDs must be canonical lowercase v4; bot tokens are bounded to 2,048 characters. Data is normalized before hashing/sending.
- Only the exact configured HTTPS origin and same-origin fetch context are accepted. The function additionally requires Vercel's runtime marker and a valid single IP from `x-vercel-forwarded-for`. It does not trust a client-selected UUID as a rate-limit identity and never falls back to arbitrary forwarding headers. Additional proxies may collapse traffic into a proxy IP; verify the actual path before activation rather than weaken the check.
- Every response is JSON, `no-store`, with MIME sniffing disabled. No permissive CORS policy is added. Errors use safe generic text, not upstream response bodies or request data.
- `CONTACT_DELIVERY_ENABLED` must be exactly `true`; every required server credential/configuration must also be present and structurally valid. Disabled, partial, invalid or non-Vercel configuration returns 503 before external calls. Redis, bot or provider failures also fail closed. No in-memory fallback or testing bypass is available in the deployed entry.
- API work has a 12-second outbound deadline. Individual security requests are bounded to 2.5 seconds and Resend to 6 seconds; lease cleanup is bounded to another second. Together with the body read and network latency, a client can still time out first; this is treated as uncertain receipt and retried safely using the same ID. Vercel's function maximum is 20 seconds.

### Resend adapter

Uses built-in Node `fetch`; no email SDK/dependency was added. It sends a readable **plain-text** message including name, business, email/phone, selected package, brief and submission reference. Sender and recipient are fixed server configuration, not request fields. Visitor email is used only as validated `reply_to`; phone-only submissions omit Reply-To. No HTML interpolation, attachment, auto-response, CRM copy or customer-content database is added.

A successful provider response must include a valid email ID without an error. Only then, after the Redis acceptance update succeeds, does the endpoint return the existing client contract. Cached acceptance comes only from a prior completed provider acceptance record.

The Resend key is `aevum-contact/<submission UUID>`. The email bytes remain stable across unchanged retries: no retry timestamp or bot token is included. A Redis fingerprint also binds the UUID to normalized content and fixed sender/recipient. A changed payload using an existing UUID returns 409. The frontend keeps its in-flight lock, stable retry UUID, accepted-content guard, preserved brief and truthful receipt messages.

**API acceptance is not confirmed Gmail inbox delivery.** This implementation has no delivery-status webhook. The final verification step must check the actual designated inbox and provider delivery log; until then the production delivery path remains unverified.

Source: [Resend sending API](https://resend.com/docs/api-reference/emails/send-email), [Resend idempotency semantics](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Spam, rate limits and duplicate handling

### Server-verified bot control

Uses an owner-configured **Invisible Cloudflare Turnstile** widget, executed only on a valid same-origin API submission. The public site key is build-time configuration; the secret stays in the function. Each attempt gets a fresh single-use token. The server calls Siteverify and requires `success: true`, the configured hostname, and action `contact`; trusting a client token's presence alone is insufficient. Token rejection/outage never sends an email.

An Invisible widget preserves the design. Configure the widget type in the Cloudflare dashboard; a Managed/visible widget can alter layout and is not the approved design here. The client loads the script only on demand, has bounded script/challenge timeouts, clears the widget, and displays an accessible error with the brief preserved if verification cannot complete. Cloudflare script/frame/connection permissions are included in CSP only when a public key is configured; no `unsafe-inline` or `unsafe-eval` is added. No widget key has been configured in the existing `.env`.

Sources: [widget behavior](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/), [server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [CSP requirements](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).

### Persistent limits and ledger

The Upstash Redis REST adapter executes atomic Lua scripts in one primary database shared by all function instances:

- **5 valid-schema attempts per IP per 15-minute fixed window**.
- **200 valid-schema attempts globally per hour**, protecting bot/email provider calls.
- **50 new submission IDs reserved per 24-hour fixed window**, after bot verification. Failed deliveries still consume the reservation; unchanged retries do not reserve another slot. This conservative budget leaves space beneath Resend's free-tier daily cap, but other applications sharing the account require their own total-budget planning.
- A **30-second owner-token lease** prevents concurrent function instances from sending the same ID simultaneously. A crashed function leaves a lease that expires; no permanent in-memory lock is needed.
- Accepted/unknown UUID records expire after **7 days**. Pending/unknown-outcome retries are allowed only within **20 hours** of first claim, below Resend's documented **24-hour** idempotency retention. After that, the same pending ID returns 409 instead of risking a second send.
- Within the seven-day ledger horizon, accepted IDs return the stored acceptance without sending again. This is bounded idempotency, **not a permanent exactly-once guarantee**. Reusing an ID after ledger expiry, or submitting different IDs, is not globally deduplicated; bot/IP/global limits still apply.

Redis stores only counters, submission UUIDs, timestamps/lease-owner IDs, and HMAC-SHA256 digests. Raw IPs, names, contact details, descriptions and bot tokens are not stored there. IP digest keys expire after 15 minutes; global attempt keys after one hour; budget keys after 24 hours. HMAC secret must be random and server-only. No API key, provider error or personal data is logged by application code.

Use persistent primary storage with atomic EVAL support, appropriate capacity and no intentional eviction of active records. Do not use a read-only token or an eventually consistent read replica as an alternative ledger. Storage outages fail closed. If records are lost/deleted, disable delivery and review outstanding submissions/provider keys before resuming; do not recreate an empty database and assume seven-day deduplication still holds. Rotating secrets or changing the email format/configuration during pending retries also needs care.

These controls limit accepted-schema requests and email abuse, not every volumetric attack reaching Vercel. Configure the existing project's firewall/traffic limits and spend alerts as appropriate. No new paid firewall feature has been activated. Shared IPs may hit a conservative limit; direct email remains available.

Source: [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi).

## Owner configuration — no values fabricated

### Vercel environment variables

| Variable | Scope | Required value/source |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | Public, build | Existing `https://aevumstack.dev` |
| `PUBLIC_FORM_ENDPOINT` | Public, build | `/api/contact`; explicit blank keeps the interim mail-draft fallback |
| `PUBLIC_TURNSTILE_SITE_KEY` | Public, build | Public key from the approved Invisible widget |
| `PUBLIC_CONTACT_EMAIL` | Public, build | Existing `aevumstack@gmail.com` |
| `PUBLIC_WHATSAPP_NUMBER` | Public, build | Existing verified number |
| `CONTACT_DELIVERY_ENABLED` | Private, runtime | Keep `false`; set `true` only for separately approved testing/activation |
| `CONTACT_ALLOWED_ORIGIN` | Private, runtime | Exact `https://aevumstack.dev`; isolated Preview uses its exact approved HTTPS origin |
| `CONTACT_FROM_EMAIL` | Private, runtime | Bare sender address in the Resend-verified domain/subdomain; not the Gmail address |
| `CONTACT_TO_EMAIL` | Private, runtime | `aevumstack@gmail.com` (or explicitly approved isolated Preview test inbox) |
| `RESEND_API_KEY` | Private, runtime | Restricted sending key from Resend |
| `TURNSTILE_SECRET_KEY` | Private, runtime | Secret paired with the widget site key |
| `UPSTASH_REDIS_REST_URL` | Private, runtime | HTTPS root endpoint of the approved primary `*.upstash.io` database |
| `UPSTASH_REDIS_REST_TOKEN` | Private, runtime | Credential permitting the required EVAL/counter/hash operations |
| `CONTACT_HASH_SECRET` | Private, runtime | At least 32 random characters, generated/stored privately |

Do not paste private keys into chat or source. An owner can generate the hash secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and copy it directly into the private Vercel variable. No actual hash secret was generated by this task. Vercel supplies `VERCEL=1` and the trusted forwarding header; do not fabricate these to bypass local restrictions. Use separate Preview/Production credentials and ledgers where practical; if sharing the same database, the fixed key prefix also shares quotas/retry records, so plan testing accordingly, and restrict variable scopes. Rebuild after changing public values.

The existing `.env` was not edited. Therefore its explicit empty form endpoint continues the old fallback locally; `.env.example` now documents `/api/contact` and disabled server configuration. A fresh setup points to the prepared API but cannot send until all security controls and explicit enablement are configured. `astro dev`/`astro preview` alone do not run root Vercel Functions; use unit mocks/local QA or a separately approved Vercel preview for endpoint testing.

### Accounts and DNS

1. **Resend:** owner creates/signs into an account, reviews pricing/retention/region and creates a sending-only key. Select a sending subdomain of `aevumstack.dev` and sender address; no sender address is invented here. Keep recipient `aevumstack@gmail.com`.
2. Add the sending subdomain to Resend. At the existing DNS provider, add the **exact DKIM TXT, SPF TXT and sending/return-path MX records displayed in that domain's Resend dashboard**. Record names, public keys, MX targets and priorities depend on the selected subdomain/region and cannot be supplied honestly before account setup. Confirm the domain shows verified. Review DMARC alignment/policy separately before changing it. Do not create duplicate SPF records or replace unrelated root MX records. Preserve the website's existing Vercel A/CNAME records. No DNS change is needed at Gmail.
3. **Cloudflare Turnstile:** owner creates an Invisible widget, restricts hostnames to the exact production hostname and any explicitly approved preview hostname, reviews privacy requirements, and copies the public/secret pair into the appropriate Vercel scopes. Turnstile does not require migrating nameservers or proxying the site through Cloudflare. Update the existing privacy notice to disclose this processing before activation.
4. **Upstash Redis:** owner creates/selects a persistent primary database near the chosen Vercel function region, reviews retention/availability/billing, verifies EVAL and expiry behavior, and supplies its HTTPS REST URL/write token. No database was registered or hosted data created by this task. Do not enable automatic paid upgrades without approval.
5. In the **existing Vercel project**, confirm repository root, Astro preset, `npm run build`, `dist`, Node **22.x with 22.23.4+**, function duration and environment scopes. `api/contact.js` must be packaged as a Node function alongside static pages. Keep the existing domain. Obtain approval for a Preview build/deployment; this task does not provide deployment permission.

### Costs and limits to review

The implementation adds no npm dependencies. It does require external security services as well as email delivery. Resend currently lists 3,000 emails/month and 100/day on Free; Pro starts at $20/month. [Resend pricing](https://resend.com/pricing).

Turnstile's Free plan supports Invisible widgets and unlimited challenges, with up to 20 widgets and 10 hostnames/widget. [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/).

Upstash lists a Free tier with 256 MB and 500K commands/month; pay-as-you-go lists $0.20/100K commands. Script/internal operations and plan limits must be reviewed in the dashboard. Free-tier availability is not an uptime guarantee. [Redis pricing](https://upstash.com/pricing/redis).

These are published limits checked on 5 November 2026, not a purchased plan or guaranteed future price. Existing Vercel commercial hosting costs/limits remain separate. No subscription, automatic upgrade or financial commitment was made.

## Verification results

Tested under **Node 22.23.4 / npm 10.9.9**, using the official Node archive verified against its published SHA-256 manifest. The package engine now selects `>=22.23.4 <23`, compatible with Vercel's supported Node 22 family and the patched Astro requirement. Actual Vercel runtime selection still needs checking in the dashboard/preview.

| Executed command/check | Exit | Result |
| --- | --- | --- |
| Checkpoint creation | 0 | 45 source files; protected artifacts/private environment excluded; no Git index/ref changes |
| `npm ci` | 0 | Clean install under Node 22; unchanged dependency versions |
| Standalone production build | 0 | 3 static routes plus security/SEO output |
| `npm test` | 0 | **68 regression checks**, **150 unit/integration tests**, **140 metadata/link/CSP checks**; zero failures |
| Full browser E2E | 0 | **113 checks passed**, zero failures; no unexpected console/JS/network errors |
| Standalone `npm run test:links` | 0 | 140 checks, zero failures |
| `npm run test:functions` | 0 | Function entry/config/static-output checks pass; not a deployed packaging test |
| `npm run test:security` | 0 | Scoped credential/deployment checks (59 files); server files included and server-only variable names absent from static output |
| Final `npm audit --json` | 0 | Zero vulnerabilities at all severities |
| `npm run test:redis` (local Redis 8.10.3, TCP disabled) | 0 | **23 real Lua/handler checks**, zero failures; no hosted account or real email |
| Full-page visual capture | 0 | Desktop/mobile captures of all 3 routes |
| Strict pixel comparison to Phase 3A | 1 | Three tiny raster differences; not byte-identical |
| Reviewed pixel comparison with one-level channel tolerance | 0 | All captured layout/style records match; at most 49 pixels differ in any image, each by one RGB level |
| `git diff --check` | 0 | No whitespace errors |
| Protected artifact SHA-256 comparison | 0 | All 3 protected files match checkpoint hashes |

Baseline counts **68 / 43 / 106 / 140** become **68 / 150 / 113 / 140**. All original tests remain. Added **105 server tests** and **2 conditional-CSP tests** (107 new tests), plus **7 browser checks**. The 23 optional Redis checks are separate from the default unit count and do not make a clean checkout depend on a local Redis installation.

Mocked tests cover methods/media types, wrong origins, untrusted IPs, missing/unsafe configuration, independent schema/UUID/package validation, malformed/oversized/slow bodies, provider acceptance/errors/timeout, cached acceptance, changed-payload conflicts, rate limits, bot signature/hostname/action, storage outages, concurrent claims, stable retry IDs, safe plain-text email/Reply-To and atomic REST command shapes. CSP tests finalize temporary build copies with a synthetic public key and a private canary; no key/service is activated or called.

For additional assurance, built official Redis **8.10.3** source in a temporary directory and executed the actual production Lua over a private Unix socket. Tests verify threshold/expiry behavior, daily budget, owner-token leases, crash recovery, concurrent rate/claim enforcement, accepted replay, 20-hour retry refusal, seven-day record expiry, and absence of enquiry content in the ledger. A concurrent full-handler test uses real Redis scripts with mocked bot/email adapters. The Redis process is terminated and synthetic data removed after each run. This verifies core Redis semantics; Upstash REST/network behavior, persistence and platform concurrency remain Preview configuration checks. Redis is not a new repository dependency.

Full-page visual comparison: home desktop/mobile and privacy desktop match pixel-for-pixel; terms desktop has 15 one-level pixel differences, privacy mobile has 49 one-level differences, and terms mobile matches. Captured text, geometry, font/color/animation/transition values and page dimensions match for all six images. This is the same explicit raster tolerance used in Phase 3A, not a claim of universally identical rendering. No widget runs in these unconfigured captures; the approved Invisible-widget configuration must be checked in Preview.

Diagnostic failures are reported rather than counted as passes: the local Python 3.9 extractor initially lacked the newer `filter` argument (corrected after checksum/path validation); the Redis download-directory request returned HTTP 403, so the official GitHub release source was used instead. One later E2E run returned exit 1 before producing a summary because the new probe used `URL` as a constructor even though the runner already named its base URL `URL`; changing the constructor reference to `globalThis.URL` fixed the runner. Final E2E returns exit 0 with 113/113 checks. The strict pixel check intentionally remains a documented exit 1 with the quantified one-level bound.

Evidence is saved under ignored `artifacts/phase3b/verification/`: build/test/E2E/security audit logs, local Redis verification, visual snapshots/comparison and changed-file manifest. The protected root QA outputs are never used as output paths.

## Modified files

Modified relative to the Phase 3A checkpoint (12 files):

- `.env.example`
- `README.md`
- `docs/contact-delivery.md`
- `package-lock.json`
- `package.json`
- `qa-audit.js`
- `scripts/config.mjs`
- `scripts/finalize-build.mjs`
- `scripts/run-e2e.mjs`
- `scripts/security-check.mjs`
- `src/components/Contact.astro`
- `vercel.json`

New files (14):

- `api/contact.js`
- `docs/phase3b-contact-delivery.md`
- `scripts/check-functions.mjs`
- `scripts/test-contact-redis.mjs`
- `server/contact/config.mjs`
- `server/contact/handler.mjs`
- `server/contact/http.mjs`
- `server/contact/redis.mjs`
- `server/contact/resend.mjs`
- `server/contact/turnstile.mjs`
- `server/contact/validation.mjs`
- `src/turnstile.mjs`
- `tests/contact-csp.test.mjs`
- `tests/contact-server.test.mjs`

No dependencies were added or upgraded. `package-lock.json` only updates the Node engine constraint. Existing Phase 3/3A changes remain uncommitted; the dirty protected root artifacts shown in Git status are pre-existing user changes, not Phase 3B output.

## Production verification checklist — owner action required

- [ ] Review this implementation and checkpoint; approve provider accounts/terms, privacy disclosures and any charges separately.
- [ ] Configure Resend sender/domain DNS and verify it; configure the Invisible Turnstile widget and persistent Redis primary. Keep delivery disabled.
- [ ] Set scoped private/public variables in the existing Vercel project; confirm supported Node 22 runtime and function packaging from the full repository.
- [ ] Approve a Preview deployment and inspect `/api/contact`: GET → 405; disabled POST/JSON → 503, no external calls; confirm static pages and legal routes still render and no private configuration is in downloaded HTML/JS.
- [ ] With explicit approval for testing, configure exact preview origin/widget hostname and enable delivery in Preview. Verify actual Vercel IP header, CSP/widget behavior and Redis atomic scripts, persistence/TTL/rate thresholds across concurrent function instances. Confirm cross-origin, missing/expired token, malformed/oversized JSON and outages cannot send mail. Avoid flooding services.
- [ ] Approve **one labelled synthetic enquiry**. Confirm one Resend API/email record and **one email received in `aevumstack@gmail.com`**, matching the reference/content; inspect spam and provider delivery logs. A returned ID/2xx alone is insufficient.
- [ ] With approval, retry the same UUID/content and verify there is no second email; verify concurrent/in-flight retries and differing-content conflict, using mocks where real traffic is unnecessary. Do not intentionally exhaust paid/provider quotas.
- [ ] Assign an owner for provider failures, bounces/spam, rate/storage errors, quota/spend alerts and customer deletion requests. The application does not implement delivery/bounce webhooks in this phase.
- [ ] Finalize legal placeholders/processor disclosures and retention/deletion procedures. Re-run tests/security audit after any configuration/code adjustment.
- [ ] Obtain separate approval for production deployment and for setting `CONTACT_DELIVERY_ENABLED=true` in Production. Preserve a rollback to disabled delivery/direct contact channels.

**Readiness assessment:** all independent implementation checks pass; the implementation is prepared for owner configuration and preview verification. It is not activated and must not be described as verified production inbox delivery. External accounts, DNS, platform packaging and actual delivery remain the explicit outstanding steps.
