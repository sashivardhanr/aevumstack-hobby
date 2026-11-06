# AEVUM STACK V2 — Precision in Motion

Local review candidate, 6 November 2026. Branch `design/v2-premium`, based exactly on approved V1 `0da592f753759dca22d98c7b0f36bc9a03f80ade`. The later author-only V1 commit remains on `migration/v1-final-closeout`. No push, merge or public deployment is part of this work.

## Art direction

A considered engineering studio, expressed through large editorial typography, instrument markings, open layouts and alternating obsidian and porcelain surfaces. The chronograph connects the studio identity to precision without continuous animation or a new rendering library.

The current [Resend](https://resend.com/) and [Formspree](https://formspree.io/) homepages were inspected in Chromium. Resend combines spacious type and a tangible technical object; Formspree gives its demonstration a large, immediate role. V2 takes the principles of restraint and demonstrated capability, with original composition and AEVUM STACK content. No competitor images, markup, testimonials or claims were copied.

- Navigation: compact wordmark, persistent rail, iris project action, typographic mobile drawer with existing focus isolation.
- Hero: oversized Space Grotesk with a restrained Georgia italic phrase, useful offering copy and two clear actions. The instrument has reference markings and an iris scale; mobile uses a compact static presentation.
- Selected Work: porcelain gallery, a large actual V1 homepage capture, explicit self-initiated label, and a three-part build walkthrough. The image was captured from approved V1 before editing; it is not a fictional customer case study.
- Booking Desk: a light visitor workspace beside a dark operator queue. Synthetic-only labels remain prominent. State, reset and check-in logic is unchanged.
- Services: numbered horizontal editorial rows rather than another card grid.
- Offers: aligned website-package columns and a lighter support comparison; all prices, inclusions, IDs and selection links remain. Native disclosures keep the page manageable on mobile.
- Process: connected sequence of numbered steps. Value proposition: an asymmetric introduction with compact supporting points.
- FAQ: open rows on porcelain with native disclosure controls. Contact: a large invitation beside a restrained form with accessible error and receipt states.
- Footer: oversized typographic signature, useful navigation and direct contact channels.
- Legal pages: porcelain reading surface, improved heading scale, open sections and the shared header/footer. Automated hashes confirm unchanged main-content text, excluding decorative icons.

## Tokens and implementation

| Role | Value |
| --- | --- |
| Obsidian | `#101114` |
| Graphite | `#191a20` |
| Warm porcelain | `#f1efe9` |
| Titanium | `#a7a8b4` |
| Iris on dark | `#b7a3ff` |
| Ink on light | `#222329` |
| Accessible action on light | `#5b3ab3` |
| Layout | 1280px content grid; fluid 22–80px gutters |
| Typography | Existing Space Grotesk and Inter; system monospace labels; system Georgia italic emphasis |
| Components | 3–6px radii, thin rules, visible focus, minimum 44px principal controls |

`frontend/src/v2.css` owns the V2 visual layer and is compiled/fingerprinted by Vite. Existing utilities and scoped attributes remain underneath to preserve behavioral/layout hooks. No dependencies or JavaScript were added. Material Symbols were replaced with decorative inline SVG, removing that font request.

Motion is a short hero entrance, button response and a small showcase hover lift. The existing bounded pointer chronograph remains desktop-only and stops offscreen/hidden; touch and reduced-motion states are static. V2 suppresses animation, transitions and smooth scrolling for reduced motion. Content is available without animation or JavaScript; direct contact and native disclosures remain usable.

## Exact changed files

- `frontend/index.html`: complete V2 composition, semantic classes, new project image, editorial headings and fixed SVG decoration. The offer and form contract is unchanged.
- `frontend/privacy/index.html`, `frontend/terms/index.html`: shared V2 presentation, icons and stylesheet; approved legal text preserved.
- `frontend/src/v2.css`: responsive visual system.
- `frontend/public/images/studio-v1.png`: truthful V1 studio screenshot, 1200×740, 103,391 bytes.
- `backend/src/plugins/static-site.ts`: one explicit public asset entry for the new screenshot. No broader directory serving or private-file exposure.
- `frontend/tests/parity/v2.spec.ts`: seven added behavior tests covering legal text preservation, image serving, layouts at 320/390/768/1440/1920px, enlarged-text reflow and JavaScript-disabled use.
- `docs/v2-premium.md`: design, verification and review instructions.

The contact, booking, navigation and chronograph TypeScript modules, database migrations, outbox, validation, SMTP configuration, dependency manifests, original styles and original assets are unchanged. Most HTML diff lines also reflect formatting the previously compressed markup at element boundaries.

## Browser review and corrections

Actual screenshots are in ignored `artifacts/v2/`: `home-1440.png`, `home-768.png`, `home-390.png`, matching `privacy-*` and `terms-*`, and first-fold `fold-*` captures. Original V1 references are under `artifacts/v2/before/`. Component captures include services, packages, support, contact and selected work. Captures used a consistent 960px viewport height and loaded the existing web fonts. Final review confirmed a coherent dark/light rhythm, aligned pricing and visible mobile actions. No horizontal overflow was observed at the requested widths or the 320/1920px edges.

Corrections made from real failures:

1. Fastify correctly refused the initially unlisted new assets. CSS now uses the existing Vite manifest route; the screenshot has one explicit allowlist entry. Private/obsolete-route tests still pass.
2. Inherited V1 pink/white colors on new light surfaces were replaced by the appropriate theme tokens. Legal CTA/footer contrast findings were fixed.
3. Recommended badges originally offset comparison rows; their positions and description heights now keep offer prices aligned.
4. The footer email address and legal links overflowed at 200% root text size. They now wrap; the original integration test and a new regression pass.
5. The new no-JavaScript assertion initially used Playwright's text matcher, which excludes `noscript`. The test now verifies its visible paragraph and DOM text directly; the fallback was present in the application.

## Executed verification

Node 26.13.0, pinned installed dependencies, local macOS. All final commands below exited 0.

| Command/check | Actual result |
| --- | --- |
| `npm run build` | Vite three-page build and backend TypeScript build passed |
| `npm run typecheck` | Frontend and backend passed |
| `npm test` | 59 static QA; 2 CSP tests; 157 metadata/link checks; 66 Vitest passed, 4 native tests skipped in ordinary run |
| `npm run test:links` | 157 passed |
| `npm run test:security` | Credential-pattern and public output checks passed; not a full secret/history audit |
| `npm run audit:security` | 0 reported vulnerabilities |
| `npm run test:e2e` | Build plus Chromium: 17 passed |
| `npm run test:parity -- --browser=chromium` | Existing ten tests passed before adding seven V2 tests; final standard E2E runs all 17 |
| `npm run test:parity -- --browser=webkit` | 17 passed |
| `npm run test:backend:native` | 4 passed against native PostgreSQL; closes the ordinary suite's four opt-in skips |
| `npm run test:integration` | Chromium: 10 passed |
| `npm run test:integration -- --browser=webkit` | WebKit: 10 passed |
| axe-core 4.11.1, WCAG 2 A/AA, 2.1 AA and 2.2 AA tags | 0 reported violations on each of three pages at 390, 768 and 1440px; diagnostic context permits local audit script injection; application CSP is independently tested |
| Legal text comparison | Both main-content hashes equal the approved V1 snapshot |
| `git diff --check` | Passed |

Integration used freshly created disposable PostgreSQL 18.6 and Mailpit 1.33.0 containers, published only on 127.0.0.1 ports 25432, 21025 and 28025. PostgreSQL used a temporary in-memory mount, not an existing volume. Tests created isolated schemas and synthetic data; fixture containers were stopped and removed afterward. Existing containers and volumes were not manipulated.

Both website and support selections produced matching real HTTP 202 receipts, durable enquiry/outbox records and actual Mailpit captures at all three widths in both browser engines. Tests also exercised wrong Origin, validation, unavailable DB, stopped worker, SMTP outage/recovery, rate limiting, malformed receipts, and retry after committed-but-withheld acknowledgement. Native tests checked concurrent submissions/claims and stale lease ownership. No real or external email was sent. `received` remains a database acceptance state, not email-delivery confirmation.

An additional built-site smoke test uses the review preview on port 3180 and verifies one website and one support enquiry, one row/job/capture each, through Fastify static serving without Vite's proxy.

## Performance

Production JavaScript remains **13,074 bytes raw / 4,853 gzip**, identical byte size to V1. The V2 CSS bundle adds **24,564 raw / 5,737 gzip** bytes to the preserved 37,050 bytes of existing CSS. The showcase adds a lazy-loaded 103,391-byte PNG with explicit dimensions. No JS or animation library was added. Gzip figures are local compression measurements, not a statement that Fastify negotiates compression.

Three cold Chromium trials per profile, loopback preview, external font requests blocked for repeatability, reduced motion. Desktop 1440×960: LCP 48–52ms, load 43.9–47.8ms, no observed initial layout shift or >=50ms task. Mobile 390×960 with 4× CPU slowdown, 150ms latency, 1.6Mbit/s download and 0.75Mbit/s upload: LCP 600–612ms, load 623.8–630.5ms, CLS 0, one long task per sample. Sampled p95 frame interval after FAQ interaction: 16.7–16.8ms. These local measurements are not Lighthouse scores, field INP, mobile hardware certification or production Core Web Vitals. Visual captures separately include real font loading.

## Review preview and reproduction

The running full V2 preview is [http://127.0.0.1:3180](http://127.0.0.1:3180), with separate synthetic Mailpit at [http://127.0.0.1:28026](http://127.0.0.1:28026). It uses new disposable `aevum-v2-preview-*` containers and an in-memory database; use synthetic details only. Its launch session owns API/worker/container shutdown. V1 on 3000 and its preserved volume remain independent.

For normal reproducible operation after reviewing/stopping any existing local app session, use the repository's documented Node 26, Docker and ignored local environment configuration, then `npm run local:up`. This builds and serves the branch at 127.0.0.1:3000. `npm run local:down` preserves its named volume. Do not run `down -v`. A frontend-only inspection is available with `npm run build` then `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`; that visual preview has no API and correctly cannot accept enquiries.

Integration reproduction uses the existing guides with `PHASE4_TEST_DATABASE_URL` pointing to a dedicated loopback `aevumstack_phase4_test`, `PHASE4_TEST_MAILPIT_SMTP_PORT` and `PHASE4_TEST_MAILPIT_HTTP_PORT`. Native tests similarly require the documented three `PHASE3_TEST_*` settings and dedicated database. No private values belong in tracked files. Local evidence/scripts for this run are in `artifacts/v2/` and `/private/tmp/aevum-v2-*`.

## Preservation and remaining limitations

Protected root QA hashes were checked against the prior record: audit `06da7a2efb73e9976e751afd907577522a3a35d2e0f54e4f24b6d6affec639b1`, desktop `2c924a9f00d27fef1f3f3396c974722f8020f064fb344b5f939fde2bced50ee3`, mobile `4619dcac5ddcbaa53384a306b06bae6bf12828ea2937fb368d7bba2e299c450a`. The preserved backup remains `206dd2d7066b02cd19fc21949ca2e2b1dd765e8a441117bf7407bc8946c20d1d`. Original worktrees, V1 branches, reports and volumes remain available.

Firefox was not executed in this phase; its previously recorded environment launch failure remains unresolved. VoiceOver speech, physical Android/iOS devices and OS-level text scaling remain unverified. Automated accessibility plus keyboard/reflow checks are not a WCAG certification. Browser zoom/text-scale support still deserves physical-device review. A measured mobile long task and external font loading remain performance considerations, not demonstrated workflow failures.

This candidate intentionally retains the V1 CSS underneath a semantic V2 layer. A future measured cleanup could reduce redundant CSS after visual approval; it is not required for correctness. Credibility currently rests on one real studio self-project and one clearly fictional demo; more genuine project material would strengthen the portfolio. Native disclosures provide compact package scope rather than an always-expanded comparison table. Legal draft notices, dates and wording were preserved and still need owner/legal review before public use. Hosting, production SMTP, public abuse controls, retention and real business identity remain separate launch decisions.

**Recommendation:** Ready for owner visual review as a locally verified V2 candidate. Do not merge or publish until that review is accepted.
