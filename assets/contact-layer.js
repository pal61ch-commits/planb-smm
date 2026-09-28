(function () {
  "use strict";

  if (window.PlanBContactLayer) {
    window.PlanBContactLayer.mount();
    return;
  }

  var CONTACTS = [
    {
      key: "phone",
      label: "Позвонить в Plan B",
      shortLabel: "Звонок",
      href: "tel:+79281446617",
      path: "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
    },
    {
      key: "whatsapp",
      label: "Написать в WhatsApp",
      shortLabel: "WhatsApp",
      href: "https://wa.me/79281446617?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5%21%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B1%D0%B5%D1%81%D0%BF%D0%BB%D0%B0%D1%82%D0%BD%D1%83%D1%8E%20%D0%BA%D0%BE%D0%BD%D1%81%D1%83%D0%BB%D1%8C%D1%82%D0%B0%D1%86%D0%B8%D1%8E%20%D0%B8%20%D0%BF%D0%BB%D0%B0%D0%BD%20%D0%BF%D1%80%D0%BE%D0%B4%D0%B2%D0%B8%D0%B6%D0%B5%D0%BD%D0%B8%D1%8F.",
      path: "M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.97L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.18c-.24.68-1.42 1.31-1.96 1.36-.5.05-1.13.07-1.83-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-2.99s.75-2.12 1.01-2.41c.26-.29.57-.36.76-.36l.55.01c.18.01.42-.07.65.5.24.57.81 1.99.88 2.13.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.69-.81.87-1.09.18-.28.36-.23.61-.14.25.09 1.6.76 1.87.9.28.14.46.21.53.33.07.12.07.68-.17 1.36z"
    },
    {
      key: "telegram",
      label: "Написать в Telegram",
      shortLabel: "Telegram",
      href: "https://t.me/kislovkosta",
      path: "M21.94 4.5 2.9 11.84c-1.3.52-1.29 1.25-.24 1.57l4.88 1.52 1.88 5.78c.23.63.11.88.77.88.51 0 .73-.23 1.02-.5l2.46-2.39 5.12 3.78c.94.52 1.62.25 1.85-.87L24 5.81c.34-1.38-.52-2-1.5-1.59z"
    }
  ];

  function ensureStyles() {
    if (document.querySelector("link[data-planb-contact-layer]")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/contact-layer.css";
    link.setAttribute("data-planb-contact-layer", "");
    document.head.appendChild(link);
  }

  function icon(contact) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + contact.path + '"></path></svg>';
  }

  function buildAction(contact) {
    var link = document.createElement("a");
    link.className = "planb-contact-action planb-contact-action--" + contact.key;
    link.href = contact.href;
    link.setAttribute("aria-label", contact.label);
    link.title = contact.label;
    if (contact.key !== "phone") {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    link.innerHTML = icon(contact) + '<span class="planb-visually-hidden">' + contact.shortLabel + "</span>";
    return link;
  }

  function buildHeaderLink(contact) {
    var link = document.createElement("a");
    link.className = "planb-header-contact-link";
    link.href = contact.href;
    link.setAttribute("aria-label", contact.label);
    if (contact.key !== "phone") {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    link.innerHTML = icon(contact) + "<span>" + (contact.key === "phone" ? "+7 928 144-66-17" : contact.shortLabel) + "</span>";
    return link;
  }

  function mountHeaderContacts() {
    if (document.querySelector(".contact-strip")) return;
    var nav = document.querySelector(".nav");
    if (!nav || !nav.parentNode) return;

    var strip = document.querySelector(".planb-header-contact-strip");
    if (strip && !strip.hasAttribute("data-planb-contact-placeholder")) return;
    if (!strip) {
      strip = document.createElement("div");
      strip.className = "planb-header-contact-strip";
      nav.parentNode.insertBefore(strip, nav);
    }
    strip.removeAttribute("data-planb-contact-placeholder");
    strip.removeAttribute("aria-hidden");
    strip.removeAttribute("style");
    strip.replaceChildren();
    var row = document.createElement("div");
    row.className = "planb-header-contact-row";
    var label = document.createElement("span");
    label.className = "planb-header-contact-label";
    label.textContent = "Обсудить продвижение на Avito";
    var links = document.createElement("div");
    links.className = "planb-header-contact-links";
    links.setAttribute("role", "group");
    links.setAttribute("aria-label", "Прямые контакты отдела продаж");
    CONTACTS.forEach(function (contact) { links.appendChild(buildHeaderLink(contact)); });
    row.appendChild(label);
    row.appendChild(links);
    strip.appendChild(row);
  }

  function upgradeExistingDock(dock) {
    dock.classList.add("planb-contact-dock");
    var links = Array.prototype.slice.call(dock.querySelectorAll("a"));
    links.forEach(function (link) {
      var label = (link.textContent || "").trim();
      if (!label) return;
      link.setAttribute("aria-label", label === "Звонок" ? "Позвонить в Plan B" : "Написать в " + label);
      link.title = link.getAttribute("aria-label");
    });
    ["call", "wa", "tg"].forEach(function (kind) {
      var link = links.find(function (candidate) { return candidate.classList.contains(kind); });
      if (link) dock.appendChild(link);
    });
  }

  function mountDock() {
    var existing = document.querySelector(".contact-dock");
    if (existing) {
      upgradeExistingDock(existing);
      return;
    }
    var dock = document.createElement("nav");
    dock.className = "contact-dock planb-contact-dock";
    dock.setAttribute("aria-label", "Быстрая связь");
    CONTACTS.forEach(function (contact) { dock.appendChild(buildAction(contact)); });
    document.body.appendChild(dock);
  }

  function mount() {
    ensureStyles();
    mountHeaderContacts();
    mountDock();
    document.documentElement.classList.add("has-contact-dock");
  }

  window.PlanBContactLayer = { mount: mount };
  mount();
})();
