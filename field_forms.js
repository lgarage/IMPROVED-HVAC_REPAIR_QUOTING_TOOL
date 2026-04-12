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
    await ref.put(file, { contentType: file.type || "image/jpeg" });
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

  function applyFormTemplatesSnapshot(snap) {
    var out = [];
    snap.forEach(function (doc) {
      out.push({ id: doc.id, data: doc.data() || {} });
    });
    formTemplatesCache = out;
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
    var m = document.getElementById("fieldFormModal");
    if (m) {
      m.classList.remove("hidden");
      m.setAttribute("aria-hidden", "false");
    }
  }

  function closeFieldFormModal() {
    var m = document.getElementById("fieldFormModal");
    if (m) {
      m.classList.add("hidden");
      m.setAttribute("aria-hidden", "true");
    }
    currentFormId = null;
    dynamicTemplateDoc = null;
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
   */
  async function renderDynamicForm(templateId) {
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
    if (sel && typeof window.refreshSmartEquipmentSelect === "function") {
      window.refreshSmartEquipmentSelect(sel, "").then(function () {
        if (typeof window.bindSmartEquipmentSelect === "function") {
          window.bindSmartEquipmentSelect(sel);
        }
        wireFieldFormEquipmentVerifiedHint();
      });
    } else {
      wireFieldFormEquipmentVerifiedHint();
    }

    wireEquipmentFieldVisibility(body);

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
    if (typeof firebase === "undefined" || !firebase.apps.length) return [];
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
    }
    return [];
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
    var keywords = templates
      .map(function (t) {
        return String(t.data.targetKeyword || "").trim();
      })
      .filter(Boolean);

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
      templates.forEach(function (t) {
        var kw = String(t.data.targetKeyword || "").trim();
        if (!kw) return;
        if (answer.toLowerCase() === kw.toLowerCase()) matched = t;
        if (answer.toLowerCase().indexOf(kw.toLowerCase()) >= 0) matched = t;
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
      await ref.put(file, { contentType: file.type || "image/jpeg" });
      urls.push(await ref.getDownloadURL());
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
      await ref.put(file, { contentType: file.type || "image/jpeg" });
      urls.push(await ref.getDownloadURL());
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
    if (!equipmentId || equipmentId === scanVal) {
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
        if (typ === "checkbox") {
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
        date: todayYmd(),
        savedAt: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      try {
        await dbFf.add(payload);
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

    var aiBtn = document.getElementById("btnScanNotesForForms");
    if (aiBtn) {
      aiBtn.addEventListener("click", function () {
        var text = collectNotesForAiScan();
        scanNotesForFormRequirements(text);
      });
    }

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
  window.hideFormIntentBanner = hideFormIntentBanner;
  window.verifyEquipmentEvidence = verifyEquipmentEvidence;
})();
