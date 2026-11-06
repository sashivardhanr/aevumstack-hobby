# Contact delivery proposal — Vercel

**Historical comparison:** the owner selected Vercel Functions + Resend in Phase 3B. See [implemented architecture and setup](phase3b-contact-delivery.md). The proposal below records the earlier decision stage; no account or delivery has been activated.

Decision status: hosting confirmed by the owner on 5 November 2026; form provider not approved. Keep the existing Vercel project and `aevumstack.dev`. Enquiry destination: `aevumstack@gmail.com`. No service registration, live integration, email send, deployment or DNS mutation has been performed.

## Recommendation

Use **Formspree on the existing static Vercel site** for the first low-volume launch, subject to verifying that the selected plan can enforce the required field rules and spam controls. It avoids operating an email API, serverless handler and shared rate-limit/idempotency store. Keep a provider submission dashboard as a second place to check enquiries if Gmail notifications fail. If exact server-side field validation, durable idempotency and enforceable per-client limits cannot be achieved on the selected Formspree plan, choose **Option B before launch**; the current client safeguards do not satisfy those requirements by themselves.

Do not activate either architecture by filling in an arbitrary URL. The prepared frontend currently expects the custom contract documented in README. The approved Formspree adapter must map its actual payload and documented receipt format, test email/phone-only contact behavior, and re-run the mock suite before activation. Provider limits, CAPTCHA/CSP requirements and retention must also be verified on the chosen account. This proposal does not assert that Formspree already supports our custom receipt contract.

## Vercel-specific comparison

| Concern | A: Static Astro + Formspree | B: Static Astro + Vercel function + Resend |
| --- | --- | --- |
| Setup | Create/verify form and recipient, configure notifications, domain restrictions and spam controls; add tested frontend adapter | Create email account, verify sender DNS, write function, add server secrets, configure shared abuse/deduplication controls |
| Compatibility | HTTPS browser submission from existing static site; no Astro output/adapter migration | Standalone `/api/contact` Vercel function alongside static output; confirm routing in preview; an Astro endpoint would instead require a Vercel adapter and server routing configuration |
| Reliability | Managed submission archive and notifications; quotas/spam classification can prevent notifications | Email API receipt and delivery events; application owns request handling, limits, ambiguous retries and alerts |
| Security | Public form ID, no private email key in browser; provider performs filtering; verify validation/rate controls in selected plan | Email API key stays server-only; full field/body validation and origin checks; never use a visitor-controlled recipient or From header |
| Spam/rate limits | Built-in spam filtering and provider limits; enable domain restrictions and supported CAPTCHA; provider honeypot/advanced controls are plan-dependent | Server honeypot, optional verified CAPTCHA, Vercel firewall where available, shared IP/token limits, recipient-wide quota guard; Resend API quota is not visitor rate limiting |
| Duplicate handling | In-flight browser lock provided; verify provider duplicate/retry semantics before promising durable protection | Atomic shared store keyed by submission UUID + payload hash, short retention, Resend idempotency key; do not rely on per-function process memory |
| Privacy | Provider holds enquiry data plus Gmail copy; review DPA, subprocessors, region, retention and deletion | Vercel/Resend/Gmail process content; keep limiter records minimal, short-lived and hashed; no unnecessary enquiry database |
| Maintenance | Low: dashboard/quota/spam review, notification checks, provider adapter updates | Higher: function dependencies, secrets, DNS authentication, limiter storage, bounced mail events and alert handling |
| Scaling | Upgrade limits/features after explicit cost approval | More flexible custom workflows, at the cost of additional infrastructure and operational work |

### Cost/limits checked 5 November 2026

