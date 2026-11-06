import type { Pool } from 'pg';
import { payloadHmac } from './idempotency.js';
import { persistEnquiry } from './repository.js';
import { normalizeEnquiry, type EnquiryRequest } from './schema.js';

export type AcceptEnquiryResult = 'accepted' | 'conflict';

export async function acceptEnquiry(pool: Pool, secret: string, request: EnquiryRequest): Promise<AcceptEnquiryResult> {
  const normalized = normalizeEnquiry(request);
  const hmac = payloadHmac(normalized, secret);
  const result = await persistEnquiry(pool, request.submissionId, normalized, hmac);
  return result.kind;
}
