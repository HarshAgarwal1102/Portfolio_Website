import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMailto,
  encodeForm,
  isFormspreeEndpoint,
  resolveProvider,
  validateContact,
  validateField,
} from '../assets/js/validate.js';

const good = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Platform role',
  message: 'Hi Harsh, I would like to talk about a DevOps role on our team.',
};

test('accepts a complete, well-formed message', () => {
  const result = validateContact(good);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('trims values before validating', () => {
  const result = validateContact({ ...good, name: '   Ada   ' });
  assert.equal(result.values.name, 'Ada');
  assert.equal(result.valid, true);
});

test('reports every missing field', () => {
  const result = validateContact({});
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['email', 'message', 'name', 'subject']);
});

test('rejects malformed email addresses', () => {
  for (const email of ['ada', 'ada@', 'ada@example', '@example.com', 'ada @example.com', 'ada@example.c']) {
    assert.notEqual(validateField('email', email), '', `expected "${email}" to be rejected`);
  }
  for (const email of ['ada@example.com', 'a.b+tag@sub.example.co.in']) {
    assert.equal(validateField('email', email), '', `expected "${email}" to be accepted`);
  }
});

test('enforces message length bounds', () => {
  assert.match(validateField('message', 'too short'), /at least 20/);
  assert.match(validateField('message', 'x'.repeat(5001)), /5000 characters or fewer/);
  assert.equal(validateField('message', 'x'.repeat(20)), '');
});

test('resolves the delivery provider', () => {
  const base = { provider: 'auto', formspreeEndpoint: '', netlifyHosts: ['harshagarwal-portfolio.netlify.app'] };
  assert.equal(resolveProvider(base, 'harshagarwal-portfolio.netlify.app'), 'netlify');
  assert.equal(resolveProvider(base, 'deploy-preview-3--site.netlify.app'), 'netlify');
  assert.equal(resolveProvider(base, 'harshagarwal1102.github.io'), 'mailto');
  assert.equal(resolveProvider(base, 'localhost'), 'mailto');
  const withFormspree = { ...base, formspreeEndpoint: 'https://formspree.io/f/abc123' };
  assert.equal(resolveProvider(withFormspree, 'harshagarwal1102.github.io'), 'formspree');
  assert.equal(resolveProvider({ ...base, provider: 'formspree' }, 'x'), 'mailto', 'formspree without endpoint falls back');
  assert.equal(resolveProvider({ ...base, provider: 'netlify' }, 'localhost'), 'netlify');
});

test('only accepts real Formspree endpoints', () => {
  assert.equal(isFormspreeEndpoint('https://formspree.io/f/xyzAB12'), true);
  assert.equal(isFormspreeEndpoint('http://formspree.io/f/xyz'), false);
  assert.equal(isFormspreeEndpoint('https://evil.example/f/xyz'), false);
  assert.equal(isFormspreeEndpoint(''), false);
});

test('encodes Netlify form bodies', () => {
  assert.equal(encodeForm({ 'form-name': 'contact', message: 'a&b c' }), 'form-name=contact&message=a%26b+c');
});

test('builds a mailto link with encoded subject and body', () => {
  const link = buildMailto('me@example.com', { ...good, subject: 'Hi & hello+' });
  assert.ok(link.startsWith('mailto:me@example.com?'));
  const params = new URLSearchParams(link.split('?')[1]);
  assert.equal(params.get('subject'), 'Hi & hello+');
  assert.match(params.get('body'), /Ada Lovelace <ada@example.com>/);
  assert.ok(!link.includes('+'), 'spaces must be %20, not +');
});