Formspree lists 50 submissions/month and 30 days of submission history on Free. Paid tiers list 200/2,000/20,000 monthly submissions. Published pricing distinguishes monthly billing ($15/$30/$90) from annual equivalents ($10/$20/$60 per month). The plan page describes Free as testing/development; verify commercial suitability and feature availability before relying on it for launch. No paid plan has been selected. See [plans](https://formspree.io/plans) and [account limits](https://help.formspree.io/articles/account-management/account-limits/).

Resend lists a $0 transactional tier with 3,000 emails/month, limited to 100/day; Pro lists $20/month for 50,000 emails plus overages. That excludes Vercel and any shared limiter/CAPTCHA costs. See [Resend pricing](https://resend.com/pricing).

Vercel lists Pro at $20/month, with usage terms and possible additional seat/usage charges. Its Hobby plan is restricted to non-commercial personal use. Check the existing agency project's billing plan; do not assume a business website qualifies for Hobby. This applies to both options and is not a reason to migrate hosts. See [pricing](https://vercel.com/pricing) and [fair use](https://vercel.com/docs/limits/fair-use-guidelines).

## Exact external steps after owner selection

### A — Formspree

1. Owner creates/signs into Formspree and reviews billing, privacy, retention and processor terms. No credentials should be pasted into chat.
2. Create a form with `aevumstack@gmail.com` as the notification recipient. Complete recipient verification and confirm notifications are enabled.
3. Configure production domain restriction for `aevumstack.dev`, and separately approve any preview testing domain. Enable built-in filtering and the supported CAPTCHA if needed. Confirm exact field rules/length limits, rate behavior and duplicate handling with the selected plan.
4. Supply the public form endpoint/ID to the engineer; this is public routing configuration, not an email API key. Do not supply the account API key.
5. Implement the provider-specific adapter and mock tests. Map the visitor's email to the provider's supported email/Reply-To field only when the contact is an email; preserve phone-only enquiry support. Map field names, honeypot/CAPTCHA and explicit receipt semantics from current documentation. Update CSP only for the required provider/CAPTCHA origins.
6. Set `PUBLIC_FORM_ENDPOINT` in the existing Vercel project's appropriate Preview/Production environment after adapter review. Keep `PUBLIC_SITE_URL=https://aevumstack.dev`. Rebuild. Approve deployment separately.
7. Approve one labelled delivery test and follow the checklist below.

DNS changes for A: **none** for ordinary hosted notifications to Gmail. Existing Vercel domain records remain unchanged. Custom branded sender features, if selected later, may require separate DNS work and approval.

### B — Vercel function + Resend

1. Owner creates/signs into Resend, chooses a region and reviews retention/billing. Create a sending-only key restricted as narrowly as available.
2. Add a dedicated sending subdomain of `aevumstack.dev` in Resend. Copy only the exact SPF/DKIM/return-path DNS records shown by its dashboard to the DNS provider and wait for verification. Review DMARC alignment. Preserve website A/CNAME records and existing mail MX/SPF records; do not replace root MX or create duplicate SPF records. Never use `aevumstack@gmail.com` as the authenticated From identity. Gmail remains the recipient. See [Resend domains](https://resend.com/docs/dashboard/domains/introduction).
3. Approve and configure a shared rate-limit/idempotency store or suitable hosting feature. Define quotas, expiry and outage behavior; recommend fail-closed with a safe retry/direct-contact message if abuse controls are unavailable. No subscription is created automatically.
4. Implement a standalone Vercel `/api/contact` function using the shared validation module. Enforce POST/JSON, same-origin checks, 32 KB streaming body cap, field allowlists/limits, UUID validation, honeypot/CAPTCHA and atomic deduplication. Do not trust forwarded IP headers except those documented by Vercel. Return 400/403/413/429/503 safely; use `Retry-After` where relevant.
5. Send plain-text email to a fixed server-configured destination. From is a verified address in the sending subdomain; visitor email is a validated optional Reply-To, never From. Use Resend's current idempotency facility, a bounded upstream timeout shorter than the browser's, and acknowledge only a confirmed API acceptance. Do not log enquiry bodies/contact details or show provider errors to visitors.
6. Proposed variables (names only, no invented secrets): public `PUBLIC_FORM_ENDPOINT=/api/contact`; server-only `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`, `CONTACT_ALLOWED_ORIGIN`, plus store-specific credentials named after that approved store. If CAPTCHA is chosen: public site key and server-only secret key according to that provider. None are active or required by today's static build.
7. Add server tests for validation/body limits, rate limits under concurrent calls, repeat IDs with same/different payloads, upstream timeout/429/5xx, missing secrets and safe logs. Confirm Vercel routing/secret separation on Preview. Approve deployment and a real delivery test separately.

## Delivery verification — explicit approval required

1. Run all local tests with intercepted/mocked delivery. Confirm unconfigured, rejected, quota-exhausted, network, malformed receipt, timeout and duplicate cases preserve the brief and never show acceptance incorrectly.
2. Review a Vercel Preview: domain, HTTPS, headers/CSP, form provider's allowed origins, secrets absent from HTML/JS, and console/network health.
3. After explicit approval, send one labelled enquiry with synthetic non-sensitive project data and a unique test reference. Confirm one provider record/API receipt and **one email in Gmail** (including spam check), matching the reference and submitted content. Do not equate a 2xx/API acceptance with inbox delivery.
4. With approval, verify a same-ID retry does not send a second email, and verify rate/spam controls without flooding the provider. Validate provider outage/quota behavior with mocks where possible.
5. Record receipt/delivery timestamps and outcomes without committing personal data. Confirm notification monitoring, bounced/blocked mail handling, quota alerts, and who checks spam/archive if no notification arrives. Do not promise an SLA without an agreed operational process.
6. Set the actual processors, retention and deletion process in the privacy notice and approve legal terms. Only then consider automatic intake ready for production.

## Existing deployment evidence/dashboard checks

Public read-only inspection returned HTTP 200, `server: Vercel`, `x-vercel-id`, `x-vercel-cache`, and HSTS. Apex A records returned `216.198.79.1` and `64.29.17.1`; the owner separately confirmed Vercel. No local `.vercel` linkage or prior deployment manifest was present at baseline.

In the **existing** Vercel project, confirm Domains → `aevumstack.dev` and SSL status; Git → intended repository and production branch; Deployments → commit/build output of the live deployment; Build & Development → Astro, `npm run build`, output `dist`, supported Node runtime; Environment Variables → correct scopes with no public secrets; Billing/Usage → commercial plan, limits and alerts. These account-specific settings cannot be established from public response headers. Do not connect this uncommitted branch to production or change DNS as part of review.
