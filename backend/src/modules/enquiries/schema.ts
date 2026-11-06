import { z } from 'zod';
import { WEBSITE_PACKAGES, SUPPORT_PLANS, type Offer } from './offer.js';

export type OfferId = Offer['id'];
export type OfferType = 'website_package' | 'support_plan';

export interface NormalizedEnquiry {
  fullName: string;
  businessName: string | null;
  contactInfo: string;
  offerId: OfferId;
  offerType: OfferType;
  description: string;
}

const controlCharacters = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const phonePattern = /^\+?[0-9 \-().]{7,25}$/;

function validContactInfo(value: string): boolean {
  const contact = value.trim();
  if (controlCharacters.test(contact) || /[\r\n]/.test(contact)) return false;
  if (contact.includes('@')) {
    return contact.split('@')[0].length <= 64 && emailPattern.test(contact);
  }
  const digitCount = contact.replace(/\D/g, '').length;
  return phonePattern.test(contact) && digitCount >= 7 && digitCount <= 15;
}

const contactInfoSchema = z.string().max(254).refine(validContactInfo, 'Enter an email address or international phone number').transform((value) => value.trim());
const fieldText = (max: number, required: boolean) => z.string().max(max).refine((value) => !controlCharacters.test(value), 'Control characters are not allowed').refine((value) => !required || value.trim().length > 0, 'This field is required').transform((value) => value.trim());

export const enquiryRequestSchema = z.object({
  fullName: fieldText(100, true),
  businessName: fieldText(160, false).optional(),
  contactInfo: contactInfoSchema,
  offer: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('website'), id: z.enum(WEBSITE_PACKAGES) }),
    z.strictObject({ type: z.literal('support'), id: z.enum(SUPPORT_PLANS) }),
  ]),
  description: z.string().max(5_000).refine((value) => !controlCharacters.test(value), 'Control characters are not allowed').refine((value) => value.trim().length > 0, 'This field is required').transform((value) => value.replace(/\r\n?/g, '\n').trim()),
  website: z.string().max(160).optional().default('').refine((value) => value.trim() === '', 'The anti-spam field must be empty'),
  submissionId: z.uuid(),
}).strict();

export type EnquiryRequest = z.infer<typeof enquiryRequestSchema>;

export function normalizeEnquiry(request: EnquiryRequest): NormalizedEnquiry {
  const offerId = request.offer.id;
  const businessName = request.businessName?.trim() || null;
  return {
    fullName: request.fullName,
    businessName,
    contactInfo: request.contactInfo,
    offerId,
    offerType: request.offer.type === 'support' ? 'support_plan' : 'website_package',
    description: request.description,
  };
}
