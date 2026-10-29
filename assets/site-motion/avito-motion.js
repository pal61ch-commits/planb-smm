/* Finite decorative stages, each entering while its number is actually visible. */
(() => {
  'use strict';
  if (!/(?:vedenie-avito|razovaya-nastroyka-avito)(?:\.html)?\/?$/.test(location.pathname)) return;
  if (window.PBAvitoMotion) return;
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [];
  const svgNode = (name, attributes = {}) => {
    const node = document.createElementNS(NS, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };
  const round = value => Math.round(value * 100) / 100;
  const point = (x, y) => `${round(x)},${round(y)}`;
  const exposed = element => {
    const rect = element.getBoundingClientRect();
    const nav = document.querySelector('.nav')?.getBoundingClientRect();
    const top = nav && nav.top <= 16 && nav.bottom > 0 ? nav.bottom + 12 : 12;
    if (document.hidden || rect.width <= 0 || rect.height <= 0 || rect.top < top ||
        rect.bottom > innerHeight - 20 || rect.left < 0 || rect.right > innerWidth) return false;
    return ![...document.querySelectorAll('.contact-dock, #planb-cookie')].some(blocker => {
      const style = getComputedStyle(blocker), box = blocker.getBoundingClientRect();
      return style.visibility !== 'hidden' && Number(style.opacity) > .1 &&
        box.width > 0 && box.height > 0 && rect.left < box.right && rect.right > box.left &&
        rect.top < box.bottom && rect.bottom > box.top;
    });
  };
  const chamfer = (cx, cy, width, height) => {
    const x = cx - width / 2, y = cy - height / 2, cut = 7;
    return `M${point(x + cut, y)} H${round(x + width - cut)} L${point(x + width, y + cut)} V${round(y + height - cut)} L${point(x + width - cut, y + height)} H${round(x + cut)} L${point(x, y + height - cut)} V${round(y + cut)} Z`;
  };

  document.querySelectorAll('.section .steps').forEach(container => {
    const cards = [...container.querySelectorAll(':scope > .step')];
    const markers = cards.map(card => card.querySelector(':scope > b'));
    if (cards.length !== 4 || markers.some(marker => !marker)) return;
    container.classList.add('pb-avito-steps');
    const svg = svgNode('svg', {class: 'pb-avito-route', 'aria-hidden': 'true', focusable: 'false'});
    container.append(svg);
    const scene = {container, svg, cards, markers, played: false, routes: [], frames: [],
      stages: markers.map(() => ({done: false, timer: 0, animations: [], generation: 0, startsAt: 0}))};

    const updateState = () => {
      container.dataset.pbAvitoMotion = scene.stages.some(stage => stage.animations.length) ? 'playing' : 'settled';
    };
    const cancelStage = stage => {
      stage.generation += 1;
      clearTimeout(stage.timer);
      stage.timer = 0;
      stage.animations.forEach(animation => animation.cancel());
      stage.animations = [];
    };
    const settle = () => {
      scene.stages.forEach(cancelStage);
      updateState();
    };

    const measure = () => {
      settle();
      const parent = container.getBoundingClientRect();
      scene.lastWidth = parent.width;
      scene.lastHeight = parent.height;
      svg.setAttribute('viewBox', `0 0 ${round(parent.width)} ${round(parent.height)}`);
      svg.replaceChildren();
      scene.routes = [];
      scene.frames = [];
      const nodes = markers.map((marker, index) => {
        const rect = marker.getBoundingClientRect(), card = cards[index].getBoundingClientRect();
        const heading = cards[index].querySelector(':scope > h3').getBoundingClientRect();
        const frameTop = rect.top - parent.top - 5;
        // Keep the complete number inside; leave room below the geometric stroke.
        const frameBottom = Math.min(rect.bottom - parent.top + 3, heading.top - parent.top - 5);
        return {x: rect.left - parent.left + rect.width / 2,
          y: (frameTop + frameBottom) / 2,
          width: Math.max(50, rect.width + 20), height: frameBottom - frameTop,
          cardLeft: card.left - parent.left, cardRight: card.right - parent.left,
          cardTop: card.top - parent.top, cardBottom: card.bottom - parent.top};
      });

      for (let index = 0; index < nodes.length - 1; index += 1) {
        const a = nodes[index], b = nodes[index + 1];
        let d;
        if (Math.abs(a.y - b.y) < 12) {
          d = `M${point(a.x + a.width / 2, a.y)} L${point(b.x - b.width / 2, b.y)}`;
        } else if (Math.abs(a.x - b.x) < 12) {
          const lane = Math.max(5, Math.min(a.cardLeft, b.cardLeft) + 8);
          d = `M${point(a.x - a.width / 2, a.y)} H${round(lane)} V${round(b.y)} H${round(b.x - b.width / 2)}`;
        } else {
          // The 2×2 grid wraps through the empty row gap, avoiding the card text.
          const right = Math.min(parent.width - 5, a.cardRight - 8);
          const left = Math.max(5, b.cardLeft + 8);
          const mid = (a.cardBottom + b.cardTop) / 2;
          d = `M${point(a.x + a.width / 2, a.y)} H${round(right)} V${round(mid)} H${round(left)} V${round(b.y)} H${round(b.x - b.width / 2)}`;
        }
        const guide = svgNode('path', {class: 'pb-avito-guide', d});
        const draw = svgNode('path', {class: 'pb-avito-draw', d, pathLength: 1});
        const beam = svgNode('path', {class: 'pb-avito-beam', d, pathLength: 1});
        svg.append(guide, draw, beam);
        scene.routes.push({draw, beam});
      }
      nodes.forEach(node => {
        const d = chamfer(node.x, node.y, node.width, node.height);
        const base = svgNode('path', {class: 'pb-avito-marker-base', d});
        const draw = svgNode('path', {class: 'pb-avito-marker-draw', d, pathLength: 1});
        const light = svgNode('path', {class: 'pb-avito-marker-light', d});
        svg.append(base, draw, light);
        scene.frames.push({draw, light});
      });
    };

    const playStage = index => {
      const stage = scene.stages[index];
      stage.timer = 0;
      if (stage.done || reduced.matches || !exposed(scene.frames[index].draw) || !Element.prototype.animate) return;
      scene.played = true;
      const generation = ++stage.generation;
      const animate = (node, frames, options) => {
        stage.animations.push(node.animate(frames, {...options, fill: 'both'}));
      };
      if (index > 0) {
        const {draw, beam} = scene.routes[index - 1];
        animate(draw, [{strokeDashoffset: 1, opacity: .25}, {strokeDashoffset: 0, opacity: .7}],
          {duration: 575, easing: 'cubic-bezier(.22,.7,.2,1)'});
        animate(beam, [{strokeDashoffset: .18, opacity: 0},
          {strokeDashoffset: .06, opacity: 1, offset: .14},
          {strokeDashoffset: -.82, opacity: 1, offset: .87},
          {strokeDashoffset: -1, opacity: 0}], {duration: 640, easing: 'linear'});
      }
      const {draw, light} = scene.frames[index], delay = index ? 270 : 0;
      animate(draw, [{strokeDashoffset: 1, opacity: .2}, {strokeDashoffset: 0, opacity: 1}],
        {duration: 420, delay, easing: 'cubic-bezier(.2,.75,.2,1)'});
      animate(light, [{opacity: 0}, {opacity: .12, offset: .4}, {opacity: 0}],
        {duration: 550, delay, easing: 'ease-out'});
      updateState();
      Promise.all(stage.animations.map(animation => animation.finished.catch(() => {}))).then(() => {
        if (stage.generation !== generation) return;
        stage.done = true;
        cancelStage(stage);
        updateState();
      });
    };

    const scan = () => {
      if (reduced.matches || document.hidden || !Element.prototype.animate) {
        settle();
        return;
      }
      const now = performance.now();
      scene.stages.forEach((stage, index) => {
        if (!exposed(scene.frames[index].draw)) cancelStage(stage);
      });
      let next = Math.max(now, ...scene.stages.filter(stage => stage.timer || stage.animations.length)
        .map(stage => stage.startsAt + 500));
      scene.stages.forEach((stage, index) => {
        if (stage.done || stage.timer || stage.animations.length || !exposed(scene.frames[index].draw)) return;
        stage.startsAt = next;
        const delay = Math.max(0, next - now);
        if (delay < 1) playStage(index);
        else stage.timer = setTimeout(() => playStage(index), delay);
        next += 500;
      });
      updateState();
    };

    scene.settle = settle;
    scene.scan = scan;
    scene.replay = () => {
      settle();
      scene.stages.forEach(stage => { stage.done = false; });
      scene.played = false;
      scan();
    };
    scenes.push(scene);
    measure();
    if ('ResizeObserver' in window) {
      scene.resize = new ResizeObserver(() => {
        const rect = container.getBoundingClientRect();
        if (Math.abs(rect.width - scene.lastWidth) > .5 || Math.abs(rect.height - scene.lastHeight) > .5) measure();
        scan();
      });
      scene.resize.observe(container);
    }
    if ('IntersectionObserver' in window) {
      scene.intersection = new IntersectionObserver(scan, {threshold: [0, 1]});
      markers.forEach(marker => scene.intersection.observe(marker));
    }
    scene.measure = () => { measure(); scan(); };

  });

  const settle = () => scenes.forEach(scene => scene.settle());
  const scan = () => scenes.forEach(scene => scene.scan());
  const replay = () => scenes.forEach(scene => scene.replay());
  // One queued frame per scroll/resize burst; there is no autonomous animation loop.
  let pendingFrame = 0;
  const requestScan = () => {
    if (pendingFrame || document.hidden) return;
    pendingFrame = requestAnimationFrame(() => { pendingFrame = 0; scan(); });
  };
  addEventListener('scroll', requestScan, {passive: true});
  addEventListener('resize', () => scenes.forEach(scene => scene.measure()), {passive: true});
  addEventListener('pageshow', scan);
  addEventListener('pb-motion-replay', replay);
  document.addEventListener('planb:analytics-consent', requestScan);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
      settle();
    } else scan();
  });
  if (reduced.addEventListener) reduced.addEventListener('change', scan);
  else reduced.addListener(scan);
  window.PBAvitoMotion = {replay, settle, getState: () => scenes.map(scene => ({
    state: scene.container.dataset.pbAvitoMotion,
    played: scene.played,
    completedStages: scene.stages.map(stage => stage.done),
    queuedStages: scene.stages.map(stage => Boolean(stage.timer)),
    activeAnimations: scene.stages.flatMap(stage => stage.animations)
      .filter(animation => animation.playState === 'running' || animation.playState === 'pending').length,
    routes: scene.routes.length, markers: scene.frames.length
  }))};
})();
