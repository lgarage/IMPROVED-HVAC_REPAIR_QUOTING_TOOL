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
   * Cross-device override: subscribe to the active ticket doc and reflect
   * `officeOverrideActive` on the technician's real phone (not just the dispatcher iframe).
   * The dispatcher writes `officeOverrideActive: true` in `service_call.js#toggleOfficeOverride`.
   */
  var _vcOfficeOverrideTicketUnsub = null;
  var _vcOfficeOverrideTicketId = null;
  var _vcOfficeOverrideRemoteActive = false;

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

  function teardownOfficeOverrideTicketListener() {
    if (typeof _vcOfficeOverrideTicketUnsub === "function") {
      try { _vcOfficeOverrideTicketUnsub(); } catch (e) {}
    }
    _vcOfficeOverrideTicketUnsub = null;
    _vcOfficeOverrideTicketId = null;
    if (_vcOfficeOverrideRemoteActive) {
      _vcOfficeOverrideRemoteActive = false;
      handleOfficeOverride(false);
    }
  }

  function subscribeOfficeOverrideForTicket(ticketId) {
    var tid = String(ticketId || "").trim();
    if (!tid) return;
    if (_vcOfficeOverrideTicketId === tid && typeof _vcOfficeOverrideTicketUnsub === "function") return;
    teardownOfficeOverrideTicketListener();
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    var db = firebase.firestore();
    var ref =
      typeof VCFirestore !== "undefined" && VCFirestore.serviceCalls
        ? VCFirestore.serviceCalls(db).doc(tid)
        : db.collection("service_calls").doc(tid);
    _vcOfficeOverrideTicketId = tid;
    try {
      _vcOfficeOverrideTicketUnsub = ref.onSnapshot(
        function (snap) {
          var data = snap && snap.exists ? snap.data() || {} : {};
          var on = data.officeOverrideActive === true;
          var by = on ? String(data.officeOverrideBy || "").trim() : "";
          if (on !== _vcOfficeOverrideRemoteActive) {
            _vcOfficeOverrideRemoteActive = on;
            handleOfficeOverride(on);
          }
          updateOverrideStripLabel(by, on);
        },
        function (err) {
          console.warn("[OfficeOverride] active-ticket listener", err);
        }
      );
    } catch (e) {
      console.warn("[OfficeOverride] subscribe failed", e);
    }
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
    try {
      var t = (typeof window !== "undefined" && window.activeTicket) || null;
      if (t && t.id) subscribeOfficeOverrideForTicket(t.id);
    } catch (e) {}
  }

  window.workspaceUiOnOpen = workspaceUiOnOpen;
  window.ensureOfficeOverrideWorkspaceUnlocked = ensureOfficeOverrideWorkspaceUnlocked;
  window.lockWorkspaceControls = lockWorkspaceControls;
  window.handleOfficeOverride = handleOfficeOverride;
  window.subscribeOfficeOverrideForTicket = subscribeOfficeOverrideForTicket;
  window.teardownOfficeOverrideTicketListener = teardownOfficeOverrideTicketListener;
  window.openSiteIntelForLocation = openSiteIntelModal;
  window.teardownWorkspaceSiteIntel = teardownSiteIntelListener;
  window.getFieldEvidenceDefaultIsPublic = getFieldEvidenceDefaultIsPublic;
})();
