// About-section photo carousel: a swipe/scroll-snap track with no visible controls.
// It auto-advances and pauses on hover, focus, when off-screen, when the tab is hidden,
// and by default for visitors who prefer reduced motion. Keyboard users get arrow keys
// and a pause button that appears when focused.
//
// Looping: a decorative copy of the first slide sits after the last one. Moving past the
// last photo scrolls forward onto that copy, then jumps (invisibly) back to the real
// first photo, so the slideshow always moves in one direction instead of rewinding.

export function initCarousel() {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;

  const track = root.querySelector('[data-carousel-track]');
  const slides = [...track.children];
  const count = slides.length;
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

  // Loop copy of the first slide: hidden from assistive tech, never counted.
  const loopCopy = slides[0].cloneNode(true);
  loopCopy.removeAttribute('role');
  loopCopy.removeAttribute('aria-roledescription');
  loopCopy.removeAttribute('aria-label');
  loopCopy.setAttribute('aria-hidden', 'true');
  const copyImg = loopCopy.querySelector('img');
  copyImg.alt = '';
  copyImg.style.objectPosition = copyImg.dataset.pos ?? '';
  track.append(loopCopy);

  const width = () => track.clientWidth;

  function scrollToPosition(position, smooth) {
    track.scrollTo({
      left: position * width(),
      behavior: smooth && !reducedMotion.matches ? 'smooth' : 'instant',
    });
  }

  function render() {
    slides.forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== index)));
  }

  function next() {
    if (index === count - 1) {
      // Scroll forward onto the copy of photo 1; the scroll-end handler swaps in the real one.
      index = 0;
      scrollToPosition(count, true);
      if (reducedMotion.matches) scrollToPosition(0, false);
    } else {
      index += 1;
      scrollToPosition(index, true);
    }
    render();
  }

  function previous() {
    if (index === 0) {
      // Jump onto the copy (it looks identical to photo 1), then move back to the last photo.
      scrollToPosition(count, false);
      index = count - 1;
    } else {
      index -= 1;
    }
    scrollToPosition(index, true);
    render();
  }

  function shouldPlay() {
    return !userPaused && !hovering && !focused && onScreen && !document.hidden;
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = null;
    if (shouldPlay()) timer = window.setTimeout(() => {
      next();
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

  // When scrolling settles: swap the loop copy for the real first photo, and keep
  // `index` in sync when the visitor swipes or scrolls the track directly.
  let scrollEnd = null;
  track.addEventListener('scroll', () => {
    window.clearTimeout(scrollEnd);
    scrollEnd = window.setTimeout(() => {
      const position = Math.round(track.scrollLeft / width());
      if (position >= count) {
        scrollToPosition(0, false);
        if (index !== 0) {
          index = 0;
          render();
          schedule();
        }
      } else if (position !== index) {
        index = position;
        render();
        schedule();
      }
    }, 120);
  }, { passive: true });

  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    updateToggle();
    schedule();
  });

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') next();
    else if (event.key === 'ArrowLeft') previous();
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

  window.addEventListener('resize', () => scrollToPosition(index, false));

  updateToggle();
  render();
}
