import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve('dist/index.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

console.log("=== AEVUM STACK QA VERIFICATION SUITE ===");

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failed++;
  }
}

// 1. Check absence of remote placeholder logos
assert(!html.includes('lh3.googleusercontent.com'), 'No remote placeholder Google logo URLs in HTML');

// 2. Check presence of official local clock logo asset
assert(html.includes('/images/signal-social.png'), 'Approved SIGNAL social identity is used');
assert(fs.existsSync('dist/images/signal-social.png'), 'Built SIGNAL social asset exists on disk');
assert(fs.existsSync('dist/images/aevum-clock-logo.png'), 'Built official logo asset exists on disk');

// 3. Check absence of Tailwind CDN
assert(!html.includes('cdn.tailwindcss.com'), 'Tailwind CDN is completely absent');
const compiledStylesheet = html.match(/href="(\/[^"]+\.css)"/);
assert(compiledStylesheet && fs.existsSync(path.join('dist', compiledStylesheet[1].replace(/^\/+/, ''))), 'Locally compiled stylesheet is linked');

// 4. Verify all 4 packages and exact prices
assert(html.includes('₹4,999') && html.includes('Starter'), 'Starter package (₹4,999) is present');
assert(html.includes('₹9,999') && html.includes('Business') && html.includes('FOR LOCAL BUSINESSES') && !html.includes('MOST POPULAR'), 'Business package price and scope-based label are present');
assert(html.includes('₹14,999') && html.includes('Growth'), 'Growth package (₹14,999) is present');
assert(html.includes('₹29,999') && html.includes('Pro'), 'Pro package (₹29,999) is present');

// 5. Verify all 3 support plans and exact prices
assert(html.includes('₹999') && html.includes('Care') && html.includes('/ month'), 'Support Care (₹999/mo) is present');
assert(html.includes('₹2,999') && html.includes('RECOMMENDED'), 'Support Growth (₹2,999/mo, RECOMMENDED) is present');
assert(html.includes('₹4,999') && html.includes('Automation'), 'Support Automation (₹4,999/mo) is present');

// 6. Verify section IDs match all navigation hrefs
const targetIds = ['services', 'packages', 'support-plans', 'how-it-works', 'faq', 'contact'];
targetIds.forEach(id => {
  assert(html.includes(`id="${id}"`), `Section target id="${id}" exists in document`);
});

// 7. Verify functional mobile menu elements
assert(html.includes('id="mobile-menu-btn"'), 'Mobile menu toggle button exists');
assert(html.includes('id="mobile-nav-drawer"'), 'Mobile navigation drawer container exists');
assert(html.includes('aria-controls="mobile-nav-drawer"'), 'Accessible aria-controls attribute on menu toggle');

// 8. Verify FAQ accordions
assert(html.includes('details class="faq-accordion-item'), 'FAQ details accordions exist');
assert(html.includes('summary class="p-5 cursor-pointer'), 'FAQ summary handles exist');

// 9. Verify genuine contact form integration
assert(html.includes('id="project-form"'), 'Project contact form exists');
assert(html.includes('id="full-name"') && html.includes('id="business-name"') && html.includes('id="contact-info"') && html.includes('id="selected-package"') && html.includes('id="project-description"'), 'All required form fields exist with labels');
assert(html.includes('contact-success-msg') && html.includes('contact-announcement') && html.includes('contact-error-msg'), 'Form has genuine success, live announcement, and error feedback elements');
assert(html.includes('aria-describedby="contact-info-error"') && html.includes('id="contact-info-error"') && html.includes('role="alert"'), 'Contact form has accessible error messaging attributes');

// 10. Verify corrected package & support plan navigation hrefs
assert(!html.includes('href="#contact?package=') && !html.includes('href="#contact?plan='), 'Broken #contact?package= and #contact?plan= href patterns are absent');
assert(html.includes('href="?package=business#contact"') && html.includes('href="?package=starter#contact"'), 'Corrected ?package=...#contact navigation patterns are present');
assert(html.includes('href="?plan=care#contact"') && html.includes('href="?plan=support-growth#contact"'), 'Corrected ?plan=...#contact navigation patterns are present');

