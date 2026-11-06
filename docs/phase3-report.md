# AEVUM STACK — Phase 3 engineering report

Date: 5 November 2026 (Asia/Kolkata). Baseline: `99a4ae4`. Branch: `phase3/production-readiness`.

**Assessment: repository hardening is complete within the independent scope; automatic enquiry intake is not production-ready.** Launch remains gated on approved provider integration, actual inbox delivery verification, dependency remediation and owner review of legal/configuration details. No commit, push, merge, deployment, account registration, subscription, DNS change or real enquiry send was performed.

## Initial findings

- Branch and baseline matched the brief. Only `audit-results.json`, `desktop-screenshot.png` and `mobile-screenshot.png` were dirty before work; they remain byte-for-byte unchanged from their initial state.
- Astro 5.18.2 statically renders `/`, `/privacy`, `/terms`, using shared layout/components and locally compiled Tailwind. No SSR adapter, backend endpoint, hosting manifest, README or CI workflow existed at baseline. Existing Vercel hosting was subsequently confirmed by the owner and supported by public HTTP headers.
- Contact accepted email or phone, posted to an optional public endpoint, or opened a mail draft. There was no live configured receiver. Any HTTP 2xx counted as success, with no timeout or explicit duplicate guard; upstream errors could be shown to visitors.
- `npm test` read prebuilt `dist` and could fail immediately on a clean checkout. All 68 baseline checks passed against the pre-existing build.
- Browser QA used hardcoded Brave/user artifact paths, wrote into protected root files, and reported findings without failing its exit status. It was not exposed as an npm script.
- Page-specific titles/descriptions, canonical URLs, OG/Twitter tags, local image dimensions, a skip link, legal routes and accessible mobile-menu behavior already existed. `PUBLIC_SITE_URL` was documented but unused in Astro configuration. Sitemap, robots and explicit application security headers were missing.
- Google Fonts/Material Symbols are runtime third parties. Both the clock logo and PNG favicon are 367,708 bytes, oversized for many display sizes. Legal pages contain explicit owner-confirmation placeholders.

## Implemented changes

### Contact safeguards and proposed integration

- Shared, directly tested validation: required nonblank fields, email/phone syntax, package allowlist, control-character restrictions and limits of 100/160/254/5,000 characters for name/business/contact/brief.
- Hidden honeypot, accessible invalid-field focus, busy state and reinitialization guard. Submit lock blocks concurrent requests; stable UUIDs support deliberate retries; identical accepted content is not resent in the same page session.
- Bounded 15-second request timeout, no automatic retry, no credentials/cookies forwarded, no redirects followed and no referrer sent to the receiver.
- Explicit custom JSON acknowledgement required: `accepted: true` and the matching submission UUID. A 200 HTML page, false/missing/mismatched receipt, invalid JSON or HTTP error cannot produce success feedback.
- Failure messages disclose uncertain receipt without provider internals. The brief is preserved. Success says service acceptance, not inbox delivery. The unconfigured fallback says no submission was sent and does not assume an email application actually opened. A no-JavaScript message points to direct contact channels.
- Removed unsupported automatic-intake claims/deployment-variable instructions from customer-facing form feedback, retaining existing classes/design.
- No provider adapter/backend has been activated. **Server validation, rate limiting, CAPTCHA verification and durable cross-session deduplication remain pending**. The honeypot and other client checks are bypassable.

### Security and deployment

- Build rejects unsafe site/endpoint configuration, including non-HTTPS receiver origins, embedded credentials, query strings/fragments and ambiguous endpoint paths. All current configuration is public build-time data; no secret was introduced.
- Generated CSP permits local scripts plus exact hashes of inline build scripts; limits stylesheet/font origins to existing Google Fonts resources, connections to the configured receiver origin, and forbids plugins/base injection/native form posts. No `unsafe-inline`/`unsafe-eval` was added.
- Vercel configuration sets MIME-sniffing, frame, referrer and browser-permission protections, with static Astro output preserved. Early HTML meta CSP handles resource loading on Vercel; generated `_headers` provides full header CSP for compatible hosts and the local test server. Vercel ignores `_headers`; framing is enforced there with `X-Frame-Options: DENY`.
- Public Vercel already returned HSTS. No new HSTS/preload/subdomain commitment was made.
- Added a limited credential-pattern scan and checks against tracked `.env`/private deployment content. This is not a comprehensive historical secret audit or penetration test.

### Tests, portability and documentation

