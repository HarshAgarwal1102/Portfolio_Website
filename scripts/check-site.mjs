#!/usr/bin/env node
// Zero-dependency static site checker.
//   node scripts/check-site.mjs
// Checks: local links/assets exist, in-page anchors resolve, icon sprite references resolve,
// external new-tab links are safe, images have alt text and dimensions, the main page has no
// inline styles/scripts (required by its CSP), CSS/JS references exist, and no secret-like
// strings are committed. Findings print as file:line + rule — matched values are never printed.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML_FILES = ['index.html', '404.html'];
const SKIP_DIRS = new Set(['.git', 'node_modules', '.claude']);
const TEXT_EXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md', '.toml', '.yml', '.yaml', '.txt', '.xml', '.svg']);

const SECRET_RULES = [
  ['smtpjs-secure-token', /SecureToken\s*[:=]/i],
  ['smtpjs-script', /smtpjs\.com/i],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['password-assignment', /\b(password|passwd|pwd)\s*[:=]\s*["'][^"']{6,}["']/i],
  ['emailjs-or-smtp-key', /\b(api[_-]?key|secret|client[_-]?secret)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i],
];

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function isExternal(url) {
  return /^(https?:)?\/\//i.test(url) || /^(mailto|tel|data|javascript):/i.test(url);
}

function localPath(fromFile, url) {
  const clean = url.split('#')[0].split('?')[0];
  if (!clean) return null;
  const decoded = decodeURIComponent(clean);
  return decoded.startsWith('/') ? join(ROOT, decoded) : resolve(dirname(fromFile), decoded);
}

export function runChecks() {
  const errors = [];
  const warnings = [];
  const add = (list, file, line, rule, detail = '') => list.push({ file: relative(ROOT, file), line, rule, detail });

  for (const name of HTML_FILES) {
    const file = join(ROOT, name);
    if (!existsSync(file)) {
      add(errors, file, 0, 'missing-html-file');
      continue;
    }
    const html = readFileSync(file, 'utf8');
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const strict = name === 'index.html';

    // href / src references
    for (const m of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
      const [, attr, url] = m;
      const line = lineOf(html, m.index);
      if (url === '' ) {
        add(errors, file, line, 'empty-link', attr);
        continue;
      }
      if (url === '#') {
        add(errors, file, line, 'placeholder-anchor');
        continue;
      }
      if (url.startsWith('#')) {
        if (!ids.has(url.slice(1))) add(errors, file, line, 'broken-anchor', url);
        continue;
      }
      if (/^javascript:/i.test(url)) {
        add(errors, file, line, 'javascript-url');
        continue;
      }
      if (/^http:\/\//i.test(url)) add(errors, file, line, 'insecure-http-link', url);
      if (isExternal(url)) continue;
      const target = localPath(file, url);
      if (target && !existsSync(target)) add(errors, file, line, 'missing-local-file', url);
    }

    // Safe new-tab links
    for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
      if (!/rel="[^"]*noopener[^"]*"/.test(m[0])) add(errors, file, lineOf(html, m.index), 'target-blank-without-noopener');
    }

    // Images
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0];
      const line = lineOf(html, m.index);
      if (!/\salt="/.test(tag)) add(errors, file, line, 'img-missing-alt');
      if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) add(errors, file, line, 'img-missing-dimensions');
    }

    // Buttons need an accessible name
    for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const [, attrs, inner] = m;
      const text = inner.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim();
      if (!text && !/aria-label="[^"]+"/.test(attrs)) add(errors, file, lineOf(html, m.index), 'button-without-name');
    }

    if (strict) {
      for (const m of html.matchAll(/\sstyle="/g)) add(errors, file, lineOf(html, m.index), 'inline-style-blocked-by-csp');
      for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
        const attrs = m[1];
        if (!/\ssrc="/.test(attrs) && !/type="application\/ld\+json"/.test(attrs)) {
          add(errors, file, lineOf(html, m.index), 'inline-script-blocked-by-csp');
        }
      }
      for (const m of html.matchAll(/\son[a-z]+="/g)) add(errors, file, lineOf(html, m.index), 'inline-event-handler');
      if (!/<meta name="description"/.test(html)) add(errors, file, 0, 'missing-meta-description');
      if (!/<html lang="/.test(html)) add(errors, file, 0, 'missing-html-lang');
      if ((html.match(/<h1\b/g) ?? []).length !== 1) add(errors, file, 0, 'expected-exactly-one-h1');
    }
  }

  // CSS url() references
  for (const file of walk(join(ROOT, 'assets')).filter((f) => extname(f) === '.css')) {
    const css = readFileSync(file, 'utf8');
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const url = m[1];
      if (isExternal(url) || url.startsWith('#')) continue;
      const target = localPath(file, url);
      if (target && !existsSync(target)) add(errors, file, lineOf(css, m.index), 'missing-css-asset', url);
    }
  }

  // JS module imports
  for (const file of walk(join(ROOT, 'assets')).filter((f) => extname(f) === '.js')) {
    const js = readFileSync(file, 'utf8');
    for (const m of js.matchAll(/^\s*import\s[^'"]*['"](\.[^'"]+)['"]/gm)) {
      if (!existsSync(resolve(dirname(file), m[1]))) add(errors, file, lineOf(js, m.index), 'missing-js-import', m[1]);
    }
  }

  // Templates referenced by project buttons
  const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const m of index.matchAll(/data-open-project="([^"]+)"/g)) {
    if (!index.includes(`id="tpl-${m[1]}"`)) add(errors, join(ROOT, 'index.html'), lineOf(index, m.index), 'missing-project-template', m[1]);
  }

  // Secret patterns across committed text files
  for (const file of walk(ROOT)) {
    if (!TEXT_EXT.has(extname(file))) continue;
    if (file === fileURLToPath(import.meta.url)) continue;
    if (file.includes(`${join(ROOT, 'tests')}`)) continue;
    const text = readFileSync(file, 'utf8');
    for (const [rule, re] of SECRET_RULES) {
      const m = re.exec(text);
      if (m) add(errors, file, lineOf(text, m.index), `possible-secret:${rule}`);
    }
  }

  return { errors, warnings };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { errors, warnings } = runChecks();
  for (const w of warnings) console.warn(`warn  ${w.file}:${w.line}  ${w.rule}${w.detail ? `  ${w.detail}` : ''}`);
  for (const e of errors) console.error(`error ${e.file}:${e.line}  ${e.rule}${e.detail ? `  ${e.detail}` : ''}`);
  if (errors.length) {
    console.error(`\n✗ ${errors.length} problem(s) found.`);
    process.exit(1);
  }
  console.log(`✓ Site checks passed (${HTML_FILES.length} pages, links, assets, a11y basics, CSP, secret patterns).`);
}
