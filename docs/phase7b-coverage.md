# Phase 7B — Legacy coverage migration

Baseline: 3d60b8dc609ec4a2076c6e1e538cc0859ec4aa8e on migration/phase6-quality-security. Verification branch: migration/phase7-coverage. The original remote is sashivardhanr/aevumstack-complete. The historical main worktree at 3fc8c26 and the original design worktrees were preserved. Phase 7A is the path inventory for the next phase.

## Coverage map

| Legacy evidence | Classification and target evidence |
| --- | --- |
| .test-qa.js page, branding, price, offer, legal and metadata sentinels | **Preserve.** Still protects the Vite build. The clock assertion now checks the built asset. The source-string check against Header.astro is replaced by browser focus and inert-state assertions. The old copied validation and selection checks remain in this phase. Active validator and Playwright tests exercise those behaviors directly. |
| qa-audit.js routes, assets, desktop/mobile navigation, hero and footer CTAs, history, FAQ, and offer disclosures | **Replaced.** The built-site Playwright suite loads and refreshes all three routes at 390, 768, and 1440 px. It checks overflow, skip focus, menu and background isolation, focus wrapping/restoration, link destinations, all package and support CTA choices, custom query selection, invalid or wrong-category queries, Back/Forward with a live draft, refresh of the selected offer, all eight FAQs, and narrow-layout plan disclosures. |
| qa-audit.js Booking Desk and presentation | **Replaced.** Keyboard selects and confirms a synthetic slot. Touch checks in and resets. The test checks the queue, selection changes, reset, reload, and absence of network requests, navigation, or local/session storage and cookie writes during the simulation. Desktop pointer enhancement, reduced motion, narrow-width fallback and screenshots have dedicated assertions. |
| qa-audit.js contact UX and tests/contact.test.mjs | **Already covered and extended.** The active Vitest validator accepts representative email and phone formats and rejects invalid boundaries. The built-site browser suite verifies focus, honeypot, programmatic length limits, the fixed endpoint, wrong receipt IDs, HTML responses, 503, 429, offline draft preservation, retry UUID reuse, concurrent and repeated submission suppression, materially changed content, and no contact values in URLs or storage. The native integration suite proves that a receipt can be lost after a real commit and verifies the ensuing retry against PostgreSQL. |
| qa-audit.js Astro page-load event, retired route probe, scripts/check-functions.mjs, tests/config.test.mjs and scripts/test-contact-cookies.mjs | **Obsolete contract.** The active frontend boots through its Vite entry, posts to a fixed same-origin endpoint, and serves from Fastify. It does not use Astro page transitions, configurable receivers, or Vercel Preview cookies. The fixed-endpoint unit/browser checks and built static boundary test remain. |
| tests/contact-server.test.mjs and scripts/test-contact-redis.mjs | **Active behavior replaced.** The new Vitest tests use a real TCP listener, request bytes and PostgreSQL semantics via PGlite. Native PostgreSQL tests cover the transactional and concurrency semantics with separate connections. The browser integration tests exercise a real unavailable database, a stopped worker and SMTP outage. Resend acceptance, Turnstile challenge verification, Redis Lua and Vercel forwarding are **obsolete contracts**. |
| tests/contact-csp.test.mjs, scripts/check-site.mjs, scripts/security-check.mjs | **Preserve.** They protect the active build. The Vite integration suite still creates a synthetic backup outside the frontend and verifies /@fs refuses it. The parity suite checks that built Fastify does not serve environment files, source, backups, private build metadata or either method of the old /api/contact route. |

Reload verifies the selected offer from the URL. Draft preservation is tested across same-document history and failed sends. Persisting enquiry drafts across a full reload is outside the app contract. Browser parity uses the actual built Fastify site and intercepts contact POST responses only for UI scenarios. Full persistence and Mailpit tests are separate.

## Wire behavior and fixes

| Case | Observed baseline or retained behavior | Verified result |
| --- | --- | --- |
| Invalid UTF-8 inside otherwise valid JSON | Fastify decoded the invalid byte to a replacement character and accepted it. This could silently change stored data and its identity. | Strict UTF-8 decoding returns safe 400 before persistence. A valid multibyte character split across writes is accepted. Fastify retains its bounded buffering and secure JSON parser. |
| Unsupported request compression | Gzip bytes returned 400. Valid JSON falsely labeled gzip could be accepted. | The API accepts absent or identity content encoding and rejects unsupported encodings with safe 415 before parsing. |
| Incomplete request body | The wire client timed out at seven seconds without a response. | A five-second enquiry body deadline returns safe 408 and closes the connection. This deadline covers body ingestion, separately from database work. Liveness stays available. |
| Fixed-length and chunked oversized JSON | The current 32 KiB Fastify policy already rejected both, independently of the legacy function's rules. | Both return 413. |
| Malformed JSON, unsupported content type and foreign Origin | Active Fastify already owns these policies. | Safe 400, 415 and 403 respectively. A foreign Origin is rejected before parsing. |
| Rate limits, UUIDs, persistence | Active Fastify and PostgreSQL replace the legacy forwarded-IP and hosted ledger model. | A changed forwarded address does not evade 429. Equivalent normalized UTF-8 submissions share a durable receipt and one outbox record. Changed content with the same UUID returns 409. |
| Unknown/private paths and database outage | Fastify owns these boundaries. | Generic no-store 404 on the tested private and obsolete routes. Native browser integration verifies a safe 503 for unavailable PostgreSQL with no false receipt. |

The first Chromium parity run exposed three incorrect selectors in the new tests (a homepage logo fragment and two distinct Start a Project links). The selectors were corrected. These were fixture errors. No homepage, legal copy, design or application frontend source was edited. Privacy still describes the old draft and webhook options. Its factual correction remains separate and requires owner approval.