- `npm test` builds from source before the preserved 68 Phase 1/2 checks, 43 new unit tests and internal-link/metadata/CSP checks.
- Browser executable and artifact directory are configurable. E2E owns an ephemeral loopback server, serves production output/headers, closes the server/browser, and returns nonzero for failed checks.
- Existing browser scenarios remain: assets, desktop/tablet/mobile overflow, menu isolation/Escape, navigation/CTAs, package/support selection, URL history/defaults, FAQ, contact validation/fallback and legal pages.
- Added mock-only delivery scenarios: explicit acceptance, HTML/mismatched receipt, 429/500, offline/timeout, concurrent/duplicate submissions, unchanged retry IDs, brief preservation, oversized values, honeypot and repeated initialization. All non-GET requests are intercepted; no external enquiries are sent.
- Browser console/network/JavaScript errors affect the result. Asset status tests fetch files instead of navigating to Chromium's synthetic image-viewer document, whose internal styles conflicted with a site CSP.
- New artifacts default to ignored `artifacts/e2e/`; root-directory artifacts are protected. Previously tracked screenshots/report remain tracked pending explicit approval to change that policy.
- Added README, public environment documentation, provider comparison/setup instructions, deployment checklist and this report. No dependencies were added; the lockfile only records the Node engine requirement.

### SEO and performance

- `PUBLIC_SITE_URL` now drives Astro's configured origin. Canonicals consistently normalize trailing slashes and exclude selection query parameters; OG URLs follow canonical URLs.
- Build generates sitemap entries for all three routes and robots.txt referencing the configured canonical origin. Page-specific title/description/OG/Twitter metadata was retained and checked.
- Hero image receives high fetch priority; footer logo decodes asynchronously. Existing image dimensions and visual styles remain intact.
- Final compiled contact JS: **7,394 bytes raw / 2,794 gzip**; compiled CSS: **27,278 bytes raw / 5,469 gzip**. Header JS is small and inlined by Astro, authorized by generated hashes; these file totals do not include HTML/inline bytes or network protocol overhead.
- No overflow at 1440, 768 or 390 pixels in the browser suite. Menu focus/isolation, skip target and contact errors received regression coverage. This is not a complete WCAG audit.
- No Lighthouse score, throttled mobile performance result, real-user LCP/INP/CLS or field Core Web Vitals claim is made. Fonts remain network-dependent; oversized PNG/favicon optimization and a dedicated social-share image remain follow-up opportunities requiring image/visual QA. No UI redesign was performed.

## Verification results

Runtime used: Node **26.13.0**, npm **11.20.0**, installed Brave/Chromium via `BROWSER_PATH` on this machine. Repository requirement is Node 22.12+; no browser path is committed.

| Executed verification | Exit code | Result |
| --- | --- | --- |
| Baseline `npm test` | 0 | 68 passed, 0 failed |
| Final standalone production build | 0 | 3 static routes plus generated security/SEO files |
| Final workspace `npm test` | 0 | 68 regression checks + 43 unit tests; 0 failed; 140 metadata/link/CSP checks passed |
| Isolated `npm ci` | 0 | Locked install succeeded, with 14 vulnerability warnings and deprecated `tsconfck` warning |
| Isolated `npm test` without `.env` or existing `dist` | 0 | Same 68 + 43 tests and 140 metadata/link/CSP checks; 0 failed |
| Full final browser E2E | 0 | 106 passed, 0 failed; mock delivery plus all preserved browser scenarios |
| Standalone `npm run test:links` | 0 | 140 metadata/link/CSP checks passed, 0 failed |
| Credential-pattern/deployment checks | 0 | 44 files checked; no matching exposed credentials/private deployment content in scoped scan |
| Final registry `npm audit --json` | 1 | 14 affected packages: 1 critical, 11 high, 2 low |
| `git diff --check` | 0 | No whitespace errors |
| Protected artifact SHA-256 comparison | 0 | All 3 match their initial hashes |

The isolated verification copied the changed source/config/tests into `/private/tmp/aevum-phase3-clean-20261105`, installed dependencies there and ran the full default test command. It did not copy the workspace `.env`, `dist` or `node_modules`; this verifies clean-install behavior without creating a Git commit.

Failures encountered and resolved: initial shell lacked npm on PATH (exit 127); registry audit initially failed DNS inside the sandbox (exit 1), then succeeded in fetching advisories with approved network access; initial E2E server was blocked by sandbox loopback permissions (exit 1), then ran with approval. First asserted browser run returned exit 1 (99 passed/5 failed), involving an overly strict `aria-hidden` expectation, three scroll-check timing failures and image-viewer CSP errors. The next run returned exit 1 (103/1) for the remaining image-viewer issue. After corrections, a complete run returned exit 0 (104/0); final verification returned exit 0 (106/0), adding retry-ID/JavaScript-exception coverage. These earlier failures were not treated as passes.

