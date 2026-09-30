(function () {
  "use strict";

  var root = document.documentElement;
  if (root.hasAttribute("data-planb-depth-mounted")) return;
  root.setAttribute("data-planb-depth-mounted", "");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var queued = false;
  var progress = document.createElement("div");
  progress.className = "site-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.setAttribute("data-sc-verify-state", "page:0");
  progress.innerHTML = "<span></span>";
  document.body.appendChild(progress);

  if (!document.querySelector(".bg")) {
    var atmosphere = document.createElement("div");
    atmosphere.className = "bg";
    atmosphere.setAttribute("aria-hidden", "true");
    document.body.insertBefore(atmosphere, document.body.firstChild);
  }

  root.classList.toggle("has-contact-dock", Boolean(document.querySelector(".contact-dock")));

  function markEach(selector, attribute, value) {
    document.querySelectorAll(selector).forEach(function (element) {
      element.setAttribute(attribute, value == null ? "" : value);
    });
  }

  function decorate() {
    markEach(".phead, main:not([class]) > .hero .wrap, .section-head, .cta, .more > h2, .notice, .pricebox, .choice, .contact-cta, .expert, .video-promo", "data-sc-in");
    var groups = ".kpis, .post-grid, .grid, .more-grid, .cards, .cases, .steps, .direction-grid, .evidence, .method-list, .video-grid";
    markEach(groups, "data-sc-in");
    markEach(groups, "data-sc-stagger", "65");
    markEach(".article-video", "data-sc-in");

    var entity = document.querySelector(".entity-card");
    if (entity) {
      entity.setAttribute("data-sc-tilt", "3");
      entity.setAttribute("data-sc-spotlight", "");
    }
  }

  function ensureCompleteMenu() {
    var links = document.querySelector(".nav .nav-links");
    if (!links) return;
    var existingCta = links.querySelector(".nav-cta");
    var cta = existingCta ? existingCta.cloneNode(true) : document.createElement("a");
    if (!existingCta) {
      cta.className = "nav-cta";
      cta.href = "/#contact";
      cta.textContent = "Получить разбор";
    }
    var pathname = window.location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
    var items = [
      { label: "Услуги", href: "/#services", current: pathname.indexOf("/uslugi/") === 0 },
      { label: "Кейсы", href: "/kejsy/", current: pathname === "/kejsy" || pathname.indexOf("/kejsy/") === 0 },
      { label: "Блог", href: "/blog/", current: pathname === "/blog" || pathname.indexOf("/blog/") === 0 },
      { label: "Видео", href: "/video/", current: pathname === "/video" },
      { label: "Отзывы", href: "/otzyvy/", current: pathname === "/otzyvy" },
      { label: "Контакты", href: "/#contact", current: false }
    ];
    links.replaceChildren();
    items.forEach(function (item) {
      var link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      if (item.current) link.setAttribute("aria-current", "page");
      links.appendChild(link);
    });
    links.appendChild(cta);
  }

  function mountMenu() {
    var nav = document.querySelector(".nav");
    var shell = nav && nav.querySelector(".wrap");
    var links = nav && nav.querySelector(".nav-links");
    if (!nav || !shell || !links || nav.querySelector(".inner-menu-btn")) return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "inner-menu-btn";
    button.setAttribute("aria-label", "Открыть меню");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = "<span></span>";
    links.id = links.id || "site-nav-links";
    button.setAttribute("aria-controls", links.id);
    shell.insertBefore(button, links);

    function closeMenu() {
      links.removeAttribute("data-open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Открыть меню");
    }

    button.addEventListener("click", function () {
      var open = button.getAttribute("aria-expanded") !== "true";
      if (open) links.setAttribute("data-open", "true");
      else links.removeAttribute("data-open");
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    });
    links.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
        closeMenu();
        button.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 720) closeMenu();
    }, { passive: true });
  }

  function revealFallback() {
    document.querySelectorAll("[data-sc-in], [data-sc-stagger] > *").forEach(function (element) {
      element.classList.add("sc-in");
    });
  }

  function render() {
    queued = false;
    var available = Math.max(1, root.scrollHeight - window.innerHeight);
    var ratio = Math.min(1, Math.max(0, window.scrollY / available));
    root.style.setProperty("--site-progress", ratio.toFixed(4));
    root.classList.toggle("site-scrolled", window.scrollY > 24);
    progress.setAttribute("data-sc-verify-state", "page:" + Math.round(ratio * 100));
    if (reduced.matches) progress.setAttribute("data-sc-verify-hold", "true");
    else progress.removeAttribute("data-sc-verify-hold");
  }

  function requestRender() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(render);
  }

  function loadContactLayer() {
    if (window.PlanBContactLayer) {
      window.PlanBContactLayer.mount();
      return;
    }
    function loadScript() {
      if (document.querySelector('script[data-planb-contact-layer]')) return;
      var script = document.createElement("script");
      script.src = "/assets/contact-layer.js";
      script.defer = true;
      script.setAttribute("data-planb-contact-layer", "");
      document.head.appendChild(script);
    }
    var stylesheet = document.querySelector('link[data-planb-contact-layer]');
    if (stylesheet) {
      loadScript();
      return;
    }
    stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/assets/contact-layer.css";
    stylesheet.setAttribute("data-planb-contact-layer", "");
    stylesheet.addEventListener("load", loadScript, { once: true });
    stylesheet.addEventListener("error", function () {
      var placeholder = document.querySelector("[data-planb-contact-placeholder]");
      if (placeholder) placeholder.remove();
    }, { once: true });
    document.head.appendChild(stylesheet);
  }

  function reserveContactHeader() {
    if (document.querySelector(".contact-strip,.planb-header-contact-strip")) return;
    var nav = document.querySelector(".nav");
    if (!nav || !nav.parentNode) return;
    root.classList.add("has-contact-dock");
    var placeholder = document.createElement("div");
    placeholder.className = "planb-header-contact-strip";
    placeholder.setAttribute("data-planb-contact-placeholder", "");
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.style.cssText = "min-height:34px;background:#090a0c";
    nav.parentNode.insertBefore(placeholder, nav);
  }

  reserveContactHeader();
  ensureCompleteMenu();
  mountMenu();
  loadContactLayer();
  decorate();

  try {
    if (window.ScrollCraft && typeof window.ScrollCraft.mount === "function") {
      if (!window.ScrollCraft.instances || window.ScrollCraft.instances.length === 0) {
        window.ScrollCraft.mount(document.body);
      } else {
        revealFallback();
      }
    } else {
      revealFallback();
    }
  } catch (error) {
    revealFallback();
    root.setAttribute("data-planb-depth-fallback", "");
  }

  window.addEventListener("scroll", requestRender, { passive: true });
  window.addEventListener("resize", requestRender, { passive: true });
  window.addEventListener("pageshow", requestRender);
  if (typeof reduced.addEventListener === "function") reduced.addEventListener("change", requestRender);
  else if (typeof reduced.addListener === "function") reduced.addListener(requestRender);
  render();
})();
