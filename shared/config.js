/**
 * Vertex Core — tenant branding & identity (Phase 10).
 * Override via localStorage vc_app_config (JSON) and vc_active_tenant_id.
 */
(function (global) {
  "use strict";

  var BASE = {
    tenantId: "TWIN_PILLARS",
    brandName: "Twin Pillars Heating & Cooling LLC",
    shortBrand: "Twin Pillars",
    /** Default Vertex Core asset; override per tenant via Settings → Branding (URL or path). */
    logoUrl: "vertex_core_logo.png",
    primaryColor: "#1e4b85",
    accentColor: "#c89b53",
    adminUnlockPin: "beta",
  };

  /**
   * Enterprise role definitions (Vertex-Core CSV mapping). Used by User Import + Field entitlements.
   */
  global.VC_ROLE_DEFINITIONS = {
    admin: { id: "admin", label: "Administrator", description: "Full dispatcher / settings access." },
    tech: { id: "tech", label: "Field Technician", description: "Field app, jobs, equipment, reporting." },
    sales: { id: "sales", label: "Sales", description: "Quote / customer-facing workflows." },
    timeTrackingOnly: {
      id: "time_tracking_only",
      label: "Time Tracking Only",
      description:
        "Yellow / restricted seat: clock-in/out only; AI dictation, advanced reporting, and premium Field features are disabled to save licenses.",
    },
  };

  /** Canonical CSV column headers (case-insensitive match) for Green Column import. */
  global.VC_USER_IMPORT_HEADERS = {
    firstName: ["first name", "firstname", "payroll first name", "given name"],
    lastName: ["last name", "lastname", "payroll last name", "surname", "family name"],
    email: ["email", "e-mail", "work email", "login email"],
    department: ["department", "dept", "division", "team"],
    role: ["role", "roles", "job title", "title", "hats"],
    isAdmin: ["is admin", "admin", "administrator", "is administrator"],
    isTech: ["is tech", "technician", "field tech", "is technician", "is field tech"],
    isSales: ["is sales", "sales", "sales rep", "is sales rep"],
    timeTrackingOnly: [
      "time tracking only",
      "time tracking",
      "tt only",
      "clock only",
      "yellow",
      "yellow highlight",
      "time tracking seat",
    ],
    password: ["password", "temp password", "temporary password", "initial password"],
  };

  global.validateVcEnterprisePassword = function (password) {
    var pw = password != null ? String(password) : "";
    if (pw.length < 8) {
      return { ok: false, message: "Password must be at least 8 characters." };
    }
    if (!/[A-Z]/.test(pw)) {
      return { ok: false, message: "Password must include at least one capital letter." };
    }
    if (!/[^A-Za-z0-9]/.test(pw)) {
      return { ok: false, message: "Password must include at least one special character." };
    }
    return { ok: true, message: "" };
  };

  /** Vertex-Core: local+training@domain for sandbox training accounts. */
  global.trainingEmailFromPrimary = function (email) {
    var e = String(email || "").trim().toLowerCase();
    var at = e.indexOf("@");
    if (at < 1) return "";
    var local = e.slice(0, at);
    var domain = e.slice(at + 1);
    if (!domain) return "";
    if (local.indexOf("+training") !== -1) return e;
    return local + "+training@" + domain;
  };

  function loadFromStorage() {
    var cfg = Object.assign({}, BASE);
    try {
      var raw = localStorage.getItem("vc_app_config");
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") {
          Object.keys(cfg).forEach(function (k) {
            if (Object.prototype.hasOwnProperty.call(o, k) && o[k] != null && o[k] !== "") {
              cfg[k] = o[k];
            }
          });
        }
      }
    } catch (e) {
      console.warn("[VC config] parse vc_app_config", e);
    }
    try {
      var tid = localStorage.getItem("vc_active_tenant_id");
      if (tid && String(tid).trim()) {
        cfg.tenantId = String(tid).trim();
      }
    } catch (e2) {}
    return cfg;
  }

  global.APP_CONFIG = loadFromStorage();

  /**
   * Apply CSS variables + logo/title elements marked with data-vc-* ids.
   */
  function resolveLogoUrl(url) {
    if (!url) return url;
    var u = String(url).trim();
    if (/^https?:\/\//i.test(u) || u.charAt(0) === "/" || u.indexOf("data:") === 0) {
      return u;
    }
    var isField =
      typeof global.location !== "undefined" &&
      /\/technician\/index\.html/i.test(String(global.location.pathname));
    if (isField && u.indexOf("../") !== 0) {
      return "../" + u.replace(/^\.\//, "");
    }
    return u;
  }

  global.applyVcBranding = function () {
    var cfg = global.APP_CONFIG;
    if (!cfg) return;
    var root = document.documentElement;
    root.style.setProperty("--vc-brand-primary", cfg.primaryColor || "#1e4b85");
    root.style.setProperty("--vc-brand-accent", cfg.accentColor || "#c89b53");

    var resolvedLogo = resolveLogoUrl(cfg.logoUrl);
    var logo = document.getElementById("vcBrandLogo");
    if (logo && resolvedLogo) {
      logo.src = resolvedLogo;
      logo.alt = cfg.brandName || "Company logo";
    }
    var mini = document.getElementById("vcBrandLogoMini");
    if (mini && resolvedLogo) {
      mini.src = resolvedLogo;
      mini.alt = cfg.brandName || "Company logo";
    }
    var printLogo = document.getElementById("vcBrandLogoPrint");
    if (printLogo && resolvedLogo) {
      printLogo.src = resolvedLogo;
      printLogo.alt = cfg.brandName || "Company logo";
    }

    var isField = /technician\/index\.html/i.test(String(global.location && global.location.pathname));
    document.title = isField
      ? (cfg.shortBrand || "Field") + " Field App"
      : (cfg.shortBrand || "Vertex Core") + " | Dispatcher";

    var titles = document.querySelectorAll("[data-vc-brand-title]");
    for (var i = 0; i < titles.length; i++) {
      titles[i].textContent = cfg.brandName || "";
    }
    var subs = document.querySelectorAll("[data-vc-brand-subtitle]");
    for (var j = 0; j < subs.length; j++) {
      subs[j].textContent = cfg.shortBrand || "";
    }
    var footers = document.querySelectorAll("[data-vc-brand-footer]");
    for (var k = 0; k < footers.length; k++) {
      footers[k].innerHTML =
        (cfg.brandName || "") + "<br />Dispatcher Portal v4.0";
    }
  };

  /**
   * Persist tenant/branding overrides and reload.
   * @param {object} patch partial APP_CONFIG
   */
  global.saveVcAppConfig = function (patch) {
    try {
      var next = Object.assign({}, global.APP_CONFIG, patch || {});
      localStorage.setItem("vc_app_config", JSON.stringify(next));
      localStorage.setItem("vc_active_tenant_id", String(next.tenantId || "TWIN_PILLARS"));
      global.location.reload();
    } catch (e) {
      console.error("[VC config] save", e);
    }
  };

  global.setVcTenantId = function (tenantId) {
    try {
      localStorage.setItem("vc_active_tenant_id", String(tenantId || "").trim());
      global.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        if (typeof global.applyVcBranding === "function") global.applyVcBranding();
      });
    } else {
      global.applyVcBranding();
    }
  }
})(typeof window !== "undefined" ? window : this);
