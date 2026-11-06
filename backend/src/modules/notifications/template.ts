import type { OfferType } from '../enquiries/schema.js';

export interface EnquiryDetails {
  submission_id: string;
  full_name: string;
  business_name: string | null;
  contact_info: string;
  offer_type: OfferType;
  offer_id: string;
  description: string;
  created_at: Date;
}

export interface Notification {
  subject: string;
  text: string;
  html: string;
}

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => entities[character]);

export function renderEnquiry(details: EnquiryDetails): Notification {
  const fields: [string, string][] = [
    ['Submission ID', details.submission_id],
    ['Name', details.full_name],
  ];
  if (details.business_name) fields.push(['Business', details.business_name]);
  fields.push(
    ['Contact', details.contact_info],
    [details.offer_type === 'support_plan' ? 'Support plan' : 'Website package', details.offer_id],
    ['Submitted (UTC)', details.created_at.toISOString()],
  );

  return {
    subject: 'New AEVUM STACK enquiry',
    text: `New enquiry\n\n${fields.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nDescription\n${details.description}`,
    html: `<h1>New enquiry</h1><dl>${fields.map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl><h2>Description</h2><p>${escapeHtml(details.description).replace(/\n/g, '<br>')}</p>`,
  };
}
