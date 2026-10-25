// About-section photo carousel: swipe/scroll-snap track, prev/next, dots and an
// auto-advance that pauses on hover, focus, when off-screen, when the tab is hidden,
// and by default for visitors who prefer reduced motion.

export function initCarousel() {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;

  const track = root.querySelector('[data-carousel-track]');
  const slides = [...track.children];
  const dots = [...root.querySelectorAll('[data-slide-to]')];
  const toggle = root.querySelector('[data-carousel-toggle]');
  const iconPause = toggle.querySelector('[data-icon-pause]');
  const iconPlay = toggle.querySelector('[data-icon-play]');
  const interval = Number(root.dataset.interval) || 4000;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let index = 0;
  let timer = null;
  let userPaused = reducedMotion.matches;
  let hovering = false;
  let focused = false;
  let onScreen = false;

  // Per-photo focal point (kept out of inline style attributes for the CSP).
  for (const img of track.querySelectorAll('img[data-pos]')) {
    img.style.objectPosition = img.dataset.pos;
  }

  function render() {
    dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    slides.forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== index)));
  }

  function goTo(i, smooth = true) {
    index = (i + slides.length) % slides.length;
    track.scrollTo({
      left: index * track.clientWidth,
      behavior: smooth && !reducedMotion.matches ? 'smooth' : 'auto',
    });
    render();
  }

  function shouldPlay() {
    return !userPaused && !hovering && !focused && onScreen && !document.hidden;
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = null;
    if (shouldPlay()) timer = window.setTimeout(() => {
      goTo(index + 1);
      schedule();
    }, interval);
  }

  function updateToggle() {
    toggle.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
    iconPause.hidden = userPaused;
    iconPlay.hidden = !userPaused;
    // Announce slide changes only when the visitor is in control.
    track.setAttribute('aria-live', userPaused ? 'polite' : 'off');
  }

  // Keep `index` in sync when the visitor swipes or scrolls the track directly.
  let scrollEnd = null;
  track.addEventListener('scroll', () => {
    window.clearTimeout(scrollEnd);
    scrollEnd = window.setTimeout(() => {
      const next = Math.round(track.scrollLeft / track.clientWidth);
      if (next !== index) {
        index = next;
        render();
        schedule();
      }
    }, 80);
  }, { passive: true });

  root.querySelector('[data-carousel-prev]').addEventListener('click', () => {
    goTo(index - 1);
    schedule();
  });
  root.querySelector('[data-carousel-next]').addEventListener('click', () => {
    goTo(index + 1);
    schedule();
  });
  dots.forEach((dot) => dot.addEventListener('click', () => {
    goTo(Number(dot.dataset.slideTo));
    schedule();
  }));

  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    updateToggle();
    schedule();
  });

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') goTo(index + 1);
    else if (event.key === 'ArrowLeft') goTo(index - 1);
    else return;
    event.preventDefault();
  });

  root.addEventListener('pointerenter', () => { hovering = true; schedule(); });
  root.addEventListener('pointerleave', () => { hovering = false; schedule(); });
  root.addEventListener('focusin', () => { focused = true; schedule(); });
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) {
      focused = false;
      schedule();
    }
  });
  document.addEventListener('visibilitychange', schedule);

  new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    schedule();
  }, { threshold: 0.4 }).observe(root);

  window.addEventListener('resize', () => goTo(index, false));

  updateToggle();
  render();
}
