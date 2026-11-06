import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Text from the owner-approved V1 main content; decorative icons are excluded.
const legalHashes = {
  privacy: 'ebba5e2b07bdf3fd7bc1b121a3494fbf940f95d8b6a621996cdf822c9cc2962f',
  terms: '324d2354be022a895db5971141289a1fb13937d12a1b845db8cae2cd59bd8ced',
};

test('V2 preserves approved legal content and serves the showcase through Fastify', async ({ page, request }) => {
  for (const [route, expected] of Object.entries(legalHashes)) {
    await page.goto(`/${route}/`);
    const text = await page.locator('main').evaluate(el => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('svg').forEach(icon => icon.remove());
      return copy.textContent!.replace(/\s+/g, ' ').trim();
    });
    expect(createHash('sha256').update(text).digest('hex')).toBe(expected);
  }
  const image = await request.get('/images/studio-v1.png');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/png');
  expect(image.headers()['cache-control']).toBe('no-cache');
});

for (const width of [320, 390, 768, 1440, 1920]) {
  test(`V2 reading layouts and assets remain usable at ${width}px`, async ({ page, baseURL }, info) => {
    await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
    await page.setViewportSize({ width, height: 960 });
    const failures: string[] = [];
    page.on('pageerror', error => failures.push(error.message));
    for (const path of ['/', '/privacy/', '/terms/']) {
      await page.goto(path);
      // The compiled V2 stylesheet must really be served, not just linked in HTML.
      await expect(page.locator('body')).toHaveCSS('font-family', /Inter/);
      await expect(page.locator('body')).toHaveCSS('background-color', path === '/' ? 'rgb(11, 13, 16)' : 'rgb(243, 240, 232)');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (width === 390) {
        await page.evaluate(() => document.documentElement.style.fontSize = '200%');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
      }
      await expect(page.locator('h1')).toBeVisible();
      if (path === '/') {
        const showcase = page.locator('.project-visual img');
        await showcase.scrollIntoViewIfNeeded();
        await expect.poll(() => showcase.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
        const disclosure = page.locator('#support-plans details').first();
        await disclosure.locator('summary').press('Enter');
        await expect(disclosure.getByText('Website Updates', { exact: false })).toBeVisible();
        await expect(disclosure.locator('summary')).toBeFocused();
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`${path.replaceAll('/', '') || 'home'}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    expect(failures).toEqual([]);
  });
}

test('V2 content, disclosures and direct contact remain available without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.signal-hero a[href="#contact"]')).toBeVisible();
    await expect(page.locator('[data-demo-fallback]')).toBeVisible();
    await expect(page.locator('#form-submit-btn')).toBeDisabled();
    await expect(page.locator('#project-form noscript p')).toBeVisible();
    expect(await page.locator('#project-form noscript p').evaluate(el => el.textContent)).toContain('direct email or WhatsApp');
    const detail = page.locator('#packages details').first();
    await detail.locator('summary').click();
    await expect(detail.getByText('Single Page Website')).toBeVisible();
  } finally { await context.close(); }
});
