/**
 * Dynamic work order forms (Standard PM, Repair Quote) for technician app.
 * Depends on: firebase, db, activeTicket, currentTechProfile, ensureFirebaseStorage pattern.
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
        { name: "filterSize", label: "Filter Size", type: "text", placeholder: "e.g. 20x25x2" },
        { name: "beltSize", label: "Belt Size", type: "text", placeholder: "e.g. A44" },
        { name: "notes", label: "Notes", type: "textarea", placeholder: "PM observations" },
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
    var body = document.getElementById("fieldFormModalBody");
    if (body) body.innerHTML = "";
  }

  function renderForm(formTemplateId) {
    var t = FORM_TEMPLATES[formTemplateId];
    if (!t) {
      console.warn("[field_forms] Unknown template", formTemplateId);
      return;
    }
    currentFormId = formTemplateId;
    var body = document.getElementById("fieldFormModalBody");
    var titleEl = document.getElementById("fieldFormModalTitle");
    if (!body) return;
    if (titleEl) titleEl.textContent = t.title;

    var html = "<div class=\"field-form-inner\">";
    html +=
      "<label class=\"field-form-label\">Select Equipment</label>" +
      "<select id=\"fieldFormEquipmentSelect\" data-smart-equipment=\"true\" class=\"field-form-select\"></select>";

    t.fields.forEach(function (f) {
      html += "<label class=\"field-form-label\" for=\"field_" + f.name + "\">" + escapeHtml(f.label) + "</label>";
      if (f.type === "textarea") {
        html +=
          "<textarea id=\"field_" +
          f.name +
          "\" class=\"field-form-input\" placeholder=\"" +
          escapeAttr(f.placeholder || "") +
          "\"></textarea>";
      } else {
        html +=
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
    });

    if (formTemplateId === "repair_quote") {
      html +=
        "<label class=\"field-form-label\" for=\"quotePhotosInput\">Photo evidence</label>" +
        "<input type=\"file\" accept=\"image/*;capture=camera\" multiple id=\"quotePhotosInput\" class=\"field-form-file\"/>";
    }

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
      });
    }

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
    var ticketId = getTicketId();
    var tech =
      typeof currentTechProfile !== "undefined" ? currentTechProfile : "";

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
        filterSize: fs && fs.value ? String(fs.value).trim() : "",
        beltSize: bs && bs.value ? String(bs.value).trim() : "",
        notes: n && n.value ? String(n.value).trim() : "",
        date: todayYmd(),
        savedAt: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      try {
        await db.collection("pm_records").add(payload);
        alert("PM checklist saved.");
        closeFieldFormModal();
      } catch (e) {
        console.error(e);
        alert("Save failed: " + (e.message || e));
      }
      return;
    }

    if (currentFormId === "repair_quote") {
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
        date: todayYmd(),
        savedAt: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      try {
        await db.collection("field_quotes").add(qPayload);
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFieldFormLaunchers);
  } else {
    initFieldFormLaunchers();
  }

  window.renderForm = renderForm;
  window.closeFieldFormModal = closeFieldFormModal;
  window.FORM_TEMPLATES = FORM_TEMPLATES;
})();
