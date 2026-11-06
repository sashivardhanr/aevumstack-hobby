import { findOffer } from '../../backend/src/modules/enquiries/offer';
import { deliverEnquiry, normalizeBrief, validateBrief, type Brief, type EnquiryResult } from './contact';

const feedback: Record<Exclude<EnquiryResult, 'received'>, string> = {
  unknown: 'We could not confirm receipt. Your enquiry may already be saved. Retry the same details to check.',
  unavailable: 'The enquiry service is unavailable. Your details are still here. Please retry in a moment.',
  invalid: 'The enquiry was rejected. Check your details and try again.',
  'too-large': 'The enquiry is too large. Shorten your description and try again.',
  'rate-limited': 'Too many attempts. Wait before retrying.',
  conflict: 'These details conflict with a previous submission. Review or edit your details before retrying, or use a direct contact link.',
  rejected: 'The enquiry service rejected this request. Try again from this page or use a direct contact link.',
};

function setupContactForm() {
  const form = document.querySelector<HTMLFormElement>('#project-form');
  if (!form || form.dataset.initialized) return;
  const fullName = form.querySelector<HTMLInputElement>('#full-name')!;
  const businessName = form.querySelector<HTMLInputElement>('#business-name')!;
  const contactInfo = form.querySelector<HTMLInputElement>('#contact-info')!;
  const description = form.querySelector<HTMLTextAreaElement>('#project-description')!;
  const website = form.querySelector<HTMLInputElement>('#website')!;
  const selected = form.querySelector<HTMLSelectElement>('#selected-package')!;
  const button = form.querySelector<HTMLButtonElement>('#form-submit-btn')!;
  const label = form.querySelector<HTMLElement>('#submit-btn-text')!;
  const icon = form.querySelector('#submit-btn-icon')!;
  const spinner = form.querySelector('#submit-btn-spinner')!;
  const success = form.querySelector('#contact-success-msg')!;
  const error = form.querySelector('#contact-error-msg')!;
  const detail = form.querySelector('#error-detail')!;
  const announcement = form.querySelector('#contact-announcement')!;
  const contact = document.getElementById('contact');
  const defaultSelection = selected.value;
  const fields = { fullName, businessName, contactInfo, description, offer: selected };
  const attempts = new Map<string, { id: string; received: boolean }>();
  let inFlight = false;

  function setFieldError(field: HTMLElement, message?: string) {
    field.classList.toggle('border-primary-container', !!message);
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
    const hint = document.getElementById(field.getAttribute('aria-describedby') ?? '');
    if (hint) {
      hint.classList.toggle('hidden', !message);
      if (message) hint.textContent = message;
    }
  }

  function clearFeedback() {
    success.classList.add('hidden');
    error.classList.add('hidden');
    announcement.classList.add('sr-only');
    announcement.textContent = '';
    label.textContent = 'Submit enquiry';
  }

  function applySelection() {
    const url = new URL(location.href);
    const legacy = url.hash.startsWith('#contact?') ? new URLSearchParams(url.hash.slice(9)) : new URLSearchParams();
    const params = url.searchParams.has('package') || url.searchParams.has('plan') ? url.searchParams : legacy;
    const packageId = params.get('package');
    const planId = params.get('plan');
    const offer = findOffer(packageId ?? planId ?? '');
    const next = offer?.type === (packageId !== null ? 'website' : 'support') ? offer.id : defaultSelection;
    if (selected.value !== next && !inFlight) clearFeedback();
    selected.value = next;
    if (url.hash.startsWith('#contact?')) contact?.scrollIntoView({ behavior: 'auto' });
  }
  applySelection();
  window.addEventListener('hashchange', applySelection);
  window.addEventListener('popstate', applySelection);

  document.querySelectorAll<HTMLAnchorElement>('[data-package-select], [data-plan-select]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (!contact || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      history.pushState(null, '', link.href);
      applySelection();
      contact.scrollIntoView({ behavior: 'auto' });
    });
  });

  function showResult(result: EnquiryResult) {
    if (result === 'received') {
      success.classList.remove('hidden');
      announcement.textContent = 'Enquiry received.';
      label.textContent = 'Submit enquiry';
      return;
    }
    detail.textContent = feedback[result];
    error.classList.remove('hidden');
    announcement.textContent = feedback[result];
    label.textContent = 'Retry enquiry';
  }

  function readBrief(): Brief {
    return {
      fullName: fullName.value, businessName: businessName.value,
      contactInfo: contactInfo.value, description: description.value, website: website.value,
    };
  }

  for (const [key, field] of Object.entries(fields)) {
    field.addEventListener('input', () => {
      if (!inFlight) clearFeedback();
      if (key === 'offer' ? findOffer(selected.value) : !validateBrief(readBrief())[key as keyof Brief]) {
        setFieldError(field);
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (inFlight) return;
    clearFeedback();

    const brief = readBrief();
    const errors = validateBrief(brief);
    const offer = findOffer(selected.value);
    for (const [key, field] of Object.entries(fields)) {
      setFieldError(field, key === 'offer' ? (offer ? undefined : 'Please select a listed offer') : errors[key as keyof Brief]);
    }
    if (!offer || Object.keys(errors).length) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      if (errors.website) showResult('rejected');
      return;
    }

    const payload = { ...normalizeBrief(brief), offer };
    const fingerprint = JSON.stringify(payload);
    let attempt = attempts.get(fingerprint);
    if (attempt?.received) {
      showResult('received');
      return;
    }
    if (!attempt) {
      attempt = { id: crypto.randomUUID(), received: false };
      attempts.set(fingerprint, attempt);
    }

    inFlight = true;
    form.setAttribute('aria-busy', 'true');
    button.disabled = true;
    label.textContent = 'Submitting…';
    announcement.textContent = 'Submitting enquiry.';
    icon.classList.add('hidden');
    spinner.classList.remove('hidden');

    let result: EnquiryResult = 'unknown';
    try {
      result = await deliverEnquiry({ ...payload, submissionId: attempt.id });
      attempt.received = result === 'received';
    } finally {
      inFlight = false;
      form.removeAttribute('aria-busy');
      button.disabled = false;
      icon.classList.remove('hidden');
      spinner.classList.add('hidden');
      const currentOffer = findOffer(selected.value);
      if (JSON.stringify({ ...normalizeBrief(readBrief()), offer: currentOffer }) === fingerprint) showResult(result);
      else {
        label.textContent = 'Submit enquiry';
        announcement.classList.remove('sr-only');
        announcement.textContent = result === 'received'
          ? 'Your previous details were received. The edits on screen have not been submitted.'
          : 'The form changed during the request. The edits on screen have not been submitted.';
      }
    }
  });

  form.dataset.initialized = 'true';
  button.disabled = false;
}

setupContactForm();