## Reproduction

Install the pinned dependencies and Playwright Chromium/WebKit under Node 26. From the repository root:

~~~sh
npm ci
npm run build
npm run typecheck
npm test
npm run test:parity -- --browser=chromium
npm run test:parity -- --browser=webkit
npm run test:links
npm run test:security
npm run audit:security
~~~

Parity uses port 3177 and a deliberately unusable loopback database URL. It does not need PostgreSQL, Mailpit or Docker. It writes to ignored artifacts/phase7-parity unless --output is provided. Use a different output directory for each engine if retaining both captures. The ordinary test:e2e command still runs the legacy suite using an installed Chromium executable via BROWSER_PATH and writes under TEST_ARTIFACT_DIR when set.

For native verification, follow the Phase 3–5 guides. This run used its own Compose project, aevumstack-phase7b, on loopback PostgreSQL 27432, SMTP 23025 and Mailpit HTTP 30025. It created the dedicated aevumstack_phase3_test, aevumstack_phase4_test and aevumstack_phase5_test fixture databases. Set each suite's PHASE3_TEST_*, PHASE4_TEST_* or PHASE5_TEST_* variables for those isolated services. Set PHASE3_REQUIRE_NATIVE=1 for npm test to require native coverage. Run npm run test:backend:native, npm run test:integration and npm run test:local-runtime. Pass -- --browser=webkit for the WebKit variants. The built local-runtime suite uses pg_dump and pg_restore on PATH and a disposable restore database.

## Results

| Command | Result |
| --- | --- |
| npm ci | Exit 0, 147 packages installed. npm noted two optional install scripts outside the current allowlist. |
| npm run build and npm run typecheck | Exit 0 each. |
| npm test with PHASE3_REQUIRE_NATIVE=1 | Exit 0. 67 static QA checks, 158 Node tests, 152 metadata/link/CSP checks and 67 Vitest tests. |
| Targeted Vitest app.test.ts | Exit 0 after the fixes, 26 tests. The baseline exposed the four expected failures across encoding, decoding, and incomplete bodies. |
| npm run test:backend:native | Exit 0, 4 native PostgreSQL tests. |
| npm run test:integration | Exit 0 in Chromium and WebKit, 10 tests each. Includes actual Vite /@fs denial and Mailpit capture. |
| npm run test:local-runtime | Exit 0 in Chromium and WebKit, 2 tests each, including restart and backup/restore. |
| npm run test:links | Exit 0, 152 checks. |
| npm run test:security and npm run audit:security | Exit 0 each. npm reported zero advisories. |
| Final shared-build comparison | Exit 0 for parity (10 each in Chromium and WebKit) and legacy E2E (122 checks and 3 cookie checks). Native fixture containers were stopped and the SHA-256 inventory of dist matched before and after. |
| npm run test:functions and npm run test:redis | Exit 0 each. Function source/config check and 23 Redis checks passed. Redis used a fresh Unix socket and no hosted services. |
| Firefox retry | Exit 1. Firefox exited before navigation with “Could not find profile folder”. |

VoiceOver speech, physical-device behavior, and OS text scaling remain documented local-V1 limitations. Browser touch emulation and WebKit engine coverage are the evidence for the tested interactions. Browser output and command logs for this run are in /private/tmp/aevum-phase7b-JYkANb. The original QA artifact and Phase 5 backup hashes matched before and after. The preserved volumes were not mounted in the fixture stack. The fixture stack was stopped with its volume intact.

## Phase 7C handoff

The following exact paths can leave active source after Phase 7C updates their callers and verifies the post-removal build and tests:

- Astro configuration and layout: astro.config.mjs, tailwind.config.mjs, src/styles/global.css, src/layouts/Layout.astro, src/pages/index.astro, src/pages/privacy.astro, src/pages/terms.astro.
- Astro components: src/components/BookingDemo.astro, src/components/ChronographEnhancement.astro, src/components/Contact.astro, src/components/Faq.astro, src/components/Footer.astro, src/components/Header.astro, src/components/Hero.astro, src/components/HowItWorks.astro, src/components/PackageCard.astro, src/components/Packages.astro, src/components/PlanDetails.astro, src/components/SelectedWork.astro, src/components/Services.astro, src/components/SupportCard.astro, src/components/SupportPlans.astro, src/components/WhyChooseUs.astro.
- Duplicated assets: public/favicon.png, public/favicon.svg, public/images/aevum-clock-logo.png.
- Legacy delivery: api/contact.js, vercel.json, src/contact.mjs, src/turnstile.mjs, frontend/src/turnstile.ts, scripts/config.mjs, server/contact/config.mjs, server/contact/handler.mjs, server/contact/http.mjs, server/contact/redis.mjs, server/contact/resend.mjs, server/contact/turnstile.mjs, server/contact/validation.mjs.
- Retired runners and provider tests: qa-audit.js, scripts/run-e2e.mjs, scripts/check-functions.mjs, scripts/test-contact-cookies.mjs, scripts/test-contact-redis.mjs, tests/config.test.mjs, tests/contact.test.mjs, tests/contact-server.test.mjs.

Phase 7C still needs the mechanical package-script, lockfile, README, environment example and security-scanner updates from the approved manifest. Keep tests/contact-csp.test.mjs wired into npm test. Keep test:parity available without a native stack, and keep integration and local-runtime commands distinct. Preserve the active data-astro-cid attributes paired with the shipped CSS and keep the active metadata finalizer. Obtain owner approval before editing Privacy wording. Phase 7B contains no retirement deletions, lockfile removals, pushes or deployment changes.
