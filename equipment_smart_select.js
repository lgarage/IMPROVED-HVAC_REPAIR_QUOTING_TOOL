/**
 * Smart equipment dropdown: site units + first option opens AI data plate scanner.
 * Depends on: firebase, activeTicket, getParentCompany, EquipmentManager, #location
 */
(function () {
  "use strict";

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

  function openScannerForActiveJob() {
    if (typeof activeTicket === "undefined" || !activeTicket) {
      alert("Select a job from your schedule first.");
      return;
    }
    var locLine = getLocationLine();
    if (!locLine) {
      alert("Set the location field before scanning new equipment.");
      return;
    }
    if (typeof EquipmentManager === "undefined" || !EquipmentManager.open) {
      alert("Equipment scanner is not loaded.");
      return;
    }
    var run = function (parentCompany) {
      EquipmentManager.open({
        parentCompany: parentCompany || "—",
        customer: activeTicket.customerName,
        locationDisplay: locLine,
        locationId: sanitizePathSegment(locLine),
      });
    };
    if (typeof getParentCompany === "function") {
      getParentCompany(locLine)
        .then(function (pc) {
          run(pc || "—");
        })
        .catch(function () {
          run("—");
        });
    } else {
      run("—");
    }
  }

  /**
   * Rebuild options: [+ Scan New…], — None —, then units.
   * @param {HTMLSelectElement} selectEl
   * @param {string} [preserveValue] value to restore if still present
   */
  function refreshSmartEquipmentSelect(selectEl, preserveValue) {
    if (!selectEl) return Promise.resolve();
    var keep =
      preserveValue != null ? preserveValue : String(selectEl.value || "");
    var locLine = getLocationLine();
    if (typeof activeTicket === "undefined" || !activeTicket || !locLine) {
      selectEl.innerHTML =
        "<option value=\"" +
        SCAN_NEW_VALUE +
        "\">[+ Scan New Equipment Data Plate]</option>" +
        "<option value=\"\">— None —</option>";
      selectEl.disabled = true;
      selectEl.value = "";
      return Promise.resolve();
    }
    selectEl.disabled = false;
    var customerId = sanitizePathSegment(activeTicket.customerName || "");
    var locationId = sanitizePathSegment(locLine);

    selectEl.innerHTML =
      "<option value=\"" +
      SCAN_NEW_VALUE +
      "\">[+ Scan New Equipment Data Plate]</option>" +
      "<option value=\"\">— None —</option>" +
      "<option disabled>Loading…</option>";

    if (
      typeof firebase === "undefined" ||
      !firebase.apps ||
      !firebase.apps.length
    ) {
      selectEl.innerHTML =
        "<option value=\"" +
        SCAN_NEW_VALUE +
        "\">[+ Scan New Equipment Data Plate]</option>" +
        "<option value=\"\">— None —</option>";
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
        var opts =
          "<option value=\"" +
          SCAN_NEW_VALUE +
          "\">[+ Scan New Equipment Data Plate]</option>" +
          "<option value=\"\">— None —</option>";
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          var composite = makeEquipmentId(customerId, locationId, doc.id);
          var label =
            (d.unitTag || d.brand || doc.id || "Unit") +
            (d.model ? " — " + d.model : "");
          var verified = !!(
            String(d.dataPlatePhotoUrl || "").trim() &&
            String(d.overallPhotoUrl || "").trim()
          );
          var optTitle = verified
            ? "Identity Verified: Photos & Specs on file."
            : "";
          opts +=
            "<option value=\"" +
            escapeAttr(composite) +
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
        } else if (keep === SCAN_NEW_VALUE) {
          selectEl.value = "";
        }
      })
      .catch(function (e) {
        console.error("[SmartEquipmentSelect]", e);
        selectEl.innerHTML =
          "<option value=\"" +
          SCAN_NEW_VALUE +
          "\">[+ Scan New Equipment Data Plate]</option>" +
          "<option value=\"\">— None —</option>";
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
      if (selectEl.value !== SCAN_NEW_VALUE) {
        if (typeof saveDraft === "function") saveDraft();
        return;
      }
      selectEl.dataset.openingScanner = "1";
      openScannerForActiveJob();
      selectEl.value = "";
      selectEl.dataset.openingScanner = "";
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
  window.openEquipmentScannerForActiveJob = openScannerForActiveJob;
})();
