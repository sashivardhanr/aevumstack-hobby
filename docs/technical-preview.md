# AEVUM STACK temporary technical preview

The portfolio includes the fictional Booking Desk and a decorative desktop chronograph. The enquiry form prepares a copyable email draft when the built-in API has no public Turnstile key or the endpoint is empty. Email and WhatsApp links are available directly. The draft opens in the visitor's email app only when they choose **Open email draft**, and they send it from there.

## Delivery evidence

- Local browser tests use intercepted submissions and validate the returned submission ID. They cover the application flow through receipt, without contacting an email provider.
- The existing public deployment has a packaged /api/contact route. The last read-only audit saw GET return 405 and an empty, origin-less JSON request return a fail-closed 503. This evidence applies to that deployment only.
- Real delivery is unverified. Before enabling it, review privacy and retention, configure a verified Resend sender, a matching Turnstile widget, scoped Upstash and mail credentials, and the exact origin. Verify one authorized synthetic enquiry reaches the intended inbox and a retry does not send a second copy. Follow the [setup and variable matrix](phase3c-setup.md).

## Hosting and test procedure

Vercel restricts Hobby to personal, non-commercial use and lists advertising services as commercial. Authentication helps control access, but the guidelines do not grant an exemption for a temporary or protected deployment. Confirm with Vercel that the specific testing arrangement is allowed, or identify an existing eligible team before uploading the agency build. [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) · [Deployment Protection](https://vercel.com/docs/deployment-protection)

1. Choose a separate, owner-approved test project and a protected Preview target. Record the exact candidate Git SHA and verify the Preview is accessible only to intended testers. Use its generated URL and keep the existing custom domain attached to Production.
2. Build with Node 26.x and the lockfile using the existing Astro build and root Vercel Function. Set Preview delivery to false, keep the public widget key empty, and omit provider credentials. Use synthetic values for any browser checks.
3. Verify HTTPS, protection and indexing headers. Check Home, Privacy, Terms, image assets, the static dial on touch, desktop tilt and reduced motion. Check navigation, disclosures and the fictional booking demo. Verify the email-draft label and copyable brief without sending it.
4. Verify GET /api/contact returns JSON 405 with Allow: POST. One empty JSON POST without Origin should return a safe 503 while disabled. Confirm security headers and CSP on the actual host. Record the deployment ID and distinguish these endpoint checks from successful delivery.

## Taking the test offline

In the test project's Deployments list, open the exact deployment ID recorded above and verify the project and URL. Keep access protection enabled until teardown. With owner authorization, remove only that test deployment using its deployment menu, then verify the test URL no longer serves the preview and the production domain still serves its existing site. If the test used an automatic deployment branch, stop future builds for that test project before cleanup. Retain the production project, its custom domain and the repository.
