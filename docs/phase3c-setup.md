# Phase 3C — owner setup and Preview verification

Prepared 5 November 2026. Branch: `phase3/production-readiness`.

**This is an execution guide, not authorization to execute it.** No deployment, account provisioning, live submission, DNS edit, Production variable change, commit or push is performed by this phase. The application remains static Astro plus a separate Node function. Phase 3C changes only documentation and the candidate Node engine constraint to match confirmed Production Node 26; UI and application logic are unchanged.

## 1. What is complete, and what is not

| Status | Item |
| --- | --- |
| Completed engineering | Astro 7.4.5/Tailwind 3 build; Vercel Node entry; independent server validation; Resend adapter; server-verified Turnstile; atomic Redis limits/leases; truthful acceptance contract; conditional CSP; automated coverage |
| Required owner setup | Resend sender/domain/key, Invisible Turnstile widget/key pair, isolated Preview Redis database/token/hash secret, Vercel project/runtime/environment review |
| Required before configured Preview | Approve the exact Preview hostname, populate Preview-only settings, reference the Turnstile Privacy Addendum in the reviewed privacy notice, approve the Preview deployment |
| Not yet verified on Vercel | Node function packaging/import tracing, deployed route, platform IP header/origin behavior, real Invisible widget/CSP, Upstash REST/persistence, Resend acceptance and actual Gmail receipt |
| Production launch blockers | All configured Preview checks, actual delivery/dedup verification, privacy/legal review, commercial plan/budgets, and separate Production configuration/deployment/enablement approval |

Previous reports are historical: [Phase 3](phase3-report.md), [Phase 3A](phase3a-security-report.md), [Phase 3B](phase3b-contact-delivery.md). Phase 3A cleared its dependency findings; Phase 3B added the locally tested, disabled delivery implementation. Do not infer live dashboard settings from `.env.example` or local test results.

## 2. Dashboard links and owner decision record

These are real dashboard entry points; authentication is required. No project/account identifiers are guessed.

