/* Local vanilla hero motion. No analytics, requests, submission, or running loop. */
(() => {
  'use strict';
  if (!/instagram/i.test(location.pathname) || !document.body.classList.contains('ig-page')) return;
  const visual = document.querySelector('.ig-page .hero .visual[aria-hidden="true"]');
  if (!visual || visual.classList.contains('pb-ig-motion-mounted')) return;
  const logo = visual.querySelector('.ig-logo');
  const heart = visual.querySelector('.float-chip.heart');
  const chart = visual.querySelector('.float-chip.chart');
  if (!logo || !heart || !chart) return;
  const trigger = document.querySelector('.ig-page .hero .hero-link');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('pb-ig-motion-art');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = '<defs><linearGradient id="pb-ig-motion-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0" stop-color="#fff0b0"/><stop offset=".35" stop-color="#fff7fd"/><stop offset=".72" stop-color="#ff39bf"/><stop offset="1" stop-color="#c28aff"/></linearGradient></defs><g class="pb-ig-routes"><path class="pb-ig-route"/><path class="pb-ig-route pb-ig-route-secondary"/><path class="pb-ig-trace" pathLength="1"/><path class="pb-ig-trace" pathLength="1"/></g><g class="pb-ig-outlines"><rect class="pb-ig-outline"/><rect class="pb-ig-outline"/><rect class="pb-ig-outline"/></g><ellipse class="pb-ig-pulse"/>';
  visual.append(svg);
  visual.classList.add('pb-ig-motion-mounted');
  trigger?.classList.add('pb-ig-hero-trigger');
  const routes = [...svg.querySelectorAll('.pb-ig-route')];
  const traces = [...svg.querySelectorAll('.pb-ig-trace')];
  const outlines = [...svg.querySelectorAll('.pb-ig-outline')];
  const pulse = svg.querySelector('.pb-ig-pulse');
  let animations = [];
  let sequence = 0;
  let entered = false;
  let visible = false;
  let disposed = false;
  let measuredWidth = 0;
  let measuredHeight = 0;
  const abort = new AbortController();
  const listen = (target, name, handler) => target?.addEventListener(name, handler, { signal: abort.signal });

  function settle() {
    sequence += 1;
    animations.forEach(animation => animation.cancel());
    animations = [];
    visual.dataset.pbMotionState = 'settled';
  }

  function geometry() {
    const box = visual.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    measuredWidth = box.width;
    measuredHeight = box.height;
    const point = element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2 - box.left,
        y: rect.top + rect.height / 2 - box.top, width: rect.width, height: rect.height };
    };
    const centre = point(logo);
    const start = point(heart);
    const end = point(chart);
    const n = number => Math.round(number * 100) / 100;
    svg.setAttribute('viewBox', `0 0 ${n(box.width)} ${n(box.height)}`);
    const edge = logo.offsetWidth * .47;
    const a = { x: centre.x - edge, y: centre.y - edge * .35 };
    const b = { x: centre.x + edge, y: centre.y + edge * .35 };
    const paths = [
      `M ${n(start.x)} ${n(start.y)} C ${n(start.x + box.width * .15)} ${n(start.y - box.height * .12)}, ${n(a.x - box.width * .13)} ${n(a.y - box.height * .1)}, ${n(a.x)} ${n(a.y)}`,
      `M ${n(b.x)} ${n(b.y)} C ${n(b.x + box.width * .16)} ${n(b.y + box.height * .04)}, ${n(end.x - box.width * .16)} ${n(end.y + box.height * .11)}, ${n(end.x)} ${n(end.y)}`
    ];
    paths.forEach((path, index) => {
      routes[index].setAttribute('d', path);
      traces[index].setAttribute('d', path);
    });
    outlines.forEach((rect, index) => {
      const size = logo.offsetWidth * (1.12 + index * .12);
      rect.setAttribute('x', n(centre.x - size / 2));
      rect.setAttribute('y', n(centre.y - size / 2));
      rect.setAttribute('width', n(size));
      rect.setAttribute('height', n(size));
      rect.setAttribute('rx', n(size * .25));
      rect.style.setProperty('--pb-ig-turn', `${-12 + index * 8}deg`);
    });
    pulse.setAttribute('cx', n(centre.x));
    pulse.setAttribute('cy', n(centre.y));
    pulse.setAttribute('rx', n(logo.offsetWidth * .64));
    pulse.setAttribute('ry', n(logo.offsetHeight * .64));
    return true;
  }

  function play(element, frames, options) {
    const animation = element.animate(frames, { fill: 'none', ...options });
    animations.push(animation);
    return animation;
  }

  function replay() {
    settle();
    if (disposed || reduce.matches || document.hidden || !visible || !visual.animate || !geometry()) return false;
    const current = sequence;
    visual.dataset.pbMotionState = 'playing';
    const smooth = 'cubic-bezier(.16,1,.3,1)';
    const base = element => {
      const value = getComputedStyle(element).transform;
      return value === 'none' ? '' : value;
    };
    const logoBase = base(logo);
    play(logo, [
      { transform: `${logoBase} scale(.88)`, opacity: .65, offset: 0 },
      { transform: `${logoBase} scale(1.065)`, opacity: 1, offset: .38 },
      { transform: `${logoBase} scale(1)`, opacity: 1, offset: 1 }
    ], { duration: 1520, delay: 100, easing: smooth });
    [heart, chart].forEach((chip, index) => {
      const transform = base(chip);
      const direction = index === 0 ? -1 : 1;
      play(chip, [
        { transform: `${transform} translate(${direction * 20}px,${direction * 16}px) scale(.72)`, opacity: .25 },
        { transform: `${transform} translate(0,0) scale(1)`, opacity: 1 }
      ], { duration: 1050, delay: 70 + index * 370, easing: smooth });
    });
    outlines.forEach((rect, index) => {
      const direction = index % 2 === 0 ? -1 : 1;
      play(rect, [
        { transform: `translate(${direction * (36 + index * 10)}px,${-26 + index * 24}px) rotate(${40 - index * 28}deg) scale(.64)`, opacity: 0, offset: 0 },
        { opacity: .85 - index * .12, offset: .2 },
        { transform: `translate(0,0) rotate(${-12 + index * 8}deg) scale(1)`, opacity: [.18, .12, .08][index], offset: 1 }
      ], { duration: 1420, delay: index * 140, easing: smooth });
    });
    traces.forEach((path, index) => play(path, [
      { strokeDashoffset: '1.18', opacity: 0, offset: 0 },
      { opacity: 1, offset: .07 },
      { opacity: 1, offset: .79 },
      { strokeDashoffset: '-.18', opacity: 0, offset: 1 }
    ], { duration: 1400, delay: 150 + index * 450, easing: 'cubic-bezier(.33,0,.25,1)' }));
    play(pulse, [
      { transform: 'rotate(-12deg) scale(.65)', opacity: 0, offset: 0 },
      { opacity: .62, offset: .25 },
      { transform: 'rotate(-12deg) scale(1.18)', opacity: 0, offset: 1 }
    ], { duration: 1120, delay: 650, easing: smooth });
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (sequence === current) settle();
    });
    return true;
  }

  function setVisible(next) {
    visible = next;
    if (!visible) { settle(); return; }
    if (!entered) { entered = true; replay(); }
  }
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { threshold: 0 })
    : null;
  geometry();
  settle();
  if (observer) observer.observe(visual);
  const fallbackVisibility = () => {
    const rect = visual.getBoundingClientRect();
    setVisible(rect.bottom > 0 && rect.top < innerHeight);
  };
  if (!observer) {
    fallbackVisibility();
    listen(window, 'scroll', fallbackVisibility);
  }
  const resize = () => {
    const box = visual.getBoundingClientRect();
    if (Math.abs(box.width - measuredWidth) < .1 && Math.abs(box.height - measuredHeight) < .1) return;
    settle();
    geometry();
  };
  const resizer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  resizer?.observe(visual);
  listen(window, 'resize', resize);
  listen(trigger, 'pointerenter', event => { if (event.pointerType !== 'touch') replay(); });
  listen(trigger, 'focus', replay);
  listen(window, 'pb-motion-replay', replay);
  listen(document, 'visibilitychange', () => { if (document.hidden) settle(); });
  listen(reduce, 'change', settle);
  listen(window, 'pagehide', () => {
    disposed = true;
    settle();
    observer?.disconnect();
    resizer?.disconnect();
    abort.abort();
  });
  window.PBInstagramMotion = { replay, settle };
})();
