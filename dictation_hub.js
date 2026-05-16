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

  function isVcTimeTrackingOnlySeat() {
    try {
      if (typeof window !== "undefined" && window.VC_OFFICE_OVERRIDE === true) {
        return false;
      }
      return localStorage.getItem("vc_time_tracking_only") === "1";
    } catch (e) {
      return false;
    }
  }

  var rosettaState = { ids: null };
  var lastDictationTicketId = null;
  /** @type {Object.<string, { id: string, data: object }>} */
  var trayRowCache = {};

  var assetsUnsub = null;
  var internalCommsUnsub = null;
  var internalCommsBoundTicketId = null;
  var notesInputBound = false;
  var notesDebounce = null;
  var locationBlurBound = false;
  var trayDelegationWired = false;
  /** All technician notes sync to service call `internal_comms` (office / AI Report Reviewer). */
  var internalCloudDebounce = null;
  /** Avoid reloading notes when the hub refreshes for the same ticket (e.g. location blur). */
  var dictationNotesBoundTicketId = null;
  var pendingCapture = null;
  /** @type {{ logicalId: string, row: object } | null} */
  var verifiedModalContext = null;

  var SYSTEM_INSTRUCTION = [
    "You are an HVAC field-notes assistant and data-mapper. Follow every rule below.",
    "",
    "OUTPUT: Return ONLY valid JSON (no markdown fences) with exactly these keys:",
    '- "improvedNotes": string — the technician’s notes after a **light copy-edit only** (see RULES FOR improvedNotes).',
    '- "identifiedAssetIds": array of strings like ["RTU1","RTU2","VH1","EF1"]',
    '- "locationTransposed": string, standardized as "CUSTOMER - CITY - STREET" using ALL CAPS for the three parts; use hyphens with spaces as shown. If unknown, use best effort from context or empty string "".',
    '- "visitSummary": one short sentence summarizing the visit.',
    "",
    "RULES FOR improvedNotes (non‑negotiable — do not overhaul the technician’s text):",
    "- **Preserve** what the technician said: same facts, same order of ideas, same bullets/lines/paragraph breaks unless a **minimal** grammar fix requires a tiny adjustment.",
    "- **Allowed edits only:** spelling corrections, obvious typos, standard punctuation, sentence-boundary fixes, and capitalization where clearly wrong.",
    "- **Forbidden:** rewriting for tone or “polish,” removing first‑person or informal voice, turning notes into customer-facing marketing copy, summarizing, shortening, expanding with new details, or rephrasing that changes meaning.",
    "- If the text is already acceptable, return it **unchanged** or with **only** tiny fixes.",
    "",
    "SLANG → STANDARD CODES (for identifiedAssetIds):",
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
  ].join("\n");

  /** Improve-with-AI when #svcDiagnosticsFields is visible (SERVICE hub): grammar/punctuation on combined findings/repairs + recommendations; extracts quote parts & labor; never fills #dictationHubNotes. */
  var SYSTEM_INSTRUCTION_DIAGNOSTICS = [
    "You are an HVAC field-notes assistant and data-mapper. Follow every rule below.",
    "",
    "INPUT: The user message contains labeled blocks: Findings / diagnosis & repairs made, and Recommendations (some may be omitted if empty).",
    "",
    "OUTPUT: Return ONLY valid JSON (no markdown fences) with exactly these keys:",
    '- "findingsDiagnosticsRepairs": string — light copy-edit of the combined findings/diagnosis and repairs text (see RULES FOR TEXT FIELDS). If empty or missing, use "".',
    '- "recommendations": string — light copy-edit of Recommendations. If empty/missing, use "".',
    '- "quoteParts": string — parts, equipment, or materials explicitly mentioned in Recommendations that need to be ordered or quoted for the repair (item name + quantity, e.g. "1 GAS VALVE, 1 INDUCER MOTOR"). Copy exact item names and quantities from the text. If none mentioned, use "".',
    '- "quoteLabor": string — labor time or hours mentioned in Recommendations for completing the repair (e.g. "3 HOURS", "half day"). If not mentioned anywhere in Recommendations, use "".',
    '- "identifiedAssetIds": array of strings like ["RTU1","RTU2","VH1","EF1"]',
    '- "locationTransposed": string, standardized as "CUSTOMER - CITY - STREET" using ALL CAPS for the three parts; use hyphens with spaces as shown. If unknown, use best effort from context or empty string "".',
    '- "visitSummary": one short sentence summarizing the visit.',
    "",
    "RULES FOR TEXT FIELDS findingsDiagnosticsRepairs and recommendations (non‑negotiable):",
    "- **Preserve** what the technician said: same facts, same order of ideas, same bullets/lines/paragraph breaks unless a **minimal** grammar fix requires a tiny adjustment.",
    "- **Allowed edits only:** spelling corrections, obvious typos, standard punctuation, sentence-boundary fixes, and capitalization where clearly wrong.",
    "- **Forbidden:** rewriting for tone or “polish,” removing first‑person or informal voice, customer-facing marketing copy, summarizing, shortening, expanding with new details, or rephrasing that changes meaning.",
    "- If a field’s text is already acceptable, return it **unchanged** or with **only** tiny fixes.",
    "",
    "SLANG → STANDARD CODES (for identifiedAssetIds):",
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
  ].join("\n");

  function isDiagnosticsImproveWithAiContext() {
    var diagFields = document.getElementById("svcDiagnosticsFields");
    if (!diagFields) return false;
    return !diagFields.classList.contains("hidden");
  }

  function collectDiagnosticsTextForAi() {
    var dEl = document.getElementById("diagnosis");
    var recEl = document.getElementById("recommendations");
    var d = dEl ? String(dEl.value || "").trim() : "";
    var rec = recEl ? String(recEl.value || "").trim() : "";
    var parts = [];
    if (d) parts.push("Findings / diagnosis & repairs made:\n" + d);
    if (rec) parts.push("Recommendations:\n" + rec);
    return parts.join("\n\n");
  }

  function pickParsedString(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj[k] != null) return String(obj[k]);
    }
    return null;
  }

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
    return "gemini-2.0-flash";
  }

  /** Strip markdown code fences (```json / ```) before JSON.parse; used by processVisitNotes and similar. */
  function cleanGeminiJsonString(text) {
    var t = String(text || "").trim();
    if (!t) return t;
    t = t.replace(/```json/gi, "").replace(/```/g, "").trim();
    return t;
  }

  function parseGeminiJson(text) {
    if (!text) return null;
    var t = cleanGeminiJsonString(text);
    try {
      return JSON.parse(t);
    } catch (e) {
      var o = t.indexOf("{");
      var c = t.lastIndexOf("}");
      if (o >= 0 && c > o) {
        try {
          return JSON.parse(t.slice(o, c + 1));
        } catch (e2) { /* continue */ }
      }
      o = t.indexOf("[");
      c = t.lastIndexOf("]");
      if (o >= 0 && c > o) {
        try {
          return JSON.parse(t.slice(o, c + 1));
        } catch (e3) { /* continue */ }
      }
      return null;
    }
  }

  function getNotesEl() {
    return document.getElementById("dictationHubNotes");
  }

  /** Re-sync from URL (iframe navigation) and set body class so Shadow + Office Override CSS applies. */
  function syncVcOfficeOverrideFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      window.VC_OFFICE_OVERRIDE =
        p.get("office_override") === "1" &&
        !!String(p.get("forceTicketId") || "").trim();
      if (window.VC_OFFICE_OVERRIDE === true && document.body) {
        document.body.classList.add("vc-office-override");
      }
    } catch (e) {}
  }

  function unlockDictationNotesForOfficeOverride() {
    syncVcOfficeOverrideFromUrl();
    if (typeof window === "undefined" || window.VC_OFFICE_OVERRIDE !== true) return;
    var el = getNotesEl();
    if (!el) return;
    el.removeAttribute("readonly");
    el.removeAttribute("disabled");
  }

  function wireOfficeNoteButton() {
    syncVcOfficeOverrideFromUrl();
    var btn = document.getElementById("btnInsertOfficeNote");
    if (!btn) return;
    btn.style.display = window.VC_OFFICE_OVERRIDE === true ? "inline-block" : "none";
    if (btn.dataset.vcOfficeNoteWired === "1") return;
    btn.dataset.vcOfficeNoteWired = "1";
    btn.addEventListener("click", function () {
      var el = getNotesEl();
      if (!el) return;
      var cur = el.value || "";
      var stamp = "\n\n[Office Note]: ";
      el.value = cur.trim() ? cur + stamp : "[Office Note]: ";
      el.focus();
      schedulePersistNotes();
    });
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
      return { customerId: "", siteId: "", locationLine: "" };
    }
    var locEl = document.getElementById("location");
    var locLine =
      locEl && locEl.value
        ? String(locEl.value).trim()
        : activeTicket.customerName + " - " + (activeTicket.locationAddress || "");
    return {
      customerId: sanitizePathSegment(activeTicket.customerName || ""),
      siteId: sanitizePathSegment(locLine),
      locationLine: locLine,
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

  /* Phase 34e — tray no longer renders a per-row “add” card; use Equipment Hub
     (🗄️ View Site Equipment next to History) → footer “+ Add New Equipment”. */
  function buildAddEquipmentCardHtml() {
    return "";
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
        openVisionHubAddEquipment();
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

  async function processVisitNotes(text, processOpts) {
    processOpts = processOpts || {};
    var diagnosticsMode = processOpts.diagnostics === true;
    var _laborPromptNeeded = false;
    var raw = String(text || "").trim();
    if (!raw) {
      throw new Error(
        diagnosticsMode
          ? "Enter findings, repairs, and/or recommendations before processing."
          : "Enter some notes before processing."
      );
    }
    if (isVcTimeTrackingOnlySeat()) {
      throw new Error("Time tracking seat — AI dictation is disabled for this account.");
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

    var userPayload = diagnosticsMode
      ? "SERVICE diagnostics fields — apply ONLY grammar, spelling, and punctuation fixes per field. Do not rewrite or change meaning.\n\n" +
        raw +
        "\n\nCurrent location field (may help standardize locationTransposed):\n" +
        (locCtx || "(empty)") +
        "\n\nRespond with JSON only."
      : "Technician notes — apply ONLY grammar, spelling, and punctuation fixes. Do not rewrite or change meaning.\n\n" +
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
        parts: [{ text: diagnosticsMode ? SYSTEM_INSTRUCTION_DIAGNOSTICS : SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPayload }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: diagnosticsMode ? 1536 : 1024,
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

    if (!diagnosticsMode) {
      var improvedNotes =
        parsed.improvedNotes != null
          ? String(parsed.improvedNotes).trim()
          : parsed.improved_notes != null
            ? String(parsed.improved_notes).trim()
            : "";
      if (improvedNotes) {
        var notesElImprove = getNotesEl();
        if (notesElImprove) {
          notesElImprove.value = improvedNotes;
          schedulePersistNotes();
        }
      }
    } else {
      var mergedOut = pickParsedString(parsed, [
        "findingsDiagnosticsRepairs",
        "findings_diagnostics_repairs",
        "findingsDiagnosisRepairs",
      ]);
      var dOut = pickParsedString(parsed, ["diagnosis", "findingsDiagnosis", "findings_diagnosis"]);
      var rOut = pickParsedString(parsed, ["repairsMade", "repairs_made"]);
      var recOut = pickParsedString(parsed, ["recommendations", "recommendation"]);
      var dField = document.getElementById("diagnosis");
      var rField = document.getElementById("repairsMade");
      var recField = document.getElementById("recommendations");
      if (mergedOut != null && dField) {
        dField.value = mergedOut;
        if (rField) rField.value = "";
      } else if (dField) {
        var dv = dOut != null ? String(dOut).trim() : "";
        var rv = rOut != null ? String(rOut).trim() : "";
        dField.value = dv && rv ? dv + "\n\n" + rv : dv || rv || "";
        if (rField) rField.value = "";
      }
      if (recOut != null && recField) recField.value = recOut;

      // Parse quoteParts and quoteLabor from recommendations and prefill Parts & Quote Info
      var qPartsOut = pickParsedString(parsed, ["quoteParts", "quote_parts"]);
      var qLaborOut = pickParsedString(parsed, ["quoteLabor", "quote_labor"]);
      var qpField = document.getElementById("quoteParts");
      var qlField = document.getElementById("quoteLabor");
      var accPartsSvc = document.getElementById("acc-parts-svc");

      if (qPartsOut && String(qPartsOut).trim() && qpField && !qpField.value.trim()) {
        qpField.value = String(qPartsOut).trim();
        try { if (typeof autoGrow === "function") autoGrow(qpField); } catch (_e) {}
      }
      if (qLaborOut && String(qLaborOut).trim() && qlField && !qlField.value.trim()) {
        qlField.value = String(qLaborOut).trim();
      }

      // Open the accordion if AI contributed any quote data or we need to prompt for labor
      var qpAfter = qpField ? qpField.value.trim() : "";
      var qlAfter = qlField ? qlField.value.trim() : "";
      if (qpAfter || qLaborOut) {
        if (accPartsSvc) accPartsSvc.classList.add("open");
      }

      // Prompt the user to fill in labor when parts are listed but labor is still missing
      if (qpAfter && !qlAfter) {
        _laborPromptNeeded = true;
        if (accPartsSvc) accPartsSvc.classList.add("open");
        if (qlField) setTimeout(function () { qlField.focus(); }, 150);
      }

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

    if (_laborPromptNeeded) {
      setProcessStatus("", "⚠️ Parts & Quote Info (section 2) — enter labor hours to complete the quote.");
    } else {
      setProcessStatus("done", "✓ Grammar & punctuation pass");
    }
  }

  function storageKeyForTicket() {
    if (typeof activeTicket === "undefined" || !activeTicket || !activeTicket.id) {
      return "dictationHubNotes_draft";
    }
    return "dictationHubNotes_" + activeTicket.id;
  }

  /** Prefer unified key; fall back to legacy Inter-Office-only cache. */
  function loadNotesTextForTicketId(ticketId) {
    if (!ticketId) return "";
    try {
      var u = localStorage.getItem("dictationHubNotes_" + ticketId);
      if (u != null && String(u).trim() !== "") return u;
      var leg = localStorage.getItem("dictationHubInternal_" + ticketId);
      return leg != null ? leg : "";
    } catch (e) {
      return "";
    }
  }

  function persistCurrentBufferToStorage() {
    var el = getNotesEl();
    if (!el) return;
    try {
      if (typeof activeTicket === "undefined" || !activeTicket || !activeTicket.id) {
        localStorage.setItem("dictationHubNotes_draft", el.value);
        return;
      }
      localStorage.setItem("dictationHubNotes_" + activeTicket.id, el.value);
    } catch (e) {}
  }

  function loadNotesBuffer() {
    var el = getNotesEl();
    if (!el) return;
    try {
      if (typeof activeTicket === "undefined" || !activeTicket || !activeTicket.id) {
        var d = localStorage.getItem("dictationHubNotes_draft");
        el.value = d != null ? d : "";
        return;
      }
      el.value = loadNotesTextForTicketId(activeTicket.id);
    } catch (e) {
      el.value = "";
    }
  }

  /** KI-002 Plan A3 — lazy-injected "tap to retry" banner under the dictation textarea.
   *  Visible only after a save failed; tapping retries the most recent payload. */
  function ensureNotesErrorBannerInDom() {
    var el = document.getElementById("dictationHubNotesError");
    if (el) return el;
    var notesEl = document.getElementById("dictationHubNotes");
    if (!notesEl || !notesEl.parentNode) return null;
    try {
      el = document.createElement("div");
      el.id = "dictationHubNotesError";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.style.cssText = [
        "display:none", "margin-top:6px", "padding:8px 10px",
        "background:rgba(220,38,38,0.10)", "color:#dc2626",
        "border:1px solid rgba(220,38,38,0.45)", "border-radius:6px",
        "font:13px/1.3 ui-sans-serif,system-ui,sans-serif", "cursor:pointer",
        "user-select:none", "-webkit-user-select:none"
      ].join(";");
      el.textContent = "⚠ note not synced — tap to retry";
      notesEl.parentNode.insertBefore(el, notesEl.nextSibling);
      el.addEventListener("click", function () {
        var pending = el.dataset.pending || "";
        var pendingTid = el.dataset.tid || "";
        if (!pendingTid) { el.style.display = "none"; return; }
        el.textContent = "⏳ retrying…";
        runInternalCloudSave(pendingTid, pending, true);
      });
    } catch (e) { return null; }
    return el;
  }
  function setNotesErrorVisible(show, tid, payload) {
    var el = ensureNotesErrorBannerInDom();
    if (!el) return;
    if (show) {
      el.dataset.pending = String(payload || "");
      el.dataset.tid = String(tid || "");
      el.textContent = "⚠ note not synced — tap to retry";
      el.style.display = "block";
    } else {
      el.style.display = "none";
    }
  }

  function runInternalCloudSave(ticketId, payload, isRetry) {
    var _db = firebase.firestore();
    var _sc =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.serviceCalls(_db)
        : _db.collection("service_calls");
    var patch = {
      /* internal_comms is a string per "last writer wins" (KI-002, no merge logic). */
      internal_comms: payload,
      internal_comms_updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    var p =
      typeof VCFirestore !== "undefined" && VCFirestore.setServiceCallMerged
        ? VCFirestore.setServiceCallMerged(_db, ticketId, patch, true)
        : _sc.doc(ticketId).set(patch, { merge: true });
    p.then(function () {
      setNotesErrorVisible(false);
    }).catch(function (err) {
      if (typeof VCSurfaceWriteFailure === "function") {
        VCSurfaceWriteFailure("DictationHub.internal_comms" + (isRetry ? ":retry" : ""), err);
      }
      setNotesErrorVisible(true, ticketId, payload);
    });
  }

  function scheduleInternalCloudSave(text) {
    if (isVcTimeTrackingOnlySeat()) return;
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    if (typeof activeTicket === "undefined" || !activeTicket || !activeTicket.id) return;
    if (internalCloudDebounce) clearTimeout(internalCloudDebounce);
    var ticketId = activeTicket.id;
    var payload = String(text || "");
    internalCloudDebounce = setTimeout(function () {
      internalCloudDebounce = null;
      runInternalCloudSave(ticketId, payload, false);
    }, 800);
  }

  /**
   * Live mirror of `internal_comms` for the active ticket so the technician sees
   * what office staff is typing during Office Override (and vice versa). We avoid
   * clobbering the textarea while the local user is actively typing in it.
   */
  function unsubscribeInternalCommsOnly() {
    if (typeof internalCommsUnsub === "function") {
      try { internalCommsUnsub(); } catch (e) {}
    }
    internalCommsUnsub = null;
    internalCommsBoundTicketId = null;
  }

  function subscribeInternalCommsForTicket(ticketId) {
    var tid = String(ticketId || "").trim();
    if (!tid) return;
    if (internalCommsBoundTicketId === tid && typeof internalCommsUnsub === "function") return;
    unsubscribeInternalCommsOnly();
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    var db = firebase.firestore();
    var ref =
      typeof VCFirestore !== "undefined" && VCFirestore.serviceCalls
        ? VCFirestore.serviceCalls(db).doc(tid)
        : db.collection("service_calls").doc(tid);
    internalCommsBoundTicketId = tid;
    try {
      internalCommsUnsub = ref.onSnapshot(
        function (snap) {
          if (
            typeof activeTicket === "undefined" ||
            !activeTicket ||
            activeTicket.id !== tid
          ) {
            return;
          }
          var data = snap && snap.exists ? snap.data() || {} : {};
          var t = data.internal_comms != null ? String(data.internal_comms) : "";
          var el = getNotesEl();
          if (!el) return;
          /* Don't clobber a non-empty textarea with an empty transient snapshot. */
          if (!t && el.value && el.value.trim()) return;
          /* Prior-tech notes belong in Site Intel; don't pre-fill a blank
             textarea from the initial snapshot. Live updates are still allowed
             when Office Override is active so dispatch edits reach the tech. */
          if (t && !el.value.trim() && window.VC_OFFICE_OVERRIDE !== true) return;
          /* Don't clobber the user's in-progress typing or a pending local save. */
          if (document.activeElement === el) return;
          if (internalCloudDebounce) return;
          if (notesDebounce) return;
          if (el.value === t) return;
          try { localStorage.setItem("dictationHubNotes_" + tid, t); } catch (e) {}
          el.value = t;
        },
        function (err) {
          console.warn("[DictationHub] internal_comms listener", err);
        }
      );
    } catch (e) {
      console.warn("[DictationHub] internal_comms subscribe failed", e);
    }
  }

  function fetchInternalCommsFromCloud(ticketId) {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    var _db2 = firebase.firestore();
    var _sc2 =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.serviceCalls(_db2)
        : _db2.collection("service_calls");
    var load =
      typeof VCFirestore !== "undefined" && VCFirestore.getServiceCallOnceBridged
        ? VCFirestore.getServiceCallOnceBridged(_db2, ticketId)
        : _sc2
            .doc(ticketId)
            .get()
            .then(function (snap) {
              return {
                exists: snap.exists,
                data: snap.exists ? snap.data() : null,
              };
            });
    load
      .then(function (got) {
        var data = got && got.exists && got.data ? got.data : null;
        var ic =
          data && data.internal_comms != null ? String(data.internal_comms) : "";
        var tn = data && data.techNotes != null ? String(data.techNotes) : "";
        /* Prior-tech notes priority: live thread (`internal_comms`) first; if it's
           empty fall back to the formatted final report (`techNotes`) so a
           previously-submitted historical ticket displays content the dispatcher
           already shows in its "Technician report (Field app):" panel. */
        var t = ic.trim() ? ic : tn.trim() ? tn : "";
        if (
          typeof activeTicket !== "undefined" &&
          activeTicket &&
          activeTicket.id === ticketId
        ) {
          var el = getNotesEl();
          if (!el) return;
          /* Don't clobber a non-empty textarea with an empty cloud response
             (offline, bridge mismatch, etc.). */
          if (!t && el.value && el.value.trim()) return;
          /* Prior-tech notes belong in Site Intel; don't pre-fill a blank
             textarea from the cloud on workspace open. Still update localStorage
             so the tech's own future saves are cached correctly. */
          if (t && !el.value.trim()) {
            try { localStorage.setItem("dictationHubNotes_" + ticketId, t); } catch (e) {}
            return;
          }
          /* Don't clobber the user's in-progress typing or a pending local save. */
          if (document.activeElement === el) return;
          if (internalCloudDebounce) return;
          if (notesDebounce) return;
          if (el.value === t) return;
          try {
            localStorage.setItem("dictationHubNotes_" + ticketId, t);
          } catch (e) {}
          el.value = t;
        } else {
          try {
            localStorage.setItem("dictationHubNotes_" + ticketId, t);
          } catch (e) {}
        }
      })
      .catch(function () {});
  }

  function loadNotesFromStorageForNewTicket() {
    var el = getNotesEl();
    if (!el) return;
    try {
      if (typeof activeTicket === "undefined" || !activeTicket || !activeTicket.id) {
        var v = localStorage.getItem("dictationHubNotes_draft");
        if (v != null) el.value = v;
        return;
      }
      var seed = loadNotesTextForTicketId(activeTicket.id);
      /* Only restore the tech's own in-progress notes from localStorage.
         Prior-tech notes (internal_comms / techNotes from a previous visit)
         are bridged into site_intelligence.technicianInterOfficeNotes and shown
         in the Site Intel modal — the workspace textarea starts blank for a
         fresh visit so there is no confusion about whose notes are whose. */
      el.value = seed || "";
      fetchInternalCommsFromCloud(activeTicket.id);
      subscribeInternalCommsForTicket(activeTicket.id);
    } catch (e) {}
  }

  function schedulePersistNotes() {
    var el = getNotesEl();
    if (!el) return;
    if (notesDebounce) clearTimeout(notesDebounce);
    notesDebounce = setTimeout(function () {
      notesDebounce = null;
      try {
        if (typeof activeTicket === "undefined" || !activeTicket || !activeTicket.id) {
          localStorage.setItem("dictationHubNotes_draft", el.value);
          return;
        }
        localStorage.setItem("dictationHubNotes_" + activeTicket.id, el.value);
        scheduleInternalCloudSave(el.value);
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
          '<p class="dictation-action-tray-empty">No assets for this customer/site yet. Open <strong>🗄️ View Site Equipment</strong> next to History, then use <strong>+ Add New Equipment (AI Scanner)</strong> in the hub — or try <strong>✨ Improve with AI</strong> on your notes to discover units.</p>';
        applyRosettaOverlay();
        return;
      }
      tray.innerHTML =
        '<p class="dictation-action-tray-empty">No assets returned. Open <strong>🗄️ View Site Equipment</strong> next to History and add equipment from the hub.</p>';
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
    unsubscribeInternalCommsOnly();
    lastDictationTicketId = null;
    dictationNotesBoundTicketId = null;
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
    var tid = typeof activeTicket !== "undefined" && activeTicket && activeTicket.id ? activeTicket.id : null;
    if (tid !== dictationNotesBoundTicketId) {
      dictationNotesBoundTicketId = tid;
      loadNotesFromStorageForNewTicket();
    } else {
      loadNotesBuffer();
    }
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
    /* Phase 33 (ADR-011 §2) — read via the bridged equipment helper so the
       Action Tray sees CSV-imported + field-added rows alongside the legacy
       per-site assets. The bridge merges by unit identity (unitType+unitNumber
       → unitTag → docId), with `imported_equipment` winning on conflict. */
    if (
      typeof VCFirestore !== "undefined" &&
      typeof VCFirestore.subscribeEquipmentForSiteBridged === "function"
    ) {
      assetsUnsub = VCFirestore.subscribeEquipmentForSiteBridged(
        db,
        customerId,
        siteId,
        locLine,
        function (rows) {
          rows.sort(function (a, b) {
            return String(a.id).localeCompare(String(b.id));
          });
          renderActionTray(rows);
        },
        function (err) {
          console.error("[DictationHub] equipment bridge listener", err);
          if (tray) {
            tray.innerHTML =
              '<p class="dictation-action-tray-empty">Could not load assets. ' +
              escapeHtml(err.message || String(err)) +
              "</p>";
          }
        }
      );
    } else {
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
            rows.push({ id: doc.id, data: doc.data() || {}, docSnap: doc });
          });
          rows.sort(function (a, b) {
            return String(a.id).localeCompare(String(b.id));
          });
          renderActionTray(rows);
        },
        function (err) {
          console.error("[DictationHub] assets listener (legacy fallback)", err);
          if (tray) {
            tray.innerHTML =
              '<p class="dictation-action-tray-empty">Could not load assets. ' +
              escapeHtml(err.message || String(err)) +
              "</p>";
          }
        }
      );
    }
  }

  function onProcessNotesClick() {
    if (isVcTimeTrackingOnlySeat()) {
      alert("Time tracking seat — AI processing is disabled. Contact the office to upgrade.");
      return;
    }
    var diagnosticsCtx = isDiagnosticsImproveWithAiContext();
    var raw;
    if (diagnosticsCtx) {
      raw = collectDiagnosticsTextForAi();
      if (!String(raw || "").trim()) {
        alert("Enter findings, repairs, and/or recommendations before processing.");
        return;
      }
    } else {
      var el = getNotesEl();
      raw = el ? el.value : "";
    }
    var btn = document.getElementById("dictationProcessBtn");
    setProcessStatus("", "…");
    if (btn) btn.disabled = true;
    processVisitNotes(raw, diagnosticsCtx ? { diagnostics: true } : undefined)
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
  window.getDictationExportMode = function () {
    return "internal";
  };
  window.getPublicDictationNotesForReport = function () {
    if (typeof activeTicket === "undefined" || !activeTicket || !activeTicket.id) {
      try {
        return (localStorage.getItem("dictationHubNotes_draft") || "").trim();
      } catch (e) {
        return "";
      }
    }
    try {
      var id = activeTicket.id;
      var u = localStorage.getItem("dictationHubNotes_" + id);
      if (u != null && String(u).trim() !== "") return String(u).trim();
      var leg = localStorage.getItem("dictationHubInternal_" + id);
      return (leg != null ? String(leg) : "").trim();
    } catch (e2) {
      return "";
    }
  };
  window.startDictationHubFromWorkspace = function () {
    unlockDictationNotesForOfficeOverride();
    wireOfficeNoteButton();
    wireProcessButton();
    wireVisionHubOnce();
    if (!document.documentElement.dataset.dictationPlateOcrEvt) {
      document.documentElement.dataset.dictationPlateOcrEvt = "1";
      document.addEventListener("dictationHubNameplateImageSaved", function () {
        setProcessStatus("", "⏳ Reading nameplate…");
      });
    }
    startDictationHubAssetsListener();
  };

  var visionHubPendingFile = null;
  var visionHubWired = false;

  /* Phase 33 (ADR-011 §4) — runtime state captured when the Vision Hub form
     opens or when the unit identity changes. `lastLoadedValues` is the field
     diff baseline used by visionHubSaveEquipment to decide which fieldEdits
     to stamp (per the user's "stamp only what the tech actually changed"
     directive). `lastLoadedDocId` lets us write back into the same
     `imported_equipment` doc for an existing slot instead of duplicating. */
  var visionHubIdentityState = {
    lastLoadedDocId: "",
    lastLoadedSource: "",
    lastLoadedValues: {},
    lastLookupIdentity: "",
  };

  /** Lower-case canonicalization shared with shared/firebase_logic.js bridge. */
  function visionHubNormalizeLocationKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  /** Normalize a string field for diff (treats undefined/null/whitespace as ""). */
  function visionHubNormFieldValue(v) {
    if (v == null) return "";
    return String(v).trim();
  }

  function visionHubGetUnitType() {
    var sel = document.getElementById("visionHubUnitType");
    var v = sel && sel.value ? String(sel.value).trim() : "";
    if (v === "Other") {
      var other = document.getElementById("visionHubUnitTypeOther");
      var raw = other && other.value ? String(other.value).trim().toUpperCase() : "";
      return raw.replace(/[^A-Z0-9]+/g, "").slice(0, 24);
    }
    return v;
  }

  function visionHubGetUnitNumber() {
    var n = document.getElementById("visionHubUnitNumber");
    if (!n || !n.value) return "";
    return String(n.value).trim().replace(/^\s+|\s+$/g, "");
  }

  function visionHubBuildUnitTag(unitType, unitNumber) {
    var ut = String(unitType || "").trim();
    var un = String(unitNumber || "").trim();
    if (!ut || !un) return "";
    return ut + un;
  }

  function visionHubFieldEditDocId(customerId, siteId, unitTag) {
    var raw =
      String(customerId || "") +
      "|" +
      String(siteId || "") +
      "|" +
      String(unitTag || "");
    var h = 5381;
    for (var i = 0; i < raw.length; i++) {
      h = (h * 33) ^ raw.charCodeAt(i);
    }
    return "vc_field_eq_" + (h >>> 0).toString(16);
  }

  function visionHubPopulateUnitTypeDropdown() {
    var sel = document.getElementById("visionHubUnitType");
    if (!sel || sel.dataset.vcPopulated === "1") return;
    sel.dataset.vcPopulated = "1";
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— Select —";
    sel.appendChild(opt0);
    var prefixes =
      typeof window !== "undefined" && Array.isArray(window.VC_EQUIPMENT_TYPE_PREFIXES)
        ? window.VC_EQUIPMENT_TYPE_PREFIXES
        : [];
    prefixes.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p && p.id ? String(p.id) : "";
      o.textContent = p && p.label ? String(p.label) : o.value;
      if (o.value) sel.appendChild(o);
    });
    var optOther = document.createElement("option");
    optOther.value = "Other";
    optOther.textContent = "Other (freeform)";
    sel.appendChild(optOther);
  }

  function visionHubResetIdentityState() {
    visionHubIdentityState = {
      lastLoadedDocId: "",
      lastLoadedSource: "",
      lastLoadedValues: {},
      lastLookupIdentity: "",
    };
  }

  function visionHubUpdateTagPreview() {
    var preview = document.getElementById("visionHubUnitTagPreview");
    if (!preview) return;
    var tag = visionHubBuildUnitTag(visionHubGetUnitType(), visionHubGetUnitNumber());
    if (!tag) {
      preview.classList.remove("has-tag");
      preview.textContent = "Pick a unit type + number to set the slot.";
      return;
    }
    preview.classList.add("has-tag");
    var mode =
      visionHubIdentityState.lastLookupIdentity === tag &&
      visionHubIdentityState.lastLoadedDocId
        ? "edit"
        : "add";
    preview.innerHTML =
      'Slot: <span class="vc-tag">' +
      escapeHtml(tag) +
      '</span><span class="vc-tag-mode' +
      (mode === "edit" ? " is-edit" : "") +
      '">' +
      (mode === "edit" ? "Edit existing" : "New slot") +
      "</span>";
  }

  function visionHubShowSaveError(msg) {
    var err = document.getElementById("visionHubSaveError");
    if (!err) return;
    if (!msg) {
      err.classList.add("hidden");
      err.textContent = "";
      return;
    }
    err.classList.remove("hidden");
    err.textContent = String(msg);
  }

  /**
   * Lookup an existing imported_equipment row for the current site + unit identity.
   * Resolves to {docId, source, values} or null.
   * Uses the bridge so it sees both new (customerId/siteId-tagged) and legacy CSV (normalizedLocationKey-tagged) docs.
   */
  function visionHubLookupExistingSlot(site, unitTag) {
    if (!site || !site.customerId || !site.siteId || !unitTag) {
      return Promise.resolve(null);
    }
    if (
      typeof firebase === "undefined" ||
      !firebase.apps ||
      !firebase.apps.length ||
      typeof VCFirestore === "undefined" ||
      typeof VCFirestore.getEquipmentForSiteBridged !== "function"
    ) {
      return Promise.resolve(null);
    }
    return VCFirestore.getEquipmentForSiteBridged(
      firebase.firestore(),
      site.customerId,
      site.siteId,
      site.locationLine || ""
    )
      .then(function (rows) {
        for (var i = 0; i < rows.length; i++) {
          if (String(rows[i].id) === String(unitTag)) {
            return {
              docId: rows[i].importedDocId || "",
              source: rows[i].source,
              values: rows[i].data || {},
            };
          }
        }
        return null;
      })
      .catch(function (err) {
        if (typeof VCSurfaceWriteFailure === "function") {
          VCSurfaceWriteFailure("visionHubLookupExistingSlot", err);
        }
        return null;
      });
  }

  /**
   * Refresh `visionHubIdentityState` for the current unit identity and pre-fill
   * empty form fields with the existing values (so the diff at save time sees
   * what the tech started from). Triggered on unitType / unitNumber change.
   */
  function visionHubRefreshIdentityLookup() {
    var site = getDictationSiteContext();
    var ut = visionHubGetUnitType();
    var un = visionHubGetUnitNumber();
    var tag = visionHubBuildUnitTag(ut, un);
    if (!tag) {
      visionHubResetIdentityState();
      visionHubUpdateTagPreview();
      return;
    }
    if (visionHubIdentityState.lastLookupIdentity === tag) {
      visionHubUpdateTagPreview();
      return;
    }
    visionHubIdentityState.lastLookupIdentity = tag;
    visionHubLookupExistingSlot(site, tag).then(function (hit) {
      if (visionHubIdentityState.lastLookupIdentity !== tag) return;
      if (!hit) {
        visionHubIdentityState.lastLoadedDocId = "";
        visionHubIdentityState.lastLoadedSource = "";
        visionHubIdentityState.lastLoadedValues = {};
        visionHubUpdateTagPreview();
        return;
      }
      visionHubIdentityState.lastLoadedDocId = hit.docId || "";
      visionHubIdentityState.lastLoadedSource = hit.source || "";
      visionHubIdentityState.lastLoadedValues = hit.values || {};
      var v = hit.values || {};
      var prefillMap = {
        visionHubMake: v.manufacturer || v.brand || "",
        visionHubModel: v.modelNumber || v.model || "",
        visionHubSerial: v.serialNumber || "",
        visionHubBtu: v.heatingCapacityBtu || v.coolingCapacityBtu || "",
      };
      Object.keys(prefillMap).forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !el.value && prefillMap[id]) {
          el.value = String(prefillMap[id]);
        }
      });
      visionHubUpdateTagPreview();
    });
  }

  function closeVisionHubAddEquipment() {
    var overlay = document.getElementById("visionHubAddEquipment");
    if (overlay) {
      overlay.classList.add("hidden");
    }
    document.body.style.overflow = "";
    visionHubPendingFile = null;
    var prev = document.getElementById("visionHubPreviewImg");
    if (prev) {
      try {
        if (prev.src && prev.src.indexOf("blob:") === 0) {
          URL.revokeObjectURL(prev.src);
        }
      } catch (eRev) {}
      prev.removeAttribute("src");
    }
    var wrap = document.getElementById("visionHubPreviewWrap");
    if (wrap) wrap.classList.add("hidden");
    var intro = document.getElementById("visionHubCaptureIntro");
    var form = document.getElementById("visionHubStepForm");
    if (intro) intro.classList.remove("hidden");
    if (form) form.classList.add("hidden");
    var cam = document.getElementById("visionHubCameraInput");
    if (cam) cam.value = "";
    var st = document.getElementById("visionHubStatus");
    if (st) st.textContent = "";
    visionHubShowSaveError("");
    visionHubResetIdentityState();
  }

  function openVisionHubAddEquipment() {
    wireVisionHubOnce();
    var site = getDictationSiteContext();
    if (!site.customerId || !site.siteId) {
      alert("Set location on this ticket first.");
      return;
    }
    var overlay = document.getElementById("visionHubAddEquipment");
    if (!overlay) {
      alert("Vision Hub is not available. Reload the Field App.");
      return;
    }
    visionHubPendingFile = null;
    var prev = document.getElementById("visionHubPreviewImg");
    if (prev) {
      try {
        if (prev.src && prev.src.indexOf("blob:") === 0) {
          URL.revokeObjectURL(prev.src);
        }
      } catch (ePrev) {}
      prev.removeAttribute("src");
    }
    var wrap = document.getElementById("visionHubPreviewWrap");
    if (wrap) wrap.classList.add("hidden");
    var intro = document.getElementById("visionHubCaptureIntro");
    var form = document.getElementById("visionHubStepForm");
    if (intro) intro.classList.remove("hidden");
    if (form) form.classList.add("hidden");
    var st = document.getElementById("visionHubStatus");
    if (st) st.textContent = "";
    visionHubShowSaveError("");
    visionHubPopulateUnitTypeDropdown();
    visionHubResetIdentityState();
    [
      "visionHubUnitNumber",
      "visionHubUnitTypeOther",
      "visionHubModel",
      "visionHubSerial",
      "visionHubBtu",
      "visionHubMake",
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });
    var typeSel = document.getElementById("visionHubUnitType");
    if (typeSel) typeSel.value = "";
    var otherRow = document.getElementById("visionHubUnitTypeOtherRow");
    if (otherRow) otherRow.classList.add("hidden");
    visionHubUpdateTagPreview();
    var cam = document.getElementById("visionHubCameraInput");
    if (cam) cam.value = "";
    overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function visionHubOnFileSelected(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) return;
    if (isVcTimeTrackingOnlySeat()) {
      alert("Time tracking seat — Vision Hub is disabled.");
      return;
    }
    if (typeof window.dictationPreviewNameplateFromFile !== "function") {
      alert("Equipment engine not loaded. Refresh the page.");
      return;
    }
    visionHubPendingFile = file;
    var intro = document.getElementById("visionHubCaptureIntro");
    var form = document.getElementById("visionHubStepForm");
    var prev = document.getElementById("visionHubPreviewImg");
    var wrap = document.getElementById("visionHubPreviewWrap");
    if (wrap) wrap.classList.remove("hidden");
    if (prev) {
      try {
        prev.src = URL.createObjectURL(file);
      } catch (eBlob) {}
    }
    var st = document.getElementById("visionHubStatus");
    if (st) st.textContent = "⏳ Reading nameplate…";
    if (intro) intro.classList.add("hidden");
    window
      .dictationPreviewNameplateFromFile(file)
      .then(function (fields) {
        if (st) st.textContent = "";
        var mk = document.getElementById("visionHubMake");
        var md = document.getElementById("visionHubModel");
        var sn = document.getElementById("visionHubSerial");
        var bt = document.getElementById("visionHubBtu");
        if (mk && fields.manufacturer && !mk.value) mk.value = fields.manufacturer;
        if (md && fields.modelNumber && !md.value) md.value = fields.modelNumber;
        if (sn && fields.serialNumber && !sn.value) sn.value = fields.serialNumber;
        if (bt && fields.heatingCapacityBtu && !bt.value) bt.value = fields.heatingCapacityBtu;
        if (form) form.classList.remove("hidden");
      })
      .catch(function (err) {
        if (st) st.textContent = "";
        console.error("[VisionHub] preview OCR", err);
        alert(err && err.message ? err.message : "Could not read nameplate. Enter fields manually.");
        if (form) form.classList.remove("hidden");
      });
  }

  /**
   * Phase 33 (ADR-011 §1, §2, §3, §4) — Field-Add / Field-Edit Equipment writer.
   *
   * Writes go to the canonical store:
   *     tenants/{tenantId}/imported_equipment/{docId}
   *
   * Behavior:
   *  - Identity = `unitType` + `unitNumber` (e.g. RTU + 4 → RTU4).
   *  - On open, the form pre-loads existing values for that identity from the
   *    bridge and stores them on `visionHubIdentityState.lastLoadedValues`.
   *  - On save we diff the new field values against `lastLoadedValues` and
   *    only stamp `fieldEdits[<fieldName>] = { by, at }` for fields that
   *    actually CHANGED — never for fields the tech merely viewed.
   *  - For brand-new slots, `source: "field"`, `addedBy`, `addedAt` are set
   *    and `fieldEdits` is stamped for every captured field.
   *  - The nameplate photo is uploaded to Firebase Storage and its download
   *    URL is stored on the same doc (no legacy `customers/.../assets` write).
   *
   * Failure surfacing follows KI-002 Plan A: VCRequireTicketId for ticket
   * gating, VCSurfaceWriteFailure for diagnostics + a user-visible red error
   * banner inline in the form.
   */
  function visionHubSaveEquipment() {
    visionHubShowSaveError("");
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      visionHubShowSaveError("Firebase not available.");
      return;
    }
    var site = getDictationSiteContext();
    if (!site.customerId || !site.siteId) {
      visionHubShowSaveError("Set location on this ticket first.");
      return;
    }
    var unitType = visionHubGetUnitType();
    var unitNumber = visionHubGetUnitNumber();
    if (!unitType) {
      visionHubShowSaveError("Pick a unit type (or 'Other' for a custom prefix).");
      return;
    }
    if (!unitNumber) {
      visionHubShowSaveError("Enter a unit number (e.g. 4 for RTU4).");
      return;
    }
    var unitTag = visionHubBuildUnitTag(unitType, unitNumber);
    if (!unitTag) {
      visionHubShowSaveError("Could not build a unit identity from those values.");
      return;
    }

    /* KI-002 Plan A — visionHubSaveEquipment writes are unit-scoped (they
       target tenants/{tenantId}/imported_equipment/{docId}), NOT
       ticket-scoped, so we deliberately don't gate via VCRequireTicketId
       here. We still funnel failures through VCSurfaceWriteFailure on the
       error path so the debug overlay surfaces them. */

    var prevValues = visionHubIdentityState.lastLoadedValues || {};
    var prevLookupTag = visionHubIdentityState.lastLookupIdentity;
    /* If the tech changed unitType/unitNumber after we loaded a baseline,
       the cached values no longer apply — treat as a brand-new slot. */
    var baselineMatches = prevLookupTag === unitTag;
    var baseline = baselineMatches ? prevValues : {};
    var existingDocId = baselineMatches ? visionHubIdentityState.lastLoadedDocId : "";
    var existingSource = baselineMatches ? visionHubIdentityState.lastLoadedSource : "";

    var newValues = {
      unitType: unitType,
      unitNumber: unitNumber,
      unitTag: unitTag,
      manufacturer: visionHubNormFieldValue(
        (document.getElementById("visionHubMake") || {}).value
      ),
      modelNumber: visionHubNormFieldValue(
        (document.getElementById("visionHubModel") || {}).value
      ),
      serialNumber: visionHubNormFieldValue(
        (document.getElementById("visionHubSerial") || {}).value
      ),
      heatingCapacityBtu: visionHubNormFieldValue(
        (document.getElementById("visionHubBtu") || {}).value
      ),
    };

    /* Diff against baseline → which fields did the tech actually change?
       For brand-new slots (no baseline) every captured field counts as a
       change so the field-edit stamp covers the whole row. */
    var isNewSlot = !existingDocId;
    var changedFields = {};
    Object.keys(newValues).forEach(function (k) {
      var nv = visionHubNormFieldValue(newValues[k]);
      if (!nv) return;
      var ov = visionHubNormFieldValue(baseline[k]);
      if (isNewSlot || nv !== ov) {
        changedFields[k] = nv;
      }
    });

    /* If this is an EDIT and nothing actually changed (and there's no new
       photo), don't write — just close. */
    if (!isNewSlot && Object.keys(changedFields).length === 0 && !visionHubPendingFile) {
      visionHubShowSaveError("No changes to save.");
      return;
    }

    var techProfile = "";
    try {
      if (typeof currentTechProfile !== "undefined" && currentTechProfile) {
        techProfile = String(currentTechProfile);
      }
    } catch (eProf) {}
    if (!techProfile) techProfile = "field";

    var st = document.getElementById("visionHubStatus");
    if (st) st.textContent = visionHubPendingFile ? "⏳ Uploading photo…" : "⏳ Saving…";

    /* Resolve the doc path:
       - Existing imported_equipment doc → keep its docId.
       - New slot → deterministic id keyed on customer|site|unitTag so two
         techs can't race-create two docs for the same physical unit. */
    var docId = existingDocId || visionHubFieldEditDocId(site.customerId, site.siteId, unitTag);
    var dbInst = firebase.firestore();
    var collRef =
      typeof VCFirestore !== "undefined" && typeof VCFirestore.tenantImportedEquipment === "function"
        ? VCFirestore.tenantImportedEquipment(dbInst)
        : dbInst.collection("tenants").doc("default").collection("imported_equipment");
    var docRef = collRef.doc(docId);

    var serverTs = firebase.firestore.FieldValue.serverTimestamp();
    var nowMs = Date.now();

    var photoPromise = visionHubPendingFile
      ? visionHubUploadNameplatePhoto(site, unitTag, visionHubPendingFile).catch(function (err) {
          /* Non-fatal: we still want to save the field edits even if the
             photo upload fails. Surface it loudly though. */
          if (typeof VCSurfaceWriteFailure === "function") {
            VCSurfaceWriteFailure("visionHubUploadNameplatePhoto", err);
          }
          console.warn("[VisionHub] photo upload failed", err);
          return null;
        })
      : Promise.resolve(null);

    photoPromise
      .then(function (photoUrl) {
        if (st) st.textContent = "⏳ Saving…";
        var patch = {
          customerId: site.customerId,
          siteId: site.siteId,
          locationLine: site.locationLine || "",
          normalizedLocationKey: visionHubNormalizeLocationKey(site.locationLine || ""),
          unitTag: unitTag,
          unitType: unitType,
          unitNumber: unitNumber,
          updatedAt: serverTs,
          updatedAtMs: nowMs,
          updatedBy: techProfile,
        };
        Object.keys(changedFields).forEach(function (k) {
          patch[k] = changedFields[k];
        });
        if (photoUrl) {
          patch.nameplatePhotoUrl = photoUrl;
          patch.nameplatePhotoUpdatedAt = serverTs;
          changedFields.nameplatePhotoUrl = photoUrl;
        }
        if (isNewSlot) {
          patch.source = "field";
          patch.addedBy = techProfile;
          patch.addedAt = serverTs;
          patch.addedAtMs = nowMs;
        } else if (existingSource === "csv") {
          /* Preserve provenance — don't overwrite the CSV source flag, but
             record that a field tech has touched this row. */
          patch.lastFieldEditAt = serverTs;
          patch.lastFieldEditBy = techProfile;
        }
        var fieldEditsPatch = {};
        Object.keys(changedFields).forEach(function (k) {
          fieldEditsPatch["fieldEdits." + k] = {
            by: techProfile,
            at: serverTs,
          };
        });
        /* Use update() with dotted-path keys so we MERGE into the existing
           fieldEdits map without clobbering edits to other fields. For new
           docs we have to set() first because update() would 404. */
        if (isNewSlot) {
          var seedFieldEdits = {};
          Object.keys(changedFields).forEach(function (k) {
            seedFieldEdits[k] = { by: techProfile, at: serverTs };
          });
          patch.fieldEdits = seedFieldEdits;
          return docRef.set(patch, { merge: true });
        }
        return docRef.set(patch, { merge: true }).then(function () {
          if (Object.keys(fieldEditsPatch).length === 0) return null;
          return docRef.update(fieldEditsPatch);
        });
      })
      .then(function () {
        if (st) st.textContent = "";
        setProcessStatus("done", isNewSlot ? "✓ Equipment added" : "✓ Equipment updated");
        closeVisionHubAddEquipment();
        if (typeof saveDraft === "function") saveDraft();
      })
      .catch(function (err) {
        if (st) st.textContent = "";
        console.error("[VisionHub] save", err);
        if (typeof VCSurfaceWriteFailure === "function") {
          VCSurfaceWriteFailure("visionHubSaveEquipment", err);
        }
        visionHubShowSaveError(
          (err && err.message ? err.message : String(err)) +
            " — tap Save to retry."
        );
      });
  }

  /**
   * Upload a nameplate photo to Firebase Storage under
   *     tenants/default/imported_equipment_photos/{customerId}/{siteId}/{unitTag}/nameplate-{ts}.jpg
   * and resolve to its download URL. We deliberately keep this OUT of the
   * legacy `customers/.../assets` photo path so Phase 33 writes touch the
   * single canonical store only.
   */
  function visionHubUploadNameplatePhoto(site, unitTag, file) {
    if (!file) return Promise.resolve(null);
    if (typeof firebase === "undefined" || !firebase.storage) {
      return Promise.reject(new Error("Firebase Storage not available."));
    }
    var safeCustomer = sanitizePathSegment(site.customerId || "unknown");
    var safeSite = sanitizePathSegment(site.siteId || "unknown");
    var safeTag = sanitizePathSegment(unitTag || "unknown");
    var ext = "jpg";
    if (file.name) {
      var m = String(file.name).match(/\.([a-zA-Z0-9]{1,5})$/);
      if (m) ext = m[1].toLowerCase();
    } else if (file.type) {
      var t = String(file.type).toLowerCase();
      if (t.indexOf("png") >= 0) ext = "png";
      else if (t.indexOf("webp") >= 0) ext = "webp";
      else if (t.indexOf("heic") >= 0) ext = "heic";
    }
    var tenantId =
      typeof VCFirestore !== "undefined" && typeof VCFirestore.getTenantId === "function"
        ? VCFirestore.getTenantId() || "default"
        : "default";
    var path =
      "tenants/" +
      tenantId +
      "/imported_equipment_photos/" +
      safeCustomer +
      "/" +
      safeSite +
      "/" +
      safeTag +
      "/nameplate-" +
      Date.now() +
      "." +
      ext;
    var ref = firebase.storage().ref().child(path);
    return ref
      .put(file, { contentType: file.type || "image/jpeg" })
      .then(function () {
        return ref.getDownloadURL();
      });
  }

  function wireVisionHubOnce() {
    if (visionHubWired) return;
    var overlay = document.getElementById("visionHubAddEquipment");
    if (!overlay) return;
    visionHubWired = true;
    var closeBtn = document.getElementById("visionHubCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeVisionHubAddEquipment);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeVisionHubAddEquipment();
    });
    var cam = document.getElementById("visionHubCameraInput");
    var capBtn = document.getElementById("visionHubCaptureBtn");
    if (capBtn && cam) {
      capBtn.addEventListener("click", function () {
        cam.value = "";
        cam.click();
      });
    }
    if (cam) {
      cam.addEventListener("change", function () {
        var f = cam.files && cam.files[0];
        if (f) visionHubOnFileSelected(f);
      });
    }
    var saveBtn = document.getElementById("visionHubSaveBtn");
    if (saveBtn) saveBtn.addEventListener("click", visionHubSaveEquipment);
    /* Phase 33 — wire the unitType + unitNumber identity controls. */
    visionHubPopulateUnitTypeDropdown();
    var typeSel = document.getElementById("visionHubUnitType");
    var numEl = document.getElementById("visionHubUnitNumber");
    var otherRow = document.getElementById("visionHubUnitTypeOtherRow");
    var otherInput = document.getElementById("visionHubUnitTypeOther");
    if (typeSel) {
      typeSel.addEventListener("change", function () {
        if (otherRow) {
          if (typeSel.value === "Other") otherRow.classList.remove("hidden");
          else otherRow.classList.add("hidden");
        }
        visionHubRefreshIdentityLookup();
      });
    }
    if (numEl) {
      numEl.addEventListener("input", visionHubUpdateTagPreview);
      numEl.addEventListener("change", visionHubRefreshIdentityLookup);
      numEl.addEventListener("blur", visionHubRefreshIdentityLookup);
    }
    if (otherInput) {
      otherInput.addEventListener("input", visionHubUpdateTagPreview);
      otherInput.addEventListener("change", visionHubRefreshIdentityLookup);
      otherInput.addEventListener("blur", visionHubRefreshIdentityLookup);
    }
    if (!document.documentElement.dataset.visionHubEsc) {
      document.documentElement.dataset.visionHubEsc = "1";
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        var o = document.getElementById("visionHubAddEquipment");
        if (o && !o.classList.contains("hidden")) closeVisionHubAddEquipment();
      });
    }
  }
})();