| Dashboard | Owner navigation |
| --- | --- |
| [AEVUM STACK Vercel project](https://vercel.com/strix-lab007s-projects/aevumstack) | Existing team → existing AEVUM STACK project → Settings / Deployments / Functions; team settings for Billing/Usage |
| [Resend Domains](https://resend.com/domains) | Sign in/create owner account → Domains → Add domain / verified-domain details |
| [Resend API Keys](https://resend.com/api-keys) | Create a restricted sending key for the chosen domain |
| [Resend Emails](https://resend.com/emails) | Inspect approved test email, provider ID and delivery/bounce events |
| [Cloudflare](https://dash.cloudflare.com/) | Correct account → Turnstile → Add widget / widget settings |
| [Upstash](https://console.upstash.com/) | Redis → Create Database → database → Connect/REST and settings/usage |
| [Gmail](https://mail.google.com/) | Sign in as the owner of `aevumstack@gmail.com`; check Inbox, Spam and All Mail after an approved send |

Fill in this record before configured Preview. Bracketed descriptions are **not environment variable names or literal values to paste**.

| Decision | Current approved/known value |
| --- | --- |
| Production website | `https://aevumstack.dev` |
| Production enquiry inbox | `aevumstack@gmail.com` |
| Existing Vercel project dashboard URL | [Confirmed project](https://vercel.com/strix-lab007s-projects/aevumstack) |
| Production deployment | Owner confirmed Ready, commit `a2d20db`, branch `main`, Node 26.x, Fluid Compute enabled, Basic build machine (2 vCPU / 8 GB RAM) |
| Exact approved Preview hostname | **None recorded/approved yet** |
| Exact approved Preview HTTPS origin | Pending; `https://` followed by the approved hostname, no path or trailing slash |
| Resend sending domain/subdomain and bare sender address | Pending owner selection/verification |
| Preview test inbox | Pending explicit approval; use designated Gmail only when an actual send to it is approved |
| Approved provider plans/budgets/region | Pending owner confirmation |

The owner explicitly identified `aevumstack-git-main-strix-lab007s-projects.vercel.app` and `aevumstack-d0blvt687-strix-lab007s-projects.vercel.app` as **Production URLs, not Preview targets**. Do not run submission or failure tests against either. No `*.vercel.app`, guessed project slug, arbitrary deployment URL, localhost or wildcard hostname is approved for provider configuration by this document. If an existing Preview branch URL is available, copy its **actual** hostname from the existing Vercel project's Deployments page. Prefer one stable branch URL for testing. Otherwise, the first separately approved **disabled Preview** below discovers the real URL; approve that hostname before configuring/enabling services.

## 3. Vercel architecture and runtime review

Open the existing project's Settings. Confirm without modifying Production:

1. Root Directory points to this repository root, containing `package.json`, `api/contact.js`, `server/contact/` and `src/`.
2. Framework preset is **Astro**, build command **`npm run build`**, Output Directory **`dist`**. Build installs the locked dependencies, including build devDependencies, on Vercel; do not upload local `node_modules` or a macOS prebuilt bundle.
3. Preserve the confirmed **Node.js 26.x** project setting and Fluid Compute. Phase 3C corrects the earlier source pin from `>=22.23.4 <23` to **`26.x`**, matching the existing Production runtime rather than introducing a downgrade on the next build. Vercel package engines override the dashboard selection; this correction is reviewable source metadata, not a dashboard change. Confirm the actual patch in Preview build logs; local final verification uses Node 26.13.0/npm 11.20.0. The Basic build machine remains unchanged.
4. Review the connected repository (`sashivardhanr/aevumstack`) and **Production Branch**. The owner confirmed it is **`main`**, currently serving commit `a2d20db`. This working branch must be a **Preview** target, not Production. Check automatic deployments/hooks before approving any push: pushing can itself trigger deployment.
5. Preserve existing domain assignments, DNS and Production environment values. Do not promote a Preview or attach `aevumstack.dev` to it.
6. Confirm the new function's configured `maxDuration: 20` and that the existing plan supports it. Confirm the team's commercial hosting eligibility and spending controls.

Vercel's documented root `api/` Node function handling supports this separate entry while Astro writes static pages. The runtime entry uses the Web Standard `fetch` export. `vercel.json` has no legacy `builds`, catch-all rewrite or manual Build Output API directory that would replace detection. Helpers are outside `api/` and imported by the function. Static output contains no API source; this is expected, not evidence that the function is missing.

**Deploy the complete source project. `dist` alone is insufficient.** `astro dev` and `astro preview` serve the frontend, not root Vercel Functions. Local `test:functions` and the E2E server are source/fixture checks; they do not prove Vercel's deployed packaging. The first approved Preview must show `api/contact.js` in its Functions/build output and return the handler's JSON at `/api/contact`. If not, stop and diagnose packaging before changing architecture or weakening security.

Local history contains Production commit `a2d20db`; `git merge-base --is-ancestor a2d20db HEAD` succeeds, and candidate HEAD `99a4ae4` is one existing commit ahead. The staged Phase 3 work is additional uncommitted source, not live Production.

Sources: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [configuration](https://vercel.com/docs/project-configuration/vercel-json), [Node runtime selection/engine overrides](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Node 26 GA announcement, 29 October 2026](https://vercel.com/changelog/node-js-26-lts-is-now-generally-available-on-vercel). The newer GA announcement and owner-confirmed runtime supersede older cached documentation listing only Node 20/22/24.

## 4. Exact Resend setup — owner action after approval

1. At [Resend](https://resend.com/login), sign in or create an owner-controlled account; verify the account email and review plan, region, retention and billing. Do not register a subscription or enable overages without approval.
2. In [Domains](https://resend.com/domains), choose **Add domain**. Prefer an owner-selected sending subdomain of `aevumstack.dev` to isolate sending reputation. The root `aevumstack.dev` can also be verified if deliberately selected. No specific subdomain has been approved yet.
3. Select the provider region intentionally. Copy the exact **sending** DNS records shown for that domain/region. A Gmail recipient does not require configuring Resend inbound mail/receiving.
4. **Stop for explicit DNS approval.** A sending-subdomain TXT/MX edit is still a change to production-domain DNS and is outside the current authorization. This guide does not authorize it. It is possible to verify the disabled Preview route before any DNS edit; real sender delivery waits for this approval.
5. After approval, add the displayed records at the authoritative DNS provider using the table below. Do not move nameservers, change website A/CNAME records, replace unrelated root MX records or create a second SPF record at the same name. Keep ordinary mail-authentication records DNS-only if the DNS provider offers proxying.
6. Return to Resend's domain details and run its verification action. Require **Verified** for sending. Record only non-secret domain/status information; do not guess DNS values from examples.
7. Choose a **bare sender address in that verified domain/subdomain** for `CONTACT_FROM_EMAIL`. Do not use `aevumstack@gmail.com` as From: the agency does not own the `gmail.com` sending domain. The Gmail address is `CONTACT_TO_EMAIL`.
8. In [API Keys](https://resend.com/api-keys), create a **Sending access** key scoped to the verified domain where supported. Use a separately named Preview key; retain Production keys separately. Put the value only into Preview `RESEND_API_KEY` as a private Secret, never source/chat/browser config. Turn off open/click tracking for intake if it is not required.
9. Do not press Send, run a sending API example or enable `CONTACT_DELIVERY_ENABLED` until the separate live-test approval gate.

| Record | Required instruction |
| --- | --- |
| DKIM TXT | Copy exact selector/name and public-key value displayed by Resend for the selected sending domain |
| SPF TXT | Copy the exact sending/return-path hostname and SPF value displayed; reconcile any existing SPF at that **same hostname** |
| Sending/return-path MX | Add only the exact hostname, target and priority required by Resend's sending verification; do not redirect inbound mail for the website's unrelated root domain |
| DMARC TXT | Review existing policy/alignment and owner requirements before any change; do not invent or harden a policy as part of this guide |
| Website A/CNAME, nameservers, Gmail MX | **No change** for this integration |

Exact DNS record values cannot be supplied before the owner selects a sending domain/region and obtains its Resend dashboard records. That missing information is an explicit dependency, not a placeholder endpoint or fabricated credential. See [verified domains](https://resend.com/docs/dashboard/domains/introduction) and [key permissions](https://resend.com/docs/dashboard/api-keys/introduction).

## 5. Exact Turnstile setup and hostname policy

1. At [Cloudflare Dashboard](https://dash.cloudflare.com/), select the correct account, open **Turnstile**, and choose **Add widget**. The website need not migrate to Cloudflare DNS/proxying.
2. Create a dedicated Preview widget with a descriptive owner-chosen name and **Invisible** widget type. Managed or Non-Interactive modes may add visible UI and do not match the current design.
3. Add **only the exact owner-approved Preview hostname**, without `https://`, port, path or trailing slash. There is currently no approved Preview hostname, so this step must wait for the record in section 2. The server requires an exact hostname match even if a provider setting would allow subdomains.
4. Keep pre-clearance disabled/not requested. This implementation verifies tokens server-side; it does not use a Cloudflare clearance-cookie integration.
5. Save the widget. Copy the public site key to Preview `PUBLIC_TURNSTILE_SITE_KEY` and its paired private secret to Preview `TURNSTILE_SECRET_KEY`. Do not mix widget pairs or use public demonstration/test secrets for production security.
6. The code sets **action `contact`** and executes on each submission. There is no separate action environment variable or dashboard API endpoint to invent. Each retry gets a fresh token; keep the existing submission UUID for unchanged enquiry data. Replaying an old token is not a valid deduplication test.
7. Before the widget is enabled even on a configured Preview, prepare/review the privacy disclosure below. Invisible mode requires a reference to [Cloudflare's Turnstile Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/) in the site's privacy policy. **The current privacy page lacks that reference; this is a blocker to enabling the Invisible widget.**
8. Only at a later approved Production stage, create a separate Production widget restricted to **`aevumstack.dev`**. Do not add `www` unless that hostname is explicitly approved and served rather than redirected. Never copy Preview secrets/hostnames into Production automatically.

| Widget | Allowed hostname now | Activation |
| --- | --- | --- |
| Preview | **None approved yet**; enter exactly one actual owner-approved Preview hostname later | Blocked pending hostname, privacy disclosure and deployment/test approval |
| Production plan | `aevumstack.dev` | Not configured/activated by this task; requires separate Production approval |

Sources: [dashboard steps](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/), [hostname rules](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/), [Invisible-mode requirements](https://developers.cloudflare.com/turnstile/concepts/widget/), [token validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## 6. Exact Upstash Redis setup

1. At [Upstash Console](https://console.upstash.com/), sign in/create the owner account. Open **Redis → Create Database**. Choose a dedicated **Preview** database and a primary region close to the actual Vercel function's region. Confirm plan and budget before creation; no automatic paid upgrade is authorized.
2. Keep persistence enabled and **eviction disabled**. Do not use an expiring scratch database, read replica endpoint or read-only REST token as the ledger. Out-of-capacity writes should fail closed instead of evicting retry records.
3. Open the created database's **Connect → REST** (or Details/REST in an older UI). Copy its root HTTPS REST URL and **write-capable REST token** to Preview `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. This code requires a `*.upstash.io` HTTPS root URL, without query credentials or path suffixes; do not paste a Redis TCP connection string.
4. Verify the credential permits `EVAL` and the script operations: `GET`, `INCR`, `EXPIRE`, `TTL`, `HGET`, `HSET`. Use an appropriately restricted ACL if supported; do not choose a read-only token. Never run the repository's optional Redis test suite against a hosted/shared database: it starts its own local process and uses `FLUSHDB` on that isolated instance only.
5. Generate a new Preview `CONTACT_HASH_SECRET` privately: at least 32 random characters. A local owner-only command is `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Copy its output straight into a password manager/Vercel Secret; do not paste it into chat, screenshots, committed files or CI logs. Do not run this command in a shared recorded terminal.
6. Review budget/usage alerts and keep automatic paid upgrades disabled unless separately approved. Free-tier capacity/availability is not a production SLA.
7. Reserve a **different database for Production** before launch. The current key prefix is fixed: `aevum:contact:v1:*`. There is **no namespace environment variable**. Using the same database would share attempt limits, the 50-ID budget and UUID records across Preview/Production. A second database may require a paid plan; get cost approval, or return for an explicitly reviewed namespace change. Do not invent an unused variable to claim isolation.

The actual scripts enforce 5 valid-schema attempts/IP/15-minute fixed window, 200 globally/hour, and 50 new IDs/24-hour fixed window. Leases last 30 seconds; unknown outcomes can retry for 20 hours; ledger records last seven days. Raw IP/enquiry content is not stored in Redis. Preview verification must confirm REST support, TTLs, concurrency and persistence. Database loss, eviction, key deletion or secret rotation invalidates assumptions; disable delivery and review recovery before resuming.

Sources: [create/connect](https://upstash.com/docs/redis/overall/getstarted), [REST credentials/protocol](https://upstash.com/docs/redis/features/restapi), [eviction](https://upstash.com/docs/redis/features/eviction), [pricing](https://upstash.com/pricing/redis).

## 7. Complete environment matrix from the actual code

In the existing Vercel project, use **Settings → Environment Variables**, choose **Preview** and scope to `phase3/production-readiness` where the interface supports branch overrides. Do not select Production while adding Preview values. Credentials should use the **Secret** type (some dashboard versions call this Sensitive); non-secret settings can use Config. Server-only means the application never exposes the value in browser output, independent of the dashboard's display type. See [environment scopes](https://vercel.com/docs/environment-variables/manage-across-environments) and [secret storage](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

The Production column below is a **future reference only**, not an instruction to edit current Production variables.

| Actual variable | Exposure/type | Disabled Preview | Configured Preview after approval | Future Production reference |
| --- | --- | --- | --- | --- |
| `PUBLIC_SITE_URL` | Browser/build, Config | Keep canonical production origin for first disabled discovery build | Exact approved Preview HTTPS origin | `https://aevumstack.dev` |
| `PUBLIC_FORM_ENDPOINT` | Browser/build, Config | `/api/contact` | `/api/contact` | `/api/contact` |
| `PUBLIC_TURNSTILE_SITE_KEY` | Browser/build, Config | Empty | Preview Invisible widget's public key | Separate Production widget's public key |
| `PUBLIC_CONTACT_EMAIL` | Browser/build, Config | `aevumstack@gmail.com` | Same public contact | Same |
| `PUBLIC_WHATSAPP_NUMBER` | Browser/build, Config | Existing `918897202737` | Same | Same unless owner changes it separately |
| `CONTACT_DELIVERY_ENABLED` | Server-only, Config | `false` | Keep `false` through setup; `true` only for approved sends | Keep disabled until separate launch enablement approval |
| `CONTACT_ALLOWED_ORIGIN` | Server-only, Config | Not required while disabled | **Exact approved Preview HTTPS origin**, no trailing slash | `https://aevumstack.dev` |
| `CONTACT_FROM_EMAIL` | Server-only, Config/Secret | Unset | Approved bare address at verified sending domain | Approved verified Production sender |
| `CONTACT_TO_EMAIL` | Server-only, Config/Secret | Unset | Explicitly approved test inbox | `aevumstack@gmail.com` |
| `RESEND_API_KEY` | Server-only, Secret | Unset | Restricted Preview sending key | Separate restricted Production key |
| `TURNSTILE_SECRET_KEY` | Server-only, Secret | Unset | Secret paired with Preview public key | Secret paired with Production public key |
| `UPSTASH_REDIS_REST_URL` | Server-only, Config/Secret | Unset | Dedicated Preview primary's HTTPS root URL | Dedicated Production primary URL |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only, Secret | Unset | Preview write/EVAL token | Production write/EVAL token |
| `CONTACT_HASH_SECRET` | Server-only, Secret | Unset | New private random Preview value, minimum 32 chars | Separate private random Production value |

The existing local `.env` has not been edited. An explicit empty `PUBLIC_FORM_ENDPOINT` selects the old mail-draft fallback; absence defaults to `/api/contact`. That fallback is not an API readiness test. For Preview, set the literal `/api/contact`. Never put a Resend URL or secret query-string endpoint into frontend configuration.

Additional actual environment names used by tooling/platform, **not extra application secrets to configure**:

| Name | Meaning / handling |
| --- | --- |
| `VERCEL` | Platform-supplied runtime marker; required to be `1` by the API; do not fabricate it locally |
| `NODE_ENV` | Build/runtime mode supplied by tools/platform; no custom Preview secret |
| `ASTRO_TELEMETRY_DISABLED` | Set to `1` by existing npm Astro scripts |
| `BROWSER_PATH` | Local/CI path to installed Chromium-compatible executable |
| `TEST_ARTIFACT_DIR` | Local/CI generated QA output directory; keep outside protected root output paths |
| `TEST_BASE_URL` | Advanced local QA target; normal runner supplies loopback URL |
| `REDIS_SERVER_PATH`, `REDIS_CLI_PATH` | Optional local Redis verification binaries; not hosted database connection variables |

`x-vercel-forwarded-for` is a **request header, not an environment variable**. No additional sender/hostname/namespace, CAPTCHA-bypass or origin-list environment variable exists; use only the actual names in this matrix. The hostname is derived from `CONTACT_ALLOWED_ORIGIN`; keep it aligned with the actual browser URL and widget allowlist.

All Vercel variable edits require a new approved deployment to take effect; public values also require a rebuild. Redeploy after changing even server-only values. Never assume modifying the dashboard changes an already-running deployment. Do not pull Production secrets into local test files.

## 8. Preview origin, CSP and privacy gates

For the configured Preview, these must agree:

- Browser URL: actual approved Preview origin.
- `PUBLIC_SITE_URL`: that same literal HTTPS origin for Preview metadata/endpoint-origin generation.
- `CONTACT_ALLOWED_ORIGIN`: exactly the same HTTPS origin, without trailing slash.
- Turnstile Preview allowlist: exactly the hostname portion of that origin; public/secret keys are from the same Invisible widget.
- Request: relative `/api/contact`, browser Origin matches, and Vercel supplies a single valid client IP.

Do not use `https://aevumstack.dev` as the API's allowed origin while testing a `vercel.app` URL; it will reject legitimate Preview users. Do not use a guessed deployment URL or paste `${...}` interpolation strings into the dashboard: this code expects literal values. A redeployed unique URL can change; keep testing through the approved stable branch alias, or explicitly approve/configure the new hostname and redeploy.

With a configured public site key, the existing build adds `https://challenges.cloudflare.com` to script/frame/connection CSP directives. Without that key, Cloudflare is not permitted and frontend verification fails closed. Keep `npm run build` so hash-based CSP is finalized. Vercel ignores `dist/_headers`; the HTML meta policy provides resource restrictions, while `vercel.json` provides the existing response headers. Do not add wildcard origins, `unsafe-inline`, or `unsafe-eval` to make a test pass. If the Vercel Preview toolbar is blocked, review disabling that toolbar for Preview rather than widening application CSP.

Keep Preview Deployment Protection enabled for approved testers and verify `X-Robots-Tag: noindex` on the deployed Preview. Vercel supplies this by default, but verify it; the generated `robots.txt` itself currently allows crawling. A noindex header is not access control. No production robots/DNS/domain changes are required. [Vercel Preview headers](https://vercel.com/docs/headers/response-headers), [Deployment Protection](https://vercel.com/docs/deployment-protection).

**Privacy review is incomplete.** The current `/privacy` lists existing hosting/email/fonts but does not name these new processors or reference the Invisible Turnstile addendum. Before enabling the widget/delivery, obtain owner-reviewed policy text covering Resend processing the enquiry/email, Cloudflare browser/IP signals for abuse checks, Upstash's counter/UUID/HMAC ledger with actual expiry, Gmail retention/deletion, and the mandatory [Turnstile addendum reference](https://www.cloudflare.com/turnstile-privacy-policy/). Do not describe provider retention as zero or invent a legal retention schedule. Existing owner-confirmation clauses in Privacy/Terms must also be finalized before public launch. This guide leaves website UI/legal text unchanged; the disclosure edit is a recorded pre-enable blocker, not claimed completed work.

## 9. Safe Preview deployment procedure — do not execute yet

**Gate A: source checkpoint.** Review the staged diff and approve a checkpoint commit separately. Commit approval does not authorize push or deployment. The three original root QA artifacts must remain unstaged and unchanged.

**Gate B: disabled Preview.** Approve the exact repository/branch/Preview target and any push that could trigger its deployment. First confirm the branch is not the Production Branch. Use the complete reviewed source, locked install, Node 26.x and existing build settings. Apply only the Disabled Preview column. Keep Production settings/domain untouched. Do not use `--prod`, Promote to Production, production domain assignment or a DNS migration. If no Preview exists, this disabled build safely discovers the real URL before accounts/hostname settings are connected.

After that approved deployment, an authenticated tester verifies:

1. Build output contains the three static routes plus the separate Node function, with helper imports traced and no missing-module/unsupported-runtime error. Inspect the deployment's Functions list/runtime logs without printing credentials or request bodies.
2. On the **actual deployed origin**, GET `/api/contact` returns JSON **405**, `Allow: POST`; POST JSON while disabled returns JSON **503**, `accepted: false`. Deployment Protection may first return login/401/redirect; authenticate before treating that as an application failure. Static 404/HTML/200 is not a verified API route.
3. `/`, `/privacy`, `/terms`, navigation, package/history selections, fonts/images, mobile menu and accessibility work; CSP/security/noindex headers remain correct and downloaded HTML/JS contains no private configuration.
4. Record and explicitly approve the actual stable Preview hostname/origin. Keep this reference in section 2 or the owner change record; do not silently broaden the allowlist to accommodate every deployment URL.

**Gate C: configured Preview with delivery still off.** Obtain account/plan and DNS approvals separately, complete sections 4–8, and approve the updated Preview build. Keep delivery `false`; verify keys match their widget, CSP permits only expected resources, and the required privacy disclosure is present in Preview `/privacy` before the widget can execute. Setting a public widget key may cause Cloudflare verification calls on submit even with email disabled; treat widget use as a separately approved integration action.

**Gate D: labelled live test.** Only after explicit approval to call the security services and send the specified synthetic enquiry, change the **Preview-only** enable flag to `true` and approve its redeployment. Test from the approved origin using the selected test inbox. Record submission UUID, provider email ID, timestamps/status and observed inbox result without committing personal data.

- Confirm exactly one Resend record and one actual message in the designated Gmail inbox, including content/reference and safe Reply-To for an email contact. Phone-only enquiries should be readable without Reply-To. Check Spam/All Mail and bounce/delivery events. A provider ID/API 200 is acceptance, not inbox confirmation; no delivery webhook is implemented.
- Verify backend deduplication with the same UUID/content and a **fresh** Turnstile token, within the retry window. A repeated click that never makes an HTTP request only proves the frontend guard; it does not prove Redis deduplication. An engineer should perform the controlled backend retry test after approval and confirm no second email record/message.
- Verify cross-instance lease/rate/TTL behavior and Upstash persistence without flooding providers. Keep outage, quota-exhaustion, oversize and large concurrency cases mocked/local unless specifically approved for external execution. Do not delete ledger keys to bypass limits.
- Preserve the brief after rejection/timeout; retry unchanged data with its original UUID and a new bot token. After an ambiguous failure, do not generate new IDs repeatedly. Unknown outcomes beyond 20 hours require owner review/direct contact; accepted records expire after seven days, so this is bounded deduplication, not a permanent exactly-once guarantee.

**Gate E: close Preview and plan Production.** Capture results, revoke the Preview sending key or disable Preview delivery if no ongoing tests are approved, and redeploy the disabled Preview if needed (redeployment also requires approval). Production requires separate credential/database/widget configuration, privacy/business approval, a fresh audit/check suite, deployment approval and enablement approval. Never promote the Preview environment blindly: its literal origin and credentials are not Production values.

## 10. Fail-closed troubleshooting and spending safeguards

| Observation | Check without weakening controls |
| --- | --- |
| Browser opens mail app | Endpoint is explicitly empty; set `/api/contact` in approved Preview and rebuild |
| Browser security-verification error before any POST | Missing/mismatched public key, script/CSP/network issue, wrong widget type or hostname; review approved widget and privacy gate |
| 404 or HTML at `/api/contact` | Wrong project root, uploaded `dist` only, missing function, wrong deployment or routing override; inspect packaging, not Resend keys |
| 503 while flag is false | Expected inactive endpoint behavior |
| 503 while enabled | Missing/malformed server config, wrong environment/branch scope, unsupported platform/IP header, Redis/Turnstile/provider outage or uncertain completion; inspect names/scopes and private provider dashboards, never dump secrets |
| 403 | Allowed origin/browser URL mismatch, cross-site context or failed Turnstile hostname/action/token verification |
| 400 / 408 / 413 / 415 | Invalid schema/UUID; slow body; >32 KiB; unsupported media type/encoding respectively; do not increase limits merely to pass a test |
| 405 | Supported handler rejects non-POST; expected for GET, with JSON/Allow header |
| 409 | Concurrent lease, changed payload/config for same ID, or expired safe retry window; wait for lease recovery/review, do not manufacture repeated IDs |
| 429 | Shared IP/global/new-ID budget reached; respect Retry-After; do not clear Redis records or bypass bot controls |
| Accepted receipt but Gmail missing | Check Resend delivery/bounce events and Gmail Spam/All Mail; do not declare delivery verified or auto-resend with a different ID |

Use only synthetic non-sensitive data in tests. Store credentials in a password manager and scoped Vercel Secrets; exclude Development unless intentionally using isolated development resources. Do not run authenticated curl commands with tokens in shell history, paste keys into chat, or log enquiry bodies. Provider sample/demo keys are for isolated mocked/development exercises; they do not verify production-grade bot protection or actual Gmail delivery.

The application caps new submission reservations at 50 per fixed 24-hour window; this is not an account-wide guarantee if other applications/keys also send mail. API retries and bot/store requests can consume provider quotas even when no email arrives. Review [Resend pricing](https://resend.com/pricing), [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/) and [Upstash pricing](https://upstash.com/pricing/redis) in the owner's account before selecting plans. Configure spending caps/alerts where supported; alerts alone are not a hard cap. Do not enable paid overages, auto-upgrade, HA/Prod Pack or other addons without explicit cost approval. Preview/Production isolation may exceed free-tier resource allowances; no zero-cost promise is made.

AEVUM STACK is a commercial agency site. Vercel's Hobby plan is restricted to personal/non-commercial use; confirm an eligible existing commercial plan (normally Pro or Enterprise) in team Billing before deployment. Do not upgrade or migrate automatically. [Vercel commercial-use terms](https://vercel.com/docs/limits/fair-use-guidelines).

## 11. Owner-action checklist and final local verification

- [ ] Identify the existing Vercel project and confirm commercial plan, Production Branch, Node 26.x, build/root/output, protection and spend controls.
- [ ] Approve the source checkpoint commit separately; approve any push/deployment separately because Git can auto-deploy.
- [ ] Approve an inactive Preview build; verify actual Node function packaging and record/approve its real hostname.
- [ ] Approve account setup/terms/costs and any required sending-domain DNS edits; configure the sender, widget and isolated Redis database.
- [ ] Approve/finalize privacy disclosure including the Invisible Turnstile addendum; configure only Preview variables with literal matching origins and scoped secrets.
- [ ] Approve configured Preview/widget use, then separately approve one labelled external enquiry and its test recipient.
- [ ] Verify Resend acceptance **and actual inbox receipt**, fresh-token retry deduplication, platform rate limits/TTL/persistence and UI/security behavior; record results.
- [ ] Keep Production untouched until separate account/configuration, legal, deployment and enablement approvals.

### Final local results — Node 26.13.0 / npm 11.20.0

The earlier Node 22 checks also passed before the owner supplied the actual Production runtime. The final candidate and final verification use **Node 26**, preserving the confirmed Production major. Application dependencies and logic did not change in Phase 3C; `package.json` and the lockfile engine were aligned to `26.x`, and README/setup documentation was updated.

| Executed check | Exit | Result |
| --- | --- | --- |
| Clean `npm ci` | 0 | Locked install succeeds under Node 26 |
| Standalone `npm run build` | 0 | Three static routes and security/SEO output |
| `npm test` | 0 | 68 regression checks + 150 unit/integration tests, zero failures; 140 metadata/link/CSP checks pass |
| Full browser E2E | 0 | 113 passed, zero failures; only mocked/loopback enquiry traffic |
| Standalone link/CSP checks | 0 | 140 passed |
| Function source/config check | 0 | Root function and static outputs coexist locally; actual Vercel packaging remains pending |
| Actual Redis Lua/handler checks | 0 | 23 passed against an isolated Unix-socket-only local Redis; bot/email adapters mocked |
| Scoped security scan | 0 | No matching exposed credentials/private deployment content; no server-only configuration names in static output |
| `npm audit --json` | 0 | Zero vulnerabilities at every severity |
| Lockfile inventory review | 0 | All 355 entries checked; root versions/Node constraint match; resolved packages use npm registry URLs with integrity fields |
| Production-commit ancestry | 0 | `a2d20db` is an ancestor of local HEAD; one existing commit ahead before the uncommitted Phase 3 work |
| Protected file hash comparison | 0 | All three original QA files unchanged |

Baseline counts from Phase 3B remain **68 / 150 / 113 / 140**, plus the 23 optional real-Redis checks. No tests were removed. Results and the review patch/manifest are local ignored files in `artifacts/phase3c/`; no real enquiries or remote deployment were executed.

### Checkpoint recommendation

The intended checkpoint comprises **39 staged files** covering Phase 3, 3A, 3B and this guide/runtime alignment. It excludes the protected original root QA report/screenshots, private `.env` files, installed dependencies and generated artifacts. Review covers application/configuration changes, tests/tooling, setup/historical reports and the validated generated lockfile. The only remaining unstaged tracked changes should be the three protected files.

**Recommend a source checkpoint commit after explicit owner approval. Do not push or deploy as part of that approval.** This is readiness for a disabled Preview review, not certification of hosted packaging or production delivery. A separately approved Preview build must prove the root function, runtime/imports, exact origin/widget behavior and real provider path. Required owner setup and all launch blockers remain as listed above.
