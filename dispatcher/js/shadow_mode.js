/**
 * Shadow Mode — dispatcher live-mirrored Field App preview (Phase 19–20).
 * Requires: firebase, VCFirestore.livePresence, tenant users for dropdown.
 */
(function (global) {
  "use strict";

  var IDLE_MS = 5 * 60 * 1000;
  var currentShadowPresenceKey = "";
  var presenceStateByKey = {};

  function payrollKeyFromName(name) {
    return (
      String(name || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 64) || "USER"
    );
  }

  function presenceKeyFromUserDoc(docId, data) {
    var d = data || {};
    if (d.presenceKey) return String(d.presenceKey);
    var full = String(d.payrollFullName || "").trim();
    if (full) return payrollKeyFromName(full);
    return payrollKeyFromName(
      (String(d.firstName || "").trim() + " " + String(d.lastName || "").trim()).trim() || docId
    );
  }

  function isAdminUser(data) {
    var d = data || {};
    if (d.isAdmin === true) return true;
    var single = String(d.role || "")
      .trim()
      .toLowerCase();
    if (single === "admin") return true;
    var roles = d.roles;
    if (Array.isArray(roles)) {
      for (var i = 0; i < roles.length; i++) {
        if (String(roles[i]).trim().toLowerCase() === "admin") return true;
      }
    }
    return false;
  }

  function isUpdatedAtStale(updatedAt) {
    if (!updatedAt || typeof updatedAt.toMillis !== "function") return true;
    return Date.now() - updatedAt.toMillis() > IDLE_MS;
  }

  function updateSelectIdleClasses() {
    var sel = document.getElementById("vcShadowUserSelect");
    if (!sel) return;
    for (var i = 0; i < sel.options.length; i++) {
      var opt = sel.options[i];
      var pk = opt.value;
      if (!pk) continue;
      var d = presenceStateByKey[pk] || {};
      var stale = isUpdatedAtStale(d.updatedAt);
      opt.classList.toggle("vc-shadow-option--idle", stale);
    }
  }

  function updateOfflineBadgeForCurrentSelection() {
    var sel = document.getElementById("vcShadowUserSelect");
    var badge = document.getElementById("vcShadowOfflineBadge");
    var modal = document.getElementById("vcShadowModal");
    if (!sel || !badge) return;
    if (!modal || modal.classList.contains("hidden")) {
      badge.classList.add("hidden");
      return;
    }
    var opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) {
      badge.classList.add("hidden");
      return;
    }
    if (opt.classList.contains("vc-shadow-option--idle")) {
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  function subscribeLivePresenceIdle() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    if (typeof VCFirestore === "undefined" || !VCFirestore.livePresence) return;
    if (subscribeLivePresenceIdle.wired) return;
    subscribeLivePresenceIdle.wired = true;
    var db = firebase.firestore();
    VCFirestore.livePresence(db).onSnapshot(
      function (snap) {
        presenceStateByKey = {};
        snap.forEach(function (doc) {
          presenceStateByKey[doc.id] = doc.data() || {};
        });
        updateSelectIdleClasses();
        updateOfflineBadgeForCurrentSelection();
      },
      function (e) {
        console.warn("[ShadowMode] live_presence:", e);
      }
    );
  }

  function loadTenantUsersIntoSelect() {
    var sel = document.getElementById("vcShadowUserSelect");
    if (!sel || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    if (typeof VCFirestore === "undefined" || !VCFirestore.tenantUsers) return;
    var db = firebase.firestore();
    VCFirestore.tenantUsers(db)
      .get()
      .then(function (snap) {
        sel.innerHTML = '<option value="">Choose a user…</option>';
        var rows = [];
        snap.forEach(function (doc) {
          rows.push({ id: doc.id, data: doc.data() || {} });
        });
        rows.sort(function (a, b) {
          var la = String(a.data.payrollFullName || a.data.email || a.id).toLowerCase();
          var lb = String(b.data.payrollFullName || b.data.email || b.id).toLowerCase();
          return la.localeCompare(lb);
        });
        rows.forEach(function (row) {
          if (isAdminUser(row.data)) return;
          var pk = presenceKeyFromUserDoc(row.id, row.data);
          var opt = document.createElement("option");
          opt.value = pk;
          opt.textContent =
            row.data.payrollFullName ||
            (String(row.data.firstName || "") + " " + String(row.data.lastName || "")).trim() ||
            row.data.email ||
            row.id;
          opt.dataset.presenceKey = pk;
          sel.appendChild(opt);
        });
        subscribeLivePresenceIdle();
        updateSelectIdleClasses();
        updateOfflineBadgeForCurrentSelection();
      })
      .catch(function (e) {
        console.warn("[ShadowMode] tenant users:", e);
      });
  }

  function applyShadowTarget(presenceKey, displayLabel) {
    currentShadowPresenceKey = String(presenceKey || "");
    var modal = document.getElementById("vcShadowModal");
    var iframe = document.getElementById("vcShadowIframe");
    var title = document.getElementById("vcShadowModalTitle");
    var coachInp = document.getElementById("vcShadowCoachInput");
    if (!modal || !iframe) return;
    if (coachInp) coachInp.value = "";
    if (title) {
      title.textContent = displayLabel ? "Shadowing: " + displayLabel : "Shadow viewer";
    }
    var base = new URL("technician/index.html", global.location.href);
    base.searchParams.set("vc_shadow_viewer", "1");
    base.searchParams.set("vc_presence_key", currentShadowPresenceKey);
    if (displayLabel) base.searchParams.set("vc_display_name", displayLabel);
    iframe.src = base.toString();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    updateOfflineBadgeForCurrentSelection();
  }

  function openShadowModal(presenceKey, label) {
    applyShadowTarget(presenceKey, label);
  }

  function closeShadowModal() {
    var modal = document.getElementById("vcShadowModal");
    var iframe = document.getElementById("vcShadowIframe");
    if (iframe) iframe.src = "about:blank";
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    currentShadowPresenceKey = "";
    var badge = document.getElementById("vcShadowOfflineBadge");
    if (badge) badge.classList.add("hidden");
  }

  function sendCoachPrompt() {
    var input = document.getElementById("vcShadowCoachInput");
    var text = input && input.value ? String(input.value).trim() : "";
    if (!text || !currentShadowPresenceKey) return;
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    if (typeof VCFirestore === "undefined" || !VCFirestore.livePresence) return;
    var db = firebase.firestore();
    var ref = VCFirestore.livePresence(db).doc(currentShadowPresenceKey);
    ref
      .set(
        {
          coachPrompt: text,
          coachPromptAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .then(function () {
        if (input) input.value = "";
      })
      .catch(function (e) {
        console.warn("[ShadowMode] coach prompt:", e);
      });
  }

  function forceRemoteSync() {
    if (!currentShadowPresenceKey) return;
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    if (typeof VCFirestore === "undefined" || !VCFirestore.livePresence) return;
    var db = firebase.firestore();
    var ref = VCFirestore.livePresence(db).doc(currentShadowPresenceKey);
    ref
      .set(
        {
          forceSyncAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(function (e) {
        console.warn("[ShadowMode] force sync:", e);
      });
  }

  function initShadowMode() {
    loadTenantUsersIntoSelect();
    var sel = document.getElementById("vcShadowUserSelect");
    if (sel && !sel.dataset.vcShadowWired) {
      sel.dataset.vcShadowWired = "1";
      sel.addEventListener("change", function () {
        var v = sel.value;
        if (!v) return;
        var opt = sel.options[sel.selectedIndex];
        var label = opt ? opt.textContent : "";
        applyShadowTarget(v, label);
      });
    }
    var sendBtn = document.getElementById("vcShadowCoachSend");
    if (sendBtn && !sendBtn.dataset.vcShadowWired) {
      sendBtn.dataset.vcShadowWired = "1";
      sendBtn.addEventListener("click", sendCoachPrompt);
    }
    var forceBtn = document.getElementById("vcShadowForceSyncBtn");
    if (forceBtn && !forceBtn.dataset.vcShadowWired) {
      forceBtn.dataset.vcShadowWired = "1";
      forceBtn.addEventListener("click", forceRemoteSync);
    }
    var coachInp = document.getElementById("vcShadowCoachInput");
    if (coachInp && !coachInp.dataset.vcShadowWired) {
      coachInp.dataset.vcShadowWired = "1";
      coachInp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          sendCoachPrompt();
        }
      });
    }
  }

  global.VcShadowMode = {
    initShadowMode: initShadowMode,
    openShadowModal: openShadowModal,
    closeShadowModal: closeShadowModal,
    sendCoachPrompt: sendCoachPrompt,
    forceRemoteSync: forceRemoteSync,
    payrollKeyFromName: payrollKeyFromName,
  };
})(typeof window !== "undefined" ? window : this);
