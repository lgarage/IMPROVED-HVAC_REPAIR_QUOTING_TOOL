/**
 * Dictation Hub: Firestore asset tray, Rosetta Gemini mapping, verification states, OCR promotion.
 *
 * Schedule / job list is wired at the app shell (technician uses DataProvider.getSchedule); this
 * module does not reference UniFiX or other field-service providers.
 *
 * Firestore: customers/{customerId}/sites/{siteId}/assets/{assetDocId}
 *
 * Promotion: window.dictationPromoteAssetPhoto (equipment_manager.js)
 */
(function () {
  "use strict";

  var rosettaState = { ids: null };
  var lastDictationTicketId = null;
  /** @type {Object.<string, { id: string, data: object }>} */
  var trayRowCache = {};

  var assetsUnsub = null;
  var notesInputBound = false;
  var notesDebounce = null;
  var locationBlurBound = false;
  var trayDelegationWired = false;
  var pendingCapture = null;
  /** @type {{ logicalId: string, row: object } | null} */
  var verifiedModalContext = null;

  var SYSTEM_INSTRUCTION = [
    "You are a master HVAC data-mapper. Follow these rules exactly.",
    "",
    "SLANG → STANDARD CODES:",
    '- "Entrance Heater" / "Vestibule Heater" → VH',
    '- "Roof Fan" / "Exhaust Fan" → EF',
    '- "Hanging Heater" / "Unit Heater" → UH',
    '- "Package Unit" / "Rooftop Unit" → RTU',
    '- "Fresh Air Unit" / "MUA" → MUA',
    "",
    "QUANTITY / MULTIPLIERS:",
    'Spelled or spoken quantities must expand into numbered asset ids (e.g. "Two RTUs" → RTU1 and RTU2).',
    "Use digit counts when given: 1 → one id, 2 → two ids, etc.",
    'The words "both", "pair", or "a pair" mean 2 units of the preceding or implied equipment type.',
    'The word "handful" means 3 units.',
    "If quantity is unclear, infer conservatively from context or use a single unit (…1).",
    "",
    "OUTPUT:",
    "Return ONLY valid JSON (no markdown fences) with exactly these keys:",
    '- "identifiedAssetIds": array of strings like ["RTU1","RTU2","VH1","EF1"]',
    '- "locationTransposed": string, standardized as "CUSTOMER - CITY - STREET" using ALL CAPS for the three parts; use hyphens with spaces as shown. If unknown, use best effort from context or empty string "".',
    '- "visitSummary": one clean sentence summarizing work mentioned in the notes.',
  ].join("\n");

  function sanitizePathSegment(s) {
    return (
      String(s || "")
        .trim()
        .replace(/[/\\]+/g, "_")
        .replace(/\s+/g, " ")
        .slice(0, 200) || "unknown"
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad2(n) {
    return String(n).length < 2 ? "0" + n : String(n);
  }

  function formatLastServiceDate(v) {
    if (v == null || v === "") return "—";
    if (typeof v === "string") return v;
    if (v.toDate && typeof v.toDate === "function") {
      try {
        var d = v.toDate();
        return (
          d.getFullYear() +
          "-" +
          pad2(d.getMonth() + 1) +
          "-" +
          pad2(d.getDate())
        );
      } catch (e) {}
    }
    return "—";
  }

  function getImageUrl(node) {
    if (!node) return "";
    if (typeof node === "string") return node.trim() ? node : "";
    return node.url && String(node.url).trim() ? String(node.url).trim() : "";
  }

  function getModelNumber(d) {
    if (!d || typeof d !== "object") return "";
    if (d.modelNumber != null && String(d.modelNumber).trim()) {
      return String(d.modelNumber).trim();
    }
    if (d.model != null && String(d.model).trim()) return String(d.model).trim();
    return "";
  }

  function getSerialNumber(d) {
    if (!d || typeof d !== "object") return "";
    if (d.serialNumber != null && String(d.serialNumber).trim()) {
      return String(d.serialNumber).trim();
    }
    if (d.serialJob != null && String(d.serialJob).trim()) {
      return String(d.serialJob).trim();
    }
    if (d.serial != null && String(d.serial).trim()) return String(d.serial).trim();
    return "";
  }

  function pickThumbUrl(images) {
    if (!images || typeof images !== "object") return "";
    var ov = images.overall;
    var n = images.nameplate;
    var g = images.ghost;
    if (ov && getImageUrl(ov)) return getImageUrl(ov);
    if (n && getImageUrl(n)) return getImageUrl(n);
    if (g && getImageUrl(g)) return getImageUrl(g);
    return "";
  }

  function isAwaitingNewEquipment(d) {
    return !!(d && d.awaitingNewEquipment === true);
  }

  /**
   * Vertex-Core Phase 1–2: strict lifecycle from Firestore document data.
   * @param {{ exists: boolean, data?: function(): object }} doc Firestore DocumentSnapshot or compatible
   * @returns {'GHOST'|'INCOMPLETE'|'VERIFIED'}
   */
  function evaluateAssetState(doc) {
    if (!doc || doc.exists === false) {
      return "GHOST";
    }
    var d = typeof doc.data === "function" ? doc.data() || {} : {};
    if (d.awaitingNewEquipment === true) {
      return "GHOST";
    }
    var img = d.images || {};
    var npUrl =
      img.nameplate &&
      img.nameplate.url != null &&
      String(img.nameplate.url).trim() !== "";
    var ovUrl =
      img.overall &&
      img.overall.url != null &&
      String(img.overall.url).trim() !== "";
    var hasModel =
      d.modelNumber != null && String(d.modelNumber).trim() !== "";
    var hasSerial =
      d.serialNumber != null && String(d.serialNumber).trim() !== "";
    if (hasModel && hasSerial && npUrl && ovUrl) {
      return "VERIFIED";
    }
    return "INCOMPLETE";
  }

  function vcStateToCardClass(vc) {
    if (vc === "VERIFIED") return "asset-card-verified";
    if (vc === "GHOST") return "asset-card-ghost";
    return "asset-card-incomplete";
  }

  /** Missing items for incomplete tray hints (strict VC fields). */
  function getVcMissingLabels(d) {
    var missing = [];
    var data = d || {};
    var img = data.images || {};
    if (data.modelNumber == null || !String(data.modelNumber).trim()) {
      missing.push("Model number");
    }
    if (data.serialNumber == null || !String(data.serialNumber).trim()) {
      missing.push("Serial number");
    }
    if (
      !img.nameplate ||
      img.nameplate.url == null ||
      !String(img.nameplate.url).trim()
    ) {
      missing.push("Nameplate photo");
    }
    if (
      !img.overall ||
      img.overall.url == null ||
      !String(img.overall.url).trim()
    ) {
      missing.push("Overall photo");
    }
    return missing;
  }

  function computeVerification(d) {
    if (isAwaitingNewEquipment(d)) {
      return {
        verified: false,
        vacant: true,
        hasModel: false,
        hasSerial: false,
        hasNameplate: false,
        hasOverall: false,
      };
    }
    var img = (d && d.images) || {};
    var hasNp = !!getImageUrl(img.nameplate);
    var hasOv = !!getImageUrl(img.overall);
    var hasModel = !!getModelNumber(d);
    var hasSerial = !!getSerialNumber(d);
    var verified = hasModel && hasSerial && hasNp && hasOv;
    return {
      verified: verified,
      vacant: false,
      hasModel: hasModel,
      hasSerial: hasSerial,
      hasNameplate: hasNp,
      hasOverall: hasOv,
    };
  }

  function getSiteWatermarkLine1() {
    var locEl = document.getElementById("location");
    var t = "";
    if (locEl && locEl.value) t = String(locEl.value).trim();
    else if (typeof activeTicket !== "undefined" && activeTicket) {
      t =
        (activeTicket.customerName || "") +
        " - " +
        (activeTicket.locationAddress || "");
    }
    return t.replace(/\s+/g, " ").toUpperCase();
  }

  function getWatermarkLine2(unitId, retired) {
    return (
      String(unitId || "").trim().toUpperCase() +
      (retired ? " (Retired)" : " (Current)")
    );
  }

  function watermarkedFigureHtml(url, caption, unitId, retired) {
    var line1 = escapeHtml(getSiteWatermarkLine1());
    var line2 = escapeHtml(getWatermarkLine2(unitId, retired));
    var imgCls = retired ? "retired-photo" : "";
    return (
      '<div class="dictation-gallery-slide" data-gallery-silo="' +
      (retired ? "retired" : "active") +
      '">' +
      '<div class="dictation-img-frame' +
      (retired ? " dictation-img-frame--retired" : "") +
      '">' +
      '<img' +
      (imgCls ? ' class="' + imgCls + '"' : "") +
      ' src="' +
      escapeHtml(url) +
      '" alt="' +
      escapeHtml(caption) +
      '">' +
      '<div class="dictation-watermark" aria-hidden="true">' +
      '<span class="dictation-wm-line1">' +
      line1 +
      "</span>" +
      '<span class="dictation-wm-line2">' +
      line2 +
      "</span>" +
      "</div></div>" +
      '<span class="dictation-gallery-caption">' +
      escapeHtml(caption) +
      "</span></div>"
    );
  }

  function collectActivePhotoEntries(d) {
    var out = [];
    var img = (d && d.images) || {};
    if (getImageUrl(img.nameplate)) {
      out.push({ label: "Nameplate", url: getImageUrl(img.nameplate) });
    }
    if (getImageUrl(img.overall)) {
      out.push({ label: "Overall", url: getImageUrl(img.overall) });
    }
    var add = Array.isArray(d.additional_images) ? d.additional_images : [];
    add.forEach(function (entry, i) {
      var u =
        typeof entry === "string"
          ? entry
          : entry && entry.url
            ? String(entry.url)
            : "";
      if (u) out.push({ label: "Additional " + (i + 1), url: u });
    });
    return out;
  }

  function collectPhotoEntriesFromSnapshot(arch) {
    var out = [];
    var img = (arch && arch.images) || {};
    if (getImageUrl(img.nameplate)) {
      out.push({ label: "Nameplate", url: getImageUrl(img.nameplate) });
    }
    if (getImageUrl(img.overall)) {
      out.push({ label: "Overall", url: getImageUrl(img.overall) });
    }
    var add = Array.isArray(arch.additional_images) ? arch.additional_images : [];
    add.forEach(function (entry, i) {
      var u =
        typeof entry === "string"
          ? entry
          : entry && entry.url
            ? String(entry.url)
            : "";
      if (u) out.push({ label: "Additional " + (i + 1), url: u });
    });
    return out;
  }

  function normalizeUnitId(s) {
    return String(s || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
  }

  function geminiModelId() {
    if (typeof GEMINI_GENERATE_MODEL !== "undefined" && GEMINI_GENERATE_MODEL) {
      return GEMINI_GENERATE_MODEL;
    }
    return "gemini-2.5-flash";
  }

  function parseGeminiJson(text) {
    if (!text) return null;
    var t = String(text).trim();
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    try {
      return JSON.parse(t);
    } catch (e) {
      var o = t.indexOf("{");
      var c = t.lastIndexOf("}");
      if (o >= 0 && c > o) {
        try {
          return JSON.parse(t.slice(o, c + 1));
        } catch (e2) {}
      }
      return null;
    }
  }

  function getNotesEl() {
    return document.getElementById("dictationHubNotes");
  }

  function setProcessStatus(kind, message) {
    var el = document.getElementById("dictationProcessStatus");
    if (!el) return;
    el.classList.remove("dictation-process-status--done");
    el.textContent = message || "";
    if (kind === "done") el.classList.add("dictation-process-status--done");
  }

  function getDictationSiteContext() {
    if (typeof activeTicket === "undefined" || !activeTicket) {
      return { customerId: "", siteId: "" };
    }
    var locEl = document.getElementById("location");
    var locLine =
      locEl && locEl.value
        ? String(locEl.value).trim()
        : activeTicket.customerName + " - " + (activeTicket.locationAddress || "");
    return {
      customerId: sanitizePathSegment(activeTicket.customerName || ""),
      siteId: sanitizePathSegment(locLine),
    };
  }

  function ensureCameraInput() {
    var el = document.getElementById("dictationAssetCameraInput");
    if (el) return el;
    el = document.createElement("input");
    el.type = "file";
    el.id = "dictationAssetCameraInput";
    el.accept = "image/*";
    el.setAttribute("capture", "environment");
    el.className = "visually-hidden";
    el.setAttribute("tabindex", "-1");
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    el.addEventListener("change", onCameraInputChange);
    return el;
  }

  function onCameraInputChange() {
    var input = document.getElementById("dictationAssetCameraInput");
    var f = input && input.files && input.files[0];
    var ctx = pendingCapture;
    pendingCapture = null;
    if (!f || !ctx) return;
    if (typeof window.dictationPromoteAssetPhoto !== "function") {
      alert("Asset engine not loaded. Refresh the page.");
      return;
    }
    setProcessStatus("", "⏳ Saving photo…");
    window
      .dictationPromoteAssetPhoto(
        {
          logicalId: ctx.logicalId,
          customerId: ctx.customerId,
          siteId: ctx.siteId,
          kind: ctx.kind || "nameplate",
        },
        f
      )
      .then(function () {
        setProcessStatus("done", "✓ Saved");
        if (typeof saveDraft === "function") saveDraft();
      })
      .catch(function (err) {
        console.error("[DictationHub] promote", err);
        setProcessStatus("", "");
        alert(err && err.message ? err.message : String(err));
      });
  }

  function startDictationCapture(kind, logicalId) {
    var site = getDictationSiteContext();
    if (!site.customerId || !site.siteId) {
      alert("Set location on this ticket first.");
      return;
    }
    var docKey = sanitizePathSegment(logicalId);
    var k = kind === "overall" ? "overall" : kind === "additional" ? "additional" : "nameplate";
    pendingCapture = {
      kind: k,
      logicalId: docKey,
      customerId: site.customerId,
      siteId: site.siteId,
    };
    ensureCameraInput().value = "";
    ensureCameraInput().click();
  }

  function startAdditionalPhotoCapture(logicalId) {
    startDictationCapture("additional", logicalId);
  }

  function buildAddEquipmentCardHtml() {
    return (
      '<article class="dictation-asset-card dictation-asset-card--add" id="dictationAddEquipmentCard" data-add-equipment="1">' +
      '<div class="dictation-asset-card-body dictation-add-card-body">' +
      '<button type="button" class="dictation-add-equipment-btn">+ Add Equipment</button>' +
      '<p class="dictation-add-card-hint">Manual entry — then capture photos</p>' +
      "</div></article>"
    );
  }

  function ensureDetailModal() {
    var existing = document.getElementById("dictationAssetVerifiedModal");
    if (existing) return existing;
    var wrap = document.createElement("div");
    wrap.id = "dictationAssetVerifiedModal";
    wrap.className = "dictation-asset-modal hidden";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "dictationAssetVerifiedTitle");
    wrap.innerHTML =
      '<div class="dictation-asset-modal-backdrop" data-close-modal="1"></div>' +
      '<div class="dictation-asset-modal-sheet">' +
      '<div class="dictation-asset-modal-head">' +
      '<h3 id="dictationAssetVerifiedTitle">Verified unit</h3>' +
      '<button type="button" class="dictation-asset-modal-close" data-close-modal="1" aria-label="Close">&times;</button>' +
      "</div>" +
      '<div id="dictationAssetVerifiedBody" class="dictation-asset-modal-body"></div>' +
      "</div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close-modal")) closeVerifiedModal();
    });
    if (!document.documentElement.dataset.dictationModalEsc) {
      document.documentElement.dataset.dictationModalEsc = "1";
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        var rv = document.getElementById("dictationRetiredVaultModal");
        if (rv && !rv.classList.contains("hidden")) {
          closeRetiredVaultModal();
          return;
        }
        var m = document.getElementById("dictationAssetVerifiedModal");
        if (m && !m.classList.contains("hidden")) closeVerifiedModal();
      });
    }
    return wrap;
  }

  function closeVerifiedModal() {
    var m = document.getElementById("dictationAssetVerifiedModal");
    if (m) m.classList.add("hidden");
    verifiedModalContext = null;
  }

  function closeRetiredVaultModal() {
    var m = document.getElementById("dictationRetiredVaultModal");
    if (m) m.classList.add("hidden");
  }

  function ensureRetiredVaultModal() {
    var existing = document.getElementById("dictationRetiredVaultModal");
    if (existing) return existing;
    var wrap = document.createElement("div");
    wrap.id = "dictationRetiredVaultModal";
    wrap.className = "dictation-asset-modal dictation-retired-vault-modal hidden";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML =
      '<div class="dictation-asset-modal-backdrop" data-close-vault="1"></div>' +
      '<div class="dictation-asset-modal-sheet dictation-retired-vault-sheet">' +
      '<div class="dictation-asset-modal-head">' +
      '<h3 id="dictationRetiredVaultTitle">Retired equipment</h3>' +
      '<button type="button" class="dictation-asset-modal-close" data-close-vault="1" aria-label="Close">&times;</button>' +
      "</div>" +
      '<div id="dictationRetiredVaultBody" class="dictation-asset-modal-body"></div>' +
      "</div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close-vault")) closeRetiredVaultModal();
    });
    return wrap;
  }

  function vaultArchivedMs(data) {
    var d = data || {};
    var a = d.archivedAt;
    if (a && typeof a.toMillis === "function") {
      return a.toMillis();
    }
    if (a && typeof a.toDate === "function") {
      return a.toDate().getTime();
    }
    var r = d.retiredAt;
    if (r && typeof r.toMillis === "function") {
      return r.toMillis();
    }
    if (r && typeof r.toDate === "function") {
      return r.toDate().getTime();
    }
    return 0;
  }

  function openRetiredVaultForUnit(logicalId) {
    var site = getDictationSiteContext();
    if (!site.customerId || !site.siteId) return;
    var docId = sanitizePathSegment(logicalId);
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;

    var body = document.getElementById("dictationRetiredVaultBody");
    if (!body) return;
    body.innerHTML =
      '<p class="dictation-vault-loading">Loading archive…</p>';

    var modal = ensureRetiredVaultModal();
    modal.classList.remove("hidden");

    var histCol = firebase
      .firestore()
      .collection("customers")
      .doc(site.customerId)
      .collection("sites")
      .doc(site.siteId)
      .collection("assets")
      .doc(docId)
      .collection("retired_history");

    var loadSnap = histCol
      .orderBy("archivedAt", "desc")
      .get()
      .catch(function () {
        return histCol.get();
      });

    loadSnap
      .then(function (snap) {
        var rows = [];
        snap.forEach(function (doc) {
          rows.push({ id: doc.id, data: doc.data() || {} });
        });
        rows.sort(function (a, b) {
          var ma = vaultArchivedMs(a.data);
          var mb = vaultArchivedMs(b.data);
          if (mb !== ma) {
            return mb - ma;
          }
          return String(b.id).localeCompare(String(a.id));
        });
        if (!rows.length) {
          body.innerHTML =
            "<p>No retired snapshots for this unit yet.</p>";
          return;
        }
        var html = "";
        rows.forEach(function (r, idx) {
          var arch = r.data;
          var when =
            arch.retiredAt && arch.retiredAt.toDate
              ? arch.retiredAt.toDate().toLocaleString()
              : arch.archivedAt && arch.archivedAt.toDate
                ? arch.archivedAt.toDate().toLocaleString()
                : arch.archivedAt
                  ? String(arch.archivedAt)
                  : r.id;
          var entries = collectPhotoEntriesFromSnapshot(arch);
          var slides = "";
          entries.forEach(function (en) {
            slides += watermarkedFigureHtml(en.url, en.label, logicalId, true);
          });
          if (!slides) {
            slides =
              "<p class=\"dictation-vault-noimg\">No photos in this archive entry.</p>";
          }
          html +=
            '<section class="dictation-vault-entry">' +
            "<h4>Archive " +
            escapeHtml(String(idx + 1)) +
            " · " +
            escapeHtml(String(when)) +
            "</h4>" +
            '<div class="dictation-gallery dictation-gallery--retired" tabindex="0">' +
            slides +
            "</div>" +
            "</section>";
        });
        body.innerHTML = html;
      })
      .catch(function (e) {
        body.innerHTML =
          "<p>Could not load archive.</p>";
        console.error(e);
      });
  }

  function wireVerifiedModalActions(logicalId, row) {
    var site = getDictationSiteContext();
    var docKey = sanitizePathSegment(logicalId);

    var retireBtn = document.getElementById("dictationBtnRetire");
    if (retireBtn) {
      retireBtn.onclick = function () {
        if (
          !window.confirm(
            "Retire this equipment? A full snapshot moves to Retired History. This slot will clear for a new installation."
          )
        ) {
          return;
        }
        if (typeof window.dictationRetireCurrentAsset !== "function") {
          alert("Retire is not available. Refresh the page.");
          return;
        }
        setProcessStatus("", "⏳ Archiving…");
        window
          .dictationRetireCurrentAsset({
            logicalId: docKey,
            customerId: site.customerId,
            siteId: site.siteId,
          })
          .then(function () {
            setProcessStatus("done", "✓ Retired");
            closeVerifiedModal();
            if (typeof saveDraft === "function") saveDraft();
          })
          .catch(function (err) {
            setProcessStatus("", "");
            alert(err && err.message ? err.message : String(err));
          });
      };
    }

    var addPhotoBtn = document.getElementById("dictationBtnAddPhoto");
    if (addPhotoBtn) {
      addPhotoBtn.onclick = function () {
        startAdditionalPhotoCapture(logicalId);
      };
    }

    var vaultBtn = document.getElementById("dictationBtnRetiredVault");
    if (vaultBtn) {
      vaultBtn.onclick = function () {
        openRetiredVaultForUnit(logicalId);
      };
    }
  }

  function showVerifiedAssetModal(row) {
    var d = row && row.data ? row.data : {};
    var logical = d.id != null && String(d.id).trim() ? String(d.id).trim() : row.id;
    var logicalNorm = normalizeUnitId(logical);
    verifiedModalContext = { logicalId: logicalNorm, row: row };

    var body = document.getElementById("dictationAssetVerifiedBody");
    if (!body) return;

    var entries = collectActivePhotoEntries(d);
    var slides = "";
    entries.forEach(function (en) {
      slides += watermarkedFigureHtml(en.url, en.label, logical, false);
    });
    if (!slides) {
      slides =
        '<p class="dictation-gallery-empty">No photos yet.</p>';
    }

    body.innerHTML =
      '<p class="dictation-readonly-note" role="note">Read-only detail — specs &amp; photos below. Use toolbar for actions.</p>' +
      '<div class="dictation-verified-toolbar">' +
      '<button type="button" class="dictation-btn-retire" id="dictationBtnRetire">⚠️ Retire this Equipment</button>' +
      '<button type="button" class="dictation-btn-add-photo" id="dictationBtnAddPhoto">+ Add Photo</button>' +
      '<button type="button" class="dictation-btn-retired-vault" id="dictationBtnRetiredVault" style="display:none" hidden>Retired Equipment</button>' +
      "</div>" +
      "<p class=\"dictation-verified-unit-label\"><strong>" +
      escapeHtml(logical) +
      "</strong></p>" +
      "<dl class=\"dictation-verified-dl\">" +
      "<dt>Manufacturer</dt><dd>" +
      escapeHtml(d.manufacturer || d.brand || "—") +
      "</dd>" +
      "<dt>Model #</dt><dd>" +
      escapeHtml(getModelNumber(d) || "—") +
      "</dd>" +
      "<dt>Serial #</dt><dd>" +
      escapeHtml(getSerialNumber(d) || "—") +
      "</dd>" +
      "</dl>" +
      '<div class="dictation-gallery dictation-gallery--active" tabindex="0">' +
      slides +
      "</div>";

    wireVerifiedModalActions(logical, row);

    var vaultBtn = document.getElementById("dictationBtnRetiredVault");
    if (vaultBtn) {
      var siteVault = getDictationSiteContext();
      if (
        siteVault.customerId &&
        siteVault.siteId &&
        typeof window.dictationAssetHasRetiredHistory === "function"
      ) {
        window
          .dictationAssetHasRetiredHistory({
            logicalId: sanitizePathSegment(logicalNorm),
            customerId: siteVault.customerId,
            siteId: siteVault.siteId,
          })
          .then(function (has) {
            if (!vaultBtn) return;
            if (has) {
              vaultBtn.style.display = "";
              vaultBtn.removeAttribute("hidden");
            } else {
              vaultBtn.style.display = "none";
              vaultBtn.setAttribute("hidden", "hidden");
            }
          })
          .catch(function () {
            if (vaultBtn) {
              vaultBtn.style.display = "none";
              vaultBtn.setAttribute("hidden", "hidden");
            }
          });
      }
    }

    var modal = ensureDetailModal();
    modal.classList.remove("hidden");
  }

  function wireTrayDelegationOnce() {
    var tray = document.getElementById("dictationActionTray");
    if (!tray || trayDelegationWired) return;
    trayDelegationWired = true;
    tray.addEventListener("click", function (e) {
      var addBtn = e.target.closest(".dictation-add-equipment-btn");
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        var name = window.prompt("Unit ID (e.g. EF3):", "");
        if (name == null || !String(name).trim()) return;
        var logical = String(name).trim();
        var docId = sanitizePathSegment(logical);
        var site = getDictationSiteContext();
        if (!site.customerId || !site.siteId) {
          alert("Set location on this ticket first.");
          return;
        }
        if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
          alert("Firebase not available.");
          return;
        }
        firebase
          .firestore()
          .collection("customers")
          .doc(site.customerId)
          .collection("sites")
          .doc(site.siteId)
          .collection("assets")
          .doc(docId)
          .set(
            {
              id: logical,
              type: "",
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
          .catch(function (err) {
            console.error(err);
            alert(err && err.message ? err.message : String(err));
          });
        return;
      }

      var cap = e.target.closest(".dictation-capture-btn");
      if (cap) {
        e.preventDefault();
        e.stopPropagation();
        var kind = cap.getAttribute("data-capture-kind") || "nameplate";
        var lid = cap.getAttribute("data-logical-id");
        if (lid) startDictationCapture(kind, lid);
        return;
      }

      var ghostUp = e.target.closest(".dictation-ghost-upload-btn");
      if (ghostUp) {
        e.preventDefault();
        e.stopPropagation();
        var glid = ghostUp.getAttribute("data-logical-id");
        if (glid) startDictationCapture("nameplate", glid);
        return;
      }

      var card = e.target.closest(".dictation-asset-card");
      if (!card || card.classList.contains("dictation-asset-card--add")) return;
      if (card.getAttribute("data-ghost-asset") === "1") return;
      if (e.target.closest("button")) return;
      if (!card.classList.contains("asset-card-verified")) return;

      var lid = card.getAttribute("data-logical-id");
      if (!lid) return;
      var row = trayRowCache[lid];
      if (row) showVerifiedAssetModal(row);
    });
  }

  function clearRosettaUi() {
    rosettaState.ids = null;
    trayRowCache = {};
    var tray = document.getElementById("dictationActionTray");
    if (tray) {
      tray.querySelectorAll(".dictation-asset-card").forEach(function (c) {
        c.classList.remove("active-asset");
      });
      tray.querySelectorAll('[data-ghost-asset="1"]').forEach(function (g) {
        g.remove();
      });
    }
    setProcessStatus("", "");
    closeVerifiedModal();
  }

  function unsubscribeAssetsOnly() {
    if (typeof assetsUnsub === "function") {
      assetsUnsub();
      assetsUnsub = null;
    }
  }

  function removeGhostCards(tray) {
    tray.querySelectorAll('[data-ghost-asset="1"]').forEach(function (g) {
      g.remove();
    });
  }

  function applyRosettaOverlay() {
    var tray = document.getElementById("dictationActionTray");
    if (!tray || rosettaState.ids === null) return;

    var ids = Array.isArray(rosettaState.ids) ? rosettaState.ids : [];
    var idSet = [];
    ids.forEach(function (id) {
      var n = normalizeUnitId(id);
      if (n && idSet.indexOf(n) < 0) idSet.push(n);
    });

    tray.querySelectorAll(".dictation-asset-card").forEach(function (c) {
      c.classList.remove("active-asset");
    });
    removeGhostCards(tray);

    var matched = {};
    tray.querySelectorAll(".dictation-asset-card:not([data-ghost-asset])").forEach(function (card) {
      if (card.classList.contains("dictation-asset-card--add")) return;
      var lid = card.getAttribute("data-logical-id");
      if (!lid) return;
      var key = normalizeUnitId(lid);
      if (idSet.indexOf(key) >= 0) {
        card.classList.add("active-asset");
        matched[key] = true;
      }
    });

    idSet.forEach(function (key) {
      if (matched[key]) return;
      tray.appendChild(createGhostAssetCard(key));
    });
  }

  function createGhostAssetCard(logicalId) {
    var article = document.createElement("article");
    article.className =
      "dictation-asset-card asset-card-ghost dictation-asset-card--discovery";
    article.setAttribute("data-logical-id", logicalId);
    article.setAttribute("data-ghost-asset", "1");

    var badge = document.createElement("div");
    badge.className = "dictation-discovery-badge asset-new-discovery-label";
    badge.textContent = "NEW DISCOVERY";

    var thumb = document.createElement("div");
    thumb.className = "dictation-asset-card-thumb";
    var uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "dictation-ghost-upload-btn";
    uploadBtn.setAttribute("data-logical-id", logicalId);
    uploadBtn.setAttribute("title", "Capture nameplate — creates asset in cloud");
    uploadBtn.setAttribute("aria-label", "Capture nameplate photo");
    uploadBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
    thumb.appendChild(uploadBtn);

    var body = document.createElement("div");
    body.className = "dictation-asset-card-body";
    body.innerHTML =
      '<div class="dictation-asset-card-id">' +
      escapeHtml(logicalId) +
      "</div>" +
      '<div class="dictation-asset-card-meta">Not yet in site assets</div>' +
      '<div class="dictation-asset-card-loc">Upload nameplate to promote this unit.</div>' +
      '<div class="dictation-asset-card-date">AI match</div>';

    article.appendChild(badge);
    article.appendChild(thumb);
    article.appendChild(body);
    return article;
  }

  function renderWatermarkedThumb(url, logical, retired) {
    var line1 = escapeHtml(getSiteWatermarkLine1());
    var line2 = escapeHtml(getWatermarkLine2(logical, retired));
    return (
      '<div class="dictation-img-frame dictation-img-frame--thumb">' +
      '<img src="' +
      escapeHtml(url) +
      '" alt="" loading="lazy">' +
      '<div class="dictation-watermark dictation-watermark--thumb" aria-hidden="true">' +
      '<span class="dictation-wm-line1">' +
      line1 +
      "</span>" +
      '<span class="dictation-wm-line2">' +
      line2 +
      "</span>" +
      "</div></div>"
    );
  }

  function wrapDocSnapForRow(row) {
    if (row.docSnap) return row.docSnap;
    return {
      exists: true,
      data: function () {
        return row.data || {};
      },
    };
  }

  function renderAssetCardHtml(row) {
    var d = row.data || {};
    var logical =
      d.id != null && String(d.id).trim() ? String(d.id).trim() : row.id;
    var logicalNorm = normalizeUnitId(logical);
    var docSnap = wrapDocSnapForRow(row);
    var vc = evaluateAssetState(docSnap);
    var vcClass = vcStateToCardClass(vc);

    var typ = d.type != null && String(d.type).trim() ? String(d.type) : "—";
    var locDesc =
      d.locationDescription != null ? String(d.locationDescription) : "—";
    var last = formatLastServiceDate(d.lastServiceDate);
    var thumb = pickThumbUrl(d.images);

    var ribbon = "";
    if (vc === "VERIFIED") {
      ribbon =
        '<div class="dictation-verified-banner" title="Verified asset"><span class="dictation-verified-shield" aria-hidden="true">🛡️</span> Verified</div>';
    } else if (isAwaitingNewEquipment(d)) {
      ribbon =
        '<div class="dictation-vacant-banner">New install slot</div>';
    }

    var thumbBlock = "";
    if (thumb) {
      thumbBlock =
        '<div class="dictation-asset-card-thumb">' +
        renderWatermarkedThumb(thumb, logical, false) +
        "</div>";
    } else {
      thumbBlock =
        '<div class="dictation-asset-card-thumb dictation-asset-card-thumb--placeholder" aria-hidden="true">◇</div>';
    }

    var missing = vc === "INCOMPLETE" ? getVcMissingLabels(d) : [];
    var missingBlock =
      missing.length && vc === "INCOMPLETE"
        ? '<ul class="asset-incomplete-missing-list">' +
          missing
            .map(function (m) {
              return "<li>" + escapeHtml(m) + "</li>";
            })
            .join("") +
          "</ul>"
        : "";

    var actions = "";
    if (vc === "VERIFIED") {
      actions +=
        '<p class="dictation-verified-tap-hint">Tap for read-only detail &amp; lifecycle</p>';
    } else {
      actions += '<div class="dictation-incomplete-actions">';
      if (isAwaitingNewEquipment(d)) {
        actions +=
          '<button type="button" class="dictation-capture-btn" data-capture-kind="nameplate" data-logical-id="' +
          escapeHtml(logicalNorm) +
          '">📸 Capture nameplate</button>' +
          '<button type="button" class="dictation-capture-btn" data-capture-kind="overall" data-logical-id="' +
          escapeHtml(logicalNorm) +
          '">📸 Capture overall</button>';
      } else {
        var img = d.images || {};
        var needNp =
          !img.nameplate ||
          !img.nameplate.url ||
          !String(img.nameplate.url).trim();
        var needOv =
          !img.overall || !img.overall.url || !String(img.overall.url).trim();
        if (needNp) {
          actions +=
            '<button type="button" class="dictation-capture-btn" data-capture-kind="nameplate" data-logical-id="' +
            escapeHtml(logicalNorm) +
            '">📸 Capture nameplate</button>';
        }
        if (needOv) {
          actions +=
            '<button type="button" class="dictation-capture-btn" data-capture-kind="overall" data-logical-id="' +
            escapeHtml(logicalNorm) +
            '">📸 Capture overall</button>';
        }
        if (
          !needNp &&
          !needOv &&
          (d.modelNumber == null ||
            !String(d.modelNumber).trim() ||
            d.serialNumber == null ||
            !String(d.serialNumber).trim())
        ) {
          actions +=
            '<p class="dictation-incomplete-hint">Re-capture nameplate so OCR can fill model &amp; serial.</p>';
        }
      }
      actions += missingBlock + "</div>";
    }

    return (
      '<article class="dictation-asset-card ' +
      vcClass +
      '" data-asset-id="' +
      escapeHtml(row.id) +
      '" data-logical-id="' +
      escapeHtml(logicalNorm) +
      '" data-vc-state="' +
      vc +
      '">' +
      ribbon +
      thumbBlock +
      '<div class="dictation-asset-card-body">' +
      '<div class="dictation-asset-card-id">' +
      escapeHtml(logical) +
      "</div>" +
      '<div class="dictation-asset-card-meta">' +
      escapeHtml(typ) +
      "</div>" +
      '<div class="dictation-asset-card-loc">' +
      escapeHtml(locDesc) +
      "</div>" +
      '<div class="dictation-asset-card-date">Last: ' +
      escapeHtml(last) +
      "</div>" +
      actions +
      "</div></article>"
    );
  }

  async function processVisitNotes(text) {
    var raw = String(text || "").trim();
    if (!raw) {
      throw new Error("Enter some notes before processing.");
    }

    if (typeof getGeminiApiKey !== "function") {
      throw new Error("Gemini API key is not available (getGeminiApiKey).");
    }
    var key = await getGeminiApiKey();
    if (!key) {
      throw new Error("Add the Gemini API key under Settings → Integrations & API Keys.");
    }

    var locEl = document.getElementById("location");
    var locCtx =
      locEl && locEl.value ? String(locEl.value).trim() : "";

    var userPayload =
      "Technician dictation / notes:\n" +
      raw +
      "\n\nCurrent location field (may help standardize locationTransposed):\n" +
      (locCtx || "(empty)") +
      "\n\nRespond with JSON only.";

    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      geminiModelId() +
      ":generateContent?key=" +
      encodeURIComponent(key);

    var body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPayload }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    };

    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    var data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || "Gemini request failed.");
    }

    var part =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0];
    var rawOut = part && part.text ? String(part.text) : "";
    var parsed = parseGeminiJson(rawOut);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Could not parse Gemini JSON. Check the console.");
    }

    var identified =
      parsed.identifiedAssetIds != null
        ? parsed.identifiedAssetIds
        : parsed.identified_asset_ids;
    if (!Array.isArray(identified)) {
      identified = [];
    }

    var locationTransposed =
      parsed.locationTransposed != null
        ? String(parsed.locationTransposed).trim()
        : parsed.location_transposed != null
          ? String(parsed.location_transposed).trim()
          : "";

    if (locationTransposed && locEl) {
      locEl.value = locationTransposed;
      if (typeof saveDraft === "function") saveDraft();
    }

    rosettaState.ids = identified
      .map(function (x) {
        return String(x || "").trim();
      })
      .filter(Boolean);

    applyRosettaOverlay();

    var summary =
      parsed.visitSummary != null
        ? String(parsed.visitSummary).trim()
        : parsed.visit_summary != null
          ? String(parsed.visit_summary).trim()
          : "";
    if (summary) {
      console.log("[DictationHub] visitSummary:", summary);
    }

    setProcessStatus("done", "✓ AI processed");
  }

  function storageKeyForTicket() {
    if (typeof activeTicket === "undefined" || !activeTicket || !activeTicket.id) {
      return "dictationHubNotes_draft";
    }
    return "dictationHubNotes_" + activeTicket.id;
  }

  function loadNotesFromStorage() {
    var el = getNotesEl();
    if (!el) return;
    try {
      var v = localStorage.getItem(storageKeyForTicket());
      if (v != null) el.value = v;
    } catch (e) {}
  }

  function schedulePersistNotes() {
    var el = getNotesEl();
    if (!el) return;
    if (notesDebounce) clearTimeout(notesDebounce);
    notesDebounce = setTimeout(function () {
      notesDebounce = null;
      try {
        localStorage.setItem(storageKeyForTicket(), el.value);
      } catch (e) {}
    }, 400);
  }

  function wireNotesPersistence() {
    var el = getNotesEl();
    if (!el || notesInputBound) return;
    notesInputBound = true;
    el.addEventListener("input", schedulePersistNotes);
  }

  function wireLocationResubscribe() {
    var loc = document.getElementById("location");
    if (!loc || locationBlurBound) return;
    locationBlurBound = true;
    loc.addEventListener("blur", function () {
      if (typeof window.startDictationHubFromWorkspace === "function") {
        window.startDictationHubFromWorkspace();
      }
    });
  }

  function renderActionTray(docs) {
    var tray = document.getElementById("dictationActionTray");
    if (!tray) return;

    trayRowCache = {};
    wireTrayDelegationOnce();

    var hasDocs = docs && docs.length > 0;

    if (!hasDocs) {
      if (rosettaState.ids === null) {
        tray.innerHTML =
          '<p class="dictation-action-tray-empty">No assets for this customer/site yet. Use <strong>+ Add Equipment</strong> or process dictation to discover units.</p>';
        tray.insertAdjacentHTML("beforeend", buildAddEquipmentCardHtml());
        applyRosettaOverlay();
        return;
      }
      tray.innerHTML = buildAddEquipmentCardHtml();
    } else {
      var html = "";
      docs.forEach(function (row) {
        var d = row.data || {};
        var logical =
          d.id != null && String(d.id).trim() ? String(d.id).trim() : row.id;
        var key = normalizeUnitId(logical);
        trayRowCache[key] = row;
        html += renderAssetCardHtml(row);
      });
      html += buildAddEquipmentCardHtml();
      tray.innerHTML = html;
    }

    applyRosettaOverlay();
  }

  function teardownDictationHub() {
    unsubscribeAssetsOnly();
    lastDictationTicketId = null;
    clearRosettaUi();
  }

  function startDictationHubAssetsListener() {
    if (typeof activeTicket !== "undefined" && activeTicket && activeTicket.id) {
      if (lastDictationTicketId !== activeTicket.id) {
        rosettaState.ids = null;
        setProcessStatus("", "");
        lastDictationTicketId = activeTicket.id;
      }
    }

    unsubscribeAssetsOnly();
    loadNotesFromStorage();
    wireNotesPersistence();
    wireLocationResubscribe();

    var tray = document.getElementById("dictationActionTray");
    if (tray) {
      tray.innerHTML =
        '<p class="dictation-action-tray-loading">Loading assets…</p>';
    }

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      if (tray) {
        tray.innerHTML =
          '<p class="dictation-action-tray-empty">Firebase not available.</p>';
      }
      return;
    }

    if (typeof activeTicket === "undefined" || !activeTicket) {
      if (tray) {
        tray.innerHTML =
          '<p class="dictation-action-tray-empty">Select a job to load site assets.</p>';
      }
      return;
    }

    var locEl = document.getElementById("location");
    var locLine =
      locEl && locEl.value
        ? String(locEl.value).trim()
        : activeTicket.customerName + " - " + (activeTicket.locationAddress || "");
    var customerId = sanitizePathSegment(activeTicket.customerName || "");
    var siteId = sanitizePathSegment(locLine);

    var db = firebase.firestore();
    var ref = db
      .collection("customers")
      .doc(customerId)
      .collection("sites")
      .doc(siteId)
      .collection("assets");

    assetsUnsub = ref.onSnapshot(
      function (snap) {
        var rows = [];
        snap.forEach(function (doc) {
          rows.push({
            id: doc.id,
            data: doc.data() || {},
            docSnap: doc,
          });
        });
        rows.sort(function (a, b) {
          return String(a.id).localeCompare(String(b.id));
        });
        renderActionTray(rows);
      },
      function (err) {
        console.error("[DictationHub] assets listener", err);
        if (tray) {
          tray.innerHTML =
            '<p class="dictation-action-tray-empty">Could not load assets. ' +
            escapeHtml(err.message || String(err)) +
            "</p>";
        }
      }
    );
  }

  function onProcessNotesClick() {
    var el = getNotesEl();
    var raw = el ? el.value : "";
    var btn = document.getElementById("dictationProcessBtn");
    setProcessStatus("", "…");
    if (btn) btn.disabled = true;
    processVisitNotes(raw)
      .then(function () {
        if (btn) btn.disabled = false;
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        setProcessStatus("", "");
        var msg =
          err && err.message ? err.message : "Processing failed.";
        console.error("[DictationHub] processVisitNotes", err);
        alert(msg);
      });
  }

  function wireProcessButton() {
    var btn = document.getElementById("dictationProcessBtn");
    if (!btn || btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", onProcessNotesClick);
  }

  window.processVisitNotes = processVisitNotes;
  window.evaluateAssetState = evaluateAssetState;
  window.teardownDictationHub = teardownDictationHub;
  window.startDictationHubFromWorkspace = function () {
    wireProcessButton();
    if (!document.documentElement.dataset.dictationPlateOcrEvt) {
      document.documentElement.dataset.dictationPlateOcrEvt = "1";
      document.addEventListener("dictationHubNameplateImageSaved", function () {
        setProcessStatus("", "⏳ Reading nameplate…");
      });
    }
    startDictationHubAssetsListener();
  };
})();
