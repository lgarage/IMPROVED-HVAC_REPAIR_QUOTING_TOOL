/**
 * Work order forms — static (Standard PM, Repair Quote), Firestore form_templates,
 * Gemini keyword intent, equipment flags (direct drive, mini-split).
 */
(function () {
  "use strict";

  function sanitizePathSegment(s) {
    return (
      String(s || "")
        .trim()
        .replace(/[/\\]+/g, "_")
        .replace(/\s+/g, " ")
        .slice(0, 200) || "unknown"
    );
  }

  function pad2(n) {
    var x = Number(n);
    return x < 10 ? "0" + x : String(x);
  }

  function todayYmd() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  var FORM_TEMPLATES = {
    standard_pm: {
      id: "standard_pm",
      title: "Standard PM",
      fields: [
        { name: "filterSize", label: "Filter Size", type: "text", placeholder: "e.g. 20x25x2", group: "filter" },
        { name: "beltSize", label: "Belt Size", type: "text", placeholder: "e.g. A44", group: "belt" },
        { name: "notes", label: "Notes", type: "textarea", placeholder: "PM observations", group: "notes" },
      ],
    },
    repair_quote: {
      id: "repair_quote",
      title: "Repair Quote",
      fields: [
        { name: "description", label: "Description", type: "textarea", placeholder: "Scope of repair" },
        { name: "partsList", label: "Parts (one per line)", type: "textarea", placeholder: "Part A\nPart B" },
        { name: "laborHours", label: "Labor Hours", type: "number", step: "0.25", min: "0", placeholder: "0" },
      ],
    },
  };

  var currentFormId = null;
  var dynamicTemplateDoc = null;
  /**
   * Phase 34c — provenance tag set by the caller before the dynamic-form modal
   * opens (e.g. `"repair_branch"` for the Service Call additional-repair
   * accordion). Threaded into the `field_form_submissions` payload + the
   * `vc:fieldFormSaved` event so the repair-branch accordion can mark its
   * chip as "Saved" without needing a Firestore round-trip. Cleared on
   * close + after each save dispatch.
   */
  var pendingTriggeredBy = null;

  /** Repair quote: both mandatory equipment photos must exist before save. */
  var quoteEvidenceState = {
    ok: false,
    overallPhotoUrl: null,
    dataPlatePhotoUrl: null,
  };

  function parseEquipmentCompositeId(equipmentId) {
    var parts = String(equipmentId || "").split("/");
    if (parts.length < 3) return null;
    return {
      customerId: parts[0],
      locationId: parts[1],
      unitDocId: parts.slice(2).join("/"),
    };
  }

  function getEquipmentDocRef(equipmentId) {
    var p = parseEquipmentCompositeId(equipmentId);
    if (!p || typeof firebase === "undefined" || !firebase.apps.length) return null;
    return firebase
      .firestore()
      .collection("Customers")
      .doc(p.customerId)
      .collection("Locations")
      .doc(p.locationId)
      .collection("Equipment")
      .doc(p.unitDocId);
  }

  /**
   * Returns whether the equipment record has overall + data plate photo URLs.
   */
  async function verifyEquipmentEvidence(equipmentId) {
    var scanVal =
      typeof window.SCAN_NEW_EQUIPMENT_VALUE !== "undefined"
        ? window.SCAN_NEW_EQUIPMENT_VALUE
        : "__TP_SCAN_NEW_EQUIPMENT__";
    if (!equipmentId || String(equipmentId).trim() === "" || equipmentId === scanVal) {
      return {
        ok: false,
        overallPhotoUrl: null,
        dataPlatePhotoUrl: null,
        reason: "no_equipment",
      };
    }
    if (typeof firebase === "undefined" || !firebase.apps.length) {
      return {
        ok: false,
        overallPhotoUrl: null,
        dataPlatePhotoUrl: null,
        reason: "offline",
      };
    }
    var ref = getEquipmentDocRef(equipmentId);
    if (!ref) {
      return {
        ok: false,
        overallPhotoUrl: null,
        dataPlatePhotoUrl: null,
        reason: "bad_id",
      };
    }
    try {
      var snap = await ref.get();
      if (!snap.exists) {
        return {
          ok: false,
          overallPhotoUrl: null,
          dataPlatePhotoUrl: null,
          reason: "missing_doc",
        };
      }
      var d = snap.data() || {};
      var o = d.overallPhotoUrl && String(d.overallPhotoUrl).trim();
      var p = d.dataPlatePhotoUrl && String(d.dataPlatePhotoUrl).trim();
      return {
        ok: !!(o && p),
        overallPhotoUrl: o || null,
        dataPlatePhotoUrl: p || null,
        reason: o && p ? "ok" : "incomplete",
      };
    } catch (e) {
      console.error("[field_forms] verifyEquipmentEvidence", e);
      return {
        ok: false,
        overallPhotoUrl: null,
        dataPlatePhotoUrl: null,
        reason: "error",
      };
    }
  }

  function renderQuoteMandatoryEvidenceHtml() {
    return (
      "<div class=\"quote-mandatory-evidence\" id=\"quoteMandatoryEvidenceWrap\">" +
      "<div class=\"quote-evidence-title\">Required equipment evidence</div>" +
      "<p class=\"quote-evidence-hint\">A repair quote requires an overall unit photo and a data plate photo on file for the selected equipment.</p>" +
      "<div id=\"quoteEvidenceStatus\" class=\"quote-evidence-status\"></div>" +
      "<div id=\"quoteEvidenceVerifiedPanel\" class=\"quote-evidence-verified-panel hidden\">" +
      "<div class=\"quote-verified-head\">" +
      "<span class=\"quote-verified-check\" aria-hidden=\"true\">✓</span>" +
      "<span id=\"quoteVerifiedUnitLabel\"></span>" +
      "</div>" +
      "<p class=\"quote-verified-msg\">Identity Confirmed. No new unit photos required.</p>" +
      "<div class=\"quote-evidence-ghost-grid\">" +
      "<div><span class=\"quote-ghost-label\">Overall</span><div id=\"quoteGhostOverall\" class=\"quote-evidence-ghost-wrap\"></div></div>" +
      "<div><span class=\"quote-ghost-label\">Data plate</span><div id=\"quoteGhostPlate\" class=\"quote-evidence-ghost-wrap\"></div></div>" +
      "</div>" +
      "<button type=\"button\" class=\"quote-issue-photo-btn\" id=\"quoteIssuePhotoOptionalBtn\">📸 Add Issue Photo (Optional)</button>" +
      "</div>" +
      "<div id=\"quoteEvidenceRows\" class=\"quote-evidence-rows\">" +
      "<div class=\"quote-evidence-row\" id=\"quoteEvidenceRowOverall\">" +
      "<label class=\"field-form-label\" for=\"quoteOverallEvidenceInput\">📸 Capture overall unit photo</label>" +
      "<input type=\"file\" accept=\"image/*;capture=camera\" id=\"quoteOverallEvidenceInput\" class=\"field-form-file\"/>" +
      "<div id=\"quoteOverallEvidencePreview\" class=\"quote-evidence-preview hidden\"></div>" +
      "</div>" +
      "<div class=\"quote-evidence-row\" id=\"quoteEvidenceRowPlate\">" +
      "<label class=\"field-form-label\" for=\"quotePlateEvidenceInput\">📸 Capture data plate photo</label>" +
      "<input type=\"file\" accept=\"image/*;capture=camera\" id=\"quotePlateEvidenceInput\" class=\"field-form-file\"/>" +
      "<div id=\"quotePlateEvidencePreview\" class=\"quote-evidence-preview hidden\"></div>" +
      "</div>" +
      "</div>" +
      "<div id=\"quoteEvidenceOkBadge\" class=\"quote-evidence-ok hidden\">✓ Overall and data plate photos on file for this unit.</div>" +
      "</div>"
    );
  }

  function setQuoteSaveEnabled(enabled) {
    var btn = document.getElementById("fieldFormSaveBtn");
    if (!btn || currentFormId !== "repair_quote") return;
    btn.disabled = !enabled;
    btn.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  function applyQuoteEvidenceUi(ev) {
    quoteEvidenceState = {
      ok: !!ev.ok,
      overallPhotoUrl: ev.overallPhotoUrl || null,
      dataPlatePhotoUrl: ev.dataPlatePhotoUrl || null,
    };
    var statusEl = document.getElementById("quoteEvidenceStatus");
    var okBadge = document.getElementById("quoteEvidenceOkBadge");
    var rows = document.getElementById("quoteEvidenceRows");
    var rowO = document.getElementById("quoteEvidenceRowOverall");
    var rowP = document.getElementById("quoteEvidenceRowPlate");
    var prevO = document.getElementById("quoteOverallEvidencePreview");
    var prevP = document.getElementById("quotePlateEvidencePreview");
    var inpO = document.getElementById("quoteOverallEvidenceInput");
    var inpP = document.getElementById("quotePlateEvidenceInput");

    if (statusEl) {
      if (ev.reason === "no_equipment") {
        statusEl.innerHTML =
          "<span class=\"quote-evidence-warn\">Select equipment above, then add photos if needed.</span>";
      } else if (ev.reason === "offline") {
        statusEl.innerHTML =
          "<span class=\"quote-evidence-warn\">Connect to the internet to verify equipment photos.</span>";
      } else if (!ev.ok && ev.reason === "missing_doc") {
        statusEl.innerHTML =
          "<span class=\"quote-evidence-warn\">Equipment record not found.</span>";
      } else if (!ev.ok && (ev.reason === "bad_id" || ev.reason === "error")) {
        statusEl.innerHTML =
          "<span class=\"quote-evidence-warn\">Could not verify equipment photos. Try again.</span>";
      } else if (ev.ok) {
        statusEl.innerHTML = "";
      } else {
        statusEl.innerHTML =
          "<span class=\"quote-evidence-warn\">Capture the missing photo(s) below. They are saved to this equipment profile.</span>";
      }
    }

    if (okBadge) {
      okBadge.classList.add("hidden");
    }

    var verifiedPanel = document.getElementById("quoteEvidenceVerifiedPanel");
    var ghostO = document.getElementById("quoteGhostOverall");
    var ghostP = document.getElementById("quoteGhostPlate");
    var unitLabelEl = document.getElementById("quoteVerifiedUnitLabel");
    var issueBtn = document.getElementById("quoteIssuePhotoOptionalBtn");

    function showUrlPreview(container, url) {
      if (!container) return;
      if (url) {
        container.innerHTML =
          "<a href=\"" +
          escapeAttr(url) +
          "\" target=\"_blank\" rel=\"noopener\"><img src=\"" +
          escapeAttr(url) +
          "\" alt=\"\" class=\"quote-evidence-thumb\"/></a>";
        container.classList.remove("hidden");
      } else {
        container.innerHTML = "";
        container.classList.add("hidden");
      }
    }

    if (ev.ok) {
      if (rows) rows.classList.add("hidden");
      if (verifiedPanel) verifiedPanel.classList.remove("hidden");
      if (ghostO) {
        ghostO.innerHTML = ev.overallPhotoUrl
          ? "<img src=\"" +
            escapeAttr(ev.overallPhotoUrl) +
            "\" alt=\"\" class=\"quote-evidence-thumb--ghost\"/>"
          : "";
      }
      if (ghostP) {
        ghostP.innerHTML = ev.dataPlatePhotoUrl
          ? "<img src=\"" +
            escapeAttr(ev.dataPlatePhotoUrl) +
            "\" alt=\"\" class=\"quote-evidence-thumb--ghost\"/>"
          : "";
      }
      var selEq = document.getElementById("fieldFormEquipmentSelect");
      var optEq = selEq && selEq.options[selEq.selectedIndex];
      var rawLabel = optEq && optEq.textContent ? String(optEq.textContent) : "Unit";
      var uname =
        rawLabel.indexOf("🛡️") >= 0
          ? rawLabel.split("🛡️")[0].trim()
          : rawLabel.trim();
      if (unitLabelEl) unitLabelEl.textContent = uname;
      if (issueBtn) {
        issueBtn.onclick = function () {
          var inp = document.getElementById("quotePhotosInput");
          if (inp) {
            try {
              inp.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch (e1) {}
            setTimeout(function () {
              inp.click();
            }, 250);
          }
        };
      }
      if (prevO) {
        prevO.innerHTML = "";
        prevO.classList.add("hidden");
      }
      if (prevP) {
        prevP.innerHTML = "";
        prevP.classList.add("hidden");
      }
      if (inpO) inpO.classList.add("hidden");
      if (inpP) inpP.classList.add("hidden");
    } else {
      if (verifiedPanel) verifiedPanel.classList.add("hidden");
      if (ghostO) ghostO.innerHTML = "";
      if (ghostP) ghostP.innerHTML = "";
      if (rows) rows.classList.remove("hidden");

      if (ev.overallPhotoUrl) {
        showUrlPreview(prevO, ev.overallPhotoUrl);
        if (inpO) inpO.classList.add("hidden");
      } else {
        if (prevO) {
          prevO.innerHTML = "";
          prevO.classList.add("hidden");
        }
        if (inpO) inpO.classList.remove("hidden");
      }
      if (ev.dataPlatePhotoUrl) {
        showUrlPreview(prevP, ev.dataPlatePhotoUrl);
        if (inpP) inpP.classList.add("hidden");
      } else {
        if (prevP) {
          prevP.innerHTML = "";
          prevP.classList.add("hidden");
        }
        if (inpP) inpP.classList.remove("hidden");
      }
    }

    setQuoteSaveEnabled(!!ev.ok && currentFormId === "repair_quote");
  }

  function updateFieldFormEquipmentVerifiedHint() {
    var row = document.getElementById("fieldFormEquipmentVerifiedRow");
    var sel = document.getElementById("fieldFormEquipmentSelect");
    if (!row || !sel) return;
    var scanVal =
      typeof window.SCAN_NEW_EQUIPMENT_VALUE !== "undefined"
        ? window.SCAN_NEW_EQUIPMENT_VALUE
        : "__TP_SCAN_NEW_EQUIPMENT__";
    var eid =
      sel.value && sel.value !== scanVal ? String(sel.value).trim() : "";
    if (!eid) {
      row.classList.add("hidden");
      row.innerHTML = "";
      return;
    }
    verifyEquipmentEvidence(eid).then(function (v) {
      if (!v.ok) {
        row.classList.add("hidden");
        row.innerHTML = "";
        return;
      }
      var opt = sel.options[sel.selectedIndex];
      var raw = opt && opt.textContent ? String(opt.textContent) : "Unit";
      var label =
        raw.indexOf("🛡️") >= 0 ? raw.split("🛡️")[0].trim() : raw.trim();
      row.innerHTML =
        "<span class=\"ff-ev-check\" aria-hidden=\"true\">✓</span> " +
        escapeHtml(label) +
        " — <span style=\"font-weight:700;color:#1e6b3a\">Identity Verified: Photos & Specs on file.</span>";
      row.classList.remove("hidden");
    });
  }

  function wireFieldFormEquipmentVerifiedHint() {
    var sel = document.getElementById("fieldFormEquipmentSelect");
    if (!sel) return;
    if (sel.dataset.verifiedHintWired === "1") {
      updateFieldFormEquipmentVerifiedHint();
      return;
    }
    sel.dataset.verifiedHintWired = "1";
    sel.addEventListener("change", updateFieldFormEquipmentVerifiedHint);
    updateFieldFormEquipmentVerifiedHint();
  }

  async function runQuoteEvidenceCheck() {
    if (currentFormId !== "repair_quote") return;
    var sel = document.getElementById("fieldFormEquipmentSelect");
    var eid = sel && sel.value ? String(sel.value).trim() : "";
    var scanVal =
      typeof window.SCAN_NEW_EQUIPMENT_VALUE !== "undefined"
        ? window.SCAN_NEW_EQUIPMENT_VALUE
        : "__TP_SCAN_NEW_EQUIPMENT__";
    if (!eid || eid === scanVal) {
      applyQuoteEvidenceUi({
        ok: false,
        overallPhotoUrl: null,
        dataPlatePhotoUrl: null,
        reason: "no_equipment",
      });
      updateFieldFormEquipmentVerifiedHint();
      return;
    }
    var v = await verifyEquipmentEvidence(eid);
    var ev = {
      ok: v.ok,
      overallPhotoUrl: v.overallPhotoUrl,
      dataPlatePhotoUrl: v.dataPlatePhotoUrl,
      reason: v.reason
        ? v.reason
        : v.ok
          ? "ok"
          : "incomplete",
    };
    applyQuoteEvidenceUi(ev);
    updateFieldFormEquipmentVerifiedHint();
  }

  async function uploadQuoteMandatoryEvidenceAndMerge(equipmentId, file, kind) {
    await loadFirebaseStorageCompat();
    var storage = firebase.storage();
    var path =
      "field_quote_evidence/" +
      sanitizePathSegment(equipmentId) +
      "/" +
      kind +
      "_" +
      Date.now() +
      ".jpg";
    var ref = storage.ref().child(path);
    var uploadMeta = { contentType: file.type || "image/jpeg" };
    try {
      await ref.put(file, uploadMeta);
    } catch (_putErr) {
      if (typeof VCStorageOutbox !== "undefined") {
        var _p = parseEquipmentCompositeId(equipmentId);
        VCStorageOutbox.enqueue(ref.fullPath, file, uploadMeta, _p ? {
          hook: "fieldFormEquipmentPhoto",
          payload: {
            docPath: "Customers/" + _p.customerId + "/Locations/" + _p.locationId + "/Equipment/" + _p.unitDocId,
            field: kind === "overall" ? "overallPhotoUrl" : "dataPlatePhotoUrl",
          },
        } : null);
      }
      console.warn("[FieldForms] quote evidence upload failed — queued for retry", _putErr);
      throw _putErr;
    }
    var url = await ref.getDownloadURL();
    var refDoc = getEquipmentDocRef(equipmentId);
    if (!refDoc) throw new Error("Bad equipment path");
    var patch =
      kind === "overall"
        ? { overallPhotoUrl: url }
        : { dataPlatePhotoUrl: url };
    patch.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await refDoc.set(patch, { merge: true });
    return url;
  }

  function wireRepairQuoteEvidenceUi() {
    var sel = document.getElementById("fieldFormEquipmentSelect");
    if (sel) {
      sel.addEventListener("change", function () {
        runQuoteEvidenceCheck();
      });
    }
    var inpO = document.getElementById("quoteOverallEvidenceInput");
    var inpP = document.getElementById("quotePlateEvidenceInput");
    if (inpO) {
      inpO.addEventListener("change", function () {
        var f = inpO.files && inpO.files[0];
        var sel2 = document.getElementById("fieldFormEquipmentSelect");
        var eid = sel2 && sel2.value ? String(sel2.value).trim() : "";
        if (!f || !eid) return;
        inpO.disabled = true;
        uploadQuoteMandatoryEvidenceAndMerge(eid, f, "overall")
          .then(function () {
            inpO.value = "";
            inpO.disabled = false;
            return runQuoteEvidenceCheck();
          })
          .catch(function (e) {
            console.error(e);
            alert("Upload failed: " + (e.message || e));
            inpO.disabled = false;
          });
      });
    }
    if (inpP) {
      inpP.addEventListener("change", function () {
        var f = inpP.files && inpP.files[0];
        var sel2 = document.getElementById("fieldFormEquipmentSelect");
        var eid = sel2 && sel2.value ? String(sel2.value).trim() : "";
        if (!f || !eid) return;
        inpP.disabled = true;
        uploadQuoteMandatoryEvidenceAndMerge(eid, f, "plate")
          .then(function () {
            inpP.value = "";
            inpP.disabled = false;
            return runQuoteEvidenceCheck();
          })
          .catch(function (e) {
            console.error(e);
            alert("Upload failed: " + (e.message || e));
            inpP.disabled = false;
          });
      });
    }
    runQuoteEvidenceCheck();
  }

  /** Cached rows from form_templates; kept fresh via onSnapshot. */
  var formTemplatesCache = null;
  var formTemplatesUnsubscribe = null;

  /* Slice 63b — localStorage key for offline form-template persistence */
  var LS_FORM_TEMPLATES_CACHE_KEY = "vc_form_templates_cache";

  function saveFormTemplatesLocalCache(rows) {
    try {
      localStorage.setItem(LS_FORM_TEMPLATES_CACHE_KEY, JSON.stringify(rows));
    } catch (e) { /* quota exceeded — degrade silently */ }
  }

  function loadFormTemplatesLocalCache() {
    try {
      var raw = localStorage.getItem(LS_FORM_TEMPLATES_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Phase 34a — inject toggle (Yes/No slider) styles once. Lives here so the
   * dispatcher Settings preview AND the Field App both pick up the same CSS
   * without touching technician/index.html beyond the cache-bust.
   */
  function ensureToggleStylesInjected() {
    if (document.getElementById("vcFieldFormToggleStyles")) return;
    var s = document.createElement("style");
    s.id = "vcFieldFormToggleStyles";
    s.textContent =
      ".field-toggle-row{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:8px 0;}" +
      ".field-toggle-row .field-toggle-label{flex:1;font-size:14px;color:#222;}" +
      ".field-toggle-switch{position:relative;display:inline-block;width:54px;height:30px;flex-shrink:0;}" +
      ".field-toggle-switch input{opacity:0;width:0;height:0;}" +
      ".field-toggle-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#cbd5e1;border-radius:30px;transition:background 160ms ease;}" +
      ".field-toggle-slider:before{position:absolute;content:\"\";height:24px;width:24px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:transform 160ms ease;box-shadow:0 1px 3px rgba(0,0,0,0.2);}" +
      ".field-toggle-switch input:checked + .field-toggle-slider{background:#16a085;}" +
      ".field-toggle-switch input:checked + .field-toggle-slider:before{transform:translateX(24px);}" +
      ".field-toggle-state{font-size:11px;font-weight:700;letter-spacing:0.5px;color:#94a3b8;min-width:28px;text-align:right;}" +
      ".field-toggle-state.on{color:#16a085;}" +
      ".ff-new-unit-wrap{margin:6px 0 4px;padding:10px 12px;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.22);border-radius:10px;}" +
      ".ff-new-unit-notice{font-size:13px;color:#7dd3fc;margin-bottom:10px;line-height:1.4;}" +
      ".ff-new-unit-preview{margin-top:6px;}" +
      ".ff-new-unit-preview img{max-width:100%;border-radius:6px;max-height:160px;object-fit:cover;}";
    document.head.appendChild(s);
  }

  function applyFormTemplatesSnapshot(snap) {
    var out = [];
    snap.forEach(function (doc) {
      out.push({ id: doc.id, data: doc.data() || {} });
    });
    formTemplatesCache = out;
    /* Slice 63b — persist to localStorage so triggerWords are available offline */
    saveFormTemplatesLocalCache(out);
  }

  function startFormTemplatesListener() {
    if (typeof firebase === "undefined" || !firebase.apps.length) return;
    if (formTemplatesUnsubscribe) return;
    try {
      formTemplatesUnsubscribe = firebase
        .firestore()
        .collection("form_templates")
        .onSnapshot(
          function (snap) {
            applyFormTemplatesSnapshot(snap);
          },
          function (err) {
            console.error("[field_forms] form_templates listener", err);
          }
        );
    } catch (e) {
      console.error("[field_forms] startFormTemplatesListener", e);
    }
  }

  function stopFormTemplatesListener() {
    if (formTemplatesUnsubscribe) {
      try { formTemplatesUnsubscribe(); } catch (e) { /* best-effort */ }
      formTemplatesUnsubscribe = null;
    }
    formTemplatesCache = null;
  }

  function loadFirebaseStorageCompat() {
    if (typeof firebase !== "undefined" && firebase.storage) {
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src =
        "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage-compat.js";
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("firebase-storage load failed"));
      };
      document.head.appendChild(s);
    });
  }

  function showModal() {
    ensureToggleStylesInjected();
    var m = document.getElementById("fieldFormModal");
    if (m) {
      m.classList.remove("hidden");
      m.setAttribute("aria-hidden", "false");
    }
  }

  /** Phase 34a — bind ON/OFF state labels for any rendered toggles. */
  function wireDynamicToggleStateLabels(root) {
    root = root || document;
    var toggles = root.querySelectorAll("input[data-dyn-toggle=\"1\"]");
    toggles.forEach(function (cb) {
      var stateId = "dyntoggle_state_" + (cb.id || "").replace(/^dynfield_/, "");
      var stateEl = document.getElementById(stateId);
      function apply() {
        if (!stateEl) return;
        if (cb.checked) {
          stateEl.textContent = "YES";
          stateEl.classList.add("on");
        } else {
          stateEl.textContent = "NO";
          stateEl.classList.remove("on");
        }
      }
      cb.addEventListener("change", apply);
      apply();
    });
  }

  /**
   * Inject the two-photo unit-onboarding section at the bottom of the form
   * (just above the action buttons) on the first Save tap when unit not on file.
   * Changes the save button label to "Save & Add Unit".
   */
  function injectNewUnitPhotoSection() {
    var body = document.getElementById("fieldFormModalBody");
    var actions = body && body.querySelector(".field-form-actions");
    if (!actions || document.getElementById("ffNewUnitPhotoSection")) return;

    var sel = document.getElementById("fieldFormEquipmentSelect");
    var synOpt = sel && sel.options[sel.selectedIndex];
    var unitName = synOpt
      ? String(synOpt.getAttribute("data-unit-name") || synOpt.text || "").replace(/\s*\(not yet on file\)$/i, "").trim()
      : "this unit";

    var section = document.createElement("div");
    section.id = "ffNewUnitPhotoSection";
    section.className = "ff-new-unit-wrap";
    section.innerHTML =
      '<div class="ff-new-unit-notice">\uD83D\uDCCD <strong>' + escapeHtml(unitName) + "</strong> isn\u2019t on file yet \u2014 snap these two photos to add it:</div>" +
      '<div class="field-form-fieldwrap">' +
      '<label class="field-form-label" for="ffNewUnitNameplatePhoto">\uD83D\uDCF8 Unit name tag (model + serial number) <span style="color:#e74c3c">*</span></label>' +
      '<input type="file" accept="image/*;capture=camera" id="ffNewUnitNameplatePhoto" class="field-form-file"/>' +
      '<div id="ffNewUnitNameplatePreview" class="ff-new-unit-preview hidden"></div>' +
      "</div>" +
      '<div class="field-form-fieldwrap">' +
      '<label class="field-form-label" for="ffNewUnitOverallPhoto">\uD83D\uDCF8 Overall photo of unit <span style="color:#e74c3c">*</span></label>' +
      '<input type="file" accept="image/*;capture=camera" id="ffNewUnitOverallPhoto" class="field-form-file"/>' +
      '<div id="ffNewUnitOverallPreview" class="ff-new-unit-preview hidden"></div>' +
      "</div>";

    actions.parentNode.insertBefore(section, actions);
    wireNewUnitPhotoPreview("ffNewUnitNameplatePhoto", "ffNewUnitNameplatePreview");
    wireNewUnitPhotoPreview("ffNewUnitOverallPhoto", "ffNewUnitOverallPreview");

    var saveBtn = document.getElementById("fieldFormSaveBtn");
    if (saveBtn) saveBtn.textContent = "Save & Add Unit";

    try { section.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
  }

  function closeFieldFormModal() {
    var m = document.getElementById("fieldFormModal");
    if (m) {
      m.classList.add("hidden");
      m.setAttribute("aria-hidden", "true");
    }
    currentFormId = null;
    dynamicTemplateDoc = null;
    pendingTriggeredBy = null;
    quoteEvidenceState = {
      ok: false,
      overallPhotoUrl: null,
      dataPlatePhotoUrl: null,
    };
    var body = document.getElementById("fieldFormModalBody");
    if (body) body.innerHTML = "";
  }

  /** Shared equipment options row for all equipment-related forms */
  function renderEquipmentFlagsHtml() {
    return (
      "<div class=\"field-equipment-flags\" id=\"fieldEquipmentFlags\">" +
      "<label class=\"field-form-label field-checkbox-label\">" +
      "<input type=\"checkbox\" id=\"field_isDirectDrive\"/> Direct drive (no belt)</label>" +
      "<label class=\"field-form-label\" for=\"field_equipmentType\">Equipment type</label>" +
      "<select id=\"field_equipmentType\" class=\"field-form-input\">" +
      "<option value=\"\">— Select —</option>" +
      "<option value=\"Standard\">Standard / RTU</option>" +
      "<option value=\"Mini-Split\">Mini-Split</option>" +
      "<option value=\"Other\">Other</option>" +
      "</select>" +
      "<div id=\"field_cleanedScreensWrap\" class=\"hidden\">" +
      "<label class=\"field-form-label field-checkbox-label\">" +
      "<input type=\"checkbox\" id=\"field_cleanedScreens\"/> Cleaned screens</label>" +
      "</div></div>"
    );
  }

  function wireEquipmentFieldVisibility(root) {
    root = root || document;
    var dd = root.querySelector("#field_isDirectDrive");
    var et = root.querySelector("#field_equipmentType");
    var csWrap = root.querySelector("#field_cleanedScreensWrap");
    function apply() {
      var direct = dd && dd.checked;
      var mini = et && et.value === "Mini-Split";
      root.querySelectorAll("[data-belt-group]").forEach(function (el) {
        el.style.display = direct || mini ? "none" : "";
      });
      root.querySelectorAll("[data-filter-group]").forEach(function (el) {
        el.style.display = mini ? "none" : "";
      });
      if (csWrap) {
        csWrap.classList.toggle("hidden", !mini);
      }
    }
    if (dd) dd.addEventListener("change", apply);
    if (et) et.addEventListener("change", apply);
    apply();
  }

  function wrapFieldRow(html, fieldMeta) {
    var g = fieldMeta && fieldMeta.group;
    var attrs = "";
    if (g === "belt") attrs = " data-belt-group=\"1\"";
    if (g === "filter") attrs = " data-filter-group=\"1\"";
    return "<div class=\"field-form-fieldwrap\"" + attrs + ">" + html + "</div>";
  }

  function renderForm(formTemplateId) {
    var t = FORM_TEMPLATES[formTemplateId];
    if (!t) {
      console.warn("[field_forms] Unknown template", formTemplateId);
      return;
    }
    currentFormId = formTemplateId;
    dynamicTemplateDoc = null;
    var body = document.getElementById("fieldFormModalBody");
    var titleEl = document.getElementById("fieldFormModalTitle");
    if (!body) return;
    if (titleEl) titleEl.textContent = t.title;

    var html = "<div class=\"field-form-inner\">";
    html +=
      "<label class=\"field-form-label\">Select Equipment</label>" +
      "<select id=\"fieldFormEquipmentSelect\" data-smart-equipment=\"true\" class=\"field-form-select\"></select>" +
      "<div id=\"fieldFormEquipmentVerifiedRow\" class=\"field-form-equipment-verified-row hidden\" role=\"status\" aria-live=\"polite\"></div>";

    html += renderEquipmentFlagsHtml();

    if (formTemplateId === "repair_quote") {
      html += renderQuoteMandatoryEvidenceHtml();
    }

    t.fields.forEach(function (f) {
      var inner =
        "<label class=\"field-form-label\" for=\"field_" +
        f.name +
        "\">" +
        escapeHtml(f.label) +
        "</label>";
      if (f.type === "textarea") {
        inner +=
          "<textarea id=\"field_" +
          f.name +
          "\" class=\"field-form-input\" placeholder=\"" +
          escapeAttr(f.placeholder || "") +
          "\"></textarea>";
      } else {
        inner +=
          "<input type=\"" +
          (f.type || "text") +
          "\" id=\"field_" +
          f.name +
          "\" class=\"field-form-input\" " +
          (f.step ? "step=\"" + f.step + "\" " : "") +
          (f.min != null ? "min=\"" + f.min + "\" " : "") +
          "placeholder=\"" +
          escapeAttr(f.placeholder || "") +
          "\"/>";
      }
      html += wrapFieldRow(inner, f);
    });

    if (formTemplateId === "repair_quote") {
      html +=
        "<label class=\"field-form-label\" for=\"quotePhotosInput\">Additional job photos (optional)</label>" +
        "<input type=\"file\" accept=\"image/*;capture=camera\" multiple id=\"quotePhotosInput\" class=\"field-form-file\"/>";
    }

    var saveBtnLabel = formTemplateId === "repair_quote" ? "Save quote" : "Save";
    var saveBtnDisabledAttr = formTemplateId === "repair_quote" ? " disabled" : "";
    html +=
      "<div class=\"field-form-actions\">" +
      "<button type=\"button\" class=\"field-form-btn field-form-btn-secondary\" id=\"fieldFormCancelBtn\">Cancel</button>" +
      "<button type=\"button\" class=\"field-form-btn field-form-btn-primary\" id=\"fieldFormSaveBtn\"" +
      saveBtnDisabledAttr +
      ">" +
      saveBtnLabel +
      "</button>" +
      "</div></div>";

    body.innerHTML = html;

    var sel = document.getElementById("fieldFormEquipmentSelect");
    if (sel && typeof window.refreshSmartEquipmentSelect === "function") {
      window.refreshSmartEquipmentSelect(sel, "").then(function () {
        if (typeof window.bindSmartEquipmentSelect === "function") {
          window.bindSmartEquipmentSelect(sel);
        }
        if (formTemplateId === "repair_quote") {
          wireRepairQuoteEvidenceUi();
        }
        wireFieldFormEquipmentVerifiedHint();
      });
    } else {
      if (formTemplateId === "repair_quote") {
        wireRepairQuoteEvidenceUi();
      }
      wireFieldFormEquipmentVerifiedHint();
    }

    wireEquipmentFieldVisibility(body);

    var cancel = document.getElementById("fieldFormCancelBtn");
    if (cancel) cancel.addEventListener("click", closeFieldFormModal);
    var save = document.getElementById("fieldFormSaveBtn");
    if (save) save.addEventListener("click", saveCurrentFieldForm);

    showModal();
  }

  /**
   * Firestore form_templates/{templateId}: templateName, targetKeyword, fields[], active.
   *
   * Phase 34c — accepts an optional `opts` arg. Currently the only honored
   * key is `opts.triggeredBy` (e.g. `"repair_branch"`), which is threaded
   * into the saved `field_form_submissions` payload and the
   * `vc:fieldFormSaved` event. Signature stays backward-compatible: callers
   * that pass only `templateId` keep working.
   */
  /**
   * Try to auto-select a detected unit in the equipment dropdown by fuzzy-matching
   * the option label or data-unit-tag against the detected unit name (e.g. "RTU 1").
   * Returns true if a match was selected.
   */
  function tryAutoSelectDetectedUnit(sel, detectedUnit) {
    if (!detectedUnit || !sel) return false;
    var needle = String(detectedUnit).toLowerCase().trim();
    for (var i = 0; i < sel.options.length; i++) {
      if (!sel.options[i].value) continue;
      var dataTag = String(sel.options[i].getAttribute("data-unit-tag") || "").toLowerCase();
      var optText = String(sel.options[i].text || "").toLowerCase();
      if (dataTag === needle || optText.indexOf(needle) >= 0 || (needle.length >= 3 && dataTag.indexOf(needle) >= 0)) {
        sel.value = sel.options[i].value;
        sel.dispatchEvent(new Event("change"));
        return true;
      }
    }
    return false;
  }

  /** Return HTML for the inline new-unit onboarding section (nameplate + overall photos). */
  function renderNewUnitOnboardingHtml(unitName) {
    var safe = escapeHtml(String(unitName || "this unit"));
    var safeAttr = escapeAttr(String(unitName || ""));
    return (
      '<div class="ff-new-unit-wrap" id="ffNewUnitWrap">' +
      '<input type="hidden" id="ffNewUnitName" value="' + safeAttr + '"/>' +
      '<div class="ff-new-unit-notice">📍 <strong>' + safe + "</strong> isn\u2019t on file yet \u2014 snap these to add it to the system:</div>" +
      '<div class="field-form-fieldwrap">' +
      '<label class="field-form-label" for="ffNewUnitNameplatePhoto">\uD83D\uDCF8 Model / serial number tag <span style="color:#e74c3c">*</span></label>' +
      '<input type="file" accept="image/*;capture=camera" id="ffNewUnitNameplatePhoto" class="field-form-file"/>' +
      '<div id="ffNewUnitNameplatePreview" class="ff-new-unit-preview hidden"></div>' +
      "</div>" +
      '<div class="field-form-fieldwrap">' +
      '<label class="field-form-label" for="ffNewUnitOverallPhoto">\uD83D\uDCF8 Overall unit photo <span style="color:#e74c3c">*</span></label>' +
      '<input type="file" accept="image/*;capture=camera" id="ffNewUnitOverallPhoto" class="field-form-file"/>' +
      '<div id="ffNewUnitOverallPreview" class="ff-new-unit-preview hidden"></div>' +
      "</div>" +
      "</div>"
    );
  }

  /** Wire a file input to show an image preview beneath it. */
  function wireNewUnitPhotoPreview(inputId, previewId) {
    var inp = document.getElementById(inputId);
    var prev = document.getElementById(previewId);
    if (!inp || !prev) return;
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0];
      if (!f) { prev.innerHTML = ""; prev.classList.add("hidden"); return; }
      var reader = new FileReader();
      reader.onload = function (ev) {
        prev.innerHTML = '<img src="' + ev.target.result + '" alt=""/>';
        prev.classList.remove("hidden");
      };
      reader.readAsDataURL(f);
    });
  }

  /**
   * Upload photos and create a new Equipment Firestore doc for the detected unit.
   * Returns the composite equipment ID ("customerId/locationId/docId") or null on failure.
   */
  async function createNewEquipmentFromOnboarding() {
    /* Read unit name from the synthetic dropdown option (data-unit-name attribute) */
    var sel = document.getElementById("fieldFormEquipmentSelect");
    var synOpt = sel && sel.options[sel.selectedIndex];
    var unitName = synOpt
      ? String(synOpt.getAttribute("data-unit-name") || synOpt.text || "").replace(/\s*\(not yet on file\)$/i, "").trim()
      : "";
    if (!unitName) {
      var unitNameEl = document.getElementById("ffNewUnitName");
      unitName = unitNameEl ? String(unitNameEl.value || "").trim() : "";
    }
    var etSel = document.getElementById("field_equipmentType");
    var equipmentType = etSel && etSel.value ? String(etSel.value) : "";
    var npInp = document.getElementById("ffNewUnitNameplatePhoto");
    var ovInp = document.getElementById("ffNewUnitOverallPhoto");
    var npFile = npInp && npInp.files && npInp.files[0];
    var ovFile = ovInp && ovInp.files && ovInp.files[0];
    if (!npFile) { alert("Required: photo of the model/serial number tag."); return null; }
    if (!ovFile) { alert("Required: overall unit photo."); return null; }

    var locEl = document.getElementById("location");
    var locLine = locEl && locEl.value ? String(locEl.value).trim() : "";
    var custId = sanitizePathSegment(
      typeof activeTicket !== "undefined" && activeTicket ? (activeTicket.customerName || "") : ""
    );
    var locId = sanitizePathSegment(locLine);
    if (!custId || !locId) {
      alert("Cannot save new unit: job context not loaded. Please try again.");
      return null;
    }

    try {
      await loadFirebaseStorageCompat();
      var storage = firebase.storage();
      var db = firebase.firestore();
      var ts = Date.now();

      var npPath = "equipment_photos/" + custId + "/" + locId + "/nameplate_" + ts + ".jpg";
      var npRef = storage.ref().child(npPath);
      await npRef.put(npFile, { contentType: npFile.type || "image/jpeg" });
      var npUrl = await npRef.getDownloadURL();

      var ovPath = "equipment_photos/" + custId + "/" + locId + "/overall_" + ts + ".jpg";
      var ovRef = storage.ref().child(ovPath);
      await ovRef.put(ovFile, { contentType: ovFile.type || "image/jpeg" });
      var ovUrl = await ovRef.getDownloadURL();

      var eqDoc = {
        unitTag: unitName || "Unknown",
        equipmentType: equipmentType || "",
        dataPlatePhotoUrl: npUrl,
        overallPhotoUrl: ovUrl,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        addedBy: typeof currentTechProfile !== "undefined" ? (currentTechProfile || "") : "",
      };
      var docRef = await db
        .collection("Customers").doc(custId)
        .collection("Locations").doc(locId)
        .collection("Equipment").add(eqDoc);

      var compositeId = custId + "/" + locId + "/" + docRef.id;
      try {
        window.dispatchEvent(new CustomEvent("equipmentManagerSaved", { detail: { equipmentId: compositeId } }));
      } catch (e) { /* best-effort */ }
      return compositeId;
    } catch (e) {
      console.error("[field_forms] createNewEquipmentFromOnboarding", e);
      alert("Failed to save new unit: " + (e.message || e));
      return null;
    }
  }

  /**
   * injectEquipmentPhotoPrompt — fires when the equipment select has no units on file
   * for the current site. Injects a system message into the conversational timeline
   * asking the tech to photograph the nameplate and overall unit.
   */
  function injectEquipmentPhotoPrompt(unitName) {
    var label = unitName ? unitName : "this unit";
    var msg = label + " isn\u2019t on file yet. Please take a photo of the unit nameplate " +
      "(model and serial number) and a photo of the overall unit \u2014 I\u2019ll use those to add it to the system.";
    try {
      if (window.ConversationalTimeline &&
          typeof window.ConversationalTimeline.addSystemEntry === "function") {
        window.ConversationalTimeline.addSystemEntry(msg);
      }
    } catch (e) { /* degrade silently */ }
  }

  async function renderDynamicForm(templateId, opts) {
    pendingTriggeredBy =
      opts && opts.triggeredBy ? String(opts.triggeredBy) : null;
    if (typeof firebase === "undefined" || !firebase.apps.length) {
      alert("Firebase is not available.");
      return;
    }
    var snap = await firebase
      .firestore()
      .collection("form_templates")
      .doc(templateId)
      .get();
    if (!snap.exists) {
      alert("Form template not found: " + templateId);
      return;
    }
    var data = snap.data() || {};
    var fields = Array.isArray(data.fields) ? data.fields : [];
    dynamicTemplateDoc = { id: templateId, doc: data };
    currentFormId = "dynamic:" + templateId;

    var body = document.getElementById("fieldFormModalBody");
    var titleEl = document.getElementById("fieldFormModalTitle");
    if (!body) return;
    if (titleEl) titleEl.textContent = data.templateName || "Custom form";

    var html = "<div class=\"field-form-inner\">";
    html +=
      "<label class=\"field-form-label\">Select Equipment</label>" +
      "<select id=\"fieldFormEquipmentSelect\" data-smart-equipment=\"true\" class=\"field-form-select\"></select>" +
      "<div id=\"fieldFormEquipmentVerifiedRow\" class=\"field-form-equipment-verified-row hidden\" role=\"status\" aria-live=\"polite\"></div>";
    html += "<div id=\"ffNewUnitStatusNote\" class=\"hidden\" style=\"font-size:12px;color:#7dd3fc;padding:2px 2px 6px;line-height:1.4;\"></div>";
    html += renderEquipmentFlagsHtml();

    fields.forEach(function (f, idx) {
      var name = f.name || "field_" + idx;
      var label = f.label || name;
      var typ = String(f.type || "text").toLowerCase();
      var req = f.required ? " <span style=\"color:#e74c3c\">*</span>" : "";
      var inner = "";

      if (typ === "checkbox") {
        inner =
          "<label class=\"field-form-label field-checkbox-label\">" +
          "<input type=\"checkbox\" id=\"dynfield_" +
          name +
          "\"/> <span>" +
          escapeHtml(label) +
          "</span>" +
          req +
          "</label>";
        html += wrapFieldRow(inner, f);
        return;
      }

      if (typ === "toggle") {
        inner =
          "<div class=\"field-toggle-row\">" +
          "<span class=\"field-toggle-label\">" +
          escapeHtml(label) +
          req +
          "</span>" +
          "<span class=\"field-toggle-state\" id=\"dyntoggle_state_" +
          name +
          "\">NO</span>" +
          "<label class=\"field-toggle-switch\">" +
          "<input type=\"checkbox\" id=\"dynfield_" +
          name +
          "\" data-dyn-toggle=\"1\"/>" +
          "<span class=\"field-toggle-slider\"></span>" +
          "</label>" +
          "</div>";
        html += wrapFieldRow(inner, f);
        return;
      }

      if (typ === "photo") {
        inner =
          "<label class=\"field-form-label\" for=\"dynphoto_" +
          name +
          "\">" +
          escapeHtml(label) +
          req +
          "</label>" +
          "<input type=\"file\" accept=\"image/*;capture=camera\" id=\"dynphoto_" +
          name +
          "\" class=\"field-form-file\" data-dyn-photo=\"1\"/>";
        html += wrapFieldRow(inner, f);
        return;
      }

      if (typ === "dropdown") {
        var dopts = Array.isArray(f.options) ? f.options : [];
        inner =
          "<label class=\"field-form-label\" for=\"dynfield_" +
          name +
          "\">" +
          escapeHtml(label) +
          req +
          "</label>" +
          "<select id=\"dynfield_" +
          name +
          "\" class=\"field-form-input field-form-select\">" +
          "<option value=\"\">Select...</option>";
        dopts.forEach(function (opt) {
          var o = String(opt);
          inner +=
            "<option value=\"" +
            escapeAttr(o) +
            "\">" +
            escapeHtml(o) +
            "</option>";
        });
        inner += "</select>";
        html += wrapFieldRow(inner, f);
        return;
      }

      if (typ === "multi_check") {
        var mopts = Array.isArray(f.options) ? f.options : [];
        inner =
          "<div class=\"field-form-label\">" +
          escapeHtml(label) +
          req +
          "</div>" +
          "<div class=\"dyn-multi-wrap\" id=\"dynmulti_wrap_" +
          name +
          "\">";
        mopts.forEach(function (opt, mi) {
          var o = String(opt);
          var cid = "dynmulti_" + name + "_" + mi;
          inner +=
            "<label class=\"field-form-label field-checkbox-label\">" +
            "<input type=\"checkbox\" class=\"dynmulti-item\" id=\"" +
            cid +
            "\" value=\"" +
            escapeAttr(o) +
            "\"/> <span>" +
            escapeHtml(o) +
            "</span></label>";
        });
        inner += "</div>";
        html += wrapFieldRow(inner, f);
        return;
      }

      inner =
        "<label class=\"field-form-label\" for=\"dynfield_" +
        name +
        "\">" +
        escapeHtml(label) +
        req +
        "</label>";
      if (typ === "textarea") {
        inner +=
          "<textarea id=\"dynfield_" +
          name +
          "\" class=\"field-form-input\" placeholder=\"" +
          escapeAttr(f.placeholder || "") +
          "\"></textarea>";
      } else if (typ === "number") {
        inner +=
          "<input type=\"number\" step=\"any\" id=\"dynfield_" +
          name +
          "\" class=\"field-form-input\" placeholder=\"" +
          escapeAttr(f.placeholder || "") +
          "\"/>";
      } else {
        inner +=
          "<input type=\"text\" id=\"dynfield_" +
          name +
          "\" class=\"field-form-input\" placeholder=\"" +
          escapeAttr(f.placeholder || "") +
          "\"/>";
      }
      html += wrapFieldRow(inner, f);
    });

    html +=
      "<div class=\"field-form-actions\">" +
      "<button type=\"button\" class=\"field-form-btn field-form-btn-secondary\" id=\"fieldFormCancelBtn\">Cancel</button>" +
      "<button type=\"button\" class=\"field-form-btn field-form-btn-primary\" id=\"fieldFormSaveBtn\">Save</button>" +
      "</div></div>";

    body.innerHTML = html;

    var sel = document.getElementById("fieldFormEquipmentSelect");
    var _intentOpts = opts || {};
    if (sel && typeof window.refreshSmartEquipmentSelect === "function") {
      window.refreshSmartEquipmentSelect(sel, "").then(function () {
        if (typeof window.bindSmartEquipmentSelect === "function") {
          window.bindSmartEquipmentSelect(sel);
        }
        wireFieldFormEquipmentVerifiedHint();

        /* Auto-set equipment type from checklist intent context (e.g. "Standard" for RTU) */
        if (_intentOpts.equipmentType) {
          var etSel = document.getElementById("field_equipmentType");
          if (etSel) {
            etSel.value = _intentOpts.equipmentType;
            wireEquipmentFieldVisibility(body);
          }
        }

        /* Auto-select detected unit, or add a synthetic "not yet on file" option */
        if (_intentOpts.detectedUnit) {
          var matched = tryAutoSelectDetectedUnit(sel, _intentOpts.detectedUnit);
          if (!matched) {
            /* Unit not in Firestore — add a synthetic option so the field shows the unit name */
            var safeName = escapeHtml(String(_intentOpts.detectedUnit));
            var safeAttr = escapeAttr(String(_intentOpts.detectedUnit));
            var synOpt = document.createElement("option");
            synOpt.value = "__FF_NEW_UNIT__";
            synOpt.setAttribute("data-unit-name", safeAttr);
            synOpt.textContent = _intentOpts.detectedUnit + " (not yet on file)";
            sel.appendChild(synOpt);
            sel.value = "__FF_NEW_UNIT__";
            /* Show a status note so the tech knows photos will be required on save */
            var statusNote = document.getElementById("ffNewUnitStatusNote");
            if (statusNote) {
              statusNote.textContent = "\uD83D\uDCCD " + _intentOpts.detectedUnit + " \u2014 not on file. Photos will be required when you save.";
              statusNote.classList.remove("hidden");
            }
          }
        }
      });
    } else {
      wireFieldFormEquipmentVerifiedHint();
    }

    wireEquipmentFieldVisibility(body);
    wireDynamicToggleStateLabels(body);

    var cancel = document.getElementById("fieldFormCancelBtn");
    if (cancel) cancel.addEventListener("click", closeFieldFormModal);
    var save = document.getElementById("fieldFormSaveBtn");
    if (save) save.addEventListener("click", saveCurrentFieldForm);

    showModal();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  function getTicketId() {
    var el = document.getElementById("ticketSelector");
    return el && el.value ? String(el.value).trim() : "";
  }

  function collectEquipmentFlags() {
    var dd = document.getElementById("field_isDirectDrive");
    var et = document.getElementById("field_equipmentType");
    var cs = document.getElementById("field_cleanedScreens");
    return {
      isDirectDrive: !!(dd && dd.checked),
      equipmentType: et && et.value ? String(et.value) : "",
      cleanedScreens: !!(cs && cs.checked),
    };
  }

  function parseGeminiText(text) {
    if (!text) return "";
    var t = String(text).trim();
    var fence = t.match(/```(?:\w*)?\s*([\s\S]*?)```/);
    if (fence) t = fence[1].trim();
    return t.split("\n")[0].trim();
  }

  async function fetchActiveFormTemplates() {
    /* Slice 63b — fall back to localStorage cache when Firebase is unavailable (offline) */
    if (typeof firebase === "undefined" || !firebase.apps.length) {
      var localRows = formTemplatesCache || loadFormTemplatesLocalCache();
      if (localRows) {
        return localRows.filter(function (t) { return t.data.active !== false; });
      }
      return [];
    }
    if (formTemplatesCache !== null) {
      return formTemplatesCache.filter(function (t) {
        return t.data.active !== false;
      });
    }
    var db = firebase.firestore();
    try {
      var snap = await db.collection("form_templates").get();
      applyFormTemplatesSnapshot(snap);
      return formTemplatesCache.filter(function (t) {
        return t.data.active !== false;
      });
    } catch (e) {
      console.error("[field_forms] form_templates", e);
      /* Slice 63b — Firestore query failed (offline); serve from localStorage if available */
      var offlineRows = loadFormTemplatesLocalCache();
      if (offlineRows) {
        return offlineRows.filter(function (t) { return t.data.active !== false; });
      }
    }
    return [];
  }

  /** Phase 34a — sort active templates with sortIndex (asc), then templateName. */
  function sortTemplatesForUi(rows) {
    return rows.slice().sort(function (a, b) {
      var sa = Number(a.data.sortIndex);
      var sb = Number(b.data.sortIndex);
      if (!isFinite(sa)) sa = 0;
      if (!isFinite(sb)) sb = 0;
      if (sa !== sb) return sa - sb;
      var na = String(a.data.templateName || a.id || "").toLowerCase();
      var nb = String(b.data.templateName || b.id || "").toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });
  }

  /**
   * Phase 34a — return active templates whose `assignedJobTypes` includes the
   * given job-type key (e.g. "service" / "pm" / "quote"). Sorted by sortIndex.
   * Used by the per-job-panel form chooser (Phase 34c+) to populate the
   * "Open form" lists. Caller must handle the empty-array case (no matches).
   */
  async function getTemplatesByJobType(jobType) {
    var key = String(jobType || "").trim().toLowerCase();
    if (!key) return [];
    var rows = await fetchActiveFormTemplates();
    var matched = rows.filter(function (t) {
      var arr = Array.isArray(t.data.assignedJobTypes) ? t.data.assignedJobTypes : [];
      return arr.indexOf(key) >= 0;
    });
    return sortTemplatesForUi(matched);
  }

  /**
   * Phase 34a — return active templates whose `assignedRepairTypes` includes
   * the given repair-type key (e.g. "supply_fan" / "compressor"). Sorted by
   * sortIndex. Used by the Service Call repair branching accordion (Phase
   * 34c) to surface the right checklist for each repair pill.
   */
  async function getTemplatesByRepairType(repairType) {
    var key = String(repairType || "").trim().toLowerCase();
    if (!key) return [];
    var rows = await fetchActiveFormTemplates();
    var matched = rows.filter(function (t) {
      var arr = Array.isArray(t.data.assignedRepairTypes) ? t.data.assignedRepairTypes : [];
      return arr.indexOf(key) >= 0;
    });
    return sortTemplatesForUi(matched);
  }

  /**
   * AI: if notes indicate major repair/replace of a keyword item, return template id.
   */
  async function scanNotesForFormRequirements(techNotes) {
    var notes = String(techNotes || "").trim();
    if (!notes) {
      hideFormIntentBanner();
      return null;
    }

    var templates = await fetchActiveFormTemplates();
    /* Slice 63b — build keyword list from triggerWords[] (all variants) with
       targetKeyword fallback so Gemini hears every matching phrase */
    var keywords = [];
    templates.forEach(function (t) {
      var words = Array.isArray(t.data.triggerWords) && t.data.triggerWords.length
        ? t.data.triggerWords
        : [t.data.targetKeyword || ""];
      words.forEach(function (w) {
        var tw = String(w || "").trim();
        if (tw && keywords.indexOf(tw) === -1) keywords.push(tw);
      });
    });

    if (!keywords.length) {
      hideFormIntentBanner();
      return null;
    }

    if (typeof getGeminiApiKey !== "function") {
      console.warn("[field_forms] getGeminiApiKey missing");
      hideFormIntentBanner();
      return null;
    }

    var key = await getGeminiApiKey();
    if (!key) {
      hideFormIntentBanner();
      return null;
    }

    var listStr = keywords.join(", ");
    var prompt =
      "Based on these tech notes: " +
      JSON.stringify(notes) +
      ", is the technician intending to REPAIR or REPLACE any of these specific items: [" +
      listStr +
      "]? Only return the Keyword if they are performing a major action. If they are just mentioning it (e.g., 'checked belt on motor'), return 'NONE'.\n" +
      "Reply with exactly one word or phrase: the matching keyword from the list, or NONE.";

    var model =
      typeof GEMINI_GENERATE_MODEL !== "undefined"
        ? GEMINI_GENERATE_MODEL
        : "gemini-2.5-flash";
    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      model +
      ":generateContent?key=" +
      encodeURIComponent(key);

    try {
      var res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 128 },
        }),
      });
      var data = await res.json();
      if (data.error) {
        console.error(data.error);
        hideFormIntentBanner();
        return null;
      }
      var part =
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0];
      var raw = part && part.text ? String(part.text) : "";
      var answer = parseGeminiText(raw);
      var upper = answer.toUpperCase();
      if (upper === "NONE" || !answer) {
        hideFormIntentBanner();
        return null;
      }

      var matched = null;
      var answerLower = answer.toLowerCase();
      /* Slice 63b — match Gemini's answer against triggerWords[] with targetKeyword fallback */
      templates.forEach(function (t) {
        if (matched) return;
        var words = Array.isArray(t.data.triggerWords) && t.data.triggerWords.length
          ? t.data.triggerWords
          : [t.data.targetKeyword || ""];
        for (var w = 0; w < words.length; w++) {
          var tw = String(words[w]).trim().toLowerCase();
          if (!tw) continue;
          if (answerLower === tw || answerLower.indexOf(tw) >= 0) { matched = t; break; }
        }
      });

      if (!matched) {
        hideFormIntentBanner();
        return null;
      }

      showFormIntentBanner(matched);
      return matched.id;
    } catch (e) {
      console.error("[field_forms] scanNotesForFormRequirements", e);
      hideFormIntentBanner();
      return null;
    }
  }

  function hideFormIntentBanner() {
    var el = document.getElementById("formIntentBanner");
    if (el) {
      el.classList.add("hidden");
      el.innerHTML = "";
    }
  }

  function showFormIntentBanner(templateRow) {
    var el = document.getElementById("formIntentBanner");
    if (!el) return;
    var name = templateRow.data.templateName || templateRow.id;
    el.innerHTML =
      "<div class=\"form-intent-inner\">" +
      "<button type=\"button\" class=\"form-intent-btn\" id=\"formIntentOpenBtn\">📋 Required: Open " +
      escapeHtml(name) +
      "</button>" +
      "<div id=\"formIntentVerifiedNote\" class=\"form-intent-verified-note hidden\" role=\"status\"></div>" +
      "</div>";
    el.classList.remove("hidden");
    var btn = document.getElementById("formIntentOpenBtn");
    if (btn) {
      btn.onclick = function () {
        renderDynamicForm(templateRow.id);
      };
    }
    var linked = document.getElementById("linkedEquipmentSelect");
    var eid = linked && linked.value ? String(linked.value).trim() : "";
    var note = document.getElementById("formIntentVerifiedNote");
    if (!eid || !note) return;
    verifyEquipmentEvidence(eid).then(function (v) {
      if (!v.ok || !note.parentNode) return;
      var opt = linked.options[linked.selectedIndex];
      var raw = opt && opt.textContent ? String(opt.textContent) : "Unit";
      var unitLabel =
        raw.indexOf("🛡️") >= 0 ? raw.split("🛡️")[0].trim() : raw.trim();
      note.innerHTML =
        "<span class=\"form-intent-verified-check\" aria-hidden=\"true\">✓</span> " +
        "<span class=\"form-intent-verified-text\">" +
        escapeHtml(unitLabel) +
        " — Identity Verified: Photos & Specs on file.</span>";
      note.classList.remove("hidden");
    });
  }

  function collectNotesForAiScan() {
    var parts = [];
    if (currentMode === "PM") {
      var n = document.getElementById("notes");
      if (n && n.value) parts.push(n.value);
    } else if (currentMode === "SERVICE") {
      ["reason", "diagnosis", "repairsMade", "recommendations"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.value) parts.push(el.value);
      });
    } else {
      ["quoteIssue", "quoteRepairs", "quoteTesting", "quoteRecs"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.value) parts.push(el.value);
      });
    }
    return parts.join("\n\n");
  }

  async function uploadFieldFormPhotos(files, ticketId, fieldName) {
    await loadFirebaseStorageCompat();
    var storage = firebase.storage();
    var urls = [];
    var baseTs = Date.now();
    var safeField = sanitizePathSegment(fieldName || "photo");
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (!file || !file.size) continue;
      var path =
        "field_form_evidence/" +
        sanitizePathSegment(ticketId || "no_ticket") +
        "/" +
        safeField +
        "_" +
        baseTs +
        "_" +
        i +
        ".jpg";
      var ref = storage.ref().child(path);
      var uploadMeta = { contentType: file.type || "image/jpeg" };
      try {
        await ref.put(file, uploadMeta);
        urls.push(await ref.getDownloadURL());
      } catch (_putErr) {
        if (typeof VCStorageOutbox !== "undefined") {
          VCStorageOutbox.enqueue(ref.fullPath, file, uploadMeta);
        }
        console.warn("[FieldForms] form photo upload failed — queued for retry", _putErr);
      }
    }
    return urls;
  }

  async function uploadQuotePhotos(files, ticketId) {
    await loadFirebaseStorageCompat();
    var storage = firebase.storage();
    var urls = [];
    var baseTs = Date.now();
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (!file || !file.size) continue;
      var path =
        "quote_evidence/" +
        sanitizePathSegment(ticketId || "no_ticket") +
        "_" +
        baseTs +
        "_" +
        i +
        ".jpg";
      var ref = storage.ref().child(path);
      var uploadMeta = { contentType: file.type || "image/jpeg" };
      try {
        await ref.put(file, uploadMeta);
        urls.push(await ref.getDownloadURL());
      } catch (_putErr) {
        if (typeof VCStorageOutbox !== "undefined") {
          VCStorageOutbox.enqueue(ref.fullPath, file, uploadMeta);
        }
        console.warn("[FieldForms] quote photo upload failed — queued for retry", _putErr);
      }
    }
    return urls;
  }

  async function saveCurrentFieldForm() {
    var equipmentSel = document.getElementById("fieldFormEquipmentSelect");
    var equipmentId = equipmentSel && equipmentSel.value ? equipmentSel.value.trim() : "";
    var scanVal =
      typeof window.SCAN_NEW_EQUIPMENT_VALUE !== "undefined"
        ? window.SCAN_NEW_EQUIPMENT_VALUE
        : "__TP_SCAN_NEW_EQUIPMENT__";

    var NEW_UNIT_SENTINEL = "__FF_NEW_UNIT__";

    if (equipmentId === NEW_UNIT_SENTINEL) {
      /* First Save tap: photo section not shown yet → inject it and scroll to it. */
      if (!document.getElementById("ffNewUnitPhotoSection")) {
        injectNewUnitPhotoSection();
        return;
      }
      /* Second Save tap: photos should now be selected — upload, create Equipment, continue. */
      var newEqId = await createNewEquipmentFromOnboarding();
      if (!newEqId) return;
      equipmentId = newEqId;
    } else if (!equipmentId || equipmentId === scanVal) {
      alert("Select an equipment unit (or scan a new data plate first).");
      return;
    }

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      alert("Firebase is not available.");
      return;
    }

    var db = firebase.firestore();
    var dbPm =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.pmRecords(db)
        : db.collection("pm_records");
    var dbFq =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.fieldQuotes(db)
        : db.collection("field_quotes");
    var dbFf =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.fieldFormSubmissions(db)
        : db.collection("field_form_submissions");
    var ticketId = getTicketId();
    var tech =
      typeof currentTechProfile !== "undefined" ? currentTechProfile : "";
    var flags = collectEquipmentFlags();

    if (currentFormId && String(currentFormId).indexOf("dynamic:") === 0) {
      var tid = String(currentFormId).replace(/^dynamic:/, "");
      var fields = (dynamicTemplateDoc && dynamicTemplateDoc.doc.fields) || [];
      var fieldValues = {};
      for (var idx = 0; idx < fields.length; idx++) {
        var f = fields[idx];
        var name = f.name || "field_" + idx;
        var typ = String(f.type || "text").toLowerCase();
        if (typ === "checkbox" || typ === "toggle") {
          var ch = document.getElementById("dynfield_" + name);
          var ok = ch && ch.checked;
          if (f.required && !ok) {
            alert("Required: " + (f.label || name));
            return;
          }
          fieldValues[name] = ok ? "yes" : "no";
          continue;
        }
        if (typ === "photo") {
          var fin = document.getElementById("dynphoto_" + name);
          if (f.required && (!fin || !fin.files || !fin.files.length)) {
            alert("Required photo: " + (f.label || name));
            return;
          }
          if (fin && fin.files && fin.files.length) {
            try {
              var purls = await uploadFieldFormPhotos(fin.files, ticketId, name);
              fieldValues[name] = purls.length ? JSON.stringify(purls) : "";
            } catch (pe) {
              console.error(pe);
              alert("Photo upload failed: " + (pe.message || pe));
              return;
            }
          } else {
            fieldValues[name] = "";
          }
          continue;
        }
        if (typ === "dropdown") {
          var dsel = document.getElementById("dynfield_" + name);
          var dval = dsel && dsel.value != null ? String(dsel.value).trim() : "";
          if (f.required && !dval) {
            alert("Required: choose an option for " + (f.label || name));
            return;
          }
          fieldValues[name] = dval;
          continue;
        }
        if (typ === "multi_check") {
          var mwrap = document.getElementById("dynmulti_wrap_" + name);
          var mvals = [];
          if (mwrap) {
            mwrap.querySelectorAll(".dynmulti-item:checked").forEach(function (cb) {
              mvals.push(cb.value);
            });
          }
          if (f.required && mvals.length === 0) {
            alert("Required: select at least one option for " + (f.label || name));
            return;
          }
          fieldValues[name] = mvals;
          continue;
        }
        var el = document.getElementById("dynfield_" + name);
        var val = el && el.value != null ? String(el.value).trim() : "";
        if (f.required && !val) {
          alert("Required: " + (f.label || name));
          return;
        }
        fieldValues[name] = el && el.value != null ? String(el.value) : "";
      }
      var payload = {
        templateId: tid,
        templateName: dynamicTemplateDoc.doc.templateName || tid,
        targetKeyword: dynamicTemplateDoc.doc.targetKeyword || "",
        equipmentId: equipmentId,
        ticketId: ticketId || null,
        techName: tech || null,
        fieldValues: fieldValues,
        isDirectDrive: flags.isDirectDrive,
        equipmentType: flags.equipmentType,
        cleanedScreens: flags.cleanedScreens,
        triggeredBy: pendingTriggeredBy || null,
        date: todayYmd(),
        savedAt: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      try {
        await dbFf.add(payload);
        try {
          window.dispatchEvent(new CustomEvent("vc:fieldFormSaved", {
            detail: {
              templateId: tid,
              triggeredBy: pendingTriggeredBy || null,
              ticketId: ticketId || null,
            },
          }));
        } catch (evtErr) { /* CustomEvent unsupported — non-fatal */ }
        alert("Form saved.");
        closeFieldFormModal();
      } catch (e) {
        console.error(e);
        alert("Save failed: " + (e.message || e));
      }
      return;
    }

    if (currentFormId === "standard_pm") {
      var fs = document.getElementById("field_filterSize");
      var bs = document.getElementById("field_beltSize");
      var n = document.getElementById("field_notes");
      var payload = {
        formType: "standard_pm",
        templateId: "standard_pm",
        equipmentId: equipmentId,
        ticketId: ticketId || null,
        techName: tech || null,
        filterSize:
          flags.equipmentType === "Mini-Split"
            ? ""
            : fs && fs.value
              ? String(fs.value).trim()
              : "",
        beltSize:
          flags.isDirectDrive || flags.equipmentType === "Mini-Split"
            ? ""
            : bs && bs.value
              ? String(bs.value).trim()
              : "",
        notes: n && n.value ? String(n.value).trim() : "",
        isDirectDrive: flags.isDirectDrive,
        equipmentType: flags.equipmentType,
        cleanedScreens: flags.cleanedScreens,
        date: todayYmd(),
        savedAt: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      try {
        await dbPm.add(payload);
        alert("PM checklist saved.");
        closeFieldFormModal();
      } catch (e) {
        console.error(e);
        alert("Save failed: " + (e.message || e));
      }
      return;
    }

    if (currentFormId === "repair_quote") {
      var evidenceCheck = await verifyEquipmentEvidence(equipmentId);
      if (!evidenceCheck.ok || !quoteEvidenceState.ok) {
        alert(
          "Stop! You must provide an overall photo and a data plate photo of the unit so the office can verify parts before ordering."
        );
        return;
      }
      var overallUrl =
        evidenceCheck.overallPhotoUrl ||
        quoteEvidenceState.overallPhotoUrl ||
        "";
      var plateUrl =
        evidenceCheck.dataPlatePhotoUrl ||
        quoteEvidenceState.dataPlatePhotoUrl ||
        "";
      if (!overallUrl || !plateUrl) {
        alert(
          "Stop! You must provide an overall photo and a data plate photo of the unit so the office can verify parts before ordering."
        );
        return;
      }

      var desc = document.getElementById("field_description");
      var partsEl = document.getElementById("field_partsList");
      var laborEl = document.getElementById("field_laborHours");
      var photoInput = document.getElementById("quotePhotosInput");

      var partsRaw = partsEl && partsEl.value ? String(partsEl.value) : "";
      var partsArray = partsRaw
        .split(/\r?\n/)
        .map(function (x) {
          return x.trim();
        })
        .filter(Boolean);

      var laborHours = parseFloat((laborEl && laborEl.value) || "0");
      if (!isFinite(laborHours)) laborHours = 0;

      var evidencePhotoUrls = [];
      if (photoInput && photoInput.files && photoInput.files.length) {
        try {
          evidencePhotoUrls = await uploadQuotePhotos(photoInput.files, ticketId);
        } catch (upErr) {
          console.error(upErr);
          alert("Photo upload failed: " + (upErr.message || upErr));
          return;
        }
      }

      var qPayload = {
        formType: "repair_quote",
        templateId: "repair_quote",
        equipmentId: equipmentId,
        ticketId: ticketId || null,
        techName: tech || null,
        description: desc && desc.value ? String(desc.value).trim() : "",
        partsArray: partsArray,
        laborHours: laborHours,
        evidencePhotoUrls: evidencePhotoUrls,
        overallPhotoUrl: overallUrl,
        dataPlatePhotoUrl: plateUrl,
        isDirectDrive: flags.isDirectDrive,
        equipmentType: flags.equipmentType,
        cleanedScreens: flags.cleanedScreens,
        date: todayYmd(),
        savedAt: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      try {
        await dbFq.add(qPayload);
        alert("Repair quote saved.");
        closeFieldFormModal();
      } catch (e2) {
        console.error(e2);
        alert("Save failed: " + (e2.message || e2));
      }
    }
  }

  /* ============================================================ *
   * Phase 34c — Service Call additional-repair branching accordion *
   * ============================================================ *
   *
   * Wires the `#acc-svc-repair` accordion that lives inside
   * `#serviceSection` of `technician/index.html`. Self-contained: reads/writes
   * the active service-call doc via `VCFirestore.setServiceCallMerged` and
   * uses `getTemplatesByRepairType` to surface the right Phase-34b seeded
   * checklist. Hydrates on the `vc:workspaceOpened` event dispatched at the
   * end of `openWorkspace()` (technician/index.html). Refreshes chip status
   * on the `vc:fieldFormSaved` event dispatched by `saveCurrentFieldForm`.
   *
   * Tickets get four new fields (additive, no schema migration):
   *   additionalRepairNeeded   : boolean
   *   repairFormTypes          : string[]   e.g. ["supply_fan","other"]
   *   repairFormCustomLabel    : string     (the free-text "Other" label)
   *   repairFormStatus         : { <repairKey>: { templateId, status, savedAt } }
   *
   * If the wiring DOM is missing (dispatcher app, or stale cached HTML on
   * iPhone), every helper bails silently — wiring this into field_forms.js
   * lets us cache-bust via ?v= without touching the entry-point HTML.
   */
  var REPAIR_BRANCH_TYPES = [
    { key: "supply_fan", label: "Supply Fan" },
    { key: "condenser_fan", label: "Condenser Fan" },
    { key: "gas_valve", label: "Gas Valve" },
    { key: "compressor", label: "Compressor" },
    { key: "refrigerant_leak", label: "Refrigerant Leak" },
    { key: "other", label: "Other" },
  ];
  /* In-memory mirror of the active ticket's repair-branch slice. Hydrated on
     `vc:workspaceOpened`, mutated on every user interaction, written back via
     setServiceCallMerged. Kept here (vs reading from DOM) so chip status
     updates from `vc:fieldFormSaved` can write a server-timestamp without
     racing the user's other clicks. */
  var repairBranchState = {
    ticketId: "",
    additionalRepairNeeded: null,
    repairFormTypes: [],
    repairFormCustomLabel: "",
    repairFormStatus: {},
    /* templateId → repairKey reverse map, rebuilt on each chip render so
       `vc:fieldFormSaved` events can resolve which chip to mark "Saved". */
    templateIdToRepairKey: {},
  };

  function getActiveTicketIdForRepairBranch() {
    var sel = document.getElementById("ticketSelector");
    return sel && sel.value ? String(sel.value).trim() : "";
  }

  function getServiceCallsRefForRepairBranch() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return null;
    return firebase.firestore();
  }

  /** Persist a partial patch onto `service_calls/{ticketId}` via the canonical
   *  `setServiceCallMerged` helper. Surfaces failures through
   *  `VCSurfaceWriteFailure` so the iPhone debug overlay records dropped writes
   *  (KI-002 Plan A pattern). Silent-bails when no ticket is loaded. */
  function persistRepairBranchPatch(patch) {
    var tid = getActiveTicketIdForRepairBranch();
    if (!tid) return Promise.resolve();
    var db = getServiceCallsRefForRepairBranch();
    if (!db) return Promise.resolve();
    var p =
      typeof VCFirestore !== "undefined" && VCFirestore.setServiceCallMerged
        ? VCFirestore.setServiceCallMerged(db, tid, patch, true)
        : db.collection("service_calls").doc(tid).set(patch, { merge: true });
    return p.catch(function (err) {
      console.error("[field_forms] repairBranch write failed", err);
      if (typeof VCSurfaceWriteFailure === "function") {
        VCSurfaceWriteFailure("repairBranch:write[" + tid + "]", err);
      }
    });
  }

  function getRepairBranchAccordion() {
    return document.getElementById("acc-svc-repair");
  }

  /** Resolve the canonical template for a given repair-type key. Prefers
   *  `isDefault: true`; else lowest `sortIndex` (already done by
   *  `getTemplatesByRepairType` → `sortTemplatesForUi`). Returns
   *  `{ id, doc }` or `null` when no template matches (e.g. dispatcher
   *  hasn't seeded yet, or `key === "other"`). */
  async function resolveRepairTemplateForKey(key) {
    if (!key || key === "other") return null;
    var rows = await getTemplatesByRepairType(key);
    if (!rows || !rows.length) return null;
    var def = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].data && rows[i].data.isDefault === true) { def = rows[i]; break; }
    }
    return def || rows[0];
  }

  function renderRepairBranchChipsHtml(resolvedRows) {
    if (!resolvedRows.length) {
      return "<div style=\"font-size:12px;color:#7f8c8d;font-style:italic;padding:6px 2px;\">" +
        "Pick at least one repair above to surface its checklist." +
        "</div>";
    }
    var html = "";
    resolvedRows.forEach(function (row) {
      var status = repairBranchState.repairFormStatus[row.key] || {};
      var saved = status.status === "saved";
      var badgeClass = saved ? "vc-repair-chip__badge saved" : "vc-repair-chip__badge";
      var badgeText = saved ? "✓ Saved" : "Not started";
      var nameHtml = "";
      var actionHtml = "";
      if (row.key === "other") {
        nameHtml = "Other (free-text repair) — no checklist";
        actionHtml = "<span class=\"vc-repair-chip__missing\">Describe above</span>";
      } else if (!row.template) {
        nameHtml = escapeHtml(row.label) + " — <em>no template seeded</em>";
        actionHtml = "<span class=\"vc-repair-chip__missing\">Ask dispatch to seed</span>";
      } else {
        var tname = String((row.template.data && row.template.data.templateName) || row.template.id);
        nameHtml = escapeHtml(tname);
        actionHtml = "<button type=\"button\" class=\"vc-repair-chip__open\" " +
          "data-svc-repair-open=\"" + escapeAttr(row.key) + "\" " +
          "data-template-id=\"" + escapeAttr(row.template.id) + "\">" +
          (saved ? "Re-open form" : "Open form") +
          "</button>";
      }
      html +=
        "<div class=\"vc-repair-chip\" data-repair-key=\"" + escapeAttr(row.key) + "\">" +
        "<div style=\"display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;\">" +
        "<span class=\"vc-repair-chip__name\">" + nameHtml + "</span>" +
        "<span class=\"" + badgeClass + "\">" + badgeText + "</span>" +
        "</div>" +
        actionHtml +
        "</div>";
    });
    return html;
  }

  async function rerenderRepairBranchChips() {
    var acc = getRepairBranchAccordion();
    if (!acc) return;
    var chipsWrap = document.getElementById("svcRepairFormChips");
    if (!chipsWrap) return;
    var selected = repairBranchState.repairFormTypes.slice();
    var resolved = [];
    for (var i = 0; i < selected.length; i++) {
      var key = selected[i];
      var meta = REPAIR_BRANCH_TYPES.filter(function (r) { return r.key === key; })[0];
      var label = meta ? meta.label : key;
      if (key === "other") {
        resolved.push({ key: key, label: label, template: null });
        continue;
      }
      var tpl = null;
      try { tpl = await resolveRepairTemplateForKey(key); } catch (e) { tpl = null; }
      resolved.push({ key: key, label: label, template: tpl });
    }
    var idMap = {};
    resolved.forEach(function (r) {
      if (r.template && r.template.id) idMap[r.template.id] = r.key;
    });
    repairBranchState.templateIdToRepairKey = idMap;
    chipsWrap.innerHTML = renderRepairBranchChipsHtml(resolved);
    chipsWrap.querySelectorAll("[data-svc-repair-open]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tid = btn.getAttribute("data-template-id");
        if (!tid) return;
        try {
          renderDynamicForm(tid, { triggeredBy: "repair_branch" });
        } catch (e) {
          console.error("[field_forms] open repair-branch form failed", e);
        }
      });
    });
  }

  function applyRepairBranchYesNoStyles() {
    var yesBtn = document.getElementById("svcRepairNeededYesBtn");
    var noBtn = document.getElementById("svcRepairNeededNoBtn");
    if (yesBtn) yesBtn.setAttribute("aria-pressed",
      repairBranchState.additionalRepairNeeded === true ? "true" : "false");
    if (noBtn) noBtn.setAttribute("aria-pressed",
      repairBranchState.additionalRepairNeeded === false ? "true" : "false");
    var typesWrap = document.getElementById("svcRepairTypesWrap");
    if (typesWrap) {
      typesWrap.classList.toggle("hidden", repairBranchState.additionalRepairNeeded !== true);
    }
  }

  function applyRepairBranchTypePillStyles() {
    var pillWrap = document.querySelector(".vc-svc-repair-types");
    if (!pillWrap) return;
    pillWrap.querySelectorAll("[data-svc-repair-type]").forEach(function (btn) {
      var key = btn.getAttribute("data-svc-repair-type");
      var on = repairBranchState.repairFormTypes.indexOf(key) >= 0;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var otherWrap = document.getElementById("svcRepairOtherWrap");
    if (otherWrap) {
      var otherOn = repairBranchState.repairFormTypes.indexOf("other") >= 0;
      otherWrap.classList.toggle("hidden", !otherOn);
    }
    var otherInp = document.getElementById("svcRepairOtherLabel");
    if (otherInp && otherInp.value !== repairBranchState.repairFormCustomLabel) {
      otherInp.value = repairBranchState.repairFormCustomLabel || "";
    }
  }

  function hydrateRepairBranchFromTicket(ticket) {
    var acc = getRepairBranchAccordion();
    if (!acc) return;
    var t = ticket || {};
    repairBranchState.ticketId = String(t.id || getActiveTicketIdForRepairBranch() || "");
    repairBranchState.additionalRepairNeeded =
      typeof t.additionalRepairNeeded === "boolean" ? t.additionalRepairNeeded : null;
    repairBranchState.repairFormTypes = Array.isArray(t.repairFormTypes)
      ? t.repairFormTypes.slice()
      : [];
    repairBranchState.repairFormCustomLabel =
      typeof t.repairFormCustomLabel === "string" ? t.repairFormCustomLabel : "";
    repairBranchState.repairFormStatus =
      t.repairFormStatus && typeof t.repairFormStatus === "object"
        ? Object.assign({}, t.repairFormStatus)
        : {};
    applyRepairBranchYesNoStyles();
    applyRepairBranchTypePillStyles();
    rerenderRepairBranchChips();
  }

  function setRepairBranchYesNo(needed) {
    /* needed === true | false */
    repairBranchState.additionalRepairNeeded = !!needed;
    if (!needed) {
      /* User said No → clear any prior selections so the chip area collapses
         clean. Keep `repairFormStatus` history (so re-toggling Yes restores
         saved-state badges) but null the active selection. */
      repairBranchState.repairFormTypes = [];
      repairBranchState.repairFormCustomLabel = "";
    }
    applyRepairBranchYesNoStyles();
    applyRepairBranchTypePillStyles();
    rerenderRepairBranchChips();
    persistRepairBranchPatch({
      additionalRepairNeeded: !!needed,
      repairFormTypes: needed ? repairBranchState.repairFormTypes : [],
      repairFormCustomLabel: needed ? repairBranchState.repairFormCustomLabel : "",
      repairBranchUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  function toggleRepairBranchType(key) {
    if (!key) return;
    var idx = repairBranchState.repairFormTypes.indexOf(key);
    if (idx >= 0) {
      repairBranchState.repairFormTypes.splice(idx, 1);
      if (key === "other") repairBranchState.repairFormCustomLabel = "";
    } else {
      repairBranchState.repairFormTypes.push(key);
    }
    applyRepairBranchTypePillStyles();
    rerenderRepairBranchChips();
    persistRepairBranchPatch({
      repairFormTypes: repairBranchState.repairFormTypes.slice(),
      repairFormCustomLabel: repairBranchState.repairFormCustomLabel,
      repairBranchUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  /** Debounce free-text writes so we don't write a Firestore patch per
   *  keystroke. 600ms matches the dictation-hub internal-save cadence. */
  var repairBranchOtherDebounce = null;
  function setRepairBranchOtherLabel(text) {
    repairBranchState.repairFormCustomLabel = String(text || "");
    if (repairBranchOtherDebounce) clearTimeout(repairBranchOtherDebounce);
    repairBranchOtherDebounce = setTimeout(function () {
      persistRepairBranchPatch({
        repairFormCustomLabel: repairBranchState.repairFormCustomLabel,
        repairBranchUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }, 600);
  }

  function markRepairBranchFormSaved(detail) {
    var tid = detail && detail.templateId ? String(detail.templateId) : "";
    var trig = detail && detail.triggeredBy ? String(detail.triggeredBy) : "";
    if (!tid || trig !== "repair_branch") return;
    var key = repairBranchState.templateIdToRepairKey[tid];
    if (!key) return;
    repairBranchState.repairFormStatus[key] = {
      templateId: tid,
      status: "saved",
      savedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    rerenderRepairBranchChips();
    /* Snapshot value used in the persisted map can't be a serverTimestamp
       sentinel inside a nested object; Firestore allows it only at the top
       level of a set call. Instead persist a JS Date string for the savedAt
       in the nested map and a serverTimestamp at the top level. */
    var nested = {};
    nested[key] = {
      templateId: tid,
      status: "saved",
      savedAt: new Date().toISOString(),
    };
    persistRepairBranchPatch({
      repairFormStatus: nested,
      repairBranchUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  function initRepairBranchAccordion() {
    var acc = getRepairBranchAccordion();
    if (!acc || acc.dataset.wired === "1") return;
    acc.dataset.wired = "1";

    var yesBtn = document.getElementById("svcRepairNeededYesBtn");
    var noBtn = document.getElementById("svcRepairNeededNoBtn");
    if (yesBtn) yesBtn.addEventListener("click", function () { setRepairBranchYesNo(true); });
    if (noBtn) noBtn.addEventListener("click", function () { setRepairBranchYesNo(false); });

    var pillWrap = document.querySelector(".vc-svc-repair-types");
    if (pillWrap) {
      pillWrap.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-svc-repair-type]");
        if (!btn) return;
        toggleRepairBranchType(btn.getAttribute("data-svc-repair-type"));
      });
    }

    var otherInp = document.getElementById("svcRepairOtherLabel");
    if (otherInp) {
      otherInp.addEventListener("input", function () {
        setRepairBranchOtherLabel(otherInp.value);
      });
    }

    /* Hydrate when openWorkspace runs (event dispatched from
       technician/index.html). Detail carries `{ ticketId, mode, ticket }`. */
    window.addEventListener("vc:workspaceOpened", function (ev) {
      var d = ev && ev.detail ? ev.detail : {};
      hydrateRepairBranchFromTicket(d.ticket || null);
    });

    /* Refresh chip status after a repair-branch form save. */
    window.addEventListener("vc:fieldFormSaved", function (ev) {
      markRepairBranchFormSaved(ev && ev.detail ? ev.detail : null);
    });
  }

  function initFieldFormLaunchers() {
    var bPm = document.getElementById("btnLaunchStandardPm");
    if (bPm) {
      bPm.addEventListener("click", function () {
        renderForm("standard_pm");
      });
    }
    var bQ = document.getElementById("btnLaunchRepairQuote");
    if (bQ) {
      bQ.addEventListener("click", function () {
        renderForm("repair_quote");
      });
    }
    var modal = document.getElementById("fieldFormModal");
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeFieldFormModal();
      });
    }

    initRepairBranchAccordion();

    startFormTemplatesListener();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFieldFormLaunchers);
  } else {
    initFieldFormLaunchers();
  }

  window.renderForm = renderForm;
  window.renderDynamicForm = renderDynamicForm;
  window.closeFieldFormModal = closeFieldFormModal;
  window.FORM_TEMPLATES = FORM_TEMPLATES;
  window.scanNotesForFormRequirements = scanNotesForFormRequirements;
  window.collectNotesForAiScan = collectNotesForAiScan;
  window.getActiveFormTemplates = fetchActiveFormTemplates;
  window.getTemplatesByJobType = getTemplatesByJobType;
  window.getTemplatesByRepairType = getTemplatesByRepairType;
  window.hideFormIntentBanner = hideFormIntentBanner;
  window.verifyEquipmentEvidence = verifyEquipmentEvidence;
  /* Phase 34c — exposed for the technician/index.html `openWorkspace`
     dispatch path and on-device debugging. Tech can call
     `window.vcRepairBranchHydrate(window.__vcLastActiveTicket)` from the
     console to force a re-render. */
  window.vcRepairBranchHydrate = hydrateRepairBranchFromTicket;
  /* Slice 58c — lifecycle hooks called by switchScreen in technician/index.html */
  window.vcStartFormTemplatesListener = startFormTemplatesListener;
  window.vcStopFormTemplatesListener = stopFormTemplatesListener;

  /* ── Outbox hook registration ──────────────────────────────────────
     After drain() uploads a queued equipment evidence photo it patches
     the Firestore Equipment doc with the download URL.                 */
  if (typeof VCStorageOutbox !== "undefined" && typeof VCStorageOutbox.registerHook === "function") {
    VCStorageOutbox.registerHook("fieldFormEquipmentPhoto", function (url, payload) {
      try {
        var db = firebase.firestore();
        var patch = {};
        patch[payload.field] = url;
        patch.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        db.doc(payload.docPath).set(patch, { merge: true })
          .catch(function (err) {
            if (typeof VCSurfaceWriteFailure === "function") VCSurfaceWriteFailure("outboxHook:fieldFormEquipmentPhoto", err);
          });
      } catch (e) {
        if (typeof VCSurfaceWriteFailure === "function") VCSurfaceWriteFailure("outboxHook:fieldFormEquipmentPhoto", e);
      }
    });
  }
})();
