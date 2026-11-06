import { expect, test, type Page } from '@playwright/test';

const widths = [390, 768, 1440];
const packages = ['starter', 'business', 'growth', 'pro'];
const plans = ['care', 'support-growth', 'automation'];
const contact = '/api/v1/enquiries';

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route =>
    new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
});

async function followFragment(page: Page, link: ReturnType<Page['locator']>) {
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^#[\w-]+$/);
  await link.click();
  expect(new URL(page.url()).hash).toBe(href);
  await expect(page.locator(href!)).toBeInViewport();
}

for (const width of widths) {
  test('built routes, assets and navigation at ' + width, async ({ page, browserName }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const failedLocal: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).origin === info.project.use.baseURL)
        failedLocal.push(response.url());
    });
    for (const path of ['/', '/privacy/', '/terms/']) {
      expect((await page.goto(path))?.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const skip = page.getByRole('link', { name: 'Skip to main content' });
      await page.keyboard.press(process.platform === 'darwin' && browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
      await expect(skip).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      expect((await page.reload())?.status()).toBe(200);
    }
    await page.goto('/');
    await expect.poll(() => page.locator('header img').first().evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    for (const icon of ['/favicon.svg', '/favicon.png']) expect((await page.request.get(icon)).ok()).toBe(true);
    await page.screenshot({ path: info.outputPath('home.png'), animations: 'disabled' });
    for (const link of await page.locator('.signal-hero a[href^="#"]').all()) await followFragment(page, link);
    if (width === 1440) {
      for (const link of await page.getByRole('navigation', { name: 'Main Navigation' }).locator('a').all())
        await followFragment(page, link);
      await followFragment(page, page.getByRole('link', { name: 'Start a Project', exact: true }).first());
    } else {
      const toggle = page.locator('#mobile-menu-btn');
      const drawer = page.locator('#mobile-nav-drawer');
      const first = drawer.locator('a').first();
      const last = drawer.locator('a').last();
      const logo = page.locator('header a').filter({ has: page.locator('img') }).first();
      await expect(drawer).toHaveAttribute('inert', '');
      await toggle.press('Enter');
      await expect(first).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const headerContactLinks = await page.locator('header a[href="#contact"]:not(.mobile-nav-link)').all();
      expect(headerContactLinks.length).toBeGreaterThan(0);
      for (const background of [page.locator('main'), page.locator('footer'), logo, ...headerContactLinks]) {
        await expect(background).toHaveAttribute('inert', '');
        await expect(background).toHaveAttribute('aria-hidden', 'true');
      }
      await page.locator('main a').first().evaluate((link: HTMLElement) => link.focus());
      await expect(first).toBeFocused();
      await last.focus();
      await page.keyboard.press('Tab');
      await expect(toggle).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(last).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(toggle).toBeFocused();
      await expect(drawer).toHaveAttribute('inert', '');
      await expect(page.locator('main')).not.toHaveAttribute('inert', '');
      await toggle.click();
      await followFragment(page, drawer.locator('a[href="#packages"]'));
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
    for (const link of await page.getByRole('navigation', { name: 'Footer Navigation' }).locator('a[href^="#"]').all())
      await followFragment(page, link);
    await expect(page.locator('footer a[href^="mailto:"]').first()).toHaveAttribute('href', /^mailto:/);
    await expect(page.locator('footer a[href^="https://wa.me/"]').first()).toHaveAttribute('href', /^https:\/\/wa\.me\//);
    for (const [path, target] of [['/privacy', '/privacy/'], ['/terms', '/terms/']]) {
      await page.locator('footer a[href="' + path + '"]').click();
      await expect(page).toHaveURL(url => url.pathname === target);
      await page.goto('/');
    }
    expect(errors).toEqual([]);
    expect(failedLocal).toEqual([]);
  });

  test('offers, history and disclosures at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const offer = page.locator('#selected-package');
    const name = page.locator('#full-name');
    await expect(offer).toHaveValue('business');
    await name.fill('Synthetic navigation draft');
    for (const [kind, values] of [['package', packages], ['plan', plans]] as const) {
      await expect(page.locator('[data-' + kind + '-select]')).toHaveCount(values.length);
      for (const value of values) {
        await page.locator('[data-' + kind + '-select="' + value + '"]').click();
        await expect(page).toHaveURL(url => url.searchParams.get(kind) === value && url.hash === '#contact');
        await expect(offer).toHaveValue(value);
        await expect(page.locator('#contact')).toBeInViewport();
        await page.goBack();
        await expect(offer).toHaveValue('business');
        await expect(name).toHaveValue('Synthetic navigation draft');
        await page.goForward();
        await expect(offer).toHaveValue(value);
        await page.goBack();
      }
    }
    for (const [query, value] of [['package=pro', 'pro'], ['plan=care', 'care'], ['package=custom', 'custom'],
      ['package=care', 'business'], ['plan=starter', 'business'], ['package=unknown', 'business'], ['plan=unknown', 'business']]) {
      await page.goto('/?' + query + '#contact');
      await expect(offer).toHaveValue(value);
      await page.reload();
      await expect(offer).toHaveValue(value);
    }
    const faqs = page.locator('#faq details');
    await expect(faqs).toHaveCount(8);
    for (const detail of await faqs.all()) {
      const summary = detail.locator('summary');
      const initial = await detail.evaluate((node: HTMLDetailsElement) => node.open);
      await summary.press('Enter');
      await expect(detail).toHaveJSProperty('open', !initial);
      await summary.press('Enter');
      await expect(detail).toHaveJSProperty('open', initial);
    }
    if (width < 1440) {
      for (const [section, inclusion] of [['packages', 'Single Page Website'], ['support-plans', 'Website Updates']]) {
        const detail = page.locator('#' + section + ' .plan-details').first();
        await detail.locator('summary').press('Enter');
        await expect(detail).toHaveJSProperty('open', true);
        await expect(detail.getByText(inclusion, { exact: false }).first()).toBeVisible();
      }
    }
  });
}

test('Booking Desk keyboard and touch interaction stays local and transient', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
    await page.goto('/');
    await expect(page.locator('[data-demo-controls]')).toBeVisible();
    const requests: string[] = [];
    page.on('request', request => requests.push(request.url()));
    const initial = await page.evaluate(() => [Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]);
    const confirm = page.locator('[data-demo-confirm]');
    await expect(confirm).toBeDisabled();
    await page.locator('[name="demo-service"]:checked').press('ArrowRight');
    await page.locator('[name="demo-slot"]').first().press('Space');
    await confirm.press('Enter');
    const entry = page.locator('[data-demo-entry]');
    await expect(entry).toContainText('Planning session');
    await expect(entry).toContainText('18 May 2027, 09:00 IST');
    await expect(entry).toContainText('45 min');
    await page.locator('[data-demo-check-in]').tap();
    await expect(page.locator('[data-demo-state]')).toHaveText('Checked in');
    await page.locator('[name="demo-slot"]:checked').press('ArrowRight');
    await expect(entry).toBeHidden();
    await page.locator('[data-demo-reset]').tap();
    await expect(confirm).toBeDisabled();
    await expect(page.locator('[data-demo-empty]')).toBeVisible();
    expect(requests).toEqual([]);
    await expect(page).toHaveURL(baseURL + '/');
    expect(await page.evaluate(() => [Object.entries(localStorage), Object.entries(sessionStorage), document.cookie])).toEqual(initial);
    await page.reload();
    await expect(entry).toBeHidden();
  } finally {
    await context.close();
  }
});

