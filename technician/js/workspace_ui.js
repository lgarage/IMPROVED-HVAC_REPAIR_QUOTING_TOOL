/**
 * Active job workspace UI: Site Intel (Firebase site_intelligence), header affordances.
 * Inter-office site notes; does not depend on UFX.
 * Office Override iframe (?forceTicketId=&office_override=1): banner + routing live in technician/index.html; Shadow viewer uses ?vc_shadow_viewer=1 only.
 */
(function () {
  "use strict";

  var siteIntelUnsub = null;
  var lastIntelDocId = "";

  function techName() {
    try {
      return String(localStorage.getItem("tp_saved_tech") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function locationLineFromDom() {
    var loc = document.getElementById("location");
    if (loc && String(loc.value || "").trim()) {
      return String(loc.value).trim();
    }
    if (typeof activeTicket !== "undefined" && activeTicket) {
      var cn = String(activeTicket.customerName || "").trim();
      var ad = String(activeTicket.locationAddress || "").trim();
      if (cn && ad) return cn + " - " + ad;
      return cn || ad || "";
    }
    return "";
  }

  function ensureSiteIntelModal() {
    var existing = document.getElementById("vcSiteIntelModal");
    if (existing) return existing;
    var wrap = document.createElement("div");
    wrap.id = "vcSiteIntelModal";
    wrap.className = "vc-modal hidden";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "vcSiteIntelTitle");
    wrap.innerHTML =
      '<div class="vc-modal-backdrop" data-vc-site-intel-close="1"></div>' +
      '<div class="vc-modal-sheet">' +
      '<div class="vc-modal-head">' +
      '<h2 id="vcSiteIntelTitle">Site Intel</h2>' +
      '<button type="button" class="vc-modal-close" data-vc-site-intel-close="1" aria-label="Close">&times;</button>' +
      "</div>" +
      '<p class="vc-modal-hint">Persistent notes for this site (ladder access, roof hatch, lock codes the office should know). Same text for every ticket at this address.</p>' +
      '<p id="vcSiteIntelLocationLabel" class="vc-site-intel-location"></p>' +
      '<label for="vcSiteIntelBody">Field bible</label>' +
      '<textarea id="vcSiteIntelBody" rows="10" placeholder="Roof access: east ladder…"></textarea>' +
      '<div class="vc-modal-actions">' +
      '<button type="button" class="btn btn-primary" id="vcSiteIntelSaveBtn">Save</button>' +
      "</div>" +
      '<p id="vcSiteIntelStatus" class="vc-modal-status" aria-live="polite"></p>' +
      "</div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-vc-site-intel-close")) {
        wrap.classList.add("hidden");
      }
    });
    document.getElementById("vcSiteIntelSaveBtn").addEventListener("click", saveSiteIntelFromModal);
    return wrap;
  }

  function siteIntelDocRef() {
    var line = locationLineFromDom();
    if (!line || !window.DataProvider || typeof DataProvider.siteIntelDocIdFromLocationLine !== "function") {
      return null;
    }
    var docId = DataProvider.siteIntelDocIdFromLocationLine(line);
    if (!docId || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return null;
    var _db = firebase.firestore();
    var _si =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.siteIntelligence(_db)
        : _db.collection("site_intelligence");
    return { docId: docId, line: line, ref: _si.doc(docId) };
  }

  function setSiteIntelButtonState(hasNotes) {
    var btn = document.getElementById("wsSiteIntelBtn");
    if (!btn) return;
    btn.classList.toggle("site-intel--has-data", !!hasNotes);
  }

  function teardownSiteIntelListener() {
    if (typeof siteIntelUnsub === "function") {
      siteIntelUnsub();
      siteIntelUnsub = null;
    }
    lastIntelDocId = "";
  }

  function subscribeSiteIntelPulse() {
    teardownSiteIntelListener();
    var meta = siteIntelDocRef();
    if (!meta) {
      setSiteIntelButtonState(false);
      return;
    }
    lastIntelDocId = meta.docId;
    var _db = firebase.firestore();
    if (typeof VCFirestore !== "undefined" && VCFirestore.subscribeSiteIntelDocMerged) {
      siteIntelUnsub = VCFirestore.subscribeSiteIntelDocMerged(
        _db,
        meta.docId,
        function (notes) {
          setSiteIntelButtonState(String(notes || "").trim().length > 0);
        },
        function () {
          setSiteIntelButtonState(false);
        }
      );
    } else {
      siteIntelUnsub = meta.ref.onSnapshot(
        function (snap) {
          var notes = snap.exists && snap.data() ? String(snap.data().notes || "").trim() : "";
          setSiteIntelButtonState(notes.length > 0);
        },
        function () {
          setSiteIntelButtonState(false);
        }
      );
    }
  }

  function openSiteIntelModal(prefillLine) {
    var modal = ensureSiteIntelModal();
    var line = prefillLine != null ? String(prefillLine).trim() : locationLineFromDom();
    document.getElementById("vcSiteIntelLocationLabel").textContent = line || "—";
    document.getElementById("vcSiteIntelStatus").textContent = "";
    var body = document.getElementById("vcSiteIntelBody");
    body.value = "";

    if (!line || !window.DataProvider) {
      modal.classList.remove("hidden");
      return;
    }
    var docId = DataProvider.siteIntelDocIdFromLocationLine(line);
    if (!docId || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      modal.classList.remove("hidden");
      return;
    }
    var _dbOpen = firebase.firestore();
    var load =
      typeof VCFirestore !== "undefined" && VCFirestore.getSiteIntelDocOnceBridged
        ? VCFirestore.getSiteIntelDocOnceBridged(_dbOpen, docId)
        : (typeof VCFirestore !== "undefined"
            ? VCFirestore.siteIntelligence(_dbOpen)
            : _dbOpen.collection("site_intelligence")
          )
            .doc(docId)
            .get()
            .then(function (snap) {
              return {
                exists: snap.exists,
                data: snap.exists ? snap.data() : null,
              };
            });
    load
      .then(function (got) {
        var t =
          got && got.exists && got.data ? String(got.data.notes || "") : "";
        body.value = t;
        modal.classList.remove("hidden");
      })
      .catch(function () {
        modal.classList.remove("hidden");
      });
  }

  function saveSiteIntelFromModal() {
    var modal = document.getElementById("vcSiteIntelModal");
    var line = document.getElementById("vcSiteIntelLocationLabel").textContent.trim();
    if (line === "—") line = locationLineFromDom();
    var body = document.getElementById("vcSiteIntelBody");
    var status = document.getElementById("vcSiteIntelStatus");
    if (!line || !body) {
      if (status) status.textContent = "Set location first.";
      return;
    }
    if (!window.DataProvider || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      if (status) status.textContent = "Firebase not available.";
      return;
    }
    var docId = DataProvider.siteIntelDocIdFromLocationLine(line);
    var nk = DataProvider.normalizeLocationKey(line);
    var payload = {
      locationDisplay: line,
      normalizedKey: nk,
      notes: body.value || "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedByTech: techName(),
    };
    status.textContent = "Saving…";
    var _dbSave = firebase.firestore();
    var savePromise =
      typeof VCFirestore !== "undefined" && VCFirestore.setSiteIntelMerged
        ? VCFirestore.setSiteIntelMerged(_dbSave, docId, payload, true)
        : (typeof VCFirestore !== "undefined"
            ? VCFirestore.siteIntelligence(_dbSave)
            : _dbSave.collection("site_intelligence")
          )
            .doc(docId)
            .set(payload, { merge: true });
    savePromise
      .then(function () {
        status.textContent = "Saved.";
        setSiteIntelButtonState(String(body.value || "").trim().length > 0);
        if (modal) modal.classList.add("hidden");
      })
      .catch(function (err) {
        status.textContent = err && err.message ? err.message : "Save failed.";
      });
  }

  /**
   * Field evidence default visibility: technician Dictation Hub no longer has a public/internal toggle;
   * new photos default to internal; dispatcher can mark public before client send.
   */
  function getFieldEvidenceDefaultIsPublic() {
    return false;
  }

  /**
   * Reserved hook for imperative workspace locks; Office Override must remain editable.
   * Historical jobs use CSS (`#screen-workspace.is-historical-job .workspace-lock-scope`); bypass via
   * `vc-office-override-unlock` + `ensureOfficeOverrideWorkspaceUnlocked`.
   */
  function lockWorkspaceControls() {
    if (typeof window !== "undefined" && window.VC_OFFICE_OVERRIDE === true) {
      return;
    }
  }

  function ensureOfficeOverrideWorkspaceUnlocked() {
    if (typeof window === "undefined" || window.VC_OFFICE_OVERRIDE !== true) return;
    var ws = document.getElementById("screen-workspace");
    if (ws) ws.classList.add("vc-office-override-unlock");
    var notes = document.getElementById("dictationHubNotes");
    if (notes) {
      notes.removeAttribute("readonly");
      notes.removeAttribute("disabled");
    }
  }

  /** Snapshot from Dispatcher iframe: `postMessage({ type: 'VC_OFFICE_OVERRIDE', active })`. */
  var _vcPostMessageOverrideSnap = null;

  function snapshotInput(el) {
    if (!el) return null;
    return { readonly: el.readOnly, disabled: el.disabled };
  }

  function applyInputSnapshot(el, snap) {
    if (!el || !snap) return;
    if (snap.readonly) el.setAttribute("readonly", "readonly");
    else el.removeAttribute("readonly");
    el.disabled = !!snap.disabled;
  }

  function handleOfficeOverride(active) {
    var on = !!active;
    var notes = document.getElementById("dictationHubNotes");
    var siteIntel = document.getElementById("vcSiteIntelBody");
    var strip = document.getElementById("vcOfficeOverrideGlobalStrip");
    if (on) {
      if (!_vcPostMessageOverrideSnap) {
        _vcPostMessageOverrideSnap = {
          dictation: snapshotInput(notes),
          siteIntel: snapshotInput(siteIntel),
        };
      }
      if (document.body) document.body.classList.add("vc-override-active");
      if (strip) strip.setAttribute("aria-hidden", "false");
      if (notes) {
        notes.removeAttribute("readonly");
        notes.removeAttribute("disabled");
      }
      if (siteIntel) {
        siteIntel.removeAttribute("readonly");
        siteIntel.removeAttribute("disabled");
      }
    } else {
      if (document.body) document.body.classList.remove("vc-override-active");
      if (strip && typeof window !== "undefined" && window.VC_OFFICE_OVERRIDE !== true) {
        strip.setAttribute("aria-hidden", "true");
      }
      if (_vcPostMessageOverrideSnap) {
        applyInputSnapshot(notes, _vcPostMessageOverrideSnap.dictation);
        applyInputSnapshot(siteIntel, _vcPostMessageOverrideSnap.siteIntel);
        _vcPostMessageOverrideSnap = null;
      }
    }
  }

  window.addEventListener("message", function (event) {
    var d = event.data;
    if (!d || d.type !== "VC_OFFICE_OVERRIDE") return;
    handleOfficeOverride(!!d.active);
  });

  /**
   * Cross-device override (global): the tech's schedule listener already streams every ticket
   * assigned to them via `runScheduleMergeAndRender`; if any of those tickets has
   * `officeOverrideActive: true` (set by `service_call.js#toggleOfficeOverride`), reflect that
   * state on the tech's actual phone — regardless of which screen they're on and immediately
   * on page load.
   *
   * Phase 32 — Consent gate: this is now a 3-state path:
   *   - `off`     → no override flag → no chrome
   *   - `pending` → `officeOverrideActive: true` AND `officeOverrideAcknowledged !== true`
   *                 → show the orange consent button (CSS-driven via `body.vc-override-pending`),
   *                   but do NOT apply the KI-001 frame/strip and do NOT touch input snapshots
   *   - `active`  → `officeOverrideActive: true` AND `officeOverrideAcknowledged === true`
   *                 → apply the existing KI-001 chrome (frame + strip) via `handleOfficeOverride(true)`
   *
   * The consent button click handler in `technician/index.html` writes
   * `officeOverrideAcknowledged: true` to the ticket; the next snapshot from
   * `runScheduleMergeAndRender` calls `applyOfficeOverrideFromTickets` again and we transition
   * pending → active. The dispatcher's `service_call.js#toggleOfficeOverride(false)` clears all
   * override fields (including the ack ones) so any subsequent re-activation starts in `pending`
   * again, requiring a fresh tap.
   */
  var _vcOfficeOverrideRemoteState = "off"; // "off" | "pending" | "active"
  var _vcOfficeOverrideRemoteBy = "";
  var _vcOfficeOverrideRemoteTicketId = "";

  function updateOverrideStripLabel(byName, on) {
    var label = document.querySelector(
      "#vcOfficeOverrideGlobalStrip .vc-office-override-global-strip__label"
    );
    if (!label) return;
    if (on && byName) {
      label.textContent = "Office Override active — " + byName + " may be editing";
    } else {
      label.textContent = "Office Override active — dispatch may be editing";
    }
  }

  function setConsentButtonForState(state, ticketId, byName) {
    var btn = document.getElementById("vcOfficeOverrideConsentBtn");
    if (!btn) return;
    var titleEl = btn.querySelector(".vc-override-consent-btn__title");
    var subEl = document.getElementById("vcOfficeOverrideConsentSub");
    if (state === "pending") {
      btn.dataset.ticketId = ticketId || "";
      btn.disabled = false;
      if (titleEl) titleEl.textContent = "🟠 Tap to acknowledge — Dispatch is editing this job";
      if (subEl) {
        subEl.textContent = byName
          ? "Office Override active — " + byName + " may be editing. Tap to confirm you see this."
          : "Office Override is active. Tap to confirm you see this.";
      }
    } else {
      /* off or active — clear the button's ticket binding so a stale tap can't write to the wrong doc. */
      btn.dataset.ticketId = "";
      btn.disabled = false;
      if (titleEl) titleEl.textContent = "🟠 Tap to acknowledge — Dispatch is editing this job";
    }
  }

  /**
   * Called by `runScheduleMergeAndRender` (technician/index.html) every time the tech's
   * ticket snapshots merge. Picks the first ticket with `officeOverrideActive === true`
   * and dispatches to `setRemoteOverrideState` with the computed 3-state.
   */
  function applyOfficeOverrideFromTickets(tickets) {
    var arr = Array.isArray(tickets) ? tickets : [];
    var hit = null;
    for (var i = 0; i < arr.length; i++) {
      var t = arr[i];
      if (t && t.officeOverrideActive === true) { hit = t; break; }
    }
    var by = hit && hit.officeOverrideBy ? String(hit.officeOverrideBy).trim() : "";
    var tid = hit && hit.id ? String(hit.id) : "";
    var ack = !!(hit && hit.officeOverrideAcknowledged === true);
    var state = !hit ? "off" : (ack ? "active" : "pending");
    setRemoteOverrideState(state, tid, by);
  }

  function setRemoteOverrideState(state, ticketId, byName) {
    var prev = _vcOfficeOverrideRemoteState;
    _vcOfficeOverrideRemoteBy = byName || "";
    _vcOfficeOverrideRemoteTicketId = ticketId || "";

    if (state === "off") {
      if (document.body) {
        document.body.classList.remove("vc-override-pending");
        /* `vc-override-active` is removed inside handleOfficeOverride(false) below. */
      }
      setConsentButtonForState("off");
      if (prev === "active") {
        handleOfficeOverride(false);
      } else if (document.body) {
        /* Defensive: if we were pending, the active class shouldn't be set, but make sure. */
        document.body.classList.remove("vc-override-active");
      }
      _vcOfficeOverrideRemoteState = "off";
      updateOverrideStripLabel("", false);
      return;
    }

    if (state === "pending") {
      if (document.body) {
        document.body.classList.add("vc-override-pending");
      }
      /* If we were `active` and the ack got cleared (e.g. dispatcher reset), tear down active chrome
         before showing the consent button again. */
      if (prev === "active") {
        handleOfficeOverride(false);
      } else if (document.body) {
        document.body.classList.remove("vc-override-active");
      }
      setConsentButtonForState("pending", ticketId, byName);
      _vcOfficeOverrideRemoteState = "pending";
      updateOverrideStripLabel(byName, false);
      return;
    }

    /* state === "active" */
    if (document.body) {
      document.body.classList.remove("vc-override-pending");
    }
    setConsentButtonForState("active");
    if (prev !== "active") {
      handleOfficeOverride(true);
    }
    _vcOfficeOverrideRemoteState = "active";
    updateOverrideStripLabel(byName, true);
  }

  function workspaceUiOnOpen() {
    ensureOfficeOverrideWorkspaceUnlocked();
    subscribeSiteIntelPulse();
    var btn = document.getElementById("wsSiteIntelBtn");
    if (btn && !btn.dataset.wired) {
      btn.dataset.wired = "1";
      btn.addEventListener("click", function () {
        openSiteIntelModal();
      });
    }
  }

  window.workspaceUiOnOpen = workspaceUiOnOpen;
  window.ensureOfficeOverrideWorkspaceUnlocked = ensureOfficeOverrideWorkspaceUnlocked;
  window.lockWorkspaceControls = lockWorkspaceControls;
  window.handleOfficeOverride = handleOfficeOverride;
  window.applyOfficeOverrideFromTickets = applyOfficeOverrideFromTickets;
  window.setRemoteOverrideState = setRemoteOverrideState;
  window.openSiteIntelForLocation = openSiteIntelModal;
  window.teardownWorkspaceSiteIntel = teardownSiteIntelListener;
  window.getFieldEvidenceDefaultIsPublic = getFieldEvidenceDefaultIsPublic;
})();
