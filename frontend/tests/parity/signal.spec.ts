import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
});

for (const width of [390, 768, 1440]) {
  test(`SIGNAL hero, navigation identity and real CTAs at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.signal-hero h1')).toHaveText('First impressions.Next moves.');
    await expect(page.locator('.signal-header')).toHaveCSS('background-color', 'rgb(243, 240, 232)');
    await expect(page.locator('.signal-hero')).toHaveCSS('background-color', 'rgb(243, 240, 232)');
    await expect(page.locator('.signal-wordmark')).toBeVisible();
    expect(await page.locator('.signal-wordmark').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page.locator('[data-chronograph-enhancement]')).toHaveCount(0);
    await expect(page.locator('#signal-run')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`signal-${width}.png`), fullPage: true });
    for (const href of ['#contact', '#selected-work']) {
      const link = page.locator(`.signal-hero a[href="${href}"]`);
      await link.focus();
      await link.press('Enter');
      await expect(page).toHaveURL(url => url.hash === href);
      await expect(page.locator(href)).toBeInViewport();
    }
    for (const route of ['/privacy/', '/terms/']) {
      await page.goto(route);
      await expect(page.locator('.signal-wordmark')).toBeVisible();
      await expect(page.locator('main h1')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test('SIGNAL traverses in order with no network/storage effects and can replay or stop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const bench = page.locator('#signal-workbench');
  const run = page.locator('#signal-run');
  const tasks = page.locator('.signal-hero .task-list li.done');
  await page.locator('#full-name').fill('Synthetic preserved draft');
  await run.scrollIntoViewIfNeeded();
  await expect(run).toBeInViewport();
  await page.waitForLoadState('networkidle');
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  const before = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  await run.focus();
  await expect(run).toBeFocused();
  expect(await run.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
  await run.press('Enter');
  await expect(bench).toHaveAttribute('data-stage', 'website');
  await expect(run).toBeDisabled();
  await expect(bench).toHaveAttribute('data-flow', 'booking');
  await expect(bench).toHaveAttribute('data-stage', 'website');
  await expect(bench).toHaveAttribute('data-stage', 'booking');
  await expect(bench).toHaveAttribute('data-stage', 'automation');
  await expect(tasks).toHaveCount(1);
  await expect(tasks).toHaveCount(2);
  await expect(tasks).toHaveCount(3);
  await expect(bench).toHaveAttribute('data-stage', 'complete');
  await expect(run).toBeEnabled();
  await expect(page.locator('#signal-sequence-status')).toContainText('No real booking');
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(before);
  await expect(page.locator('#full-name')).toHaveValue('Synthetic preserved draft');
  await run.click();
  await expect(bench).toHaveAttribute('data-stage', 'website');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(bench).toHaveAttribute('data-stage', 'idle');
  await expect(run).toBeEnabled();
});

test('SIGNAL reduced motion is immediate; the existing Booking Desk remains independent', async ({ page }) => {
  await page.goto('/');
  await page.locator('#signal-sample-start').click();
  await expect(page.locator('#signal-workbench')).toHaveAttribute('data-stage', 'complete');
  await expect(page.locator('.signal-hero .task-list li.done')).toHaveCount(3);
  await expect(page.locator('.signal-hero .traveller')).toHaveCSS('transition-duration', '0s');
  await expect(page.locator('[data-booking-demo]')).toBeVisible();
  // The separate fictional Booking Desk is exercised fully by the existing parity test.
  await expect(page.locator('[data-demo-confirm]')).toBeDisabled();
  await page.locator('[name="demo-slot"]').first().press('Space');
  await page.locator('[data-demo-confirm]').press('Enter');
  await expect(page.locator('[data-demo-entry]')).toBeVisible();
  await expect(page.locator('#signal-workbench')).toHaveAttribute('data-stage', 'complete');
});

test('SIGNAL remains readable without scripts or fonts, with no dead demo controls', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
    await page.goto(baseURL!);
    await expect(page.locator('.signal-wordmark')).toBeVisible();
    await expect(page.locator('.signal-hero .stage')).toHaveCount(3);
    await expect(page.locator('#signal-run')).toBeHidden();
    await expect(page.locator('#signal-sample-start')).toBeHidden();
    await expect(page.locator('.signal-hero a[href="#contact"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  } finally { await context.close(); }
});

test('SIGNAL identity is served consistently and interactive states keep their contrast', async ({ page, request }) => {
  const social = await request.get('/images/signal-social.png');
  expect(social.status()).toBe(200);
  expect(social.headers()['content-type']).toBe('image/png');
  for (const route of ['/', '/privacy/', '/terms/']) {
    await page.goto(route);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://aevumstack.dev/images/signal-social.png');
    await expect(page.locator('.footer-signature img')).toBeVisible();
    const headerCtas = page.locator('.signal-header a.bg-primary-container');
    await expect(headerCtas).toHaveCount(2);
    for (const headerCta of await headerCtas.all()) {
      await expect(headerCta).toHaveCSS('background-color', 'rgb(11, 13, 16)');
      await expect(headerCta).toHaveCSS('color', 'rgb(243, 240, 232)');
    }
    if (route !== '/') {
      await expect(page.locator('main a.bg-primary-container')).toHaveCSS('color', 'rgb(243, 240, 232)');
      await expect(page.locator('main a.bg-primary-container')).toHaveCSS('background-color', 'rgb(11, 13, 16)');
    }
  }
  await page.goto('/');
  const option = page.locator('.demo-option').filter({ has: page.locator('input:checked') }).first();
  await expect(option).toHaveCSS('background-color', 'rgb(11, 13, 16)');
  await expect(option).toHaveCSS('color', 'rgb(243, 240, 232)');
  await page.locator('[name="demo-slot"]').first().press('Space');
  await page.locator('[data-demo-confirm]').click();
  await expect(page.locator('[data-demo-entry]')).toBeVisible();
  await expect(page.locator('[data-demo-state]')).toHaveCSS('background-color', 'rgb(255, 92, 64)');
  await expect(page.locator('[data-demo-state]')).toHaveCSS('color', 'rgb(11, 13, 16)');
  await page.locator('[data-demo-check-in]').click();
  await expect(page.locator('[data-demo-state]')).toContainText('Checked in');
  await expect(page.locator('[data-demo-state]')).toHaveCSS('color', 'rgb(11, 13, 16)');
});

test('SIGNAL contact panel uses two desktop columns and one mobile column', async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/#contact');
    const context = await page.locator('.contact-layout>div').first().boundingBox();
    const form = await page.locator('.contact-panel').boundingBox();
    expect(context).not.toBeNull(); expect(form).not.toBeNull();
    if (width === 1440) {
      expect(Math.abs(context!.y - form!.y)).toBeLessThan(2);
      expect(form!.x).toBeGreaterThan(context!.x + context!.width);
    } else {
      expect(form!.y).toBeGreaterThan(context!.y + context!.height);
    }
    // WebKit reserves a scrollbar gutter; only overflow beyond the viewport is a defect.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
