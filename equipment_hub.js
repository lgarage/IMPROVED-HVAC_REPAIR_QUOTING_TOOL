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

  /** Currently swiped-open card row, if any. */
  var activeSwipeRow = null;

  function closeActiveSwipe() {
    if (activeSwipeRow && activeSwipeRow._snapBack) {
      activeSwipeRow._snapBack();
    }
    activeSwipeRow = null;
  }

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
    closeActiveSwipe();
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

  function isProfileVerified(d) {
    d = d || {};
    return !!(
      String(d.dataPlatePhotoUrl || "").trim() &&
      String(d.overallPhotoUrl || "").trim()
    );
  }

  function renderEquipmentList(docs) {
    var container = $("equipmentHubList");
    var meta = $("equipmentHubListMeta");
    if (!container) return;

    var verifiedCount = 0;
    var total = docs.length;
    docs.forEach(function (row) {
      if (isProfileVerified(row.data)) verifiedCount += 1;
    });
    var pct = total ? Math.round((verifiedCount / total) * 100) : 0;

    if (meta) {
      var coverageBar =
        total > 0
          ? "<div class=\"equipment-hub-coverage-wrap\" role=\"region\" aria-label=\"Verification coverage\">" +
            "<div class=\"equipment-hub-coverage-label\">Unit Coverage: <strong>" +
            verifiedCount +
            "/" +
            total +
            "</strong> Units Verified</div>" +
            "<div class=\"equipment-hub-progress\" role=\"progressbar\" aria-valuenow=\"" +
            verifiedCount +
            "\" aria-valuemin=\"0\" aria-valuemax=\"" +
            total +
            "\">" +
            "<div class=\"equipment-hub-progress-fill\" style=\"width:" +
            pct +
            "%\"></div></div></div>"
          : "";
      meta.innerHTML =
        coverageBar +
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

    // Reset any open swipe before re-rendering
    activeSwipeRow = null;
    container.innerHTML = "";

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
      var verified = isProfileVerified(d);
      var badgeHtml = verified
        ? "<span class=\"equipment-verified-strip\" title=\"Identity Verified: Photos &amp; Specs on file.\" aria-label=\"Identity Verified: Photos &amp; Specs on file.\"><span class=\"equipment-verified-shield\" aria-hidden=\"true\">🛡️</span><span class=\"equipment-verified-pill\">Verified</span></span>"
        : "";

      var swipeRow = document.createElement("div");
      swipeRow.className = "ehub-swipe-row";
      swipeRow.innerHTML =
        "<button type=\"button\" class=\"equipment-hub-card\" data-eid=\"" +
        escapeHtml(composite) +
        "\">" +
        "<span class=\"equipment-hub-card-title-row\">" +
        "<span class=\"equipment-hub-card-title\">" + escapeHtml(title) + "</span>" +
        badgeHtml +
        "</span>" +
        "<span class=\"equipment-hub-card-sub\">" + escapeHtml(sub) + "</span>" +
        "<span class=\"equipment-hub-card-health\">" + health + "</span>" +
        "</button>" +
        "<button type=\"button\" class=\"ehub-swipe-delete-btn\" aria-label=\"Delete " + escapeHtml(title) + "\">" +
        "<span aria-hidden=\"true\">🗑</span><span>Delete</span></button>";

      wireSwipeDelete(swipeRow, composite);
      container.appendChild(swipeRow);
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

    var photosHtml = "";
    if (profile) {
      var overallSrc = profile.overallPhotoUrl && String(profile.overallPhotoUrl).trim();
      var plateSrc   = profile.dataPlatePhotoUrl && String(profile.dataPlatePhotoUrl).trim();
      if (overallSrc || plateSrc) {
        photosHtml += "<div class=\"ehub-unit-photos\">";
        if (overallSrc) {
          photosHtml += "<button type=\"button\" class=\"ehub-unit-photo-wrap\" data-lightbox-src=\"" + escapeAttr(overallSrc) + "\" data-lightbox-alt=\"Overall photo\">" +
            "<img class=\"ehub-unit-photo\" src=\"" + escapeAttr(overallSrc) + "\" alt=\"Overall photo\" />" +
            "<span class=\"ehub-unit-photo-label\">Overall</span></button>";
        }
        if (plateSrc) {
          photosHtml += "<button type=\"button\" class=\"ehub-unit-photo-wrap\" data-lightbox-src=\"" + escapeAttr(plateSrc) + "\" data-lightbox-alt=\"Data plate\">" +
            "<img class=\"ehub-unit-photo\" src=\"" + escapeAttr(plateSrc) + "\" alt=\"Data plate\" />" +
            "<span class=\"ehub-unit-photo-label\">Data plate</span></button>";
        }
        photosHtml += "</div>";
      }
    }

    var actionBarHtml =
      "<div class=\"ehub-action-bar\">" +
      "<button type=\"button\" class=\"ehub-btn-edit\" id=\"ehubEditBtn\">✏ Edit Info</button>" +
      "<button type=\"button\" class=\"ehub-btn-reenter\" id=\"ehubReenterBtn\">🔄 Remove &amp; Re-scan</button>" +
      "<button type=\"button\" class=\"ehub-btn-delete\" id=\"ehubDeleteBtn\">🗑 Remove</button>" +
      "</div>";

    header.innerHTML =
      "<div class=\"ehub-title-row\">" +
      "<h3 class=\"equipment-hub-unit-title\">" + escapeHtml(String(title)) + "</h3>" +
      photosHtml +
      "</div>" +
      "<p class=\"equipment-hub-unit-specs\">" +
      escapeHtml(specs) +
      "</p>" +
      healthLine +
      buildProfileDetailsHtml(profile) +
      actionBarHtml;

    // Wire thumbnail tap → fullscreen lightbox
    header.querySelectorAll(".ehub-unit-photo-wrap[data-lightbox-src]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openPhotoLightbox(btn.getAttribute("data-lightbox-src"), btn.getAttribute("data-lightbox-alt") || "Photo");
      });
    });

    var editBtn = document.getElementById("ehubEditBtn");
    if (editBtn) {
      editBtn.addEventListener("click", function () {
        editEquipmentUnit(equipmentId);
      });
    }
    var deleteBtn = document.getElementById("ehubDeleteBtn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        deleteEquipmentUnit(equipmentId, false);
      });
    }
    var reenterBtn = document.getElementById("ehubReenterBtn");
    if (reenterBtn) {
      reenterBtn.addEventListener("click", function () {
        deleteEquipmentUnit(equipmentId, true);
      });
    }

    timeline.innerHTML =
      "<p class=\"equipment-hub-loading\">Loading history…</p>";
    showHistoryView();

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      timeline.innerHTML =
        "<p class=\"equipment-hub-error\">Firebase not available.</p>";
      return;
    }

    var db = firebase.firestore();
    var sc =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.serviceCalls(db)
        : db.collection("service_calls");
    var pmCol =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.pmRecords(db)
        : db.collection("pm_records");
    var fqCol =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.fieldQuotes(db)
        : db.collection("field_quotes");
    var crCol =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.completedReports(db)
        : db.collection("completed_reports");
    var ffCol =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.fieldFormSubmissions(db)
        : db.collection("field_form_submissions");
    var whCol = db
      .collection("Customers")
      .doc(parsed.customerId)
      .collection("Locations")
      .doc(parsed.locationId)
      .collection("Equipment")
      .doc(parsed.unitDocId)
      .collection("work_history");
    try {
      var results = await Promise.all([
        sc.where("Linked_Equipment_ID", "==", equipmentId).get(),
        pmCol.where("equipmentId", "==", equipmentId).get(),
        fqCol.where("equipmentId", "==", equipmentId).get(),
        crCol.where("Linked_Equipment_ID", "==", equipmentId).get(),
        ffCol.where("equipmentId", "==", equipmentId).get(),
        whCol.orderBy("createdAt", "desc").limit(50).get()
      ]);
      var snapCalls = results[0];
      var snapPm = results[1];
      var snapQuotes = results[2];
      var snapReports = results[3];
      var snapForms = results[4];
      var snapWorkHistory = results[5];

      var merged = [];

      snapCalls.forEach(function (doc) {
        var data = doc.data() || {};
        merged.push({
          kind: "service_call",
          id: doc.id,
          data: data,
          sortKey: formatServiceDate(data) + "_" + doc.id,
        });
      });

      snapPm.forEach(function (doc) {
        var data = doc.data() || {};
        var dk = data.date || (data.savedAt && String(data.savedAt).slice(0, 10)) || "1970-01-01";
        merged.push({
          kind: "pm",
          id: doc.id,
          data: data,
          sortKey: dk + "_pm_" + doc.id,
        });
      });

      snapQuotes.forEach(function (doc) {
        var data = doc.data() || {};
        var dk = data.date || (data.savedAt && String(data.savedAt).slice(0, 10)) || "1970-01-01";
        merged.push({
          kind: "quote",
          id: doc.id,
          data: data,
          sortKey: dk + "_q_" + doc.id,
        });
      });

      snapReports.forEach(function (doc) {
        var data = doc.data() || {};
        var dk = data.deviceSavedAt
          ? String(data.deviceSavedAt).slice(0, 10)
          : (data.savedAt && String(data.savedAt).slice(0, 10)) || "1970-01-01";
        merged.push({
          kind: "completed_report",
          id: doc.id,
          data: data,
          sortKey: dk + "_cr_" + doc.id,
        });
      });

      snapForms.forEach(function (doc) {
        var data = doc.data() || {};
        var dk = data.date || (data.savedAt && String(data.savedAt).slice(0, 10)) || "1970-01-01";
        merged.push({
          kind: "field_form",
          id: doc.id,
          data: data,
          sortKey: dk + "_ff_" + doc.id,
        });
      });

      snapWorkHistory.forEach(function (doc) {
        var data = doc.data() || {};
        var dk = data.date || (data.savedAt && String(data.savedAt).slice(0, 10)) || "1970-01-01";
        merged.push({
          kind: "work_notes",
          id: doc.id,
          data: data,
          sortKey: dk + "_wn_" + doc.id,
        });
      });

      merged.sort(function (a, b) {
        if (a.sortKey < b.sortKey) return 1;
        if (a.sortKey > b.sortKey) return -1;
        return 0;
      });

      if (!merged.length) {
        timeline.innerHTML =
          "<p class=\"equipment-hub-empty\">No history for this unit yet. Link service calls, save PM forms, or save repair quotes with this equipment selected.</p>";
        return;
      }

      var html = '<ul class="equipment-hub-timeline">';
      merged.forEach(function (row) {
        if (row.kind === "service_call") {
          var data = row.data;
          var tech =
            (Array.isArray(data.assignedTechs) && data.assignedTechs.length
              ? data.assignedTechs.join(", ")
              : "") ||
            data.assignedTech ||
            data.techName ||
            (data.completedBy && data.completedBy.name) ||
            "—";
          var when = formatServiceDate(data);
          var body = escapeHtml(pickIssueRepairText(data)).replace(/\n/g, "<br>");
          html +=
            "<li class=\"equipment-hub-tl-item equipment-hub-tl-service\">" +
            "<div class=\"equipment-hub-tl-badge\">Service call</div>" +
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
        } else if (row.kind === "pm") {
          var pm = row.data;
          var whenPm = pm.date || (pm.savedAt && String(pm.savedAt).slice(0, 10)) || "—";
          var techPm = pm.techName || "—";
          var pmBody =
            "Filter: " +
            escapeHtml(String(pm.filterSize || "—")) +
            "<br>Belt: " +
            escapeHtml(String(pm.beltSize || "—")) +
            (pm.notes
              ? "<br>Notes: " + escapeHtml(String(pm.notes)).replace(/\n/g, "<br>")
              : "");
          html +=
            "<li class=\"equipment-hub-tl-item equipment-hub-tl-pm\">" +
            "<div class=\"equipment-hub-tl-badge\">PM checklist</div>" +
            "<div class=\"equipment-hub-tl-date\">" +
            escapeHtml(String(whenPm)) +
            "</div>" +
            "<div class=\"equipment-hub-tl-tech\">" +
            escapeHtml(String(techPm)) +
            "</div>" +
            "<div class=\"equipment-hub-tl-body\">" +
            pmBody +
            "</div>" +
            "</li>";
        } else if (row.kind === "quote") {
          var q = row.data;
          var whenQ = q.date || (q.savedAt && String(q.savedAt).slice(0, 10)) || "—";
          var techQ = q.techName || "—";
          var partsStr = Array.isArray(q.partsArray)
            ? q.partsArray.join(", ")
            : String(q.partsArray || "—");
          var qBody =
            "<strong>Quote</strong><br>" +
            escapeHtml(String(q.description || "—")).replace(/\n/g, "<br>") +
            "<br><br>Parts: " +
            escapeHtml(partsStr) +
            "<br>Labor (hrs): " +
            escapeHtml(String(q.laborHours != null ? q.laborHours : "—"));
          var thumbs = "";
          var dpSrc = q.dataPlatePhotoUrl && String(q.dataPlatePhotoUrl).trim();
          if (dpSrc) {
            thumbs += "<div class=\"equipment-hub-dp-wrap\">";
            thumbs +=
              "<span class=\"equipment-hub-dp-label\">Data plate (source photo)</span>";
            thumbs +=
              "<a href=\"" +
              escapeAttr(dpSrc) +
              "\" target=\"_blank\" rel=\"noopener\">" +
              "<img class=\"equipment-hub-dp-thumb\" src=\"" +
              escapeAttr(dpSrc) +
              "\" alt=\"Data plate\"/></a>";
            thumbs += "</div>";
          }
          if (q.evidencePhotoUrls && q.evidencePhotoUrls.length) {
            thumbs += "<div class=\"equipment-hub-evidence\">";
            q.evidencePhotoUrls.forEach(function (url) {
              thumbs +=
                "<a href=\"" +
                escapeAttr(url) +
                "\" target=\"_blank\" rel=\"noopener\">" +
                "<img src=\"" +
                escapeAttr(url) +
                "\" alt=\"Evidence\"/></a>";
            });
            thumbs += "</div>";
          }
          html +=
            "<li class=\"equipment-hub-tl-item equipment-hub-tl-quote\">" +
            "<div class=\"equipment-hub-tl-badge\">Repair quote</div>" +
            "<div class=\"equipment-hub-tl-date\">" +
            escapeHtml(String(whenQ)) +
            "</div>" +
            "<div class=\"equipment-hub-tl-tech\">" +
            escapeHtml(String(techQ)) +
            "</div>" +
            "<div class=\"equipment-hub-tl-body\">" +
            qBody +
            thumbs +
            "</div>" +
            "</li>";
        } else if (row.kind === "completed_report") {
          var cr = row.data;
          var whenCr = cr.deviceSavedAt
            ? String(cr.deviceSavedAt).slice(0, 10)
            : (cr.savedAt && String(cr.savedAt).slice(0, 10)) || "—";
          var techCr = cr.techName || "—";
          var statusCr = cr.status || "—";
          var crBody = "";
          if (cr.fullReportText) {
            crBody = escapeHtml(String(cr.fullReportText).slice(0, 600)).replace(/\n/g, "<br>");
            if (cr.fullReportText.length > 600) crBody += "<br><em>… (truncated)</em>";
          } else {
            var crParts = [];
            if (cr.diagnosis) crParts.push("Diagnosis: " + cr.diagnosis);
            if (cr.repairsMade) crParts.push("Repairs: " + cr.repairsMade);
            if (cr.recommendations) crParts.push("Recs: " + cr.recommendations);
            if (cr.techNotes) crParts.push("Notes: " + String(cr.techNotes).slice(0, 400));
            crBody = crParts.length
              ? escapeHtml(crParts.join("\n\n")).replace(/\n/g, "<br>")
              : "—";
          }
          html +=
            "<li class=\"equipment-hub-tl-item equipment-hub-tl-report\">" +
            "<div class=\"equipment-hub-tl-badge\">Completed report</div>" +
            "<div class=\"equipment-hub-tl-date\">" +
            escapeHtml(String(whenCr)) +
            "</div>" +
            "<div class=\"equipment-hub-tl-tech\">" +
            escapeHtml(String(techCr)) +
            "</div>" +
            "<div class=\"equipment-hub-tl-status\">Status: " +
            escapeHtml(String(statusCr)) +
            "</div>" +
            "<div class=\"equipment-hub-tl-body\">" +
            crBody +
            "</div>" +
            "</li>";
        } else if (row.kind === "field_form") {
          var ff = row.data;
          var whenFf = ff.date || (ff.savedAt && String(ff.savedAt).slice(0, 10)) || "—";
          var techFf = ff.techName || "—";
          var formLabel = ff.templateName || ff.templateId || ff.formType || "Form";
          var ffBody = "";
          if (ff.fieldValues && typeof ff.fieldValues === "object") {
            var ffLines = [];
            Object.keys(ff.fieldValues).forEach(function (k) {
              var v = ff.fieldValues[k];
              if (v != null && String(v).trim() !== "") {
                ffLines.push(escapeHtml(k) + ": " + escapeHtml(String(v)));
              }
            });
            ffBody = ffLines.length ? ffLines.join("<br>") : "—";
          } else {
            ffBody = "—";
          }
          html +=
            "<li class=\"equipment-hub-tl-item equipment-hub-tl-form\">" +
            "<div class=\"equipment-hub-tl-badge\">" + escapeHtml(String(formLabel)) + "</div>" +
            "<div class=\"equipment-hub-tl-date\">" +
            escapeHtml(String(whenFf)) +
            "</div>" +
            "<div class=\"equipment-hub-tl-tech\">" +
            escapeHtml(String(techFf)) +
            "</div>" +
            "<div class=\"equipment-hub-tl-body\">" +
            ffBody +
            "</div>" +
            "</li>";
        } else if (row.kind === "work_notes") {
          var wn = row.data;
          var whenWn = wn.date || (wn.savedAt && String(wn.savedAt).slice(0, 10)) || "—";
          var techWn = wn.techName || "—";
          var wnLines = [];
          if (wn.findings) wnLines.push("<strong>Findings:</strong> " + escapeHtml(String(wn.findings)));
          if (wn.repairs) wnLines.push("<strong>Repairs:</strong> " + escapeHtml(String(wn.repairs)));
          if (wn.recommendations) wnLines.push("<strong>Recommendations:</strong> " + escapeHtml(String(wn.recommendations)));
          if (wn.partsUsed) wnLines.push("<strong>Parts:</strong> " + escapeHtml(String(wn.partsUsed)));
          var wnBody = wnLines.length ? wnLines.join("<br>") : "—";
          var wnTicketRef = wn.ticketId ? "<div class=\"equipment-hub-tl-status\">Job: " + escapeHtml(String(wn.ticketId)) + "</div>" : "";
          html +=
            "<li class=\"equipment-hub-tl-item equipment-hub-tl-worknotes\">" +
            "<div class=\"equipment-hub-tl-badge\">Parsed field notes</div>" +
            "<div class=\"equipment-hub-tl-date\">" +
            escapeHtml(String(whenWn)) +
            "</div>" +
            "<div class=\"equipment-hub-tl-tech\">" +
            escapeHtml(String(techWn)) +
            "</div>" +
            wnTicketRef +
            "<div class=\"equipment-hub-tl-body\">" +
            wnBody +
            "</div>" +
            "</li>";
        }
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

  /**
   * Wire iOS-style swipe-left-to-reveal-delete on a .ehub-swipe-row element.
   * Tapping the card face (no swipe) opens the unit detail view as normal.
   */
  function wireSwipeDelete(swipeRow, eid) {
    var card = swipeRow.querySelector(".equipment-hub-card");
    var delBtn = swipeRow.querySelector(".ehub-swipe-delete-btn");
    if (!card) return;

    var REVEAL = 80;
    var THRESHOLD = 50;
    var startX, startY, baseOffset, isSwiping, isScrolling, didSwipe, isRevealed;
    isRevealed = false;

    function snapTo(offset, animated) {
      isRevealed = offset < -1;
      card.style.transition = animated ? "transform 0.2s ease" : "none";
      card.style.transform = "translateX(" + offset + "px)";
      if (isRevealed) {
        if (activeSwipeRow && activeSwipeRow !== swipeRow) {
          var prev = activeSwipeRow;
          activeSwipeRow = null;
          if (prev._snapBack) prev._snapBack();
        }
        activeSwipeRow = swipeRow;
      } else {
        if (activeSwipeRow === swipeRow) activeSwipeRow = null;
      }
    }

    swipeRow._snapBack = function () { snapTo(0, true); };

    card.addEventListener("touchstart", function (e) {
      var t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      baseOffset = isRevealed ? -REVEAL : 0;
      isSwiping = false;
      isScrolling = false;
      didSwipe = false;
      card.style.transition = "none";
    }, { passive: true });

    card.addEventListener("touchmove", function (e) {
      var t = e.touches[0];
      var dx = t.clientX - startX;
      var dy = t.clientY - startY;
      // Direction lock: once decided, never re-evaluate for this gesture
      if (isScrolling) return;
      if (!isSwiping) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        if (Math.abs(dy) > Math.abs(dx)) { isScrolling = true; return; }
        isSwiping = true;
      }
      e.preventDefault();
      var off = Math.max(-REVEAL, Math.min(0, baseOffset + dx));
      card.style.transform = "translateX(" + off + "px)";
    }, { passive: false });

    card.addEventListener("touchend", function (e) {
      if (!isSwiping) return;
      isSwiping = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - startX;
      var finalOff = baseOffset + dx;
      if (finalOff < -THRESHOLD) {
        snapTo(-REVEAL, true);
        didSwipe = true;
      } else if (isRevealed && finalOff > -(REVEAL / 2)) {
        snapTo(0, true);
        didSwipe = true;
      } else if (isRevealed) {
        snapTo(-REVEAL, true);
        if (Math.abs(dx) > 5) didSwipe = true;
      } else {
        snapTo(0, true);
        if (Math.abs(dx) > 5) didSwipe = true;
      }
    });

    card.addEventListener("click", function () {
      if (didSwipe) { didSwipe = false; return; }
      if (isRevealed) { snapTo(0, true); return; }
      closeActiveSwipe();
      viewEquipmentHistory(eid);
    });

    if (delBtn) {
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteEquipmentUnit(eid, false);
      });
    }
  }

  /** Open EquipmentManager pre-filled with the saved profile — no delete. */
  function editEquipmentUnit(equipmentId) {
    var parsed = parseEquipmentId(equipmentId);
    if (!parsed) return;
    var profile = null;
    hubState.equipmentList.forEach(function (row) {
      if (row.id === parsed.unitDocId) profile = row.data;
    });
    if (typeof EquipmentManager === "undefined" || !EquipmentManager.open) {
      alert("Equipment scanner is not loaded.");
      return;
    }
    closeEquipmentHub();
    EquipmentManager.open({
      parentCompany:   hubState.parentCompany,
      customer:        hubState.customerName,
      locationDisplay: hubState.locationDisplay,
      locationId:      hubState.locationId,
      prefill:         profile || {},
    });
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  /** Best-effort delete a Firebase Storage file given its download URL. */
  function tryDeleteStorageFile(url) {
    try {
      if (!url || typeof firebase === "undefined" || !firebase.storage) return;
      var match = String(url).match(/\/o\/([^?#]+)/);
      if (!match) return;
      var storagePath = decodeURIComponent(match[1]);
      firebase.storage().ref(storagePath).delete().catch(function () {});
    } catch (e) {}
  }

  /**
   * Delete an equipment unit from Firestore (and best-effort its Storage photos).
   * @param {string} equipmentId  composite "customerId/locationId/unitDocId"
   * @param {boolean} thenReenter  if true, open EquipmentManager afterwards with pre-filled data
   */
  async function deleteEquipmentUnit(equipmentId, thenReenter) {
    var parsed = parseEquipmentId(equipmentId);
    if (!parsed) return;

    var profile = null;
    hubState.equipmentList.forEach(function (row) {
      if (row.id === parsed.unitDocId) profile = row.data;
    });
    var label = (profile && (profile.unitTag || profile.brand)) || parsed.unitDocId;

    var msg = thenReenter
      ? "Remove \"" + label + "\" and open the AI scanner to re-enter it?"
      : "Remove \"" + label + "\" from the Equipment Hub? This cannot be undone.";
    if (!window.confirm(msg)) return;

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      alert("Firebase not available.");
      return;
    }

    var db = firebase.firestore();
    try {
      await db
        .collection("Customers").doc(parsed.customerId)
        .collection("Locations").doc(parsed.locationId)
        .collection("Equipment").doc(parsed.unitDocId)
        .delete();
    } catch (e) {
      alert("Could not delete unit: " + (e.message || String(e)));
      return;
    }

    // Best-effort clean up Storage photos
    if (profile) {
      if (profile.overallPhotoUrl)   tryDeleteStorageFile(profile.overallPhotoUrl);
      if (profile.dataPlatePhotoUrl) tryDeleteStorageFile(profile.dataPlatePhotoUrl);
    }

    // Remove from in-memory list and go back to list view
    hubState.equipmentList = hubState.equipmentList.filter(function (row) {
      return row.id !== parsed.unitDocId;
    });
    hubState.selectedEquipmentId = "";
    hubState.selectedProfile = null;
    renderEquipmentList(hubState.equipmentList);
    showListView();

    if (thenReenter) {
      if (typeof EquipmentManager === "undefined" || !EquipmentManager.open) {
        alert("Equipment scanner is not loaded.");
        return;
      }
      closeEquipmentHub();
      EquipmentManager.open({
        parentCompany:   hubState.parentCompany,
        customer:        hubState.customerName,
        locationDisplay: hubState.locationDisplay,
        locationId:      hubState.locationId,
        prefill:         profile || {},
      });
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

  /** Populate linked-equipment dropdown (site units from Firestore). */
  function refreshJobLinkedEquipmentDropdown() {
    var sel = $("linkedEquipmentSelect");
    if (!sel) return;
    if (typeof window.refreshSmartEquipmentSelect === "function") {
      window.refreshSmartEquipmentSelect(sel, sel.value).then(function () {
        if (typeof window.bindSmartEquipmentSelect === "function") {
          window.bindSmartEquipmentSelect(sel);
        }
      });
    }
  }

  function buildProfileDetailsHtml(profile) {
    if (!profile) return "";
    var rows = [
      ["Unit Tag",          profile.unitTag],
      ["Brand",             profile.brand],
      ["Model",             profile.model],
      ["Serial #",          profile.serialJob],
      ["Manufacture Year",  profile.manufactureYear],
      ["Age",               profile.ageYears ? profile.ageYears + " yrs" : ""],
      ["Refrigerant",       profile.refrigerant],
      ["Tonnage",           profile.tonnage ? profile.tonnage + " ton" : ""],
      ["Voltage / Phase",   [profile.voltage, profile.phase].filter(Boolean).join(" / ")],
      ["Integrity Score",   profile.healthScore != null && profile.healthScore !== ""
                              ? profile.healthScore + " — Grade " + (profile.healthGrade || "?")
                              : ""],
      ["Est. CRV",          profile.estimatedCRV ? "$" + profile.estimatedCRV : ""],
      ["Prior Repairs",     profile.totalPreviousRepairs ? "$" + profile.totalPreviousRepairs : ""],
      ["Proposed Repair",   profile.proposedRepairCost ? "$" + profile.proposedRepairCost : ""],
    ];

    var cells = rows
      .filter(function (r) { return r[1] && String(r[1]).trim() !== ""; })
      .map(function (r) {
        return "<div class=\"ehub-detail-cell\">" +
          "<span class=\"ehub-detail-label\">" + escapeHtml(r[0]) + "</span>" +
          "<span class=\"ehub-detail-value\">" + escapeHtml(String(r[1])) + "</span>" +
          "</div>";
      })
      .join("");

    if (!cells) return "";
    return "<div class=\"ehub-detail-grid\">" + cells + "</div>";
  }

  function openPhotoLightbox(src, alt) {
    var existing = document.getElementById("ehubLightboxOverlay");
    if (existing) existing.parentNode.removeChild(existing);

    var overlay = document.createElement("div");
    overlay.id = "ehubLightboxOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", alt || "Photo");

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.id = "ehubLightboxClose";
    closeBtn.setAttribute("aria-label", "Close photo");
    closeBtn.textContent = "✕";

    var img = document.createElement("img");
    img.src = src;
    img.alt = alt || "Photo";
    img.id = "ehubLightboxImg";

    overlay.appendChild(closeBtn);
    overlay.appendChild(img);
    document.body.appendChild(overlay);

    function dismiss() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    closeBtn.addEventListener("click", function (e) { e.stopPropagation(); dismiss(); });
    overlay.addEventListener("click", dismiss);
    img.addEventListener("click", function (e) { e.stopPropagation(); });
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEquipmentHubUi);
  } else {
    initEquipmentHubUi();
  }

  /**
   * Optimistically upsert a unit into the in-memory list and re-render.
   * Called by EquipmentManager right after the modal closes so the card
   * is visible before the background Firestore write completes.
   */
  function injectEquipmentUnit(unitDocId, data) {
    var idx = -1;
    hubState.equipmentList.forEach(function (row, i) {
      if (row.id === unitDocId) idx = i;
    });
    if (idx >= 0) {
      hubState.equipmentList[idx] = { id: unitDocId, data: data };
    } else {
      hubState.equipmentList.push({ id: unitDocId, data: data });
    }
    renderEquipmentList(hubState.equipmentList);
  }

  /**
   * Re-fetch the equipment list for the current site from Firestore.
   * Called by EquipmentManager after the background upload + Firestore
   * write completes so the list reflects real photo URLs and the
   * Verified badge.  If the detail view is currently open it is also
   * re-rendered so photos appear without the tech having to navigate back.
   */
  function refreshEquipmentHubList() {
    if (!hubState.customerId || !hubState.locationId) return;
    var selectedId = hubState.selectedEquipmentId;
    fetchEquipmentForSite(hubState.customerId, hubState.locationId).then(function () {
      // Re-render the open detail view so photos + full data show up
      var histView = $("equipmentHubViewHistory");
      if (selectedId && histView && !histView.classList.contains("hidden")) {
        viewEquipmentHistory(selectedId);
      }
    });
  }

  /**
   * Opens EquipmentManager directly (add a new unit) without first
   * opening the Equipment Hub list — used by the workspace hamburger menu.
   * Resolves location context from activeTicket the same way openEquipmentHub does.
   */
  function openAddEquipmentDirect() {
    if (typeof activeTicket === "undefined" || !activeTicket) {
      alert("Select a job from your schedule first.");
      return;
    }
    if (typeof EquipmentManager === "undefined" || !EquipmentManager.open) {
      alert("Equipment scanner is not loaded.");
      return;
    }
    var locLine = getLocationLineForHub();
    if (!locLine) {
      alert("Set a location on this ticket before adding equipment.");
      return;
    }
    var customerId = sanitizePathSegment(activeTicket.customerName || "");
    var locationId = sanitizePathSegment(locLine);
    resolveParentCompany(locLine).then(function (pc) {
      EquipmentManager.open({
        parentCompany:   pc || "—",
        customer:        activeTicket.customerName || "—",
        locationDisplay: locLine,
        locationId:      locationId,
      });
    });
  }

  window.openEquipmentHub = openEquipmentHub;
  window.closeEquipmentHub = closeEquipmentHub;
  window.openAddEquipmentDirect = openAddEquipmentDirect;
  window.viewEquipmentHistory = viewEquipmentHistory;
  window.refreshJobLinkedEquipmentDropdown = refreshJobLinkedEquipmentDropdown;
  window.injectEquipmentUnit = injectEquipmentUnit;
  window.refreshEquipmentHubList = refreshEquipmentHubList;
  window.deleteEquipmentUnit = deleteEquipmentUnit;
  window.editEquipmentUnit = editEquipmentUnit;
})();
