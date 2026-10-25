import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runChecks } from '../scripts/check-site.mjs';

test('static site checks report no problems', () => {
  const { errors } = runChecks();
  assert.deepEqual(errors, [], errors.map((e) => `${e.file}:${e.line} ${e.rule} ${e.detail}`).join('\n'));
});

test('every nav link targets an existing section', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const nav = html.match(/<ul class="nav__links">([\s\S]*?)<\/ul>/)[1];
  const targets = [...nav.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(targets, ['home', 'about', 'skills', 'experience', 'projects', 'architecture', 'learning', 'contact']);
  for (const id of targets) assert.match(html, new RegExp(`<section[^>]*id="${id}"`), `section #${id} missing`);
});

test('contact form exposes every required field with a label', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const field of ['name', 'email', 'subject', 'message']) {
    assert.match(html, new RegExp(`<label for="cf-${field}"`), `label for ${field}`);
    assert.match(html, new RegExp(`id="cf-${field}" name="${field}"`), `input ${field}`);
  }
  assert.match(html, /data-netlify="true"/);
  assert.match(html, /netlify-honeypot="bot-field"/);
});

test('client config holds no credentials', () => {
  const js = readFileSync(new URL('../assets/js/config.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /token|password|secret\s*:/i);
});
