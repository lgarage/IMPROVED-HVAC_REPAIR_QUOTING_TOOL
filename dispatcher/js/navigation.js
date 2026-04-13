/**
 * Dispatcher sidebar — Reports submenu flyout (positioning + toggle).
 * Invoicing submenu remains in index.html inline script; cross-closes here.
 */
(function (global) {
  "use strict";

  function positionReportsFlyout() {
    var wrap = document.getElementById("sidebar-nav-reports");
    var flyout = document.getElementById("sidebar-reports-flyout");
    if (
      !wrap ||
      !flyout ||
      !wrap.classList.contains("sidebar-reports-open")
    )
      return;
    var r = wrap.getBoundingClientRect();
    flyout.style.top = Math.round(r.top) + "px";
    flyout.style.left = Math.round(r.right) + "px";
  }

  function repositionReportsSubmenu() {
    requestAnimationFrame(positionReportsFlyout);
  }

  global.repositionReportsSubmenu = repositionReportsSubmenu;

  global.toggleReportsSubmenu = function (event) {
    if (event) event.stopPropagation();
    var wrap = document.getElementById("sidebar-nav-reports");
    var btn = document.getElementById("sidebar-reports-trigger");
    if (!wrap) return;
    if (typeof global.closeInvoicingSubmenu === "function") {
      global.closeInvoicingSubmenu();
    }
    wrap.classList.toggle("sidebar-reports-open");
    var isOpen = wrap.classList.contains("sidebar-reports-open");
    if (btn) btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (isOpen) repositionReportsSubmenu();
  };

  global.closeReportsSubmenu = function () {
    var wrap = document.getElementById("sidebar-nav-reports");
    var btn = document.getElementById("sidebar-reports-trigger");
    if (wrap) wrap.classList.remove("sidebar-reports-open");
    if (btn) btn.setAttribute("aria-expanded", "false");
  };

  (function initReportsFlyoutListeners() {
    function onMove() {
      var wrap = document.getElementById("sidebar-nav-reports");
      if (wrap && wrap.classList.contains("sidebar-reports-open"))
        repositionReportsSubmenu();
    }
    global.addEventListener("resize", onMove);
    global.addEventListener("scroll", onMove, true);
    var sb = document.getElementById("appSidebar");
    if (sb) sb.addEventListener("scroll", onMove);
  })();
})(typeof window !== "undefined" ? window : this);
