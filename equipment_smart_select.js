/**
 * Smart equipment dropdown: site units (+ None). Refreshes from Firestore when a job is open.
 * Depends on: firebase, activeTicket, #location
 */
(function () {
  "use strict";

  /** Legacy sentinel; retained for field_forms / draft checks that reject non-unit ids. */
  var SCAN_NEW_VALUE = "__TP_SCAN_NEW_EQUIPMENT__";

  function sanitizePathSegment(s) {
    return (
      String(s || "")
        .trim()
        .replace(/[/\\]+/g, "_")
        .replace(/\s+/g, " ")
        .slice(0, 200) || "unknown"
    );
  }

  function makeEquipmentId(customerId, locationId, unitDocId) {
    return customerId + "/" + locationId + "/" + unitDocId;
  }

  function getLocationLine() {
    var el = document.getElementById("location");
    return el && el.value ? String(el.value).trim() : "";
  }

  /**
   * Rebuild options: — None —, then units (no in-dropdown scan launcher).
   * @param {HTMLSelectElement} selectEl
   * @param {string} [preserveValue] value to restore if still present
   */
  function refreshSmartEquipmentSelect(selectEl, preserveValue) {
    if (!selectEl) return Promise.resolve();
    var keep =
      preserveValue != null ? preserveValue : String(selectEl.value || "");
    var locLine = getLocationLine();
    if (typeof activeTicket === "undefined" || !activeTicket || !locLine) {
      selectEl.innerHTML = "<option value=\"\">— None —</option>";
      selectEl.disabled = true;
      selectEl.value = "";
      return Promise.resolve();
    }
    selectEl.disabled = false;
    var customerId = sanitizePathSegment(activeTicket.customerName || "");
    var locationId = sanitizePathSegment(locLine);

    selectEl.innerHTML =
      "<option value=\"\">— None —</option>" +
      "<option disabled>Loading…</option>";

    if (
      typeof firebase === "undefined" ||
      !firebase.apps ||
      !firebase.apps.length
    ) {
      selectEl.innerHTML = "<option value=\"\">— None —</option>";
      return Promise.resolve();
    }

    return firebase
      .firestore()
      .collection("Customers")
      .doc(customerId)
      .collection("Locations")
      .doc(locationId)
      .collection("Equipment")
      .get()
      .then(function (snap) {
        var opts = "<option value=\"\">— None —</option>";
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          var composite = makeEquipmentId(customerId, locationId, doc.id);
          var unitTagCore = String(d.unitTag || d.brand || doc.id || "Unit");
          var label = unitTagCore + (d.model ? " — " + d.model : "");
          var verified = !!(
            String(d.dataPlatePhotoUrl || "").trim() &&
            String(d.overallPhotoUrl || "").trim()
          );
          opts +=
            "<option value=\"" +
            escapeAttr(composite) +
            "\" data-unit-tag=\"" +
            escapeAttr(unitTagCore) +
            "\"" +
            (verified
              ? " title=\"" +
                escapeAttr("Identity Verified: Photos & Specs on file.") +
                "\""
              : "") +
            ">" +
            escapeHtml(label) +
            (verified ? " 🛡️" : "") +
            "</option>";
        });
        selectEl.innerHTML = opts;
        if (
          keep &&
          keep !== SCAN_NEW_VALUE &&
          [].some.call(selectEl.options, function (o) {
            return o.value === keep;
          })
        ) {
          selectEl.value = keep;
        } else {
          selectEl.value = "";
        }
      })
      .catch(function (e) {
        console.error("[SmartEquipmentSelect]", e);
        selectEl.innerHTML = "<option value=\"\">— None —</option>";
      });
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

  function bindSmartEquipmentSelect(selectEl) {
    if (!selectEl || selectEl.dataset.smartEquipmentBound === "1") return;
    selectEl.dataset.smartEquipmentBound = "1";
    selectEl.addEventListener("change", function () {
      if (typeof saveDraft === "function") saveDraft();
    });
  }

  function refreshAllSmartEquipmentSelects(preferredEquipmentId) {
    var list = document.querySelectorAll("select[data-smart-equipment]");
    if (!list.length) return Promise.resolve();
    var preserve =
      preferredEquipmentId != null && preferredEquipmentId !== ""
        ? String(preferredEquipmentId)
        : null;
    return Array.prototype.slice.call(list).reduce(function (chain, sel) {
      return chain
        .then(function () {
          return refreshSmartEquipmentSelect(
            sel,
            preserve || sel.value || ""
          );
        })
        .then(function () {
          if (preserve) {
            if (
              [].some.call(sel.options, function (o) {
                return o.value === preserve;
              })
            ) {
              sel.value = preserve;
            }
          }
        });
    }, Promise.resolve());
  }

  document.addEventListener("equipmentManagerSaved", function (ev) {
    var d = ev && ev.detail ? ev.detail : {};
    var eid = d.equipmentId || "";
    refreshAllSmartEquipmentSelects(eid);
  });

  window.SCAN_NEW_EQUIPMENT_VALUE = SCAN_NEW_VALUE;
  window.refreshSmartEquipmentSelect = refreshSmartEquipmentSelect;
  window.bindSmartEquipmentSelect = bindSmartEquipmentSelect;
  window.refreshAllSmartEquipmentSelects = refreshAllSmartEquipmentSelects;
})();
