# V2 SIGNAL — local review candidate

6 November 2026. Branch `design/v2-signal-integration`, based on verified V2 application `d85bcf18653a862b5f4fc54de3fc3aad42ee79b2`. Approved prototype: `93994cb64181f412f1878b548176ad1d7c01f668`. Stable V1 remains at `0da592f753759dca22d98c7b0f36bc9a03f80ade`. No push, merge or deployment.

## Design

The approved mineral-white editorial hero and carbon/steel connected illustration now lead a complete SIGNAL site. Original outlined SVG wordmarks and emblem are reused directly. All 18 prototype files are preserved byte-for-byte in `experiments/living-system`, outside the Vite public root.

- Carbon `#0B0D10`, steel `#192127`, mineral `#F3F0E8`, vermilion `#FF5C40`, mist `#AAB2B8`. Dark vermilion `#A02A18` provides accessible small accent text on mineral.
- Space Grotesk editorial headings, Inter body, system monospace labels. SVG branding is font-independent.
- Selected Work: genuine V1 screenshot, self-initiated project facts and a local engineering walkthrough. No invented clients or outcomes.
- Booking Desk: mineral visitor controls and carbon operator queue. Original selection, simulation, check-in and reset logic remains unchanged.
- Services: ruled capability index. Packages: tier comparison with native mobile disclosures. Support: horizontal rows. Prices, inclusions, IDs and URL semantics are unchanged.
- Process, value proposition and FAQ: ordered editorial layouts and native disclosure rows across alternating surfaces.
- Contact: mineral project brief, two desktop columns and mobile reflow. Contact TypeScript and API contract are unchanged.
- Footer/legal: approved outlined wordmark and mineral reading layouts. Legal main-content hashes remain identical to the approved baseline.

The signal runs only after activation, follows website → booking → automation, then stops after about 5.55 seconds. It cancels while hidden/offscreen and completes immediately under reduced motion. Without scripts, the illustration and real links remain visible; inactive demo controls are hidden. It makes no requests, bookings, storage writes or notifications. The Booking Desk remains a separate fictional simulation.

## Exact implementation scope

New active files:

- `frontend/src/signal.css`, `frontend/src/signal-site.css`, `frontend/src/signal.ts`
- `frontend/src/assets/signal-wordmark.svg`, `frontend/src/assets/signal-wordmark-light.svg`
- `frontend/src/assets/signal-mark.svg`, `frontend/src/assets/signal-mark-light.svg`
- `frontend/public/images/signal-social.png`
- `frontend/tests/parity/signal.spec.ts`
- `docs/v2-signal.md`

Modified files:

- `.gitignore`, `.test-qa.js`, `README.md`
- `backend/src/plugins/static-site.ts` — one exact public-image allowlist entry only
- `frontend/index.html`, `frontend/privacy/index.html`, `frontend/terms/index.html`
- `frontend/public/favicon.svg`, `frontend/public/favicon.png`
- `frontend/src/main.ts` — SIGNAL replaces the homepage chronograph initializer
- `frontend/tests/parity/site.spec.ts`, `frontend/tests/parity/v2.spec.ts`

Preserved approved design evidence added from the prototype commit:

- `experiments/living-system/README.md`
- `experiments/living-system/index.html`, `identity.html`, `style.css`, `system.js`, `verify.mjs`
- `experiments/living-system/assets/favicon.svg`, `mark-01.svg`, `mark-02.svg`, `mark-03.svg`, `wordmark.svg`, `wordmark-light.svg`
- `experiments/living-system/archive/violet-study/index.html`, `style.css`, `system.js`
- `experiments/living-system/previews/signal-1440.png`, `signal-390.png`, `signal-complete-1440.png`

No dependency/lockfile, contact/booking/navigation module, validation, migration, database, outbox, SMTP or Compose changes. Chronograph source/assets remain preserved. Scoped SIGNAL styles sit over the retained layout foundation.

## Executed verification

Node 26.13.0, pinned dependencies, Chromium and Playwright WebKit on macOS. All final results below exited **0**:

| Command/check | Actual result |
| --- | --- |
| `npm run build` | Vite multi-page and Fastify build passed |
| `npm run typecheck` | Frontend/backend passed |
| `npm test` with isolated native fixture variables | 60 static checks, 2 CSP tests, 151 metadata/link checks, 70 Vitest tests passed, including four native tests |
| `npm run test:links` | 151 passed |
| `npm run test:parity -- --browser=chromium` | 24 passed |
| `npm run test:parity -- --browser=webkit` | 24 passed |
| `npm run test:backend:native` | 4 passed against actual PostgreSQL 18.6 |
| `npm run test:integration` | 10 Chromium tests passed, including real website/support Mailpit submissions at 1440/768/390px |
| `npm run test:local-runtime` | 2 passed: same-origin serving, mail capture, restart, backup/restore and database outage |
| `npm run test:security` | Credential-pattern and built-content scan passed |
| `npm run audit:security` | 0 reported vulnerabilities |
| `git diff --check` | Passed |
| `npm run local:status -- --host` | API, database/schema, Mailpit HTTP and SMTP ready |

