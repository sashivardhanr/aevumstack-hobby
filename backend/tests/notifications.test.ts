import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { loadWorkerConfig } from '../src/config/worker.js';
import { acceptEnquiry } from '../src/modules/enquiries/service.js';
import { enquiryRequestSchema } from '../src/modules/enquiries/schema.js';
import { claimNotification, retryDelaySeconds } from '../src/modules/notifications/outbox.js';
import { createMailpitSender } from '../src/modules/notifications/mailpit.js';
import { DeliveryError } from '../src/modules/notifications/sender.js';
import { renderEnquiry } from '../src/modules/notifications/template.js';
import { processNotification, runWorker } from '../src/modules/notifications/worker.js';
import { createTestDatabase, type TestDatabase } from './helpers/database.js';

function sampleRequest() {
  return {
    submissionId: randomUUID(), fullName: 'Synthetic <script> & "test"', businessName: 'Example & Co',
    contactInfo: 'visitor@example.invalid', offer: { type: 'support', id: 'care' }, description: 'Line 1\n<img src=x onerror=alert(1)>',
  };
}

const testKey = 'synthetic-test-key-for-outbox-fixtures';

describe('outbox and notification processing', () => {
  let db: TestDatabase;
  beforeAll(async () => { db = await createTestDatabase(); });
  afterAll(async () => { await db?.close(); });

  async function enqueue() {
    const request = enquiryRequestSchema.parse(sampleRequest());
    expect(await acceptEnquiry(db.pool, testKey, request)).toBe('accepted');
    return request.submissionId;
  }

  async function job(id: string) {
    return (await db.pool.query('SELECT * FROM email_outbox WHERE enquiry_id = $1', [id])).rows[0];
  }

  it('commits one enquiry and one intent and keeps both unique on retries', async () => {
    const request = enquiryRequestSchema.parse(sampleRequest());
    expect(await acceptEnquiry(db.pool, testKey, request)).toBe('accepted');
    expect(await acceptEnquiry(db.pool, testKey, request)).toBe('accepted');
    expect(await acceptEnquiry(db.pool, testKey, { ...request, description: 'Changed' })).toBe('conflict');
    const result = await db.pool.query(`
      SELECT e.submission_id, o.status FROM enquiries e JOIN email_outbox o ON o.enquiry_id = e.submission_id
      WHERE e.submission_id = $1
    `, [request.submissionId]);
    expect(result.rows).toEqual([{ submission_id: request.submissionId, status: 'pending' }]);
    await db.pool.query("UPDATE email_outbox SET available_at = now() + interval '1 day' WHERE enquiry_id = $1", [request.submissionId]);
  });

  it('rolls back the enquiry when the notification insert fails', async () => {
    const request = enquiryRequestSchema.parse(sampleRequest());
    await db.pool.query("ALTER TABLE email_outbox ADD CONSTRAINT reject_new_jobs CHECK (false) NOT VALID");
    try {
      await expect(acceptEnquiry(db.pool, testKey, request)).rejects.toMatchObject({ code: '23514' });
      const result = await db.pool.query('SELECT submission_id FROM enquiries WHERE submission_id = $1', [request.submissionId]);
      expect(result.rowCount).toBe(0);
      expect(await job(request.submissionId)).toBeUndefined();
    } finally {
      await db.pool.query('ALTER TABLE email_outbox DROP CONSTRAINT reject_new_jobs');
    }
  });

  it('claims a due job, waits for send acceptance, then marks it sent', async () => {
    const id = await enqueue();
    await processNotification(db.pool, {
      async send(jobId, message) {
        expect(await job(id)).toMatchObject({ id: jobId, status: 'processing', attempt_count: 1, sent_at: null });
        expect(message.text).toContain('Support plan: care');
      },
    }, 5);
    expect(await job(id)).toMatchObject({ status: 'sent', attempt_count: 1, claim_token: null, last_error_code: null });
    expect((await job(id)).sent_at).toBeInstanceOf(Date);
  });

  it('reschedules temporary errors and keeps a terminal record when attempts are exhausted', async () => {
    const id = await enqueue();
    const sender = { async send() { throw new Error('synthetic private SMTP response with credentials and customer data'); } };
    await processNotification(db.pool, sender, 2);
    const pending = await job(id);
    expect(pending).toMatchObject({ status: 'pending', attempt_count: 1, last_error_code: 'smtp_temporary' });
    expect(pending.available_at.getTime() - pending.updated_at.getTime()).toBe(5_000);
    expect(await processNotification(db.pool, sender, 2)).toBe(false);
    await db.pool.query('UPDATE email_outbox SET available_at = now() WHERE enquiry_id = $1', [id]);
    await processNotification(db.pool, sender, 2);
    expect(await job(id)).toMatchObject({ status: 'failed', attempt_count: 2, last_error_code: 'smtp_temporary' });
    expect((await db.pool.query('SELECT 1 FROM enquiries WHERE submission_id = $1', [id])).rowCount).toBe(1);
  });

  it('records a permanent SMTP rejection immediately', async () => {
    const id = await enqueue();
    await processNotification(db.pool, { async send() { throw new DeliveryError('smtp_rejected'); } }, 5);
    expect(await job(id)).toMatchObject({ status: 'failed', attempt_count: 1, last_error_code: 'smtp_rejected' });
  });

  it('records an expired last attempt as terminal', async () => {
    const id = await enqueue();
    const claim = await claimNotification(db.pool, 1);
    expect(claim?.submission_id).toBe(id);
    await db.pool.query(`UPDATE email_outbox SET locked_at = now() - interval '2 minutes',
      lease_expires_at = now() - interval '1 minute' WHERE enquiry_id = $1`, [id]);
    expect(await claimNotification(db.pool, 1)).toBeUndefined();
    expect(await job(id)).toMatchObject({ status: 'failed', last_error_code: 'lease_expired', claim_token: null });
  });

  it('drains an in-flight send on shutdown and leaves another queued job pending', async () => {
    const first = await enqueue();
    const second = await enqueue();
    await db.pool.query("UPDATE email_outbox SET available_at = now() - interval '1 second' WHERE enquiry_id = $1", [first]);
    const controller = new AbortController();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const worker = runWorker(db.pool, {
      async send() { entered.resolve(); await release.promise; },
    }, 5, controller.signal, () => { entered.reject(new Error('unexpected worker database error')); });
    await entered.promise;
    controller.abort();
    expect((await job(first)).status).toBe('processing');
    release.resolve();
    await worker;
    expect((await job(first)).status).toBe('sent');
    expect((await job(second)).status).toBe('pending');
  });
});

