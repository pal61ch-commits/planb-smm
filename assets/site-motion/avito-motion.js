/* One finite, decorative SVG sequence. Existing copy, numbers and forms are untouched. */
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
  const visible = element => {
    const rect = element.getBoundingClientRect();
    return !document.hidden && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
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
    const scene = {container, svg, cards, markers, animations: [], played: false, generation: 0, routes: [], frames: []};

    const settle = () => {
      scene.generation += 1;
      scene.animations.forEach(animation => animation.cancel());
      scene.animations = [];
      container.dataset.pbAvitoMotion = 'settled';
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

    const play = () => {
      if (reduced.matches || !visible(container) || !Element.prototype.animate) {
        settle();
        return;
      }
      settle();
      scene.played = true;
      container.dataset.pbAvitoMotion = 'playing';
      const generation = scene.generation;
      const animate = (node, frames, options) => {
        const animation = node.animate(frames, {...options, fill: 'both'});
        scene.animations.push(animation);
      };
      scene.routes.forEach(({draw, beam}, index) => {
        const delay = 280 + index * 555;
        animate(draw, [{strokeDashoffset: 1, opacity: .25}, {strokeDashoffset: 0, opacity: .7}],
          {duration: 575, delay, easing: 'cubic-bezier(.22,.7,.2,1)'});
        animate(beam, [{strokeDashoffset: .18, opacity: 0},
          {strokeDashoffset: .06, opacity: 1, offset: .14},
          {strokeDashoffset: -.82, opacity: 1, offset: .87},
          {strokeDashoffset: -1, opacity: 0}],
          {duration: 640, delay, easing: 'linear'});
      });
      scene.frames.forEach(({draw, light}, index) => {
        const delay = index === 0 ? 0 : 550 + (index - 1) * 555;
        animate(draw, [{strokeDashoffset: 1, opacity: .2}, {strokeDashoffset: 0, opacity: 1}],
          {duration: 420, delay, easing: 'cubic-bezier(.2,.75,.2,1)'});
        animate(light, [{opacity: 0}, {opacity: .12, offset: .4}, {opacity: 0}],
          {duration: 550, delay, easing: 'ease-out'});
      });
      Promise.all(scene.animations.map(animation => animation.finished.catch(() => {}))).then(() => {
        if (scene.generation === generation) settle();
      });
    };

    scene.settle = settle;
    scene.play = play;
    scene.measure = measure;
    scenes.push(scene);
    measure();
    if ('ResizeObserver' in window) {
      scene.resize = new ResizeObserver(() => {
        const rect = container.getBoundingClientRect();
        if (Math.abs(rect.width - scene.lastWidth) > .5 || Math.abs(rect.height - scene.lastHeight) > .5) measure();
      });
      scene.resize.observe(container);
    } else {
      addEventListener('resize', measure, {passive: true});
    }
    if ('IntersectionObserver' in window) {
      scene.intersection = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) settle();
        else if (!scene.played && !reduced.matches && !document.hidden) play();
      }), {threshold: .2});
      scene.intersection.observe(container);
    }
  });

  const settle = () => scenes.forEach(scene => scene.settle());
  const replay = () => scenes.forEach(scene => scene.play());
  addEventListener('pb-motion-replay', replay);
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
  const motionChange = () => { if (reduced.matches) settle(); };
  if (reduced.addEventListener) reduced.addEventListener('change', motionChange);
  else reduced.addListener(motionChange);
  window.PBAvitoMotion = {replay, settle, getState: () => scenes.map(scene => ({
    state: scene.container.dataset.pbAvitoMotion,
    played: scene.played,
    activeAnimations: scene.animations.filter(animation => animation.playState === 'running' || animation.playState === 'pending').length,
    routes: scene.routes.length, markers: scene.frames.length
  }))};
})();
