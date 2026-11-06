import { mkdir, mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { closedLoopbackPort, createServices, endpoint, origin } from './services';

const services = createServices();

test.beforeAll(async () => {
  await services.migrate();
  await services.startApi();
});
test.afterEach(async () => services.stopWorker());
test.afterAll(async () => services.close());

test.beforeEach(async ({ page }) => {
  // Keep test browser traffic local, including link previews and remote fonts.
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
  });
});

const button = (page: Page) => page.locator('#form-submit-btn');
const notice = (page: Page) => page.locator('#contact-announcement');

async function fill(page: Page, description: string) {
  await page.locator('#full-name').fill('Synthetic Example');
  await page.locator('#business-name').fill('Local Fixture');
  await page.locator('#contact-info').fill('visitor@example.invalid');
  await page.locator('#project-description').fill(description);
}

async function submit(page: Page, status: number) {
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === endpoint && res.request().method() === 'POST');
  await button(page).click();
  const result = await response;
  expect(result.status()).toBe(status);
  return result;
}

async function received(page: Page, description: string) {
  await fill(page, description);
  const res = await submit(page, 202);
  const payload = res.request().postDataJSON();
  expect(await res.json()).toEqual({ accepted: true, status: 'received', submissionId: payload.submissionId });
  expect(await res.request().headerValue('origin')).toBe(origin);
  expect(await res.headerValue('access-control-allow-origin')).toBeNull();
  await expect(notice(page)).toHaveText('Enquiry received.');
  await expect(page.locator('#contact-success-msg')).toBeVisible();
  return payload;
}

test('Vite does not serve a synthetic backup fixture outside the frontend through /@fs', async ({ request, page }) => {
  await mkdir('artifacts', { recursive: true });
  const dir = await mkdtemp(resolve('artifacts/phase6-private-'));
  const marker = 'synthetic-backup-file-must-not-be-served';
  const file = join(dir, 'backup.dump');
  try {
    await writeFile(file, marker, { mode: 0o600, flag: 'wx' });
    const denied = await request.get('/@fs' + file.replaceAll('\\\\', '/'));
    expect(denied.status()).toBe(403);
    expect(await denied.text()).not.toContain(marker);
    // The narrow allowlist must still permit the frontend's shared offer catalogue.
    await page.goto('/?plan=care#contact');
    await expect(page.locator('#selected-package')).toHaveValue('care');
  } finally {
    try { await rm(file, { force: true }); } finally { await rmdir(dir); }
  }
});

test('the visible skip link bypasses the fixed header on all routes', async ({ page, browserName }) => {
  const tab = process.platform === 'darwin' && browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  for (const route of ['/', '/privacy/', '/terms/']) {
    await page.goto(route);
    await page.keyboard.press(tab);
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    expect(await skip.evaluate((link) => {
      const { x, y, width, height } = link.getBoundingClientRect();
      return link.contains(document.elementFromPoint(x + width / 2, y + height / 2));
    })).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  }
});

