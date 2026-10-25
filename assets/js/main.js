import { config } from './config.js';
import { initArchitecture } from './architecture.js';
import { initPipelineExplorer } from './pipeline.js';
import { initContactForm } from './contact.js';

document.documentElement.classList.add('js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const desktopNav = window.matchMedia('(min-width: 1024px)');

/* ---------- Navigation ---------- */
function initNav() {
  const header = document.getElementById('site-header');
  const toggle = header.querySelector('.nav__toggle');
  const menu = document.getElementById('nav-menu');
  const links = [...menu.querySelectorAll('.nav__link')];

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  function setOpen(open, { returnFocus = false } = {}) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
    if (open) links[0]?.focus({ preventScroll: true });
    else if (returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  for (const link of links) {
    link.addEventListener('click', () => {
      if (isOpen()) setOpen(false);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) setOpen(false, { returnFocus: true });
  });

  document.addEventListener('click', (event) => {
    if (isOpen() && !header.contains(event.target)) setOpen(false);
  });

  // Keep Tab inside the open mobile menu (toggle + links).
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !isOpen()) return;
    const last = links[links.length - 1];
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      toggle.focus();
    }
  });
  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && event.shiftKey && isOpen()) {
      event.preventDefault();
      links[links.length - 1].focus();
    }
  });

  desktopNav.addEventListener('change', (event) => {
    if (event.matches && isOpen()) setOpen(false);
  });

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Active section indicator
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  const byId = new Map(links.map((link) => [link.getAttribute('href').slice(1), link]));
  // The pipeline section sits under "Architecture" in the menu.
  const alias = { pipeline: 'architecture' };
  const observed = [...sections, document.getElementById('pipeline')].filter(Boolean);
  const visible = new Map();

  const setActive = (id) => {
    const target = byId.get(alias[id] ?? id);
    for (const link of links) {
      if (link === target) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
      const current = observed.find((section) => visible.get(section.id));
      if (current) setActive(current.id);
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  observed.forEach((section) => observer.observe(section));
}

/* ---------- Reveal on scroll ---------- */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  items.forEach((el) => observer.observe(el));
}

/* ---------- Rotating focus line ---------- */
function initRoles() {
  const el = document.querySelector('[data-roles]');
  if (!el) return;
  let roles;
  try {
    roles = JSON.parse(el.dataset.roles);
  } catch {
    return;
  }
  let index = 0;
  let timer = null;

  const schedule = (fn, ms) => {
    timer = window.setTimeout(fn, ms);
  };

  function swap() {
    index = (index + 1) % roles.length;
    el.textContent = roles[index];
    schedule(swap, 3200);
  }

  function type(text, i = 0) {
    el.textContent = text.slice(0, i);
    if (i < text.length) schedule(() => type(text, i + 1), 45);
    else schedule(erase, 2200);
  }

  function erase() {
    const text = el.textContent;
    if (text.length) {
      el.textContent = text.slice(0, -1);
      schedule(erase, 22);
    } else {
      index = (index + 1) % roles.length;
      schedule(() => type(roles[index]), 250);
    }
  }

  function start() {
    window.clearTimeout(timer);
    if (reducedMotion.matches) schedule(swap, 3200);
    else schedule(erase, 2200);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.clearTimeout(timer);
    else start();
  });
  start();
}

/* ---------- Hero terminal replay ---------- */
function initTerminal() {
  const pre = document.querySelector('[data-terminal]');
  const replay = document.querySelector('[data-terminal-replay]');
  if (!pre || !replay) return;

  // Split the static transcript into lines of [className, text] segments.
  const lines = [[]];
  for (const node of pre.childNodes) {
    const cls = node.nodeType === Node.ELEMENT_NODE ? node.className : '';
    const parts = node.textContent.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push([cls, part]);
    });
  }

  // The original <pre> stays as the accessible version; the animated copy is decorative.
  const screen = pre.cloneNode(false);
  screen.removeAttribute('data-terminal');
  screen.setAttribute('aria-hidden', 'true');
  let timer = null;

  function segment(cls, text) {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text;
    return span;
  }

  function run() {
    window.clearTimeout(timer);
    pre.classList.add('visually-hidden');
    if (!screen.isConnected) pre.after(screen);
    screen.replaceChildren();
    replay.hidden = true;
    let li = 0;

    const nextLine = () => {
      if (li >= lines.length) {
        replay.hidden = false;
        return;
      }
      const line = lines[li];
      if (li > 0) screen.append('\n');
      li += 1;
      const isCommand = line[0]?.[0] === 't-prompt';
      if (!isCommand) {
        line.forEach(([cls, text]) => screen.append(segment(cls, text)));
        timer = window.setTimeout(nextLine, 140);
        return;
      }
      const [prompt, ...rest] = line;
      screen.append(segment(prompt[0], prompt[1]));
      const command = rest.map(([, text]) => text).join('');
      const target = segment('', '');
      screen.append(target);
      let ci = 0;
      const typeChar = () => {
        target.textContent = command.slice(0, ci);
        if (ci < command.length) {
          ci += 1;
          timer = window.setTimeout(typeChar, 18);
        } else {
          timer = window.setTimeout(nextLine, 260);
        }
      };
      typeChar();
    };
    nextLine();
  }

  replay.addEventListener('click', run);

  if (reducedMotion.matches) return;
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      run();
    }
  });
  observer.observe(pre.closest('.terminal'));
}

