/**
 * Shadow Mode — dispatcher live-mirrored Field App preview (Phase 19–20).
 * Requires: firebase, VCFirestore.livePresence, tenant users for dropdown.
 */
(function (global) {
  "use strict";

  var IDLE_MS = 5 * 60 * 1000;
  var currentShadowPresenceKey = "";
  var presenceStateByKey = {};
  var _livePresenceIdleUnsub = null;

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

  function updateConsentGate() {
    var block = document.getElementById("vcShadowConsentBlock");
    var iframe = document.getElementById("vcShadowIframe");
    if (!block || !iframe) return;
    if (!currentShadowPresenceKey) {
      block.classList.add("hidden");
      iframe.style.display = "";
      return;
    }
    var d = presenceStateByKey[currentShadowPresenceKey] || {};
    var hasConsent = d.shadowConsent === true;
    if (hasConsent) {
      block.classList.add("hidden");
      iframe.style.display = "";
      if (!iframe.src || iframe.src === "about:blank") {
        var sel = document.getElementById("vcShadowUserSelect");
        var label = "";
        try {
          var opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
          label = opt ? String(opt.textContent || "").trim() : "";
        } catch (e) {}
        loadShadowIframe(currentShadowPresenceKey, label);
      }
    } else {
      block.classList.remove("hidden");
      iframe.style.display = "none";
      iframe.src = "about:blank";
    }
  }

  function loadShadowIframe(presenceKey, displayLabel) {
    var iframe = document.getElementById("vcShadowIframe");
    if (!iframe) return;
    var base = new URL("technician/index.html", global.location.href);
    base.searchParams.set("vc_shadow_viewer", "1");
    base.searchParams.set("vc_presence_key", presenceKey);
    if (displayLabel) base.searchParams.set("vc_display_name", displayLabel);
    iframe.src = base.toString();
  }

  function updateOfflineBadgeForCurrentSelection() {
    var sel = document.getElementById("vcShadowUserSelect");
    var badge = document.getElementById("vcShadowOfflineBadge");
    var modal = document.getElementById("vcShadowModal");
    if (!sel || !badge) return;
    if (!modal || modal.classList.contains("hidden")) {
      badge.classList.add("hidden");
      updateTakeOverButtonState();
      return;
    }
    var opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) {
      badge.classList.add("hidden");
      updateTakeOverButtonState();
      return;
    }
    if (opt.classList.contains("vc-shadow-option--idle")) {
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
    updateTakeOverButtonState();
  }

  /** Phase 31 — Watch + Take Over: enable the take-over button only when the shadowed tech is on a job. */
  function updateTakeOverButtonState() {
    var btn = document.getElementById("vcShadowTakeOverBtn");
    if (!btn) return;
    var modal = document.getElementById("vcShadowModal");
    if (!modal || modal.classList.contains("hidden") || !currentShadowPresenceKey) {
      btn.disabled = true;
      btn.title = "Pick a technician to shadow.";
      return;
    }
    var d = presenceStateByKey[currentShadowPresenceKey] || {};
    var tid = d.activeTicketId ? String(d.activeTicketId) : "";
    if (!tid) {
      btn.disabled = true;
      btn.title = "Tech is not on a job workspace right now — ask them to open a ticket.";
    } else {
      btn.disabled = false;
      btn.title =
        "Take over the tech's current job (Office Override). Tech sees the orange chrome on their phone.";
    }
  }

  /** Phase 31 — Watch + Take Over: flip from read-only Shadow into interactive Office Override on the
   *  ticket the tech is currently on. Closes the Shadow modal, opens the Office Override modal targeting
   *  that ticket, and writes `officeOverrideActive: true` to Firestore so the tech's real phone shows
   *  the orange chrome (the cross-device contract from KI-001). */
  function takeOverActiveTicket() {
    if (!currentShadowPresenceKey) {
      if (typeof global.showSaveCue === "function") global.showSaveCue("⚠ Pick a technician to shadow before taking over.");
      return;
    }
    var d = presenceStateByKey[currentShadowPresenceKey] || {};
    var tid = d.activeTicketId ? String(d.activeTicketId) : "";
    if (!tid) {
      if (typeof global.showSaveCue === "function") global.showSaveCue("⚠ Tech is not currently on a job workspace — ask them to open a ticket first.");
      return;
    }
    if (typeof global.openFieldAppOfficeModal !== "function") {
      if (typeof global.showSaveCue === "function") global.showSaveCue("⚠ Office Override modal is unavailable — refresh the dispatcher and try again.");
      return;
    }
    /* openFieldAppOfficeModal() reads the ticket id from #scCurrentId. Pre-load it so we don't have to
       require the dispatcher to also have the ticket open in Service Call Intake. */
    var idEl = document.getElementById("scCurrentId");
    if (idEl) idEl.value = tid;
    closeShadowModal();
    global.openFieldAppOfficeModal();
    /* openFieldAppOfficeModal calls toggleOfficeOverride(false) internally to reset state; flip it on
       so the tech's real device sees the cross-device flag. */
    if (typeof global.toggleOfficeOverride === "function") {
      global.toggleOfficeOverride(true);
    }
  }

  function subscribeLivePresenceIdle() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    if (typeof VCFirestore === "undefined" || !VCFirestore.livePresence) return;
    if (subscribeLivePresenceIdle.wired) return;
    subscribeLivePresenceIdle.wired = true;
    var db = firebase.firestore();
    _livePresenceIdleUnsub = VCFirestore.livePresence(db).onSnapshot(
      function (snap) {
        presenceStateByKey = {};
        snap.forEach(function (doc) {
          presenceStateByKey[doc.id] = doc.data() || {};
        });
        updateSelectIdleClasses();
        updateOfflineBadgeForCurrentSelection();
        updateTakeOverButtonState();
        updateConsentGate();
        syncDispatcherTicketIdToActiveTech();
      },
      function (e) {
        console.warn("[ShadowMode] live_presence:", e);
      }
    );
  }

  function unsubscribeLivePresenceIdle() {
    if (typeof _livePresenceIdleUnsub === "function") {
      try { _livePresenceIdleUnsub(); } catch (e) {}
    }
    _livePresenceIdleUnsub = null;
    subscribeLivePresenceIdle.wired = false;
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
    var d = presenceStateByKey[currentShadowPresenceKey] || {};
    if (d.shadowConsent === true) {
      loadShadowIframe(currentShadowPresenceKey, displayLabel);
    } else {
      iframe.src = "about:blank";
    }
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    updateConsentGate();
    updateOfflineBadgeForCurrentSelection();
    syncDispatcherTicketIdToActiveTech();
  }

  /** Phase 32c — Auto-sync `#scCurrentId.value` to the currently-shadowed tech's `activeTicketId` so
   *  the dispatcher can hit `#btnOfficeOverride` (or any other ticket-targeted action) immediately
   *  without first opening the ticket in Service Call Intake. Also paints the
   *  `#vcSimulatorTicketBadge` in the phone simulator toolbar so the dispatcher can SEE which ticket
   *  will be flagged. Called whenever:
   *    - the dispatcher changes `#vcShadowUserSelect` (via applyShadowTarget),
   *    - the in-iframe profile selector posts `vc_shadow_tech_changed`,
   *    - or `live_presence` snapshot arrives showing the tech moved to a different ticket.
   *
   *  We track `lastSyncedTicketId` per-key so we only overwrite `#scCurrentId.value` when the value
   *  we put there last is still in place. If the dispatcher manually loads a different ticket in
   *  Service Call Intake, we leave it alone (their input wins). */
  var lastSyncedTicketId = "";
  var lastSyncedPresenceKey = "";
  function syncDispatcherTicketIdToActiveTech() {
    var sel = document.getElementById("vcShadowUserSelect");
    var pk = sel && sel.value ? String(sel.value) : (currentShadowPresenceKey || "");
    var presence = pk ? (presenceStateByKey[pk] || {}) : {};
    var tid = presence.activeTicketId ? String(presence.activeTicketId) : "";
    var idEl = document.getElementById("scCurrentId");
    var badge = document.getElementById("vcSimulatorTicketBadge");
    /* Only overwrite #scCurrentId if (a) it's empty, OR (b) we set it last and the dispatcher hasn't
       changed it. Don't clobber a manually-loaded ticket. */
    if (idEl && tid) {
      var current = String(idEl.value || "").trim();
      if (!current || current === lastSyncedTicketId) {
        idEl.value = tid;
        lastSyncedTicketId = tid;
        lastSyncedPresenceKey = pk;
      }
    } else if (idEl && !tid && pk && pk === lastSyncedPresenceKey) {
      /* Same tech, but they've left the workspace (no activeTicketId). Clear OUR sync only — leave
         a manually-loaded ticket alone. */
      var cur2 = String(idEl.value || "").trim();
      if (cur2 && cur2 === lastSyncedTicketId) {
        idEl.value = "";
        lastSyncedTicketId = "";
      }
    }
    if (badge) {
      if (!pk) {
        badge.textContent = "No tech selected";
        badge.classList.add("vc-simulator-ticket-badge--empty");
      } else if (tid) {
        var label = "";
        try {
          var opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
          label = opt ? String(opt.textContent || "").trim() : "";
        } catch (eL) {}
        badge.textContent = (label ? label + " — " : "") + "Synced ticket: " + tid;
        badge.classList.remove("vc-simulator-ticket-badge--empty");
      } else {
        badge.textContent = "Tech not on a job — open a ticket on their phone";
        badge.classList.add("vc-simulator-ticket-badge--empty");
      }
    }
  }
  /* Expose so index.html / openTechnicianAppPreview can call it after the simulator opens. */
  global.vcSyncDispatcherTicketIdToActiveTech = syncDispatcherTicketIdToActiveTech;

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
    updateTakeOverButtonState();
    unsubscribeLivePresenceIdle();
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
        /* KI-002 Plan A9 — toast on coach-prompt failure so the dispatcher knows their nudge
           never reached the tech (otherwise they assume the tech ignored the prompt). */
        if (typeof window.VCSurfaceWriteFailure === "function") {
          window.VCSurfaceWriteFailure("ShadowMode:coachPrompt", e);
        }
        if (typeof window.showSaveCue === "function") {
          try { window.showSaveCue("⚠ Coach prompt FAILED to send — check connection and retry."); } catch (eC) {}
        }
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
        /* KI-002 Plan A9 — same surface-as-toast treatment as the coach-prompt write above. */
        if (typeof window.VCSurfaceWriteFailure === "function") {
          window.VCSurfaceWriteFailure("ShadowMode:forceSync", e);
        }
        if (typeof window.showSaveCue === "function") {
          try { window.showSaveCue("⚠ Force-sync FAILED to send — tech may not refresh."); } catch (eC) {}
        }
      });
  }

  function wireShadowIframeTechSync() {
    if (wireShadowIframeTechSync.wired) return;
    wireShadowIframeTechSync.wired = true;
    window.addEventListener("message", function (ev) {
      if (ev.origin !== window.location.origin) return;
      var d = ev.data;
      if (!d || d.type !== "vc_shadow_tech_changed") return;
      var sel = document.getElementById("vcShadowUserSelect");
      if (!sel || !d.presenceKey) return;
      if (sel.value === d.presenceKey) return;
      sel.dataset.vcSuppressChange = "1";
      try {
        sel.value = d.presenceKey;
      } catch (e) {}
      delete sel.dataset.vcSuppressChange;
      currentShadowPresenceKey = String(d.presenceKey);
      updateConsentGate();
      updateOfflineBadgeForCurrentSelection();
      syncDispatcherTicketIdToActiveTech();
    });
  }

  function initShadowMode() {
    wireShadowIframeTechSync();
    loadTenantUsersIntoSelect();
    var sel = document.getElementById("vcShadowUserSelect");
    if (sel && !sel.dataset.vcShadowWired) {
      sel.dataset.vcShadowWired = "1";
      sel.addEventListener("change", function () {
        if (sel.dataset.vcSuppressChange) return;
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
    var takeOverBtn = document.getElementById("vcShadowTakeOverBtn");
    if (takeOverBtn && !takeOverBtn.dataset.vcShadowWired) {
      takeOverBtn.dataset.vcShadowWired = "1";
      takeOverBtn.addEventListener("click", takeOverActiveTicket);
    }
    updateTakeOverButtonState();
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
    takeOverActiveTicket: takeOverActiveTicket,
    payrollKeyFromName: payrollKeyFromName,
    unsubscribeLivePresenceIdle: unsubscribeLivePresenceIdle,
  };
})(typeof window !== "undefined" ? window : this);