// The homepage chronograph was replaced by the approved SIGNAL hero.
// Its interaction/fallback coverage is now in signal.spec.ts; historical source remains in Git.

test('contact preserves a failed draft, verifies receipts, and suppresses duplicate submits', async ({ page }) => {
  await page.goto('/?plan=care#contact');
  const form = page.locator('#project-form');
  const button = page.locator('#form-submit-btn');
  const feedback = page.locator('#contact-announcement');
  const sent: { submissionId: string; description: string; offer: unknown }[] = [];
  let mode = 'wrong';
  await page.route('**' + contact, async route => {
    const data = route.request().postDataJSON();
    sent.push(data);
    if (mode === 'offline') return route.abort();
    if (mode === 'html') return route.fulfill({ status: 202, contentType: 'text/html', body: '<p>Unconfirmed</p>' });
    if (mode === 'unavailable') return route.fulfill({ status: 503 });
    if (mode === 'rate') return route.fulfill({ status: 429 });
    await route.fulfill({ status: 202, json: {
      accepted: true, status: 'received', submissionId: mode === 'wrong' ? 'mismatch' : data.submissionId,
    } });
  });
  await button.click();
  await expect(page.locator('#full-name')).toBeFocused();
  expect(sent).toHaveLength(0);
  const fields = {
    '#full-name': 'Synthetic browser name',
    '#business-name': 'Synthetic browser business',
    '#contact-info': 'synthetic-browser@example.test',
    '#project-description': 'Synthetic first brief',
  };
  for (const [selector, value] of Object.entries(fields)) await page.locator(selector).fill(value);
  await form.evaluate((element: HTMLFormElement) => {
    element.dataset.endpoint = '/unexpected-receiver';
    (element.querySelector('#website') as HTMLInputElement).value = 'synthetic-bot';
    element.requestSubmit();
  });
  await expect(feedback).toContainText('rejected');
  expect(sent).toHaveLength(0);
  await form.evaluate((element: HTMLFormElement) => {
    (element.querySelector('#website') as HTMLInputElement).value = '';
    (element.querySelector('#full-name') as HTMLInputElement).value = 'x'.repeat(101);
    element.requestSubmit();
  });
  await expect(page.locator('#full-name')).toBeFocused();
  expect(sent).toHaveLength(0);
  await page.locator('#full-name').fill(fields['#full-name']);
  await button.click();
  await expect(feedback).toContainText('could not confirm receipt');
  await expect(button).toBeEnabled();
  for (const [selector, value] of Object.entries(fields)) await expect(page.locator(selector)).toHaveValue(value);
  expect(sent).toHaveLength(1);
  expect(sent[0].offer).toEqual({ type: 'support', id: 'care' });
  expect(sent[0]).not.toHaveProperty('botToken');
  for (const [failure, message] of [['html', 'could not confirm receipt'],
    ['unavailable', 'unavailable'], ['rate', 'Too many attempts'], ['offline', 'could not confirm receipt']]) {
    mode = failure;
    await button.click();
    await expect(feedback).toContainText(message);
    await expect(page.locator('#contact-success-msg')).toBeHidden();
    await expect(button).toBeEnabled();
    for (const [selector, value] of Object.entries(fields)) await expect(page.locator(selector)).toHaveValue(value);
  }
  const failedAttempts = sent.length;
  expect(failedAttempts).toBe(5);
  mode = 'accepted';
  await form.evaluate((element: HTMLFormElement) => {
    element.requestSubmit();
    element.requestSubmit();
    element.requestSubmit();
  });
  await expect(feedback).toHaveText('Enquiry received.');
  expect(sent).toHaveLength(failedAttempts + 1);
  expect(new Set(sent.map(item => item.submissionId))).toEqual(new Set([sent[0].submissionId]));
  await button.click();
  await expect(feedback).toHaveText('Enquiry received.');
  expect(sent).toHaveLength(failedAttempts + 1);
  await page.locator('#project-description').fill('Materially changed synthetic brief');
  await button.click();
  await expect(feedback).toHaveText('Enquiry received.');
  expect(sent).toHaveLength(failedAttempts + 2);
  expect(sent.at(-1)?.submissionId).not.toBe(sent[0].submissionId);
  for (const value of Object.values(fields)) expect(decodeURIComponent(page.url())).not.toContain(value);
  expect(await page.evaluate(() => [Object.entries(localStorage), Object.entries(sessionStorage)])).toEqual([[], []]);
});

test('built Fastify does not serve sensitive paths or the retired endpoint', async ({ request }) => {
  for (const path of ['/backend/src/app.ts', '/.env', '/.env.local-runtime', '/backups/synthetic.dump',
    '/.vite/manifest.json', '/_headers', '/api/contact', '/unknown?value=synthetic-private-marker']) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'not_found' });
  }
  const obsolete = await request.post('/api/contact', { data: { synthetic: true } });
  expect(obsolete.status()).toBe(404);
  expect(await obsolete.json()).toEqual({ error: 'not_found' });
});
