import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NormalizedEnquiry } from './schema.js';

export function canonicalEnquiry(enquiry: NormalizedEnquiry): string {
  return JSON.stringify({
    fullName: enquiry.fullName,
    businessName: enquiry.businessName,
    contactInfo: enquiry.contactInfo,
    offerType: enquiry.offerType,
    offerId: enquiry.offerId,
    description: enquiry.description,
  });
}

export function payloadHmac(enquiry: NormalizedEnquiry, secret: string): string {
  return createHmac('sha256', secret).update(canonicalEnquiry(enquiry), 'utf8').digest('hex');
}

export function hmacMatches(stored: string, candidate: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(stored) || !/^[a-f0-9]{64}$/.test(candidate)) return false;
  return timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(candidate, 'hex'));
}
