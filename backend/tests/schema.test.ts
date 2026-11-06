import { describe, expect, it } from 'vitest';
import { enquiryRequestSchema, normalizeEnquiry } from '../src/modules/enquiries/schema.js';
import { canonicalEnquiry, hmacMatches, payloadHmac } from '../src/modules/enquiries/idempotency.js';

const secret = 'test-only-key-material-that-is-at-least-32-bytes';
const validRequest = {
  fullName: '  Ada Example  ',
  businessName: '   ',
  contactInfo: ' ada@example.test ',
  offer: { type: 'website', id: 'business' },
  description: 'Build a site\r\nwith bookings',
  website: '',
  submissionId: 'b43bbfd3-2ec9-4cec-951a-7396e9c10f34',
};

describe('enquiry request validation and normalization', () => {
  it('validates and normalizes text without changing the approved offer ID', () => {
    const parsed = enquiryRequestSchema.parse(validRequest);
    const normalized = normalizeEnquiry(parsed);
    expect(normalized).toEqual({
      fullName: 'Ada Example',
      businessName: null,
      contactInfo: 'ada@example.test',
      offerId: 'business',
      offerType: 'website_package',
      description: 'Build a site\nwith bookings',
    });
  });

  it('accepts all exact source offer identifiers and classifies support plans separately', () => {
    for (const id of ['business', 'starter', 'growth', 'pro', 'custom']) {
      expect(normalizeEnquiry(enquiryRequestSchema.parse({ ...validRequest, offer: { type: 'website', id } })).offerType).toBe('website_package');
    }
    for (const offer of ['care', 'support-growth', 'automation']) {
      const parsed = enquiryRequestSchema.parse({ ...validRequest, offer: { type: 'support', id: offer } });
      expect(normalizeEnquiry(parsed).offerType).toBe('support_plan');
    }
  });

  it('rejects lengths beyond field limits and invalid email or phone values', () => {
    expect(enquiryRequestSchema.safeParse({ ...validRequest, fullName: 'n'.repeat(101) }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...validRequest, businessName: 'b'.repeat(161) }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...validRequest, contactInfo: 'c'.repeat(255) }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...validRequest, description: 'd'.repeat(5_001) }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...validRequest, contactInfo: 'not-a-contact' }).success).toBe(false);
  });

  it('rejects unknown offers, malformed UUIDs, non-empty honeypots, and unexpected fields', () => {
    expect(enquiryRequestSchema.safeParse({ ...validRequest, offer: { type: 'website', id: 'unknown' } }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...validRequest, offer: { type: 'website', id: 'care' } }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...validRequest, offer: { type: 'support', id: 'business' } }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...validRequest, offer: { ...validRequest.offer, extra: true } }).success).toBe(false);
    const { offer, ...legacy } = validRequest;
    expect(enquiryRequestSchema.safeParse({ ...legacy, package: offer.id }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...validRequest, submissionId: 'not-a-uuid' }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...validRequest, website: 'spam' }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...validRequest, botToken: 'unverified-token' }).success).toBe(false);
  });

  it('computes a keyed digest over only the documented normalized enquiry fields', () => {
    const normalized = normalizeEnquiry(enquiryRequestSchema.parse(validRequest));
    const digest = payloadHmac(normalized, secret);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(hmacMatches(digest, digest)).toBe(true);
    expect(hmacMatches(digest, payloadHmac({ ...normalized, description: 'changed' }, secret))).toBe(false);
    expect(canonicalEnquiry(normalized)).not.toContain(validRequest.submissionId);
    expect(canonicalEnquiry(normalized)).not.toContain('"website":');
  });
});