Artifacts: `artifacts/e2e/audit-results.json`, desktop/mobile screenshots in the same directory, and `artifacts/security-audit.json`. These are ignored local outputs; the root user artifacts were never used as output targets.

## Remaining security/dependency issues

The registry audit reports Astro as critical (including an AVIF image-optimization RCE advisory) and additional Astro rendering/SSR advisories, vulnerable Sharp/Zod/esbuild paths, and browser-test tooling chains (`extract-zip`, proxy/FTP dependencies, Chromium BiDi). The package-level total includes transitive propagation; it is not 14 independently exploitable production defects. The current website is static, has no request-time Astro server, server islands, MDX or user-supplied image optimization. That reduces applicability of several advisories but does not clear the toolchain's audit or build risk.

The audit recommends breaking changes including Astro 7.4.5; it also suggests a Puppeteer downgrade for some paths. No blanket `audit fix --force`, unsupported transitive override or unvalidated framework migration was applied. Plan a reviewed migration to supported patched Astro/Tailwind/browser tooling, verify Node/runtime compatibility, repeat all tests and visual checks, and require a clean or explicitly triaged audit before declaring production engineering complete. Do not expose dev/preview servers or process untrusted images with the affected toolchain.

The complete machine-readable audit is the evidence source. Example advisories: [Astro AVIF](https://github.com/advisories/GHSA-26w7-cxv4-gfx2), [Astro rendering](https://github.com/advisories/GHSA-f48w-9m4c-m7f5), [Sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [ZIP extraction](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3). No exploit was executed.

## Modified files

Existing files changed by this phase:

- `.env.example`, `.gitignore`
- `astro.config.mjs`, `package.json`, `package-lock.json`
- `qa-audit.js`
- `src/components/Contact.astro`, `src/components/Hero.astro`, `src/components/Footer.astro`
- `src/layouts/Layout.astro`

New files:

- `README.md`, `vercel.json`, `src/contact.mjs`
- `scripts/config.mjs`, `scripts/finalize-build.mjs`, `scripts/check-site.mjs`, `scripts/run-e2e.mjs`, `scripts/security-check.mjs`
- `tests/contact.test.mjs`, `tests/config.test.mjs`
- `docs/contact-delivery.md`, `docs/phase3-report.md`

The dirty root QA report/screenshots shown by `git status` are **pre-existing user changes**, not changes made during this phase. `.test-qa.js` is unchanged. No dependency versions, layouts, colors, fonts or animations were changed.

## External configuration and deployment checklist

The detailed [Vercel delivery proposal](contact-delivery.md) compares Formspree with Vercel Functions + Resend, current price/limit sources, required account/DNS/secret configuration and actual delivery verification.

- [ ] Keep the existing Vercel project/domain. Confirm production Git branch, live commit, Astro preset, `npm run build`, `dist`, Node runtime and environment scopes in its dashboard.
- [ ] Check the existing Vercel commercial plan, usage caps and spend alerts. Vercel Hobby is restricted to personal/non-commercial use; no upgrade was purchased.
- [ ] Remediate/triage dependency advisories with a tested supported toolchain migration.
- [ ] Owner selects and approves form provider, account/plan and privacy/retention terms. No email delivery service is currently configured.
- [ ] Implement the selected provider adapter or Vercel function with enforceable provider/server validation, spam/rate limits and durable duplicate controls; verify the acceptance contract with mocks.
- [ ] Configure verified Gmail notifications (Formspree) or server-only email key and authenticated sender DNS (Resend). Never expose private credentials via `PUBLIC_*`.
- [ ] Verify a separately approved Vercel preview: headers and meta CSP, fonts, internal routes, canonical host, sitemap/robots, responsive UI and no private content in output. Vercel ignores `_headers`; verify `vercel.json` headers on the deployed response.
- [ ] Approve a labelled external test; confirm one provider record/API receipt and one email actually received at `aevumstack@gmail.com`. Test duplicate/outage/quota behavior safely.
- [ ] Confirm legal-page placeholders, actual processors, deletion/retention policy, commercial terms, and monitoring owner.
- [ ] Run build/default tests/full E2E/security audit again after integration and dependency changes.
- [ ] Obtain explicit approval to deploy. Nothing in this report authorizes a deployment or paid commitment.

**Final readiness: improved and reviewable, with passing independent functional verification; not yet cleared for automatic production enquiries.** The blocker is not the visual design. It is unresolved delivery configuration/verification and dependency remediation, plus owner-controlled deployment/legal settings.