describe('local delivery safety', () => {
  it('escapes all enquiry values in HTML and keeps the plain text readable', () => {
    const rendered = renderEnquiry({
      submission_id: 'fixture', full_name: '<script>&"\'', business_name: null,
      contact_info: 'person@example.invalid', offer_type: 'website_package', offer_id: 'business',
      description: 'First\n<img src=x>', created_at: new Date('2026-01-02T03:04:05Z'),
    });
    expect(rendered.html).toContain('&lt;script&gt;&amp;&quot;&#39;');
    expect(rendered.html).toContain('First<br>&lt;img src=x&gt;');
    expect(rendered.html).not.toMatch(/<script|<img|https?:/);
    expect(rendered.text).toContain('Website package: business');
    expect(rendered.text).toContain('2026-01-02T03:04:05.000Z');
    expect(rendered.text).not.toContain('Business:');
  });

  it('rejects remote hosts, SMTP authentication settings and invalid attempt limits', () => {
    expect(loadWorkerConfig({})).toEqual({ smtp: { host: '127.0.0.1', port: 1025 }, maxAttempts: 5 });
    expect(() => loadWorkerConfig({ SMTP_HOST: 'smtp.example.invalid' })).toThrow();
    expect(() => loadWorkerConfig({ SMTP_HOST: 'mailpit' })).toThrow();
    expect(() => loadWorkerConfig({ SMTP_PASSWORD: 'synthetic-secret' })).toThrow();
    expect(() => loadWorkerConfig({ SMTP_URL: 'smtp://example.invalid' })).toThrow();
    expect(() => loadWorkerConfig({ OUTBOX_MAX_ATTEMPTS: '0' })).toThrow();
    expect(() => createMailpitSender({ host: 'localhost', port: 1025 })).toThrow();
  });

  it('bounds exponential retry delays', () => {
    expect([1, 2, 3, 4, 8, 20].map(retryDelaySeconds)).toEqual([5, 10, 20, 40, 300, 300]);
  });
});
