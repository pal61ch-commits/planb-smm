(function () {
  "use strict";

  var root = document.documentElement;
  var signal = document.querySelector("[data-home-signal]");
  var progressMeter = document.querySelector("[data-home-progress]");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var queued = false;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function decorateReveals() {
    var revealSelectors = [
      ".section-head",
      ".stage-card",
      ".outcome",
      ".service-feature",
      ".one-off-service",
      ".scenario-card",
      ".flow-item",
      ".ecosystem-card",
      ".deliverable-copy",
      ".blog-card",
      ".step",
      ".legal-panel",
      ".faq",
      ".contact-copy",
      ".lead-form"
    ];

    document.querySelectorAll(revealSelectors.join(",")).forEach(function (element) {
      element.setAttribute("data-sc-in", "");
    });

    document.querySelectorAll(".stage-grid,.outcome-grid,.scenario-grid,.flow,.ecosystem-grid,.blog-grid,.steps").forEach(function (group) {
      group.setAttribute("data-sc-stagger", "70");
    });
  }

  function render() {
    queued = false;
    var available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var progress = clamp(window.scrollY / available, 0, 1);
    root.style.setProperty("--home-progress", progress.toFixed(4));
    root.classList.toggle("home-scrolled", window.scrollY > 24);
    if (progressMeter) {
      progressMeter.setAttribute("data-sc-verify-state", "page:" + Math.round(progress * 100));
    }

    if (signal) {
      var rect = signal.getBoundingClientRect();
      var stageProgress = clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0, 1);
      signal.setAttribute("data-sc-verify-state", "signal:" + Math.round(stageProgress * 100));
      if (reduced.matches) signal.setAttribute("data-sc-verify-hold", "true");
      else signal.removeAttribute("data-sc-verify-hold");
    }
  }

  function requestRender() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(render);
  }

  decorateReveals();

  if (window.ScrollCraft && typeof window.ScrollCraft.mount === "function") {
    window.ScrollCraft.mount(document.body);
  }

  window.addEventListener("scroll", requestRender, { passive: true });
  window.addEventListener("resize", requestRender, { passive: true });
  reduced.addEventListener("change", requestRender);
  window.addEventListener("pageshow", requestRender);

  render();
})();
