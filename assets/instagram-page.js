(function () {
  "use strict";
  var panel = document.querySelector(".phone-panel");
  var viewport = panel && panel.querySelector(".phone-notification-scroll");
  if (!viewport) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var hovered = false;
  var visible = false;
  var direction = 1;
  var holdUntil = 0;
  var movement = null;
  var frame = 0;
  document.documentElement.setAttribute("data-ig-animated", "true");

  function canMove() {
    return visible && !hovered && !document.hidden && !reducedMotion.matches;
  }

  function schedule() {
    if (!frame && canMove()) frame = window.requestAnimationFrame(tick);
  }

  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    movement = null;
  }

  function tick(time) {
    frame = 0;
    if (!canMove()) return;
    var limit = viewport.scrollHeight - viewport.clientHeight;
    if (limit <= 1) return;
    if (time < holdUntil) {
      schedule();
      return;
    }
    if (!movement) {
      var start = viewport.scrollTop;
      if (start >= limit - 1) direction = -1;
      if (start <= 1) direction = 1;
      var step = Math.max(42, viewport.clientWidth * 0.23);
      var target = Math.max(0, Math.min(limit, start + step * direction));
      movement = { start: start, target: target, time: time, duration: 1250 };
    }
    var progress = Math.min(1, (time - movement.time) / movement.duration);
    var eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    viewport.scrollTop = movement.start + (movement.target - movement.start) * eased;
    if (progress >= 1) {
      var atEnd = movement.target <= 1 || movement.target >= limit - 1;
      movement = null;
      holdUntil = time + (atEnd ? 2600 : 1650);
    }
    schedule();
  }

  // Native scrolling stays available. A swipe, wheel or key gives the user the
  // screen for twelve seconds, then automatic scrolling continues from there.
  function manualInteraction() {
    movement = null;
    holdUntil = performance.now() + 12000;
    schedule();
  }
  viewport.addEventListener("pointerdown", manualInteraction, { passive: true });
  viewport.addEventListener("touchstart", manualInteraction, { passive: true });
  viewport.addEventListener("wheel", manualInteraction, { passive: true });
  viewport.addEventListener("keydown", manualInteraction);
  viewport.addEventListener("pointerenter", function (event) {
    if (event.pointerType !== "mouse") return;
    hovered = true;
    stop();
  });
  viewport.addEventListener("pointerleave", function (event) {
    if (event.pointerType !== "mouse") return;
    hovered = false;
    schedule();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else schedule();
  });
  function motionPreferenceChanged() {
      stop();
    holdUntil = performance.now() + 2000;
    schedule();
  }
  if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", motionPreferenceChanged);
  else reducedMotion.addListener(motionPreferenceChanged);
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) {
        holdUntil = Math.max(holdUntil, performance.now() + 2000);
        schedule();
      } else stop();
    }, { threshold: 0.15 });
    observer.observe(viewport);
  } else {
    visible = true;
    holdUntil = performance.now() + 2000;
    schedule();
  }
  if ("ResizeObserver" in window) {
    new ResizeObserver(function () {
      movement = null;
      schedule();
    }).observe(viewport);
  }
})();
