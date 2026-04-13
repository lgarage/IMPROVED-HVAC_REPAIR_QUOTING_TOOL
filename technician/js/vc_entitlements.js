/**
 * Field App — enterprise entitlements (time-tracking-only seat, training sandbox).
 * Reads tenants/{tenantId}/users matched by payrollNameUpper.
 */
(function (global) {
  "use strict";

  function clearSandboxFlags() {
    global.VC_SANDBOX_DATA = false;
    try {
      localStorage.removeItem("vc_sandbox_session");
      localStorage.removeItem("vc_time_tracking_only");
    } catch (e) {}
    if (document.body) {
      document.body.classList.remove("vc-time-tracking-only");
      document.body.classList.remove("vc-sandbox-session");
      document.body.classList.remove("vc-lite-seat-mode");
    }
    var b = document.getElementById("vcEntitlementsBanner");
    if (b) b.remove();
    resetPremiumFieldChrome();
  }

  function resetPremiumFieldChrome() {
    var hub = document.querySelector(".dictation-hub-shell");
    if (hub) {
      hub.style.opacity = "";
      hub.style.pointerEvents = "";
      hub.removeAttribute("aria-disabled");
    }
    var accForms = document.getElementById("acc-field-forms");
    if (accForms) {
      accForms.style.opacity = "";
      accForms.style.pointerEvents = "";
    }
    var eqBtn = document.getElementById("btnOpenEquipmentHub");
    if (eqBtn) eqBtn.disabled = false;
    var pmAcc = document.getElementById("pmSection");
    if (pmAcc) pmAcc.style.display = "";
  }

  function applyTimeTrackingOnlyUi(on) {
    try {
      if (on) localStorage.setItem("vc_time_tracking_only", "1");
      else localStorage.removeItem("vc_time_tracking_only");
    } catch (e) {}
    if (!document.body) return;
    document.body.classList.toggle("vc-time-tracking-only", !!on);
    var existing = document.getElementById("vcEntitlementsBanner");
    if (existing) existing.remove();
    if (!on) {
      resetPremiumFieldChrome();
      if (document.body) document.body.classList.remove("vc-lite-seat-mode");
      var navHist = document.getElementById("nav-history");
      var navClock = document.getElementById("nav-clock");
      if (navHist) navHist.classList.remove("hidden");
      if (navClock) navClock.classList.add("hidden");
      var liteRoot = document.getElementById("vcLiteSeatRoot");
      if (liteRoot) {
        if (liteRoot._vcLiteCleanup) {
          try {
            liteRoot._vcLiteCleanup();
          } catch (e) {}
          liteRoot._vcLiteCleanup = null;
        }
        delete liteRoot.dataset.vcLiteMounted;
        liteRoot.innerHTML = "";
      }
      return;
    }
    var bar = document.createElement("div");
    bar.id = "vcEntitlementsBanner";
    bar.className = "vc-entitlements-banner";
    bar.setAttribute("role", "status");
    bar.innerHTML =
      '<strong>Lite seat</strong> — Use the Time tab to clock in/out. Job cards open a read-only job view (no dictation or AI).';
    var shell = document.querySelector(".app-top-shell");
    if (shell && shell.nextSibling) {
      shell.parentNode.insertBefore(bar, shell.nextSibling);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
    if (global.VcTimeTracker && typeof global.VcTimeTracker.initLiteSeatShell === "function") {
      global.VcTimeTracker.initLiteSeatShell();
    }
  }

  function applySandboxUi(on) {
    global.VC_SANDBOX_DATA = !!on;
    if (!document.body) return;
    document.body.classList.toggle("vc-sandbox-session", !!on);
    if (on) {
      try {
        localStorage.setItem("vc_sandbox_session", "1");
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem("vc_sandbox_session");
      } catch (e2) {}
    }
  }

  /**
   * @returns {Promise<object|null>}
   */
  async function fetchUserEntitlementDoc(payrollUpper) {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return null;
    if (typeof VCFirestore === "undefined" || !VCFirestore.tenantUsers) return null;
    var name = String(payrollUpper || "").trim().toUpperCase();
    if (!name) return null;
    var db = firebase.firestore();
    var col = VCFirestore.tenantUsers(db);
    var trainingName = name.indexOf("(TRAINING)") >= 0 ? name : name.replace(/\s+$/, "") + " (TRAINING)";
    var snap = await col.where("payrollNameUpper", "==", name).limit(1).get();
    if (snap.empty) {
      snap = await col.where("payrollNameUpper", "==", trainingName).limit(1).get();
    }
    if (snap.empty) return null;
    var doc = snap.docs[0];
    return doc.data() || {};
  }

  global.applyVcFieldEntitlements = async function (payrollUpper) {
    if (global.VC_SHADOW_VIEWER) return null;
    clearSandboxFlags();
    var profile = await fetchUserEntitlementDoc(payrollUpper);
    if (!profile) {
      applyTimeTrackingOnlyUi(false);
      applySandboxUi(false);
      return profile;
    }
    if (profile.isTrainingAccount === true) {
      applySandboxUi(true);
    } else {
      applySandboxUi(false);
    }
    var liteSeat =
      profile.timeTrackingOnly === true ||
      String(profile.role || "")
        .trim()
        .toLowerCase() === "time_tracking_only";
    if (liteSeat) {
      applyTimeTrackingOnlyUi(true);
    } else {
      applyTimeTrackingOnlyUi(false);
    }
    return profile;
  };

  global.clearVcFieldEntitlements = clearSandboxFlags;
})(typeof window !== "undefined" ? window : this);
