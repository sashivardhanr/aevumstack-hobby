import type { Offer } from '../../backend/src/modules/enquiries/offer';

export const ENQUIRY_ENDPOINT = '/api/v1/enquiries';
const limits = { fullName: 100, businessName: 160, contactInfo: 254, description: 5000 };

export interface Brief {
  fullName: string;
  businessName: string;
  contactInfo: string;
  description: string;
  website: string;
}

export interface EnquiryPayload extends Brief {
  offer: Offer;
  submissionId: string;
}

export function normalizeBrief(brief: Brief): Brief {
  return {
    fullName: brief.fullName.trim(),
    businessName: brief.businessName.trim(),
    contactInfo: brief.contactInfo.trim(),
    description: brief.description.replace(/\r\n?/g, '\n').trim(),
    website: brief.website.trim(),
  };
}

function isValidContactInfo(value: string) {
  const val = value.trim();
  if (value.length > limits.contactInfo || /[\x00-\x1f\x7f]/.test(val)) return false;
  if (val.includes('@')) {
    const email = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    return val.split('@')[0].length <= 64 && email.test(val);
  }
  const digits = val.replace(/\D/g, '').length;
  return /^\+?[0-9 \-().]{7,25}$/.test(val) && digits >= 7 && digits <= 15;
}

export function validateBrief(brief: Brief): Partial<Record<keyof Brief, string>> {
  const errors: Partial<Record<keyof Brief, string>> = {};
  const required = { fullName: 'your name', businessName: 'your business name', description: 'a brief project description' };
  for (const field of ['fullName', 'businessName', 'description'] as const) {
    const value = brief[field];
    if (!value.trim()) errors[field] = `Please enter ${required[field]}`;
    else if (value.length > limits[field] || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) || (field !== 'description' && /[\r\n]/.test(value))) {
      errors[field] = `Please enter a valid value (maximum ${limits[field]} characters)`;
    }
  }
  if (!isValidContactInfo(brief.contactInfo)) errors.contactInfo = 'Please provide a valid email or phone number';
  if (brief.website.trim()) errors.website = 'Unable to submit this enquiry.';
  return errors;
}

export type EnquiryResult = 'received' | 'unknown' | 'unavailable' | 'invalid' | 'too-large' | 'rate-limited' | 'conflict' | 'rejected';

export async function deliverEnquiry(payload: EnquiryPayload, { timeoutMs = 15_000, fetchImpl = fetch } = {}): Promise<EnquiryResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(ENQUIRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    switch (response.status) {
      case 400: return 'invalid';
      case 413: return 'too-large';
      case 429: return 'rate-limited';
      case 409: return 'conflict';
      case 403: case 415: return 'rejected';
      case 404: case 503: return 'unavailable';
      case 202: break;
      default: return 'unknown';
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) return 'unknown';
    const receipt = await response.json();
    return receipt?.accepted === true && receipt.submissionId === payload.submissionId && receipt.status === 'received'
      ? 'received' : 'unknown';
  } catch {
    // A lost or delayed response can follow a successful commit.
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}
