# Phase 3A — dependency security remediation

Date: 5 November 2026 (Asia/Kolkata). Branch: `phase3/production-readiness`. This is an incremental report relative to the uncommitted Phase 3 working tree, not just Git commit `99a4ae4`.

## Scope and strategy

Preserve static Astro/Vercel deployment, `aevumstack.dev`, CSP and other security controls, all application components/styles and the contact-delivery architecture. Do not commit, deploy, send enquiries or change accounts/DNS. The three protected root QA artifacts are read-only throughout.

1. Snapshot Phase 3 dependency/config files and fresh audit into ignored `artifacts/phase3a/before/`. Re-run the 106-check pre-upgrade browser baseline and capture all three routes at desktop/mobile sizes.
2. Compare registry metadata and official Astro 6/7 migration guidance. Astro 5's newest release remains 5.18.2 and Astro 6's newest is 6.4.8; neither clears the fresh audit ranges. A controlled Astro 7 upgrade is necessary to eliminate these advisories, rather than merely forcing incompatible transitives into Astro 5.
3. Upgrade to exact selected versions and regenerate the lockfile normally. No `npm audit fix --force`, `--force`, `--legacy-peer-deps`, dependency `overrides`, framework replacement or SSR migration.
4. Preserve Tailwind 3.4.19. The latest `@astrojs/tailwind` wrapper (6.0.2) declares an Astro 3/4/5 peer range; it cannot be used as a verified Astro 7 integration. Replace the wrapper with its equivalent Tailwind + Autoprefixer PostCSS plugins. Do not migrate to Tailwind 4 or change the theme/preflight/classes.
5. Keep previous whitespace compression with explicit `compressHTML: true`, avoiding Astro 7's changed default JSX whitespace behavior. Explicitly retain `output: 'static'`. Vite is now an explicit dependency of the development tooling because `scripts/config.mjs` directly imports its `loadEnv` API.
6. Clean-install, build, test, audit, compare computed layouts and screenshot pixels; retain reviewable rollback snapshots.

