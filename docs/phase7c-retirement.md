# Phase 7C — V1 migration closure

The retirement branch is `migration/phase7-retirement», based on `23c04d08e3347840fc24c574b93de70917b69b2e» from `migration/phase7-coverage». The repository is the local migration checkout for `sashivardhanr/aevumstack-complete». Phase 7A supplies the approved scope and the Phase 7B report maps each legacy behavior to its replacement. [Phase 7B coverage](phase7b-coverage.md) · [Phase 6 QA](phase6-quality-security.md)

## Prerequisite gate

Before removal, `npm ci», `npm run build», `npm run typecheck», and `npm test» exited 0. The full suite ran with native fixtures required and passed 67 static checks, 158 Node tests, 152 metadata/link checks and 67 Vitest tests. The standalone CSP regression passed 2 tests, and the security scan passed. The legacy Chromium runner passed 122 browser and 3 cookie checks. Playwright parity passed 10 tests each in Chromium and WebKit, and native Chromium integration passed 10. The SHA-256 inventory of every file in `dist/» matched before and after both browser runners.

## Retirement and retained behavior

`test:e2e» now builds and runs Playwright parity. The parity command can reuse an existing build and requires only the browser and local Fastify listener. Native integration and local-runtime commands retain their separate synthetic PostgreSQL and Mailpit requirements. The first post-removal E2E invocation with `--output» failed because nested npm consumed the option. Adding the argument separator restored forwarding. Both the bare command and the command with an explicit output directory passed.

`.test-qa.js» retains branding, prices, offer routes, default selection, built assets, metadata, and legal-content checks. Vitest and Playwright cover the copied validator and selector logic that was removed. `npm test» names `tests/contact-csp.test.mjs» explicitly. The security scanner covers tracked files and active source, including TypeScript, and scans the built tree for credentials, server setting names and private output paths. The deliberate legacy names in its denylist and the CSP canaries continue to protect against leaks.

The package and lockfile remove the direct `puppeteer-core» dependency and its orphaned entries for `@puppeteer/browsers», `chromium-bidi», `devtools-protocol», `mitt», `modern-tar», `string-width», `typed-query-selector», `webdriver-bidi-protocol», `ws», and `yargs». Vite's own PostCSS dependency remains. The active build uses the same finalizer, generated CSP, manifest and SEO files. The obsolete provider and configurable endpoint environment examples are gone. README documents the supported loopback setup, development workflow, test fixtures, and recovery.

The committed modifications are `.env.example», `.test-qa.js», `README.md», `package.json», `package-lock.json», and `scripts/security-check.mjs». This report is the only new tracked file. Active website HTML, CSS, images, contact implementation, Fastify source, Compose configuration and migrations match the starting commit.

## Final verification

| Check | Result |
| --- | --- |
| Post-removal npm ci, build, and typecheck | Exit 0. |
| npm test with native fixtures required | Exit 0. 52 static checks, 2 Node CSP tests, 152 metadata/link checks and 67 Vitest tests. |
| test:links, test:security, and audit:security | Exit 0. 152 metadata/link checks, credential and output scan passed, npm reported zero vulnerabilities. Synthetic private-output and frontend credential canaries were rejected in the fresh tree. |
| test:parity and test:e2e | Chromium and WebKit parity passed 10 each. Standard E2E passed 10 on Chromium. Both default and explicit artifact paths worked. |
| Native PostgreSQL and browser integration | 4 native tests. Chromium and WebKit passed 10 integration tests each. Both offer categories produced matching durable receipts and Mailpit captures. Coverage includes duplicate suppression, safe retry, service failures and Vite backup path denial. |
| Local runtime | Chromium and WebKit passed 2 each, covering built same-origin serving, restart, backup/restore and private-file boundaries. |
| Isolated Compose recovery | Two synthetic enquiries produced two durable outbox jobs and one Mailpit capture each. PostgreSQL restart and container recreation preserved the rows and sent state on the same volume. A replay created no new job or message. A custom PostgreSQL archive restored into a separate database with matching enquiry, outbox and migration rows. |
| Fresh staged-tree export | npm ci, build, typecheck, npm test, security scan, HTTP smoke and bare E2E passed in a fresh directory. The 4 opt-in native cases were skipped in that export and passed in the isolated native run. |
| Visual and asset parity | Every built static file matched the pre-removal SHA-256 inventory. All six homepage image comparisons were pixel-identical across Chromium and WebKit at 390, 768 and 1440 px. Privacy and Terms also load and refresh on both engines. |
| Firefox retry | Exit 1. Firefox exited before navigation with “Could not find profile folder”. |

Fixture logs and screenshots are in `/private/tmp/aevum-phase7c-KiXrdQ». The run used a separate Compose project and named volume with loopback PostgreSQL on 28432, SMTP on 24025 and Mailpit HTTP on 31025. The recovery run used the built Fastify API and worker against that Compose stack. The two browser local-runtime suites also exercised the shipped backup and restore commands. The initial recovery harness tried to stop the worker before it signaled readiness after restart. The corrected harness awaited that signal and passed with a fresh synthetic database. The fixture stack was stopped with its volume retained.

## Historical evidence and release boundary

The recorded hashes of the three original QA artifacts and the Phase 5 backup matched before and after. The historical main and original design worktrees retain their starting commits. Existing edits, including the original motion worktree’s Vercel configuration edit, were left in place. All preexisting Docker volumes remain present. The duplicate public assets matched the active frontend copies before removal. `git diff --check» passed and the 47 tracked deletions matched the approved manifest exactly.

Recommend acceptance of the local V1 architecture migration. VoiceOver speech, physical-device behavior, and OS text scaling remain unverified. Privacy copy still describes the former email-draft and webhook flow. Its correction requires separate owner approval. Public hosting, external SMTP, abuse controls, retention, and legal sign-off remain separate launch decisions.

## Exact tracked deletions


- `astro.config.mjs`
- `tailwind.config.mjs`
- `src/styles/global.css`
- `src/layouts/Layout.astro`
- `src/pages/index.astro`
- `src/pages/privacy.astro`
- `src/pages/terms.astro`
- `src/components/BookingDemo.astro`
- `src/components/ChronographEnhancement.astro`
- `src/components/Contact.astro`
- `src/components/Faq.astro`
- `src/components/Footer.astro`
- `src/components/Header.astro`
- `src/components/Hero.astro`
- `src/components/HowItWorks.astro`
- `src/components/PackageCard.astro`
- `src/components/Packages.astro`
- `src/components/PlanDetails.astro`
- `src/components/SelectedWork.astro`
- `src/components/Services.astro`
- `src/components/SupportCard.astro`
- `src/components/SupportPlans.astro`
- `src/components/WhyChooseUs.astro`
- `public/favicon.png`
- `public/favicon.svg`
- `public/images/aevum-clock-logo.png`
- `api/contact.js`
- `vercel.json`
- `src/contact.mjs`
- `src/turnstile.mjs`
- `frontend/src/turnstile.ts`
- `scripts/config.mjs`
- `server/contact/config.mjs`
- `server/contact/handler.mjs`
- `server/contact/http.mjs`
- `server/contact/redis.mjs`
- `server/contact/resend.mjs`
- `server/contact/turnstile.mjs`
- `server/contact/validation.mjs`
- `qa-audit.js`
- `scripts/run-e2e.mjs`
- `scripts/check-functions.mjs`
- `scripts/test-contact-cookies.mjs`
- `scripts/test-contact-redis.mjs`
- `tests/config.test.mjs`
- `tests/contact.test.mjs`
- `tests/contact-server.test.mjs`