Fixtures use a new loopback PostgreSQL cluster and capture-only Mailpit, synthetic addresses and isolated databases/schemas. Runtime tests restore into a new disposable database and remove only their own archive/database. Docker's engine was unavailable during this run: no Docker recreation/volume test is claimed. The supported **host-mode** runtime and real native backup/restore were executed.

Integration checked offer type/ID, Origin through Vite, matching 202 receipts, one durable enquiry/job/capture, stopped-worker and SMTP outage recovery, database failure, wrong Origin, rate limiting, malformed receipts and retry after committed-but-withheld acknowledgement. Native tests covered simultaneous submissions/claims and stale ownership fencing. `received` means durable receipt, not email delivery. No external email was sent.

The final Fastify preview was independently exercised with website/business at 1440px and support/care at 390px: each verified a matching 202, one enquiry, one outbox job and one Mailpit capture. Identical UUID retries returned 202 without duplication.

### Corrections and initial failures

- Screenshot review found inherited purple control styles and contact grid spans; corrected.
- Legal CTAs and scheduled/checked-in badges inherited low-contrast colors; corrected with browser regression assertions.
- A new test initially matched both desktop/mobile CTAs; it now asserts both. Another assumed WebKit's scroll width equaled its viewport despite its scrollbar gutter; it now checks the intended no-overflow invariant. Final 24/24 runs passed after corrections. Initial failures remain in ignored logs.
- `local:status` without `--host` required Docker configuration; the correct host-mode command passed. A later preview restart safely refused occupied port 3000; inspection confirmed the existing owned preview was already running.

## Visual/accessibility/performance evidence

Ignored `artifacts/signal-final/` contains final full-page `home-1440.png`, `home-768.png`, `home-390.png`, 320/1920px edge captures, legal and completed-state screenshots, logs and JSON diagnostics. Full-page captures come from built Fastify serving, not a mock page.

All three routes were checked at 320/390/768/1440/1920px with no horizontal overflow. Browser tests cover 200% root-text reflow, skip links, menu focus isolation/restoration/Escape, offer history, disclosures, keyboard Booking Desk, receipt verification/draft preservation, reduced motion, unavailable fonts and JavaScript-disabled presentation.

Axe 4.11.1 WCAG A/AA checks found zero violations on all three routes at 390/1440px, plus five states: completed signal/scheduled booking, checked-in booking, client validation errors, mocked receipt presentation and open mobile menu. Axe injection used diagnostic-only CSP bypass; ordinary browser/security tests used actual CSP. This does not establish full WCAG conformance or screen-reader speech behavior.

Main JavaScript: **15.26 kB / 5.50 kB gzip**, versus V2's 13,074 / 4,853 bytes: roughly 2.2 kB raw growth, no new library. Compiled CSS: **83.84 kB / 15.28 kB gzip**, plus the preserved 37,050-byte public stylesheets. The scoped integration adds CSS; later consolidation could reduce duplication. Lazy V1 showcase remains unchanged. Social image: 38,222 bytes; favicon PNG: 2,953 bytes. Gzip measurements do not assert HTTP compression configuration.

Three local Chromium trials per profile, 1000px height, motion enabled: desktop 1440px LCP 224–260ms; mobile 390px at 4× CPU/150ms latency/1.6Mbit download LCP 644–660ms. Across approximately 5.8-second signal samples, main-thread task time was 229–306ms desktop and 122–193ms mobile; p95 frame intervals 16.7–16.8ms. Observed loading/sequence CLS: 0.004–0.0172. Some samples included one 53–124ms task. These workstation/emulation samples were taken during QA; they are not Lighthouse scores, field INP/Core Web Vitals or physical-device guarantees.

## Local review and preservation

Website: **http://127.0.0.1:3000**. Synthetic Mailpit: **http://127.0.0.1:64695**. PostgreSQL/SMTP: loopback-only 64693/64694. Actual listener bindings were verified. Use synthetic details only.

The worktree's ignored owner-only `.env.local-runtime` points to its new temporary native fixture. While those services run, reopen with Node 26 on PATH and `npm run local:host`; inspect with `npm run local:status -- --host`. Stop only the owned foreground runtime with Ctrl+C. For a durable setup follow `docs/phase5-local-operations.md`; do not overwrite an existing HMAC key/database configuration. A frontend-only view is `npm run build` then `npm run preview -- --host 127.0.0.1 --port 4186 --strictPort`; it has no API.

The original migration worktree and its uncommitted hero integration remain intact. No historical branch/worktree was reset or overwritten. The 18 prototype files and three directly reused vector assets were byte-compared. Preserved SHA-256 values:

- audit: `06da7a2efb73e9976e751afd907577522a3a35d2e0f54e4f24b6d6affec639b1`
- desktop: `2c924a9f00d27fef1f3f3396c974722f8020f064fb344b5f939fde2bced50ee3`
- mobile: `4619dcac5ddcbaa53384a306b06bae6bf12828ea2937fb368d7bba2e299c450a`
- original backup: `206dd2d7066b02cd19fc21949ca2e2b1dd765e8a441117bf7407bc8946c20d1d`

Firefox, physical devices, VoiceOver speech and OS text scaling were not executed. Mobile remains a long page because published offers/explanations are retained. Owner visual review remains appropriate. Public hosting, legal approval, retention and real SMTP delivery remain separate launch decisions. This candidate is local-only.