Sources: [Astro 6 migration](https://docs.astro.build/en/guides/upgrade-to/v6/), [Astro 7 migration](https://docs.astro.build/en/guides/upgrade-to/v7/), [Tailwind 3 PostCSS installation](https://v3.tailwindcss.com/docs/installation/using-postcss), [Puppeteer supported browsers](https://pptr.dev/chromium-support/). Exact npm metadata is saved at `artifacts/phase3a/registry-metadata.json` and `selected-metadata.json`. Registry metadata, rather than an assumption of peer compatibility, determined the selected versions. Tailwind 3's documentation is versioned/legacy; no claim of active long-term maintenance is made merely because it is compatible and audit-clean today.

## Selected versions

| Package | Phase 3 installed | Phase 3A selection | Reason |
| --- | --- | --- | --- |
| Astro | 5.18.2 | 7.4.5 | Patched supported release above all reported Astro ranges |
| Tailwind CSS | 3.4.19 | 3.4.19 | Preserve exact utility/theme behavior; no reported advisory |
| `@astrojs/tailwind` | 5.1.5 | Removed | Its latest release still does not declare Astro 7 support; equivalent PostCSS configuration replaces it |
| Vite | 6.4.5, transitive | 8.3.5, explicit dev dependency | Matches Astro 7's dependency range; supports directly imported `loadEnv` |
| PostCSS | 8.5.32, transitive | 8.5.32, explicit dev dependency | Declare the CSS plugin host previously supplied by the wrapper |
| Autoprefixer | 10.6.2, transitive | 10.6.2, explicit dev dependency | Retain existing prefixer/version, now configured directly |
| Puppeteer Core | 24.43.1 | 25.16.0 | Removes vulnerable browser-management chains; remains `puppeteer-core`, no browser downloader added |
| Sharp | 0.34.5 | 0.35.5, Astro optional dependency | Native library security patches; no direct/override added |
| Zod | 3.25.76 | 4.6.7, transitive | Above 4.6.6 security floor via the new compatible parents |
| `@puppeteer/browsers` | 2.13.2 | 3.2.6, transitive | Removes old ZIP/proxy/FTP dependency chain |
| Node minimum | 22.12.0 | 22.23.4 | Required by selected Astro package; tests use installed Node 26.13.0 |

Sharp 0.35.5, Puppeteer 25.16.0 and Vite 8.3.5 all declare Node ranges compatible with the tested runtime. Astro's supported static configuration is retained; the actual Vercel project runtime/version still needs checking before a separately approved deployment. No Vercel configuration is changed by Phase 3A.

## Fresh initial audit and applicability

Fresh audit: **14 affected packages: 1 critical, 11 high, 2 low; exit 1**. These 14 package entries represent **19 unique underlying advisories**, plus dependency propagation. Package classification as `dependencies` versus `devDependencies` does not itself establish deployed exposure: this project deploys generated HTML/CSS/JS, not an Astro request-time server. Astro, image libraries and CSS/build tools affect development/build supply-chain risk; Puppeteer chains affect QA only. None of the listed Node packages are shipped as a public Node server by the current static deployment.

### Every underlying advisory

| Package / advisory | Severity | Affected code path and relevance here | Patched floor / chosen treatment |
| --- | --- | --- | --- |
| Astro [GHSA-j687-52p2-xcff](https://github.com/advisories/GHSA-j687-52p2-xcff) | Moderate | `define:vars` script termination escaping; can affect generated HTML if fed untrusted values. No `define:vars` is used here. | 6.1.6; choose 7.4.5 |
| Astro [GHSA-xr5h-phrj-8vxv](https://github.com/advisories/GHSA-xr5h-phrj-8vxv) | Low | Server-island encrypted parameter replay. No server islands or runtime server. | 6.1.10; choose 7.4.5 |
| Astro [GHSA-jrpj-wcv7-9fh9](https://github.com/advisories/GHSA-jrpj-wcv7-9fh9) | Moderate | Unescaped spread attribute names. Relevant to generated markup with attacker-controlled attribute keys; none accepted in this site. | Initial fix 6.4.6; incomplete-fix advisory below also requires remediation |
| Astro [GHSA-f48w-9m4c-m7f5](https://github.com/advisories/GHSA-f48w-9m4c-m7f5) | Moderate | Incomplete spread-attribute rendering fix. Static output can be affected with malicious build input. | 7.0.6; choose 7.4.5 |
| Astro [GHSA-7pw4-f3q4-r2p2](https://github.com/advisories/GHSA-7pw4-f3q4-r2p2) | Low | `transition:*` values on hydrated islands. No hydrated islands/transition directives here. | 7.0.4; choose 7.4.5 |
| Astro [GHSA-4g3v-8h47-v7g6](https://github.com/advisories/GHSA-4g3v-8h47-v7g6) | Moderate | View Transition animation property escaping. No Astro View Transition router or attacker-controlled animations here. | Above 7.0.9 (7.0.10); choose 7.4.5 |
| Astro [GHSA-2pvr-wf23-7pc7](https://github.com/advisories/GHSA-2pvr-wf23-7pc7) | High | Host-header SSRF during error-page fetch. Requires Astro runtime behavior not deployed by this static site. | 6.4.6; choose 7.4.5 |
| Astro [GHSA-8hv8-536x-4wqp](https://github.com/advisories/GHSA-8hv8-536x-4wqp) | High | Unescaped slot-name rendering. Could affect HTML generation with untrusted slot names; site uses fixed author-controlled slots. | 6.3.3; choose 7.4.5 |
| Astro [GHSA-26w7-cxv4-gfx2](https://github.com/advisories/GHSA-26w7-cxv4-gfx2) | Critical | AVIF image optimization memory corruption/RCE. No uploaded/remote user images or runtime image endpoint here; still a serious build-tool risk if untrusted images are processed. | 7.2.8; choose 7.4.5 |
| Astro [GHSA-376h-93r7-7g6f](https://github.com/advisories/GHSA-376h-93r7-7g6f) | Moderate | Base-path stripping boundary/authorization behavior. No application authorization backend or custom base path. | Above 7.2.3 (7.2.4); choose 7.4.5 |
| Astro [GHSA-98hj-9722-w3j8](https://github.com/advisories/GHSA-98hj-9722-w3j8) | Moderate | Script/style content escaping in JSX/MDX. No JSX/MDX renderer or user content in this project. | 7.3.2; choose 7.4.5 |
| `basic-ftp` [GHSA-c475-qrg2-pj4r](https://github.com/advisories/GHSA-c475-qrg2-pj4r) | High | Untrusted FTP directory listing causes CPU exhaustion. QA browser/proxy dependency only; local browser path is used and no FTP workflow exists. | Audit reports affected through 6.2.0; remove chain with Puppeteer 25.16.0 rather than select an unverified FTP patch |
| `esbuild` [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) | Low | Arbitrary file read in Windows dev server. Build/development only; dev server must not be public. | 0.28.1; offending package removed by Astro/Vite upgrade |
| `extract-zip` [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) | High | Symlink path traversal during ZIP extraction. QA browser management; no browser download/extraction in current scripts. | Audit reports affected through 2.0.1; remove chain via Puppeteer upgrade |
| `extract-zip` [GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3) | High | Arbitrary file writes via malicious archive entries. Same QA-only extraction path. | Audit reports affected through 2.0.1; remove chain via Puppeteer upgrade |
| Sharp [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) | High | Native libvips image decoding. Astro build-time image processing; fixed local PNGs only, not visitor uploads. | 0.35.0; choose 0.35.5 |
| Sharp [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | High | Native libheif decoding. Build-time image attack surface if untrusted files supplied. | 0.35.4; choose 0.35.5 |
| Sharp [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | High | Native librsvg use-after-free. Build-time SVG/image processing, not a deployed upload endpoint. | 0.35.5; choose 0.35.5 |
| Zod [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | High | Oversized constrained collections can exhaust memory. Astro config/content and browser BiDi tooling; form validation uses the project's own small module, not Zod. | 4.6.6; new parent ranges resolve 4.6.7 |

The listed patched floors are boundaries from the fresh registry audit, not promises that every intermediate version clears all advisories. The selected exact versions and final audit determine the outcome.

### Transitive/propagated package entries

| Initially flagged entry | Severity | Initial dependency path | Treatment |
| --- | --- | --- | --- |
| `astro` (direct) | Critical | Root → Astro | Upgrade 5.18.2 → 7.4.5 |
| `@astrojs/tailwind` (direct) | Low | Root → wrapper → Astro peer | Remove unsupported wrapper; retain equivalent CSS pipeline |
| `sharp` | High | Root → Astro → optional Sharp | Resolve patched 0.35.5 within Astro's declared range |
| `esbuild` | Low | Root → Astro → esbuild | Old package removed; Vite 8 uses Rolldown |
| `zod` | High | Root → Astro → Zod; root → Puppeteer → Chromium BiDi → Zod | Upgrade parents, obtain patched Zod 4 |
| `zod-to-ts` | High | Root → Astro → zod-to-ts → Zod 3 | Removed by parent upgrade |
| `puppeteer-core` (direct dev) | High | Root → Puppeteer | Upgrade 24.43.1 → 25.16.0 |
| `chromium-bidi` | High | Root → Puppeteer → Chromium BiDi → Zod 3 | Upgrade through Puppeteer's declared dependency |
| `@puppeteer/browsers` | High | Root → Puppeteer → browsers → extract-zip/proxy-agent | Upgrade through Puppeteer; old chains removed |
| `extract-zip` | High | Root → Puppeteer → browsers → extract-zip | Removed |
| `proxy-agent` | High | Root → Puppeteer → browsers → proxy-agent | Removed |
| `pac-proxy-agent` | High | Previous chain → proxy-agent → pac-proxy-agent | Removed |
| `get-uri` | High | Previous chain → pac-proxy-agent → get-uri | Removed |
| `basic-ftp` | High | Previous chain → get-uri → basic-ftp | Removed |

No advisory was waived solely because the deployment is static. Inapplicability reduces current exposure, but the dependency paths were still removed or upgraded.

## Verification

Runtime: Node **26.13.0**, npm **11.20.0**, installed Brave/Chromium selected with `BROWSER_PATH`. Browser tooling remains external-browser `puppeteer-core`; no browser was downloaded. Form requests were intercepted in both browser runs; none were sent to external enquiry systems.

| Executed command/check | Exit | Result / baseline comparison |
| --- | --- | --- |
| Fresh pre-upgrade `npm audit --json` | 1 | 14 affected packages / 19 underlying advisories |
| Pre-upgrade full E2E | 0 | 106 passed, 0 failed |
| Exact-version lockfile resolution (`npm install --package-lock-only`) | 0 | Normal resolution, no forced fixes or dependency overrides |
| `npm ci` | 0 | 280 packages added, 281 audited; zero vulnerabilities |
| Standalone `npm run build` | 0 | 3 routes; static output; CSP/headers/sitemap/robots generation succeeds |
| Final `npm test` | 0 | **68 regression + 43 unit tests**, zero failures; **140 metadata/link/CSP checks** passed |
| Full post-upgrade browser E2E | 0 | **106 passed, 0 failed**, no console/JS errors or failed network requests |
| Standalone `npm run test:links` | 0 | **140 checks**, zero failures |
| Final `npm audit --json` | 0 | Empty vulnerability map; all severities zero |
| Final plain `npm audit` | 0 | `found 0 vulnerabilities` |
| `npm run test:security` | 0 | Scoped credential/deployment scan passed; 45 files |
| Old/new full-page visual capture | 0 / 0 | Six screenshots and computed-layout snapshots per build |
| Strict screenshot comparison, channel tolerance 0 | 1 | Not pixel-identical; bounded one-level raster differences detailed below |
| Reviewed screenshot comparison, channel tolerance 1 | 0 | All six cases within one RGB level; exact captured layouts/styles match |
| `git diff --check` | 0 | No whitespace errors |
| Protected artifact hash comparison | 0 | All three initial SHA-256 values preserved |

All four requested baseline counts are unchanged: **68 / 43 / 106 / 140**. No useful test was removed. One existing assertion was updated to inspect the linked compiled stylesheet and confirm that it exists on disk, rather than require a particular bundler filename prefix.

The first post-upgrade `npm test` returned **exit 1, 67 regression passes / 1 failure**, before unit/link checks ran. Its sole failure was that Vite 8 named the compiled asset `global.<hash>.css` instead of `index.<hash>.css`. The corrected semantic assertion preserves the same check/count and is stronger than merely searching for `.css` in HTML.

The initial lockfile resolution warned about the installed old Tailwind wrapper's peer range while removing it. The final clean install/tree contains **no wrapper or invalid peer relation**, and `npm ls` succeeds. npm also warns that optional `fsevents@2.3.3` install-script approval is not configured on this machine; it did not prevent installation/build/QA and no global npm approval settings were changed.

A first ad hoc visual capture waited on an offscreen lazy image's decode promise and was terminated; the capture was corrected to decode already loaded images. The first non-frozen screenshot comparison also observed the existing pulsing dot at different animation times. Final visual captures fix animation time in the test browser only; application animation code/styles are untouched. These diagnostic attempts were not counted as successful checks.

## Visual compatibility

Compared the old generated build snapshot with the upgraded build using the same installed browser, fonts-ready capture, fixed animation time, and viewport dimensions **1440×900** and **390×844**. All routes (`/`, `/privacy/`, `/terms/`) received full-page screenshot comparisons, covering content below the fold as well as the hero. Desktop and mobile hero screenshots were also inspected visually.

Every captured element record matches exactly, including text, bounding boxes (to 0.01 px), color/background color, font family/size/weight/line height, display, animation and transition values. Page dimensions and overflow results also match. Functional E2E separately checks the 768-pixel tablet viewport and mobile menu/package/contact interactions.

| Full-page capture | Pixels with any channel change | Percentage of image | Maximum channel change (0–255) | Captured layout/styles |
| --- | ---: | ---: | ---: | --- |
| Home, desktop | 8,241 | 0.082689% | 1 | Exact match |
| Privacy, desktop | 43 | 0.000692% | 1 | Exact match |
| Terms, desktop | 0 | 0% | 0 | Exact match |
| Home, mobile | 7,522 | 0.131923% | 1 | Exact match |
| Privacy, mobile | 49 | 0.001826% | 1 | Exact match |
| Terms, mobile | 17 | 0.000562% | 1 | Exact match |

These are **not byte-identical screenshots**. The measured differences are a maximum of one intensity level, concentrated around shadow/antialiasing edges; no geometry/text/font/theme/animation differences were observed. The bundler/CSS minifier changed with Vite 8; quantization is an inference supported by the one-level bound and matching captured computed styles, rather than a claim that browser rendering is universally identical. The comparison is accepted with an explicit one-level channel tolerance; the strict comparison failure is retained above. No CSS workaround or visual redesign was introduced to hide differences.

Evidence: `artifacts/phase3a/visual-comparison.json`, `pixel-regions.json`, and before/after `visual/` directories. `capture-visual.mjs` and `compare-visual.mjs` are ignored local review utilities, not new runtime dependencies. This is measured local-browser regression coverage, not a guarantee of identical rendering on every browser/device.

## Exact changed files in Phase 3A

- `package.json`: exact selected versions, explicit CSS/Vite tooling and new Node minimum.
- `package-lock.json`: normally regenerated upgraded dependency graph.
- `astro.config.mjs`: equivalent direct PostCSS integration, explicit static output and old whitespace behavior.
- `.test-qa.js`: semantic stylesheet existence assertion, preserving the same regression check/count.
- `README.md`: current runtime/toolchain/security-status documentation.
- `docs/phase3a-security-report.md`: this report.

All other existing source, tests, Vercel/security scripts and contact files are unchanged relative to the start of Phase 3A. Prior Phase 3 uncommitted changes remain in place; do not confuse the combined Git diff with this phase's incremental changes. Local ignored logs, visual captures, comparison utilities and audits are under `artifacts/phase3a/`.

## Remaining risk and commit recommendation

**All vulnerabilities reported by the fresh initial audit are resolved in the final locked graph.** The final registry audit reports **0 vulnerabilities**, including zero critical/high/moderate/low findings. The 19 underlying advisories were addressed by compatible parent upgrades/removal of vulnerable chains, not by ignoring findings. This statement is limited to the registry's known advisory data on 5 November 2026; it is not a proof that dependencies can never contain vulnerabilities.

**Recommendation: the Phase 3A dependency changes are safe to commit after normal review**, with the measured one-level screenshot tolerance explicitly understood. Installation, production build, all baseline tests and security checks pass. Commit only intended source/config/documentation changes; do not include ignored review artifacts or the protected root QA files. No commit has been made.

Before a separately approved deployment, confirm the existing Vercel project's Node runtime meets **22.23.4+**, installs build devDependencies, and runs the existing complete `npm run build` command. A Vercel preview/build was not executed during this task; hosting configuration and domain remain unchanged. Re-audit close to deployment. Native build binaries and new Astro compiler/bundler versions remain normal supply-chain considerations; the static artifact contains no runtime Node server.

Do not treat dependency clearance as completion of production enquiry delivery: provider selection/integration and an approved actual inbox-delivery test remain outstanding from Phase 3. Contact provider architecture was deliberately unchanged in Phase 3A. No remaining known dependency vulnerability needs a waiver at this time.