test('content reflows at a narrow width with 200% root text size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/privacy/', '/terms/']) {
    await page.goto(route);
    expect(await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
      return document.documentElement.scrollWidth <= innerWidth;
    })).toBe(true);
  }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
  test(`website and support submissions reach Mailpit at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await services.startWorker();
    await page.goto('/');
    for (const item of [
      { selector: '[data-package-select="starter"]', type: 'website', id: 'starter', stored: 'website_package', label: 'Website package' },
      { selector: '[data-plan-select="care"]', type: 'support', id: 'care', stored: 'support_plan', label: 'Support plan' },
    ]) {
      await page.locator(item.selector).click();
      await expect(page.locator('#selected-package')).toHaveValue(item.id);
      await expect(page.locator('#contact')).toBeInViewport();
      const payload = await received(page, `Synthetic ${item.type} enquiry at ${viewport.width}px`);
      expect(payload.offer).toEqual({ type: item.type, id: item.id });
      await expect.poll(() => services.job(payload.submissionId)).toEqual([
        expect.objectContaining({ offer_type: item.stored, offer_id: item.id, status: 'sent', attempt_count: 1 }),
      ]);
      const [job] = await services.job(payload.submissionId);
      const messages = await services.messages(job.id);
      expect(messages).toHaveLength(1);
      expect(messages[0].Text).toContain(`${item.label}: ${item.id}`);
      expect(messages[0].HTML).toContain(payload.submissionId);
      expect(messages[0].To.map((address: { Address: string }) => address.Address)).toEqual(['enquiries@aevumstack.invalid']);
    }
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    expect(page.url()).not.toContain('visitor');
    for (const path of ['/privacy/', '/terms/']) expect((await page.goto(path))?.status()).toBe(200);
  });
}

test('worker downtime and SMTP outage preserve accepted enquiries and recover', async ({ page }) => {
  await page.goto('/');
  const payload = await received(page, 'Synthetic notification outage');
  const [queued] = await services.job(payload.submissionId);
  expect(queued).toMatchObject({ status: 'pending', attempt_count: 0 });
  expect(await services.messages(queued.id)).toHaveLength(0);
  await services.startWorker(await closedLoopbackPort());
  await expect.poll(() => services.job(payload.submissionId)).toEqual([
    expect.objectContaining({ id: queued.id, status: 'pending', attempt_count: 1, last_error_code: 'smtp_temporary' }),
  ]);
  await expect(page.locator('#contact-success-msg')).toBeVisible();
  expect((await page.request.get('/api/health/ready')).status()).toBe(200);
  await services.startWorker();
  await expect.poll(() => services.job(payload.submissionId), { timeout: 12_000 }).toEqual([
    expect.objectContaining({ id: queued.id, status: 'sent', attempt_count: 2 }),
  ]);
  expect(await services.messages(queued.id)).toHaveLength(1);
});

test('keyboard validation, server rejection, wrong origin and unavailable DB fail safely', async ({ page }) => {
  await page.goto('/#contact');
  const posts: string[] = [];
  page.on('request', (req) => { if (new URL(req.url()).pathname === endpoint) posts.push(req.method()); });
  await button(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#full-name')).toBeFocused();
  await expect(page.locator('#full-name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#full-name-error')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#full-name-error')).toBeVisible();
  expect(posts).toEqual([]);

  await fill(page, 'Synthetic invalid server payload');
  const replacePayload = async (overrides: Record<string, unknown>, status: number) => {
    await page.route('**' + endpoint, (route) => route.continue({
      postData: JSON.stringify({ ...route.request().postDataJSON(), ...overrides }),
    }), { times: 1 });
    const res = await submit(page, status);
    await expect(page.locator('#contact-error-msg')).toBeVisible();
    await expect(page.locator('#contact-success-msg')).toBeHidden();
    return res;
  };
  await replacePayload({ contactInfo: 'invalid' }, 400);
  const invalid = await replacePayload({ offer: { type: 'support', id: 'business' } }, 400);
  expect(await services.job(invalid.request().postDataJSON().submissionId)).toHaveLength(0);
  await replacePayload({ description: 'x'.repeat(34_000) }, 413);
  await expect(notice(page)).toContainText('too large');

  await page.goto('http://localhost:5173/#contact');
  await fill(page, 'Synthetic unexpected origin');
  const denied = await submit(page, 403);
  expect(await denied.request().headerValue('origin')).toBe('http://localhost:5173');
  expect(await denied.headerValue('access-control-allow-origin')).toBeNull();
  await expect(notice(page)).toContainText('rejected');

  try {
    const offline = new URL(services.databaseUrl);
    offline.port = String(await closedLoopbackPort());
    await services.startApi({ DATABASE_URL: offline.href });
    await page.goto('/#contact');
    await fill(page, 'Synthetic database outage');
    const failed = await submit(page, 503);
    await expect(notice(page)).toContainText('unavailable');
    await expect(page.locator('#contact-success-msg')).toBeHidden();
    await expect(button(page)).toHaveText(/retry enquiry/i);
    expect(await services.job(failed.request().postDataJSON().submissionId)).toHaveLength(0);
  } finally {
    await services.startApi();
  }
});

test('real rate limiting and malformed acknowledgements never show success', async ({ page }) => {
  try {
    await services.startApi({ API_RATE_LIMIT_MAX: '1' });
    await page.goto('/#contact');
    await fill(page, 'Synthetic rate-limit test');
    await page.route('**' + endpoint, (route) => route.continue({
      postData: JSON.stringify({ ...route.request().postDataJSON(), contactInfo: 'invalid' }),
    }), { times: 1 });
    await submit(page, 400);
    await expect(page.locator('#contact-error-msg')).toBeVisible();
    await submit(page, 429);
    await expect(notice(page)).toContainText('Too many attempts');
  } finally {
    await services.startApi();
  }
  for (const [status, body] of [[202, 'broken JSON'], [200, '{"accepted":true}']] as const) {
    await page.route('**' + endpoint, (route) => route.fulfill({ status, contentType: 'application/json', body }), { times: 1 });
    await submit(page, status);
    await expect(notice(page)).toContainText('could not confirm receipt');
    await expect(page.locator('#contact-success-msg')).toBeHidden();
  }
});

test('lost receipts retry the committed UUID and material edits use a new one', async ({ page }) => {
  await page.goto('/#contact');
  await page.clock.install();
  const postCount = { value: 0 };
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === endpoint && request.method() === 'POST') postCount.value++;
  });
  const rowCounts = async () => (await services.pool.query(
    'SELECT (SELECT count(*)::int FROM enquiries) AS enquiries, (SELECT count(*)::int FROM email_outbox) AS outbox',
  )).rows[0];
  const baseline = await rowCounts();

  async function loseReceipt(description: string) {
    await fill(page, description);
    const committed = Promise.withResolvers<string>();
    const release = Promise.withResolvers<void>();
    await page.route('**' + endpoint, async (route) => {
      try {
        const response = await route.fetch();
        expect(response.status()).toBe(202);
        const { submissionId } = await response.json();
        committed.resolve(submissionId);
        await release.promise;
        await route.abort().catch(() => undefined);
      } catch (error) { committed.reject(error); }
    }, { times: 1 });
    try {
      await page.locator('#project-form').evaluate((form: HTMLFormElement) => {
        form.requestSubmit();
        form.requestSubmit();
        form.requestSubmit();
      });
      await expect(button(page)).toBeDisabled();
      const id = await committed.promise;
      expect(await services.job(id)).toEqual([expect.objectContaining({ status: 'pending' })]);
      await page.clock.fastForward(15_001);
      await expect(notice(page)).toContainText('could not confirm receipt');
      return id;
    } finally { release.resolve(); }
  }

  const first = await loseReceipt('Synthetic saved before timeout');
  expect(postCount.value).toBe(1);
  await page.locator('#project-description').fill('  Synthetic saved before timeout  ');
  const retry = await submit(page, 202);
  expect(retry.request().postDataJSON().submissionId).toBe(first);
  await expect(notice(page)).toHaveText('Enquiry received.');
  expect(await services.job(first)).toHaveLength(1);

  const second = await loseReceipt('Synthetic second uncertain enquiry');
  const changed = await received(page, 'Materially edited synthetic enquiry');
  expect(changed.submissionId).not.toBe(second);
  expect(await services.job(second)).toHaveLength(1);
  expect(await services.job(changed.submissionId)).toHaveLength(1);

  await fill(page, 'Changed content with a forced conflicting UUID');
  await page.route('**' + endpoint, (route) => route.continue({
    postData: JSON.stringify({ ...route.request().postDataJSON(), submissionId: first }),
  }), { times: 1 });
  await submit(page, 409);
  await expect(notice(page)).toContainText('conflict');
  expect(await services.job(first)).toHaveLength(1);
  expect(await rowCounts()).toEqual({ enquiries: baseline.enquiries + 3, outbox: baseline.outbox + 3 });
});
