/**
 * Dispatcher — client verification link + optional portal token listener.
 */
(function (global) {
  "use strict";

  var portalUnsub = null;

  function teardownPortalWatch() {
    if (typeof portalUnsub === "function") {
      portalUnsub();
      portalUnsub = null;
    }
  }

  /**
   * KI-002 Plan E2 — TWIN_PILLARS branding is dead (per user 2026-04-25).
   * Defer to the canonical `VCFirestore.getTenantId()` helper instead of
   * pinning a legacy `"TWIN_PILLARS"` literal here. That helper is the same
   * source of truth used by every tenant-scoped collection helper in
   * `shared/firebase_logic.js`, so this metadata stays in lockstep with
   * actual write paths. Callers tolerate an empty result (today this only
   * feeds the branding snapshot on the portal_token doc).
   */
  function getTenantIdSafe() {
    if (typeof VCFirestore !== "undefined" && typeof VCFirestore.getTenantId === "function") {
      try {
        var tid = VCFirestore.getTenantId();
        if (tid) return String(tid).trim();
      } catch (e) {}
    }
    if (typeof APP_CONFIG !== "undefined" && APP_CONFIG.tenantId) {
      return String(APP_CONFIG.tenantId).trim();
    }
    return "";
  }

  function showVerificationCue(msg) {
    if (typeof global.showSaveCue === "function") {
      global.showSaveCue(msg);
    } else {
      try {
        alert(msg);
      } catch (e) {}
    }
  }

  /**
   * Create portal token + merge ticket; copy URL to clipboard when possible.
   */
  async function sendVerificationToClient() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      showVerificationCue("⚠ Firebase is not connected.");
      return;
    }
    var idEl = document.getElementById("scCurrentId");
    var ticketId = idEl && idEl.value ? String(idEl.value).trim() : "";
    if (!ticketId) {
      showVerificationCue("⚠ Open or save a ticket first, then send verification.");
      return;
    }
    if (typeof VCFirestore === "undefined" || !VCFirestore.portalTokens) {
      showVerificationCue("⚠ Portal tokens are not available (VCFirestore.portalTokens).");
      return;
    }
    if (typeof VCClientPortal === "undefined") {
      showVerificationCue("⚠ Client portal helpers missing (VCClientPortal).");
      return;
    }

    var db = firebase.firestore();
    var token = VCClientPortal.generatePortalTokenId();
    var tid = getTenantIdSafe();
    var logo =
      typeof APP_CONFIG !== "undefined" && APP_CONFIG.logoUrl
        ? String(APP_CONFIG.logoUrl).trim()
        : "";

    var dbLocal = JSON.parse(
      global.localStorage.getItem("twinPillarsServiceDB") || "[]"
    );
    var row = dbLocal.find(function (r) {
      return r && r.id === ticketId;
    });
    var ticketNum = row && row.ticketNum ? row.ticketNum : "";
    var customerName =
      row && row.customerName
        ? row.customerName
        : document.getElementById("scCustNameInput")
          ? document.getElementById("scCustNameInput").value
          : "";

    var portalRef = VCFirestore.portalTokens(db).doc(token);
    var expires = new Date(Date.now() + 90 * 86400000);

    try {
      await portalRef.set(
        {
          ticketId: ticketId,
          tenantId: tid,
          ticketNum: ticketNum,
          customerName: customerName,
          brandName:
            typeof APP_CONFIG !== "undefined" ? APP_CONFIG.brandName || "" : "",
          shortBrand:
            typeof APP_CONFIG !== "undefined" ? APP_CONFIG.shortBrand || "" : "",
          logoUrl: logo || "",
          primaryColor:
            typeof APP_CONFIG !== "undefined" ? APP_CONFIG.primaryColor || "" : "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          expiresAt: firebase.firestore.Timestamp.fromDate(expires),
          clientApprovedAt: null,
          clientSignerName: null,
        },
        { merge: true }
      );

      var mergePayload = {
        portalVerificationToken: token,
        portalVerificationSentAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (typeof VCFirestore.setServiceCallMerged === "function") {
        await VCFirestore.setServiceCallMerged(db, ticketId, mergePayload, true);
      } else {
        await VCFirestore.serviceCalls(db).doc(ticketId).set(mergePayload, {
          merge: true,
        });
      }

      var url = VCClientPortal.buildProofOfServiceUrl(tid, token);
      var box = document.getElementById("vcClientVerificationUrlOut");
      if (box) {
        box.value = url;
        box.style.display = "block";
      }
      try {
        await navigator.clipboard.writeText(url);
        showVerificationCue("✓ Verification link copied to clipboard");
      } catch (e) {
        showVerificationCue("✓ Verification link ready — copy from the box below");
      }
    } catch (err) {
      console.error(err);
      showVerificationCue("⚠ Could not create verification link: " + (err && err.message ? err.message : String(err)));
    }
  }

  function watchPortalTokenForTicket(token, ticketId) {
    teardownPortalWatch();
    if (!token || !ticketId || typeof firebase === "undefined" || !firebase.apps.length) {
      return;
    }
    if (typeof VCFirestore === "undefined" || !VCFirestore.portalTokens) return;
    var db = firebase.firestore();
    var ref = VCFirestore.portalTokens(db).doc(String(token));
    portalUnsub = ref.onSnapshot(
      function (snap) {
        if (!snap.exists) return;
        var d = snap.data() || {};
        if (!d.clientApprovedAt) return;
        var stEl = document.getElementById("scStatusInput");
        if (!stEl) return;
        var curId = document.getElementById("scCurrentId");
        if (!curId || curId.value !== ticketId) return;
        if (stEl.value === "Client Verified / Ready for Billing") return;
        stEl.value = "Client Verified / Ready for Billing";
        showVerificationCue("✓ Client approved — status updated");
        if (typeof global.saveServiceCall === "function") {
          global.saveServiceCall(true);
        }
      },
      function () {}
    );
  }

  function initClientVerificationUi() {
    var btn = document.getElementById("vcSendVerificationBtn");
    if (btn && !btn.dataset.vcWired) {
      btn.dataset.vcWired = "1";
      btn.addEventListener("click", function () {
        void sendVerificationToClient();
      });
    }
  }

  global.VcClientNotifications = {
    sendVerificationToClient: sendVerificationToClient,
    watchPortalTokenForTicket: watchPortalTokenForTicket,
    teardownPortalWatch: teardownPortalWatch,
    initClientVerificationUi: initClientVerificationUi,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initClientVerificationUi);
  } else {
    initClientVerificationUi();
  }
})(typeof window !== "undefined" ? window : this);
