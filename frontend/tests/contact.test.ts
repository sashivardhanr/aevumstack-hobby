import { describe, expect, it, vi } from 'vitest';
import { deliverEnquiry, ENQUIRY_ENDPOINT, normalizeBrief, validateBrief, type EnquiryPayload } from '../src/contact';

const payload: EnquiryPayload = {
  submissionId: 'e6924fe5-d12c-47ca-a2e9-7f412914a264', fullName: 'Synthetic Example',
  businessName: 'Local Fixture', contactInfo: 'visitor@example.invalid',
  offer: { type: 'support', id: 'care' }, description: 'Synthetic enquiry', website: '',
};
const receipt = { accepted: true, status: 'received', submissionId: payload.submissionId };

describe('Vite enquiry client', () => {
  it('validates the brief and normalizes whitespace and newline forms consistently', () => {
    expect(validateBrief(payload)).toEqual({});
    expect(validateBrief({ ...payload, contactInfo: 'invalid', website: 'spam' })).toMatchObject({
      contactInfo: expect.any(String), website: expect.any(String),
    });
    expect(normalizeBrief({ ...payload, fullName: ' Synthetic Example ', description: ' First\r\nSecond\r ' }))
      .toMatchObject({ fullName: 'Synthetic Example', description: 'First\nSecond' });
  });

  it('accepts formatted and international contact details through the active validator', () => {
    for (const contactInfo of ['visitor+brief@example.test', '+91 88972 02737', '+1 (555) 234-5678', '9876543210']) {
      expect(validateBrief({ ...payload, contactInfo })).not.toHaveProperty('contactInfo');
    }
  });

  it('rejects short phones, invalid email domains, and control characters', () => {
    for (const contactInfo of ['123', '+123', 'visitor@-example.test', 'visitor\n@example.test']) {
      expect(validateBrief({ ...payload, contactInfo })).toHaveProperty('contactInfo');
    }
  });

  it('sends only to the fixed same-origin URL and verifies a complete HTTP 202 receipt', async () => {
    const fetchImpl = vi.fn(async () => Response.json(receipt, { status: 202 }));
    expect(await deliverEnquiry(payload, { fetchImpl })).toBe('received');
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(ENQUIRY_ENDPOINT, expect.objectContaining({
      method: 'POST', body: JSON.stringify(payload), redirect: 'error', credentials: 'same-origin',
    }));
  });

  it.each([
    [200, receipt], [202, { ...receipt, status: 'sent' }], [202, { ...receipt, accepted: false }],
    [202, { ...receipt, submissionId: 'unrelated' }], [202, {}],
  ])('rejects an unconfirmed response with status %s', async (status, body) => {
    expect(await deliverEnquiry(payload, { fetchImpl: async () => Response.json(body, { status }) })).toBe('unknown');
  });

  it.each([
    [400, 'invalid'], [403, 'rejected'], [409, 'conflict'], [413, 'too-large'], [429, 'rate-limited'],
    [503, 'unavailable'], [502, 'unknown'],
  ])('classifies HTTP %s safely', async (status, result) => {
    expect(await deliverEnquiry(payload, { fetchImpl: async () => new Response(null, { status }) })).toBe(result);
  });

  it('aborts a stalled request and treats its outcome as unknown', async () => {
    vi.useFakeTimers();
    try {
      const delivery = deliverEnquiry(payload, {
        timeoutMs: 100,
        fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        }),
      });
      await vi.advanceTimersByTimeAsync(100);
      expect(await delivery).toBe('unknown');
    } finally {
      vi.useRealTimers();
    }
  });
});
