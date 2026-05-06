/**
 * Vertex Core — per-user feature overrides resolver (Per-User Feature Toggles, Slice 2).
 *
 * Layered on top of VCEntitlements (tenant-level ceiling). Resolves whether a
 * specific user can access a feature given their featureOverrides map and role.
 *
 * Boot order (any page that uses per-user entitlements):
 *   1. shared/config.js
 *   2. shared/firebase_logic.js
 *   3. shared/auth.js               (VCAuth)
 *   4. shared/entitlements.js       (VCEntitlements)
 *   5. shared/user_entitlements.js  (THIS FILE)
 *
 * Read API:
 *   VCUserEntitlements.has(featureId, userProfile)
 *     → boolean (resolves with the 4-step precedence below)
 *     userProfile is optional; falls back to VCAuth.currentProfile()
 *
 * Precedence (first match wins):
 *   1. Tenant ceiling: if VCEntitlements.has(featureId) === false → false
 *   2. Role hard-jail: role === "time_tracking_only" AND feature.tier === "premium" → false
 *   3. User override: userProfile.featureOverrides[featureId] key present → that boolean
 *   4. Tenant default: VCEntitlements.has(featureId)
 *
 * Event:
 *   window dispatches "vc:user-entitlements-changed" when tenant entitlements
 *   change OR VCAuth state changes (user profile reloaded / signed in/out).
 *
 * Cold-boot cache:
 *   localStorage["vc_user_entitlements_cache_v1"] — object keyed by
 *   "{tenantId}:{uid_or_payrollNameUpper}" → featureOverrides map.
 *   Lets the module serve the last-known overrides before the auth state
 *   resolves on reload. Cache is write-through; never used for security
 *   decisions (Firestore rules are the authority).
 *
 * Invariant: vcHasFeature(id) continues to work unchanged — it reads
 * VCEntitlements (tenant level only). This module adds a new resolver on top.
 */
