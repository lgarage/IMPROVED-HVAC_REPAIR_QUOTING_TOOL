/**
 * Equipment Hub — technician field app: site equipment list, unit history, AI scanner entry.
 * Depends on: firebase (db), activeTicket, getParentCompany (technician/index.html), EquipmentManager.
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

  /** Stable id for Linked_Equipment_ID + history queries (path segments are already safe). */
  function makeEquipmentId(customerId, locationId, unitDocId) {
    return customerId + "/" + locationId + "/" + unitDocId;
  }

  function parseEquipmentId(composite) {
    var parts = String(composite || "").split("/");
    if (parts.length < 3) return null;
    var unitDocId = parts.slice(2).join("/");
    return {
      customerId: parts[0],
      locationId: parts[1],
      unitDocId: unitDocId,
    };
  }

  var hubState = {
    customerId: "",
    locationId: "",
    locationDisplay: "",
    parentCompany: "—",
    customerName: "",
    equipmentList: [],
    selectedEquipmentId: "",
    selectedProfile: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function getLocationLineForHub() {
    var el = $("location");
    return el && el.value ? String(el.value).trim() : "";
  }

  function resolveParentCompany(locationLine) {
    if (typeof getParentCompany !== "function") {
      return Promise.resolve("—");
    }
    return getParentCompany(locationLine).then(function (p) {
      return p || "—";
    }).catch(function () {
      return "—";
    });
  }

  function showHubModal() {
    var modal = $("equipmentHubModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeEquipmentHub() {
    var modal = $("equipmentHubModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function showListView() {
    var vList = $("equipmentHubViewList");
    var vHist = $("equipmentHubViewHistory");
    var foot = $("equipmentHubStickyFooter");
    if (vList) vList.classList.remove("hidden");
    if (vHist) vHist.classList.add("hidden");
    if (foot) foot.style.display = "block";
  }

  function showHistoryView() {
    var vList = $("equipmentHubViewList");
    var vHist = $("equipmentHubViewHistory");
    var foot = $("equipmentHubStickyFooter");
    if (vList) vList.classList.add("hidden");
    if (vHist) vHist.classList.remove("hidden");
    if (foot) foot.style.display = "none";
  }

  function renderEquipmentList(docs) {
    var container = $("equipmentHubList");
    var meta = $("equipmentHubListMeta");
    if (!container) return;

    if (meta) {
      meta.innerHTML =
        "<p class=\"equipment-hub-meta-line\"><strong>Customer:</strong> " +
        escapeHtml(hubState.customerName) +
        "</p>" +
        "<p class=\"equipment-hub-meta-line\"><strong>Location id:</strong> " +
        escapeHtml(hubState.locationId) +
        "</p>";
    }

    if (!docs.length) {
      container.innerHTML =
        "<p class=\"equipment-hub-empty\">No equipment on file for this site yet. Use the button below to add a unit with the AI scanner.</p>";
      return;
    }

    var html = "";
    docs.forEach(function (row) {
      var d = row.data;
      var id = row.id;
      var composite = makeEquipmentId(hubState.customerId, hubState.locationId, id);
      var title = (d.unitTag || d.brand || id || "Unit").toString();
      var sub =
        [d.brand, d.model]
          .filter(Boolean)
          .join(" · ") || "—";
      var health =
        d.healthScore != null && d.healthScore !== ""
          ? "Score " + escapeHtml(String(d.healthScore)) + " (" + escapeHtml(String(d.healthGrade || "—")) + ")"
          : "—";
      html +=
        "<button type=\"button\" class=\"equipment-hub-card\" data-eid=\"" +
        escapeHtml(composite) +
        "\">" +
        "<span class=\"equipment-hub-card-title\">" +
        escapeHtml(title) +
        "</span>" +
        "<span class=\"equipment-hub-card-sub\">" +
        escapeHtml(sub) +
        "</span>" +
        "<span class=\"equipment-hub-card-health\">" +
        health +
        "</span>" +
        "</button>";
    });
    container.innerHTML = html;

    container.querySelectorAll(".equipment-hub-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var eid = btn.getAttribute("data-eid");
        if (eid) viewEquipmentHistory(eid);
      });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function fetchEquipmentForSite(customerId, locationId) {
    var container = $("equipmentHubList");
    if (container) {
      container.innerHTML =
        "<p class=\"equipment-hub-loading\">Loading equipment…</p>";
    }

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      if (container) {
        container.innerHTML =
          "<p class=\"equipment-hub-error\">Firebase not available.</p>";
      }
      return;
    }

    var db = firebase.firestore();
    try {
      var snap = await db
        .collection("Customers")
        .doc(customerId)
        .collection("Locations")
        .doc(locationId)
        .collection("Equipment")
        .get();

      var rows = [];
      snap.forEach(function (doc) {
        rows.push({ id: doc.id, data: doc.data() || {} });
      });
      hubState.equipmentList = rows;
      renderEquipmentList(rows);
      if (typeof refreshJobLinkedEquipmentDropdown === "function") {
        refreshJobLinkedEquipmentDropdown();
      }
    } catch (e) {
      console.error("[EquipmentHub] fetch equipment", e);
      if (container) {
        container.innerHTML =
          "<p class=\"equipment-hub-error\">Could not load equipment. " +
          escapeHtml(e.message || String(e)) +
          "</p>";
      }
    }
  }

  function openEquipmentHub(locationIdOpt) {
    if (typeof activeTicket === "undefined" || !activeTicket) {
      alert("Select a job from your schedule first.");
      return;
    }
    var locLine = getLocationLineForHub();
    if (!locLine) {
      alert("Set a location on this ticket before opening the Equipment Hub.");
      return;
    }

    var customerId = sanitizePathSegment(activeTicket.customerName || "");
    var locationId =
      locationIdOpt != null && String(locationIdOpt).trim() !== ""
        ? String(locationIdOpt).trim()
        : sanitizePathSegment(locLine);

    hubState.customerId = customerId;
    hubState.locationId = locationId;
    hubState.locationDisplay = locLine;
    hubState.customerName = activeTicket.customerName || "—";

    resolveParentCompany(locLine).then(function (pc) {
      hubState.parentCompany = pc || "—";
      showHubModal();
      showListView();
      return fetchEquipmentForSite(customerId, locationId);
    });
  }

  function pad2(n) {
    return String(n).length < 2 ? "0" + n : String(n);
  }

  function formatServiceDate(data) {
    if (data.date && typeof data.date === "string") return data.date;
    if (data.serviceDateIso) return data.serviceDateIso;
    if (data.completedAt && data.completedAt.toDate) {
      try {
        var d = data.completedAt.toDate();
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

  function pickIssueRepairText(data) {
    var parts = [];
    if (data.issue) parts.push("Issue: " + data.issue);
    if (data.techNotes) parts.push("Notes: " + String(data.techNotes).slice(0, 400));
    if (data.reasonForCall) parts.push("Reason: " + data.reasonForCall);
    if (data.diagnosis) parts.push("Diagnosis: " + data.diagnosis);
    if (data.repairsMade) parts.push("Repairs: " + data.repairsMade);
    if (!parts.length && data.jobType) parts.push("Job: " + data.jobType);
    return parts.join("\n\n") || "—";
  }

  async function viewEquipmentHistory(equipmentId) {
    hubState.selectedEquipmentId = equipmentId;
    var parsed = parseEquipmentId(equipmentId);
    var header = $("equipmentHubUnitHeader");
    var timeline = $("equipmentHubTimeline");
    if (!parsed || !header || !timeline) return;

    var profile = null;
    hubState.equipmentList.forEach(function (row) {
      if (row.id === parsed.unitDocId) profile = row.data;
    });
    hubState.selectedProfile = profile;

    var title =
      (profile && (profile.unitTag || profile.brand)) || parsed.unitDocId;
    var specs =
      (profile &&
        [
          profile.brand,
          profile.model,
          profile.serialJob ? "S/N " + profile.serialJob : "",
        ]
          .filter(Boolean)
          .join(" · ")) || "—";

    var healthLine =
      profile && profile.healthScore != null && profile.healthScore !== ""
        ? "<p><strong>Integrity score:</strong> " +
          escapeHtml(String(profile.healthScore)) +
          " — Grade " +
          escapeHtml(String(profile.healthGrade || "—")) +
          "</p>"
        : "";

    header.innerHTML =
      "<h3 class=\"equipment-hub-unit-title\">" +
      escapeHtml(String(title)) +
      "</h3>" +
      "<p class=\"equipment-hub-unit-specs\">" +
      escapeHtml(specs) +
      "</p>" +
      healthLine;

    timeline.innerHTML =
      "<p class=\"equipment-hub-loading\">Loading history…</p>";
    showHistoryView();

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      timeline.innerHTML =
        "<p class=\"equipment-hub-error\">Firebase not available.</p>";
      return;
    }

    var db = firebase.firestore();
    try {
      var snap = await db
        .collection("service_calls")
        .where("Linked_Equipment_ID", "==", equipmentId)
        .get();

      var items = [];
      snap.forEach(function (doc) {
        items.push({ id: doc.id, data: doc.data() || {} });
      });

      items.sort(function (a, b) {
        var da = formatServiceDate(a.data);
        var db_ = formatServiceDate(b.data);
        if (da < db_) return 1;
        if (da > db_) return -1;
        return 0;
      });

      if (!items.length) {
        timeline.innerHTML =
          "<p class=\"equipment-hub-empty\">No linked service calls yet. Complete a job with this unit selected in “Link repair to equipment” to build history.</p>";
        return;
      }

      var html = '<ul class="equipment-hub-timeline">';
      items.forEach(function (row) {
        var data = row.data;
        var tech =
          data.assignedTech ||
          data.techName ||
          (data.completedBy && data.completedBy.name) ||
          "—";
        var when = formatServiceDate(data);
        var body = escapeHtml(pickIssueRepairText(data)).replace(/\n/g, "<br>");
        html +=
          "<li class=\"equipment-hub-tl-item\">" +
          "<div class=\"equipment-hub-tl-date\">" +
          escapeHtml(when) +
          "</div>" +
          "<div class=\"equipment-hub-tl-tech\">" +
          escapeHtml(String(tech)) +
          "</div>" +
          "<div class=\"equipment-hub-tl-body\">" +
          body +
          "</div>" +
          "</li>";
      });
      html += "</ul>";
      timeline.innerHTML = html;
    } catch (e) {
      console.error("[EquipmentHub] history", e);
      timeline.innerHTML =
        "<p class=\"equipment-hub-error\">Could not load history. " +
        escapeHtml(e.message || String(e)) +
        "</p>";
    }
  }

  function onAddEquipmentClick() {
    if (typeof EquipmentManager === "undefined" || !EquipmentManager.open) {
      alert("Equipment scanner is not loaded.");
      return;
    }
    closeEquipmentHub();
    EquipmentManager.open({
      parentCompany: hubState.parentCompany,
      customer: hubState.customerName,
      locationDisplay: hubState.locationDisplay,
      locationId: hubState.locationId,
    });
  }

  /** Populate Job Status dropdown with units for the current ticket site (loads from Firestore). */
  function refreshJobLinkedEquipmentDropdown() {
    var sel = $("linkedEquipmentSelect");
    if (!sel) return;

    var locLine = getLocationLineForHub();
    if (typeof activeTicket === "undefined" || !activeTicket || !locLine) {
      sel.innerHTML = "<option value=\"\">— None —</option>";
      sel.disabled = true;
      return;
    }
    sel.disabled = false;

    var customerId = sanitizePathSegment(activeTicket.customerName || "");
    var locationId = sanitizePathSegment(locLine);
    var keep = sel.value;

    sel.innerHTML = "<option value=\"\">Loading…</option>";

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      sel.innerHTML = "<option value=\"\">— None —</option>";
      return;
    }

    var db = firebase.firestore();
    db.collection("Customers")
      .doc(customerId)
      .collection("Locations")
      .doc(locationId)
      .collection("Equipment")
      .get()
      .then(function (snap) {
        var rows = [];
        snap.forEach(function (doc) {
          rows.push({ id: doc.id, data: doc.data() || {} });
        });
        hubState.customerId = customerId;
        hubState.locationId = locationId;
        hubState.equipmentList = rows;

        var options = "<option value=\"\">— None —</option>";
        rows.forEach(function (row) {
          var d = row.data || {};
          var composite = makeEquipmentId(customerId, locationId, row.id);
          var label =
            (d.unitTag || d.brand || row.id || "Unit") +
            (d.model ? " — " + d.model : "");
          options +=
            "<option value=\"" +
            escapeHtml(composite) +
            "\">" +
            escapeHtml(label) +
            "</option>";
        });
        sel.innerHTML = options;
        if (
          keep &&
          [].slice.call(sel.options).some(function (o) {
            return o.value === keep;
          })
        ) {
          sel.value = keep;
        }
      })
      .catch(function (e) {
        console.error("[EquipmentHub] linked dropdown", e);
        sel.innerHTML = "<option value=\"\">— None —</option>";
      });
  }

  function initEquipmentHubUi() {
    var closeBtn = $("equipmentHubCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeEquipmentHub);
    }
    var backBtn = $("equipmentHubBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        showListView();
      });
    }
    var addBtn = $("equipmentHubAddBtn");
    if (addBtn) {
      addBtn.addEventListener("click", onAddEquipmentClick);
    }
    var openBtn = $("btnOpenEquipmentHub");
    if (openBtn) {
      openBtn.addEventListener("click", function () {
        openEquipmentHub();
      });
    }

    var hubModal = $("equipmentHubModal");
    if (hubModal) {
      hubModal.addEventListener("click", function (e) {
        if (e.target === hubModal) closeEquipmentHub();
      });
    }

    var linkedSel = $("linkedEquipmentSelect");
    if (linkedSel && typeof saveDraft === "function") {
      linkedSel.addEventListener("change", saveDraft);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEquipmentHubUi);
  } else {
    initEquipmentHubUi();
  }

  window.openEquipmentHub = openEquipmentHub;
  window.closeEquipmentHub = closeEquipmentHub;
  window.viewEquipmentHistory = viewEquipmentHistory;
  window.refreshJobLinkedEquipmentDropdown = refreshJobLinkedEquipmentDropdown;
})();
