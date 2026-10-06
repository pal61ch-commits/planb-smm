(function () {
  "use strict";
  var panel = document.querySelector(".phone-panel");
  var button = panel && panel.querySelector(".notification-toggle");
  if (!button) return;
  document.documentElement.setAttribute("data-ig-animated", "true");
  button.addEventListener("click", function () {
    var paused = panel.classList.toggle("is-paused");
    button.setAttribute("aria-pressed", String(paused));
    button.textContent = paused ? "Продолжить анимацию" : "Приостановить анимацию";
  });
})();
