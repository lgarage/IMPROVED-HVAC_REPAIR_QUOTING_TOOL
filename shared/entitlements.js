/**
 * Vertex Core — customer entitlements / feature flags (Phase 35).
 *
 * Single source of truth for "which features can this customer use?".
 * One Firestore doc per tenant: `tenants/{tenantId}/config/entitlements`.
 *
 * Boot order (every page that uses entitlements):
 *   1. shared/config.js              (APP_CONFIG.tenantId)
 *   2. shared/firebase_logic.js      (VCFirestore.tenantRoot)
 *   3. shared/entitlements.js        (this file)
 *
 * Read API (any caller, dispatcher or field):
 *   VCEntitlements.has(featureId)        -> boolean
 *   VCEntitlements.getPlanId()           -> "free" | "pro" | "enterprise" | "custom"
 *   VCEntitlements.getSnapshot()         -> { planId, features:{...} }
 *   VCEntitlements.subscribe(db, onErr)  -> unsubscribe()
 *
 * Write API (admin only — wired from dispatcher Settings UI):
 *   VCEntitlements.savePatch(db, patch)  -> Promise (merged write)
 *   VCEntitlements.applyPlanDefaults(db, planId, overrides) -> Promise
 *
 * Default-deny policy: an unknown feature id returns `false`. New features
 * added to FEATURE_CATALOG must be enabled explicitly via plan or admin
 * toggle so a stale catalog can never silently expose a paid surface.
 *
 * Offline / pre-load fallback: last-known snapshot is mirrored in
 * `localStorage[VC_ENTITLEMENTS_CACHE_KEY]` so cold boots return the
 * previous answer instead of the default-deny stub (which would flash UI
 * off on every reload).
 */
