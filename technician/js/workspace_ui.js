/**
 * Active job workspace UI: Site Intel (Firebase site_intelligence), header affordances.
 * VC-native; does not depend on UFX.
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
    var _siOpen =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.siteIntelligence(_dbOpen)
        : _dbOpen.collection("site_intelligence");
    _siOpen
      .doc(docId)
      .get()
      .then(function (snap) {
        var t = snap.exists && snap.data() ? String(snap.data().notes || "") : "";
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
    var _siSave =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.siteIntelligence(_dbSave)
        : _dbSave.collection("site_intelligence");
    _siSave
      .doc(docId)
      .set(payload, { merge: true })
      .then(function () {
        status.textContent = "Saved.";
        setSiteIntelButtonState(String(body.value || "").trim().length > 0);
        if (modal) modal.classList.add("hidden");
      })
      .catch(function (err) {
        status.textContent = err && err.message ? err.message : "Save failed.";
      });
  }

  function workspaceUiOnOpen() {
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
  window.openSiteIntelForLocation = openSiteIntelModal;
  window.teardownWorkspaceSiteIntel = teardownSiteIntelListener;
})();