// Verify the built enquiry dropdown and its default.
const packageSelectMatch = html.match(/<select[^>]*id="selected-package"[^>]*>([\s\S]*?)<\/select>/);
assert(packageSelectMatch && packageSelectMatch[1], 'Selected package dropdown exists in rendered HTML');
const options = [...(packageSelectMatch ? packageSelectMatch[1].matchAll(/value="([^"]+)"/g) : [])].map(m => m[1]);
const originalDefaultOption = options[0];
assert(originalDefaultOption === 'business', 'Default package option in HTML is confirmed as "business"');

// 13. Verify no unverified claims and check verified contact channels
assert(!html.includes('BENGALURU, INDIA'), 'Unverified specific physical location claim (Bengaluru) removed');
assert(!html.includes('Under 24 Hours (Mon – Sat)'), 'Unverified rigid response time guarantee removed');
assert(html.includes('aevumstack@gmail.com'), 'Verified communication email (aevumstack@gmail.com) is present');
assert(html.includes('wa.me/918897202737'), 'WhatsApp link points to verified number (wa.me/918897202737)');
assert(!html.includes('+91 8897202737') && !html.includes('<span>+91'), 'Raw phone number is not exposed directly in visible text');

// 11. Verify SEO and Open Graph metadata
assert(html.includes('<meta property="og:title"'), 'Open Graph title tag is present');
assert(html.includes('<meta property="og:image"'), 'Open Graph image tag is present');
assert(html.includes('<meta name="twitter:card"'), 'Twitter card meta tag is present');
assert(html.includes('<link rel="icon"'), 'Favicon is linked');

// 14. Verify Phase 2 Legal Pages, Footer Navigation & Mobile Accessibility
const privacyPath = path.resolve('dist/privacy/index.html');
const termsPath = path.resolve('dist/terms/index.html');

assert(fs.existsSync(privacyPath), 'Dedicated /privacy page (dist/privacy/index.html) exists');
assert(fs.existsSync(termsPath), 'Dedicated /terms page (dist/terms/index.html) exists');

const privacyHtml = fs.existsSync(privacyPath) ? fs.readFileSync(privacyPath, 'utf-8') : '';
const termsHtml = fs.existsSync(termsPath) ? fs.readFileSync(termsPath, 'utf-8') : '';

// Check footer links point to actual pages
assert(html.includes('href="/privacy"') && html.includes('href="/terms"'), 'Footer links point to actual /privacy and /terms routes');

// Check Privacy Policy content requirements
assert(privacyHtml.includes('Privacy Policy') && privacyHtml.includes('Information Collected Through the Contact Form'), 'Privacy policy covers form information collection');
assert(privacyHtml.includes('External Services &amp; Contact Links') && privacyHtml.includes('Data Retention &amp; Deletion Rights'), 'Privacy policy covers external service and retention sections');
assert(privacyHtml.includes('[Requires Owner Confirmation]'), 'Privacy policy clearly marks items requiring owner confirmation');
assert(privacyHtml.includes('same-origin Fastify endpoint') && privacyHtml.includes('recorded in PostgreSQL'), 'Privacy policy describes the active same-origin enquiry recording flow');
assert(privacyHtml.includes('notification request') && privacyHtml.includes('does not guarantee email delivery'), 'Privacy policy distinguishes enquiry receipt from notification delivery');
assert(privacyHtml.includes('Mailpit captures synthetic notifications') && privacyHtml.includes('not a public email provider'), 'Privacy policy identifies Mailpit as local synthetic capture only');
assert(privacyHtml.includes('Google Fonts') && privacyHtml.includes('Public hosting and production email services have not been configured or verified'), 'Privacy policy does not invent public hosting or production mail providers');
assert(!privacyHtml.includes('Google Workspace / Gmail') && !privacyHtml.includes('Static Web Hosting &amp; CDN') && !privacyHtml.includes('hosting CDNs'), 'Privacy policy omits unverified provider and CDN processing claims');
assert(privacyHtml.includes('email and WhatsApp links') && privacyHtml.includes('separate ways to contact us'), 'Privacy policy distinguishes direct contact links from form submission');
assert(!privacyHtml.includes('PUBLIC_FORM_ENDPOINT') && !privacyHtml.includes('intake webhook') && !privacyHtml.includes('preformatted email draft'), 'Privacy policy omits retired webhook and email-draft behavior');

// Check Terms & Engagement content requirements
assert(termsHtml.includes('Terms &amp; Engagement') && termsHtml.includes('Services &amp; Project Scope'), 'Terms page covers services and scope');
assert(termsHtml.includes('Third-Party Subscriptions &amp; Infrastructure Fees') && termsHtml.includes('Direct Billing Policy'), 'Terms page covers direct third-party billing');
assert(termsHtml.includes('Intellectual Property &amp; Code Ownership'), 'Terms page details code and IP ownership');
assert(termsHtml.includes('[Draft Clause — Requires Business Owner Confirmation]'), 'Terms page marks unconfirmed clauses for business owner review');

// Check Mobile Navigation accessibility attributes
assert(html.includes('id="mobile-nav-drawer"') && html.includes('aria-hidden="true"') && html.includes('inert'), 'Mobile navigation drawer has aria-hidden and inert attributes when closed');
console.log(`\nQA SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
if (failed > 0) process.exit(1);