/* ---------- Project filters ---------- */
function initFilters() {
  const group = document.querySelector('[data-filters]');
  const grid = document.querySelector('[data-projects]');
  if (!group || !grid) return;
  const cards = [...grid.querySelectorAll('[data-tags]')];
  const empty = grid.querySelector('[data-projects-empty]');
  const live = document.querySelector('[data-filter-status]');
  const buttons = [...group.querySelectorAll('[data-filter]')];

  for (const button of buttons) {
    const key = button.dataset.filter;
    const count = key === 'all' ? cards.length : cards.filter((c) => c.dataset.tags.split(' ').includes(key)).length;
    const badge = document.createElement('span');
    badge.className = 'filter__count';
    badge.textContent = String(count);
    badge.setAttribute('aria-hidden', 'true');
    button.append(badge);
    button.setAttribute('aria-label', `${button.firstChild.textContent.trim()} (${count})`);

    button.addEventListener('click', () => {
      let shown = 0;
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
      for (const card of cards) {
        const match = key === 'all' || card.dataset.tags.split(' ').includes(key);
        card.hidden = !match;
        if (match) {
          shown += 1;
          card.classList.add('is-visible');
        }
      }
      empty.hidden = shown > 0;
      const label = button.firstChild.textContent.trim();
      live.textContent = key === 'all' ? `Showing all ${shown} projects.` : `Showing ${shown} ${shown === 1 ? 'project' : 'projects'} tagged ${label}.`;
    });
  }
}

/* ---------- Project dialog ---------- */
const PROJECT_META = {
  drift: {
    title: 'AI-powered Terraform drift detector',
    meta: 'Level 1 · level1-v1.0.0 · maintenance-only',
    links: [
      ['Repository', 'https://github.com/HarshAgarwal1102/ai-terraform-drift-detector', 'primary'],
      ['Architecture doc', 'https://github.com/HarshAgarwal1102/ai-terraform-drift-detector/blob/main/docs/architecture.md', 'secondary'],
    ],
  },
  'landing-zone': {
    title: 'Azure infrastructure landing zone',
    meta: 'Terraform · 9 modules · preprod & prod',
    links: [
      ['Repository', 'https://github.com/HarshAgarwal1102/Azure-Infra-Landing-Zone', 'primary'],
      ['Pipeline definition', 'https://github.com/HarshAgarwal1102/Azure-Infra-Landing-Zone/blob/main/.github/workflows/Terraform.yml', 'secondary'],
    ],
  },
  portfolio: {
    title: 'Portfolio as code',
    meta: 'Static site · strict CSP · CI-checked',
    links: [['Repository', 'https://github.com/HarshAgarwal1102/Portfolio_Website', 'primary']],
  },
};

function initDialog() {
  const dialog = document.getElementById('project-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const title = dialog.querySelector('[data-dialog-title]');
  const meta = dialog.querySelector('[data-dialog-meta]');
  const body = dialog.querySelector('[data-dialog-body]');
  const foot = dialog.querySelector('[data-dialog-foot]');
  let opener = null;

  function open(id, trigger) {
    const info = PROJECT_META[id];
    const template = document.getElementById(`tpl-${id}`);
    if (!info || !template) return;
    opener = trigger;
    title.textContent = info.title;
    meta.textContent = info.meta;
    body.replaceChildren(template.content.cloneNode(true));
    foot.replaceChildren(
      ...info.links.map(([label, href, kind]) => {
        const a = document.createElement('a');
        a.className = `btn btn--${kind} btn--sm`;
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = label;
        const hint = document.createElement('span');
        hint.className = 'visually-hidden';
        hint.textContent = ' (opens in a new tab)';
        a.append(hint);
        return a;
      }),
    );
    dialog.showModal();
    body.scrollTop = 0;
  }

  document.querySelectorAll('[data-open-project]').forEach((button) => {
    button.addEventListener('click', () => open(button.dataset.openProject, button));
  });

  dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());

  // Click on the backdrop (the dialog element itself, outside its content) closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });

  dialog.addEventListener('close', () => opener?.focus());
}

/* ---------- Back to top, résumé links, year ---------- */
function initMisc() {
  const toTop = document.querySelector('[data-to-top]');
  if (toTop) {
    const update = () => toTop.classList.toggle('is-visible', window.scrollY > 900);
    update();
    window.addEventListener('scroll', update, { passive: true });
    toTop.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      document.querySelector('.brand')?.focus({ preventScroll: true });
      history.replaceState(null, '', window.location.pathname + window.location.search);
    });
  }

  if (config.resumeUrl) {
    document.querySelectorAll('[data-resume-link]').forEach((link) => {
      link.href = config.resumeUrl;
    });
  }

  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

initNav();
initReveal();
initRoles();
initTerminal();
initFilters();
initDialog();
initArchitecture();
initPipelineExplorer();
initContactForm();
initMisc();
