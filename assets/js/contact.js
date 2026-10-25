import { config } from './config.js';
import { FIELDS, buildMailto, encodeForm, resolveProvider, validateContact, validateField } from './validate.js';

const LABELS = {
  idle: { netlify: 'Send message', formspree: 'Send message', mailto: 'Continue in email app' },
  busy: 'Sending…',
};

export function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const contact = config.contact;
  const provider = resolveProvider(contact, window.location.hostname);
  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[data-submit]');
  const submitLabel = form.querySelector('[data-submit-label]');
  const submitIcon = form.querySelector('[data-submit-icon]');
  const honeypot = form.elements.namedItem('bot-field');
  let attempted = false;
  let busy = false;

  form.dataset.provider = provider;
  submitLabel.textContent = LABELS.idle[provider] ?? LABELS.idle.netlify;

  if (provider === 'mailto') {
    setStatus(
      'info',
      'Direct delivery isn\'t set up on this copy of the site, so the form opens your email app with your message filled in. You can also email ',
      contact.email,
    );
  }

  function field(name) {
    return form.elements.namedItem(name);
  }

  function showFieldError(name, message) {
    const input = field(name);
    const error = form.querySelector(`[data-error-for="${name}"]`);
    if (!input || !error) return;
    error.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function setStatus(tone, text, email) {
    status.replaceChildren();
    if (!tone) {
      delete status.dataset.tone;
      return;
    }
    status.dataset.tone = tone;
    const p = document.createElement('p');
    p.append(text);
    if (email) {
      const a = document.createElement('a');
      a.href = `mailto:${email}`;
      a.textContent = email;
      p.append(a, '.');
    }
    status.append(p);
  }

  function setBusy(isBusy) {
    busy = isBusy;
    submit.disabled = isBusy;
    form.setAttribute('aria-busy', String(isBusy));
    submitLabel.textContent = isBusy ? LABELS.busy : LABELS.idle[provider];
    if (isBusy) {
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      spinner.setAttribute('aria-hidden', 'true');
      spinner.dataset.spinner = '';
      submitIcon.replaceWith(spinner);
    } else {
      form.querySelector('[data-spinner]')?.replaceWith(submitIcon);
    }
  }

  // Re-validate a field as the visitor fixes it, but only after a first submit attempt.
  for (const name of FIELDS) {
    const input = field(name);
    input?.addEventListener('input', () => {
      if (attempted) showFieldError(name, validateField(name, input.value));
    });
    input?.addEventListener('blur', () => {
      if (attempted || input.value.trim()) showFieldError(name, validateField(name, input.value));
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    attempted = true;

    const raw = Object.fromEntries(FIELDS.map((name) => [name, field(name)?.value ?? '']));
    const { valid, errors, values } = validateContact(raw);
    for (const name of FIELDS) showFieldError(name, errors[name] ?? '');

    if (!valid) {
      const count = Object.keys(errors).length;
      setStatus('error', `Please fix ${count} ${count === 1 ? 'field' : 'fields'} before sending.`);
      field(FIELDS.find((name) => errors[name]))?.focus();
      return;
    }

    // Bots fill the hidden field; humans never see it. Drop the submission quietly.
    if (honeypot && honeypot.value) {
      form.reset();
      setStatus('success', 'Thanks, your message has been received.');
      return;
    }

    if (provider === 'mailto') {
      window.location.href = buildMailto(contact.email, values);
      setStatus(
        'info',
        'Your email app should now be open with the message ready to send. Nothing happened? Email me directly at ',
        contact.email,
      );
      return;
    }

    setBusy(true);
    setStatus('info', 'Sending your message…');

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), contact.timeoutMs);

    try {
      const response = provider === 'formspree'
        ? await sendFormspree(contact.formspreeEndpoint, values, controller.signal)
        : await sendNetlify(values, controller.signal);

      if (!response.ok) {
        throw new Error(await describeFailure(response));
      }

      form.reset();
      attempted = false;
      setStatus('success', `Thanks, ${values.name.split(' ')[0]}! Your message has been delivered. I'll reply to ${values.email}.`);
    } catch (error) {
      const reason = error.name === 'AbortError' ? 'The request timed out.' : error.message || 'The network request failed.';
      setStatus('error', `Your message wasn't sent. ${reason} Your text is still in the form. Please try again or email me at `, contact.email);
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
    }
  });
}

function sendNetlify(values, signal) {
  return fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeForm({ 'form-name': 'contact', 'bot-field': '', ...values }),
    signal,
  });
}

function sendFormspree(endpoint, values, signal) {
  return fetch(endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...values, _subject: `Portfolio: ${values.subject}`, _replyto: values.email }),
    signal,
  });
}

async function describeFailure(response) {
  try {
    const data = await response.clone().json();
    if (Array.isArray(data?.errors) && data.errors.length) {
      return data.errors.map((e) => e.message).filter(Boolean).join(' ');
    }
  } catch {
    // Not JSON; fall through to the status code.
  }
  return `The form service responded with HTTP ${response.status}.`;
}