(function (global) {
  "use strict";

  var ENTITLEMENTS_VERSION = 1;
  var CACHE_KEY = "vc_entitlements_cache_v1";
  var CHANGE_EVENT = "vc:entitlements-changed";

  /**
   * Authoritative feature catalog.
   *
   * `default` is the value used when the tenant has no entitlements doc yet
   * AND no plan has been applied — usually the cautious default for that
   * feature in isolation. `plans.<planId>` is what "Apply plan defaults" sets.
   *
   * Order here drives the order rendered by the dispatcher Settings admin UI.
   */
  var FEATURE_CATALOG = [
    {
      id: "interOfficeFeed",
      label: "Inter-Office Feed (Pulse)",
      description:
        "Real-time inter-office message + status feed in the dispatcher sidebar. Premium tier only.",
      tier: "premium",
      default: false,
      plans: { free: false, pro: true, enterprise: true }
    },
    {
      id: "aiReportReviewer",
      label: "AI Report Reviewer",
      description:
        "Side-by-side AI extraction from Inter-Office Comms with source citations on Service Intake.",
      tier: "premium",
      default: false,
      plans: { free: false, pro: true, enterprise: true }
    },
    {
      id: "executiveInsights",
      label: "Executive Insights & Revenue",
      description:
        "Billable hours vs. clocked labor by job type, fleet capacity, unbilled work — Reports submenu.",
      tier: "premium",
      default: false,
      plans: { free: false, pro: true, enterprise: true }
    },
    {
      id: "customReportStudio",
      label: "Custom Report Studio",
      description: "Build printable PDF reports with custom layouts — Reports submenu.",
      tier: "premium",
      default: false,
      plans: { free: false, pro: true, enterprise: true }
    },
    {
      id: "fieldAppOfficeOverride",
      label: "Field App — Office Override",
      description:
        "Dispatcher edits the live field workspace in an iframe (same data as the technician).",
      tier: "premium",
      default: false,
      plans: { free: false, pro: true, enterprise: true }
    },
    {
      id: "shadowMode",
      label: "Shadow Mode (read-only mirror)",
      description: "Read-only mirror of the field workspace for live coaching.",
      tier: "premium",
      default: false,
      plans: { free: false, pro: true, enterprise: true }
    },
    {
      id: "siteHistory",
      label: "Site History (Customer Directory)",
      description: "📜 History row in Customer Directory showing every service ticket per site.",
      tier: "premium",
      default: false,
      plans: { free: false, pro: true, enterprise: true }
    },
    {
      id: "quotingTool",
      label: "Quoting Tool",
      description: "Dispatcher Quoting view + saved quote archive.",
      tier: "core",
      default: true,
      plans: { free: true, pro: true, enterprise: true }
    },
    {
      id: "invoicing",
      label: "Invoicing & Archive",
      description: "Invoicing tool + invoice archive (sidebar Invoicing submenu).",
      tier: "core",
      default: true,
      plans: { free: true, pro: true, enterprise: true }
    },
    {
      id: "customerDirectory",
      label: "Customer Directory",
      description: "Customer + site directory accessible from the sidebar.",
      tier: "core",
      default: true,
      plans: { free: true, pro: true, enterprise: true }
    }
  ];

  var PLAN_CATALOG = [
    {
      id: "free",
      label: "Free / Starter",
      description: "Core dispatch, quoting, invoicing. No premium feeds, AI tools, or insights."
    },
    {
      id: "pro",
      label: "Pro",
      description: "All core features plus Inter-Office Feed, AI tools, Insights, and Reports."
    },
    {
      id: "enterprise",
      label: "Enterprise",
      description: "Everything in Pro. Reserved for future advanced features and SLA tier."
    },
    {
      id: "custom",
      label: "Custom",
      description: "Manually toggled — no plan defaults applied automatically."
    }
  ];

  var DEFAULT_PLAN_ID = "pro";

  function getDefaultsForPlan(planId) {
    var out = {};
    for (var i = 0; i < FEATURE_CATALOG.length; i++) {
      var f = FEATURE_CATALOG[i];
      if (planId && f.plans && Object.prototype.hasOwnProperty.call(f.plans, planId)) {
        out[f.id] = !!f.plans[planId];
      } else {
        out[f.id] = !!f.default;
      }
    }
    return out;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return null;
      if (typeof o.tenantId !== "string") return null;
      return o;
    } catch (e) {
      return null;
    }
  }

  function writeCache(tenantId, planId, features) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          tenantId: String(tenantId || ""),
          planId: String(planId || DEFAULT_PLAN_ID),
          features: features || {},
          at: Date.now()
        })
      );
    } catch (e) {}
  }

  function currentTenantId() {
    try {
      if (typeof global.VCFirestore !== "undefined" && VCFirestore.getTenantId) {
        return VCFirestore.getTenantId();
      }
    } catch (e) {}
    try {
      return (global.APP_CONFIG && APP_CONFIG.tenantId) || "";
    } catch (e2) {}
    return "";
  }

  function bootstrapState() {
    var tid = currentTenantId();
    var cached = readCache();
    var planId = DEFAULT_PLAN_ID;
    var features = getDefaultsForPlan(DEFAULT_PLAN_ID);
    if (cached && cached.tenantId === tid) {
      planId = cached.planId || DEFAULT_PLAN_ID;
      var merged = getDefaultsForPlan(planId);
      var cf = cached.features || {};
      Object.keys(cf).forEach(function (k) {
        merged[k] = !!cf[k];
      });
      features = merged;
    }
    return { tenantId: tid, planId: planId, features: features, hydrated: false };
  }

  var state = bootstrapState();
  var unsubFn = null;

  function fireChange(reason) {
    try {
      var ev =
        typeof CustomEvent === "function"
          ? new CustomEvent(CHANGE_EVENT, { detail: { reason: reason || "update", state: getSnapshot() } })
          : (function () {
              var e = document.createEvent("Event");
              e.initEvent(CHANGE_EVENT, false, false);
              e.detail = { reason: reason || "update", state: getSnapshot() };
              return e;
            })();
      (typeof window !== "undefined" ? window : global).dispatchEvent(ev);
    } catch (e) {}
  }

  function applyDocData(data) {
    var tid = currentTenantId();
    var planId =
      data && data.planId && typeof data.planId === "string" ? data.planId : DEFAULT_PLAN_ID;
    var features = getDefaultsForPlan(planId);
    if (data && data.features && typeof data.features === "object") {
      Object.keys(data.features).forEach(function (k) {
        features[k] = !!data.features[k];
      });
    }
    state = { tenantId: tid, planId: planId, features: features, hydrated: true };
    writeCache(tid, planId, features);
    fireChange("snapshot");
  }

  function entitlementsDocRef(db) {
    if (!db || typeof global.VCFirestore === "undefined" || !VCFirestore.tenantRoot) {
      throw new Error("VCEntitlements: VCFirestore.tenantRoot not available");
    }
    return VCFirestore.tenantRoot(db).collection("config").doc("entitlements");
  }

  function loadOnce(db) {
    return entitlementsDocRef(db)
      .get()
      .then(function (snap) {
        if (!snap.exists) {
          state = {
            tenantId: currentTenantId(),
            planId: DEFAULT_PLAN_ID,
            features: getDefaultsForPlan(DEFAULT_PLAN_ID),
            hydrated: true
          };
          writeCache(state.tenantId, state.planId, state.features);
          fireChange("missing-doc-defaults");
          return state;
        }
        applyDocData(snap.data() || {});
        return state;
      });
  }

  function subscribe(db, onError) {
    if (typeof unsubFn === "function") {
      try { unsubFn(); } catch (e) {}
      unsubFn = null;
    }
    try {
      var ref = entitlementsDocRef(db);
      unsubFn = ref.onSnapshot(
        function (snap) {
          if (!snap.exists) {
            state = {
              tenantId: currentTenantId(),
              planId: DEFAULT_PLAN_ID,
              features: getDefaultsForPlan(DEFAULT_PLAN_ID),
              hydrated: true
            };
            writeCache(state.tenantId, state.planId, state.features);
            fireChange("missing-doc-defaults");
            return;
          }
          applyDocData(snap.data() || {});
        },
        function (err) {
          if (typeof onError === "function") onError(err);
          try { console.warn("[VCEntitlements] subscribe", err); } catch (e) {}
        }
      );
    } catch (e) {
      if (typeof onError === "function") onError(e);
      try { console.warn("[VCEntitlements] subscribe (start)", e); } catch (ex) {}
    }
    return function () {
      if (typeof unsubFn === "function") {
        try { unsubFn(); } catch (e) {}
        unsubFn = null;
      }
    };
  }

  function savePatch(db, patch) {
    var ref = entitlementsDocRef(db);
    var payload = Object.assign({}, patch || {});
    if (firebase && firebase.firestore && firebase.firestore.FieldValue) {
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    return ref.set(payload, { merge: true });
  }

  function applyPlanDefaults(db, planId, overrides) {
    var defaults = getDefaultsForPlan(planId);
    if (overrides && typeof overrides === "object") {
      Object.keys(overrides).forEach(function (k) {
        defaults[k] = !!overrides[k];
      });
    }
    return savePatch(db, { planId: planId, features: defaults });
  }

  function getSnapshot() {
    return {
      tenantId: state.tenantId,
      planId: state.planId,
      features: Object.assign({}, state.features),
      hydrated: !!state.hydrated
    };
  }

  function has(featureId) {
    if (!featureId) return false;
    var f = state.features || {};
    if (Object.prototype.hasOwnProperty.call(f, featureId)) return !!f[featureId];
    return false;
  }

  function getPlanId() {
    return state.planId || DEFAULT_PLAN_ID;
  }

  function getFeatureCatalog() {
    return FEATURE_CATALOG.map(function (f) {
      return {
        id: f.id,
        label: f.label,
        description: f.description,
        tier: f.tier,
        default: !!f.default,
        plans: Object.assign({}, f.plans || {})
      };
    });
  }

  function getPlanCatalog() {
    return PLAN_CATALOG.map(function (p) {
      return { id: p.id, label: p.label, description: p.description };
    });
  }

  global.VCEntitlements = {
    VERSION: ENTITLEMENTS_VERSION,
    DEFAULT_PLAN_ID: DEFAULT_PLAN_ID,
    CHANGE_EVENT: CHANGE_EVENT,
    has: has,
    getPlanId: getPlanId,
    getSnapshot: getSnapshot,
    getFeatureCatalog: getFeatureCatalog,
    getPlanCatalog: getPlanCatalog,
    getDefaultsForPlan: getDefaultsForPlan,
    loadOnce: loadOnce,
    subscribe: subscribe,
    savePatch: savePatch,
    applyPlanDefaults: applyPlanDefaults
  };

  global.vcHasFeature = has;

  try {
    console.info("[VC] entitlements v=" + ENTITLEMENTS_VERSION + " loaded; default plan=" + DEFAULT_PLAN_ID);
  } catch (e) {}
})(typeof window !== "undefined" ? window : this);
