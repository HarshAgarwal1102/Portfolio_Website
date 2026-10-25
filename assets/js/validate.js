// Pure helpers for the contact form. No DOM access, so they run in Node tests too.

export const LIMITS = Object.freeze({
  name: { min: 2, max: 100 },
  email: { max: 254 },
  subject: { min: 3, max: 150 },
  message: { min: 20, max: 5000 },
});

export const FIELDS = Object.freeze(['name', 'email', 'subject', 'message']);

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

export function normalize(values) {
  const out = {};
  for (const field of FIELDS) {
    out[field] = String(values?.[field] ?? '').trim();
  }
  return out;
}

export function validateField(field, rawValue) {
  const value = String(rawValue ?? '').trim();
  const limit = LIMITS[field];

  switch (field) {
    case 'name':
      if (!value) return 'Please enter your name.';
      if (value.length < limit.min) return `Name must be at least ${limit.min} characters.`;
      if (value.length > limit.max) return `Name must be ${limit.max} characters or fewer.`;
      return '';
    case 'email':
      if (!value) return 'Please enter your email address.';
      if (value.length > limit.max || !EMAIL_RE.test(value)) return 'Enter a valid email address, like name@example.com.';
      return '';
    case 'subject':
      if (!value) return 'Please add a subject.';
      if (value.length < limit.min) return `Subject must be at least ${limit.min} characters.`;
      if (value.length > limit.max) return `Subject must be ${limit.max} characters or fewer.`;
      return '';
    case 'message':
      if (!value) return 'Please write a message.';
      if (value.length < limit.min) return `Message must be at least ${limit.min} characters (currently ${value.length}).`;
      if (value.length > limit.max) return `Message must be ${limit.max} characters or fewer.`;
      return '';
    default:
      return '';
  }
}

export function validateContact(values) {
  const clean = normalize(values);
  const errors = {};
  for (const field of FIELDS) {
    const message = validateField(field, clean[field]);
    if (message) errors[field] = message;
  }
  return { valid: Object.keys(errors).length === 0, errors, values: clean };
}

export function resolveProvider(contact, hostname = '') {
  const provider = contact?.provider ?? 'auto';
  if (provider !== 'auto') {
    if (provider === 'formspree' && !isFormspreeEndpoint(contact.formspreeEndpoint)) return 'mailto';
    return provider;
  }
  if (isFormspreeEndpoint(contact?.formspreeEndpoint)) return 'formspree';
  const host = String(hostname).toLowerCase();
  if (host.endsWith('.netlify.app') || (contact?.netlifyHosts ?? []).includes(host)) return 'netlify';
  return 'mailto';
}

export function isFormspreeEndpoint(url) {
  return /^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(String(url ?? ''));
}

export function encodeForm(data) {
  return new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])).toString();
}

export function buildMailto(recipient, values) {
  const clean = normalize(values);
  const body = `${clean.message}\n\n— ${clean.name}${clean.email ? ` <${clean.email}>` : ''}`;
  const params = new URLSearchParams({ subject: clean.subject || 'Hello from your portfolio', body });
  // URLSearchParams encodes spaces as "+", which mail clients show literally.
  return `mailto:${recipient}?${params.toString().replace(/\+/g, '%20')}`;
}