(function (global) {
  "use strict";

  var VERSION = 1;
  var CACHE_KEY = "vc_user_entitlements_cache_v1";
  var CHANGE_EVENT = "vc:user-entitlements-changed";

  /* ── cache helpers ───────────────────────────────────────────── */

  function cacheKey(tenantId, uid) {
    return String(tenantId || "") + ":" + String(uid || "");
  }

  function readCacheAll() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return (o && typeof o === "object") ? o : {};
    } catch (e) {
      return {};
    }
  }

  function readCacheForUser(tenantId, uid) {
    try {
      var all = readCacheAll();
      var k = cacheKey(tenantId, uid);
      return (all[k] && typeof all[k] === "object") ? all[k] : null;
    } catch (e) {
      return null;
    }
  }

  function writeCacheForUser(tenantId, uid, overrides) {
    try {
      var all = readCacheAll();
      var k = cacheKey(tenantId, uid);
      all[k] = overrides || {};
      all[k].__at = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  /* ── helpers ─────────────────────────────────────────────────── */

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

  function uidForProfile(profile) {
    if (!profile) return "";
    return String(
      profile.uid ||
      profile.payrollNameUpper ||
      profile._docId ||
      ""
    );
  }

  function getFeatureTier(featureId) {
    try {
      if (typeof global.VCEntitlements !== "undefined" && VCEntitlements.getFeatureCatalog) {
        var catalog = VCEntitlements.getFeatureCatalog();
        for (var i = 0; i < catalog.length; i++) {
          if (catalog[i].id === featureId) return catalog[i].tier || "core";
        }
      }
    } catch (e) {}
    return "core";
  }

  /* ── resolver ────────────────────────────────────────────────── */

  /**
   * Resolve whether `featureId` is accessible for `userProfile`.
   *
   * @param {string} featureId
   * @param {object|null} [userProfile]  If omitted, falls back to VCAuth.currentProfile().
   * @returns {boolean}
   */
  function has(featureId, userProfile) {
    if (!featureId) return false;

    // Fallback to current auth profile when caller doesn't pass one.
    var profile = userProfile;
    if (profile === undefined || profile === null) {
      try {
        if (typeof global.VCAuth !== "undefined" && VCAuth.currentProfile) {
          profile = VCAuth.currentProfile();
        }
      } catch (e) {}
    }

    // 1. Tenant ceiling: if tenant doesn't have it, nobody does.
    try {
      if (typeof global.VCEntitlements !== "undefined" && VCEntitlements.has) {
        if (!VCEntitlements.has(featureId)) return false;
      }
    } catch (e) {}

    // 2. Role hard-jail: time_tracking_only seats can't access premium features.
    var role = (profile && String(profile.role || "").trim().toLowerCase()) || "";
    if (role === "time_tracking_only") {
      var tier = getFeatureTier(featureId);
      if (tier === "premium") return false;
    }

    // 3. Per-user override: explicit key in featureOverrides wins.
    var overrides = (profile && profile.featureOverrides && typeof profile.featureOverrides === "object")
      ? profile.featureOverrides
      : null;

    if (overrides && Object.prototype.hasOwnProperty.call(overrides, featureId)) {
      return !!overrides[featureId];
    }

    // 4. Fall through to tenant default.
    try {
      if (typeof global.VCEntitlements !== "undefined" && VCEntitlements.has) {
        return VCEntitlements.has(featureId);
      }
    } catch (e) {}

    return false;
  }

  /* ── event dispatch ─────────────────────────────────────────── */

  function fireChange(reason) {
    try {
      var ev =
        typeof CustomEvent === "function"
          ? new CustomEvent(CHANGE_EVENT, { detail: { reason: reason || "update" } })
          : (function () {
              var e = document.createEvent("Event");
              e.initEvent(CHANGE_EVENT, false, false);
              e.detail = { reason: reason || "update" };
              return e;
            })();
      (typeof window !== "undefined" ? window : global).dispatchEvent(ev);
    } catch (e) {}
  }

  /* ── automatic event wiring ─────────────────────────────────── */

  function wireListeners() {
    var w = typeof window !== "undefined" ? window : global;

    // Re-fire when tenant entitlements change.
    if (w.addEventListener) {
      w.addEventListener("vc:entitlements-changed", function () {
        fireChange("tenant-entitlements-changed");
      });
    }

    // Re-fire when VCAuth resolves / user changes.
    try {
      if (typeof global.VCAuth !== "undefined" && VCAuth.onReady) {
        VCAuth.onReady(function (snap) {
          var tid = currentTenantId();
          var uid = uidForProfile(snap && snap.profile);
          if (uid && snap && snap.profile && snap.profile.featureOverrides) {
            writeCacheForUser(tid, uid, snap.profile.featureOverrides);
          }
          fireChange("auth-state-changed");
        });
        return;
      }
    } catch (e) {}

    // VCAuth not yet loaded — defer until it appears (retry).
    var retries = 0;
    var iv = setInterval(function () {
      retries++;
      if (retries > 60) { clearInterval(iv); return; }
      try {
        if (typeof global.VCAuth !== "undefined" && VCAuth.onReady) {
          clearInterval(iv);
          VCAuth.onReady(function (snap) {
            var tid = currentTenantId();
            var uid = uidForProfile(snap && snap.profile);
            if (uid && snap && snap.profile && snap.profile.featureOverrides) {
              writeCacheForUser(tid, uid, snap.profile.featureOverrides);
            }
            fireChange("auth-state-changed");
          });
        }
      } catch (e) {}
    }, 200);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", wireListeners);
    } else {
      wireListeners();
    }
  }

  /* ── public export ──────────────────────────────────────────── */

  global.VCUserEntitlements = {
    VERSION: VERSION,
    CHANGE_EVENT: CHANGE_EVENT,
    has: has,
    /** Read cached featureOverrides for a user (from localStorage; fallback). */
    getCachedOverrides: function (tenantId, uid) {
      return readCacheForUser(tenantId, uid);
    }
  };

  try {
    console.info("[VC] user_entitlements v=" + VERSION + " loaded");
  } catch (e) {}
})(typeof window !== "undefined" ? window : this);
