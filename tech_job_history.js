/**
 * Technician "My jobs (30 days)" under History tab — list, detail, open workspace.
 * Depends on: firebase, currentTechProfile, myTickets, activeTicket, openWorkspace, switchScreen.
 */
(function () {
  "use strict";

  var selectedHistoryJobId = null;

  function pad2(n) {
    return String(n).length < 2 ? "0" + n : String(n);
  }

  function ymdFromDate(d) {
    return (
      d.getFullYear() +
      "-" +
      pad2(d.getMonth() + 1) +
      "-" +
      pad2(d.getDate())
    );
  }

  function minDate30DaysAgo() {
    var d = new Date();
    d.setDate(d.getDate() - 30);
    return ymdFromDate(d);
  }

  function todayYmd() {
    return ymdFromDate(new Date());
  }

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatAddendumTs(ts) {
    if (!ts) return "—";
    try {
      if (typeof ts.toDate === "function") {
        return ts.toDate().toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }
      if (ts.seconds != null) {
        return new Date(ts.seconds * 1000).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }
    } catch (e) {}
    return "—";
  }

  async function fetchTicketForWorkspace(ticketId) {
    if (typeof firebase === "undefined" || !firebase.apps.length) return null;
    var snap = await firebase
      .firestore()
      .collection("service_calls")
      .doc(ticketId)
      .get();
    if (!snap.exists) return null;
    var data = snap.data() || {};
    data.id = ticketId;
    return data;
  }

  /**
   * Ensure ticket is on myTickets and open workspace (for past jobs from history).
   */
  window.openJobFromHistoryInWorkspace = async function (ticketId) {
    if (!ticketId || typeof openWorkspace !== "function") return;
    var t = await fetchTicketForWorkspace(ticketId);
    if (!t) {
      alert("Could not load this ticket.");
      return;
    }
    if (typeof myTickets !== "undefined" && Array.isArray(myTickets)) {
      if (!myTickets.some(function (x) { return x.id === ticketId; })) {
        myTickets.push(t);
      }
    }
    openWorkspace(ticketId);
  };

  async function loadTechJobs30Days() {
    var container = $("techJobs30List");
    if (!container) return;
    if (!currentTechProfile) {
      container.innerHTML =
        "<p style=\"color:#7f8c8d;padding:16px;\">Sign in to see your jobs.</p>";
      return;
    }
    if (typeof firebase === "undefined" || !firebase.apps.length) {
      container.innerHTML =
        "<p style=\"color:#e74c3c;padding:16px;\">Offline — connect to load jobs.</p>";
      return;
    }

    container.innerHTML =
      "<p style=\"text-align:center;padding:24px;color:#95a5a6;\">Loading…</p>";

    var minD = minDate30DaysAgo();
    var maxD = todayYmd();

    try {
      var snap = await firebase
        .firestore()
        .collection("service_calls")
        .where("assignedTech", "==", currentTechProfile)
        .get();

      var rows = [];
      snap.forEach(function (doc) {
        var data = doc.data() || {};
        var d = data.date;
        if (!d || typeof d !== "string") return;
        if (d < minD || d > maxD) return;
        data._docId = doc.id;
        rows.push(data);
      });

      rows.sort(function (a, b) {
        if ((a.date || "") < (b.date || "")) return 1;
        if ((a.date || "") > (b.date || "")) return -1;
        return 0;
      });

      if (!rows.length) {
        container.innerHTML =
          "<p style=\"padding:16px;color:#7f8c8d;\">No jobs in the last 30 days.</p>";
        return;
      }

      var pinSvg =
        '<svg class="nav-map-pin" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';

      var html = "";
      rows.forEach(function (job) {
        var id = job._docId;
        var title =
          (job.ticketNum || "—") +
          " · " +
          (job.customerName || "—") +
          " · " +
          (job.date || "");
        var navAddr =
          typeof window.buildTicketNavAddress === "function"
            ? window.buildTicketNavAddress(job)
            : [job.locationAddress, job.custCity, job.custState].filter(Boolean).join(", ");
        var safeNav = JSON.stringify(navAddr || "");
        var mapLine = navAddr
          ? "<button type=\"button\" class=\"card-address-nav tech-job-card-map-line\" onclick='event.stopPropagation();launchNavigation(" +
            safeNav +
            ")' aria-label=\"Open address in maps\">" +
            pinSvg +
            '<span class="card-address-text">' +
            escapeHtml(navAddr) +
            "</span></button>"
          : "<div class=\"card-address--empty\" style=\"margin-top:8px;padding-top:8px;border-top:1px solid #eef1f4;width:100%;color:#95a5a6;font-size:13px;\">📍 No address on file</div>";

        html +=
          "<div class=\"tech-job-card\" tabindex=\"0\" role=\"button\" data-ticket-id=\"" +
          escapeHtml(id) +
          "\">" +
          "<span class=\"tech-job-card-title\">" +
          escapeHtml(String(job.jobType || "Job")) +
          "</span>" +
          "<span class=\"tech-job-card-sub\">" +
          escapeHtml(title) +
          "</span>" +
          "<span class=\"tech-job-card-meta\">" +
          escapeHtml(String(job.status || "—")) +
          "</span>" +
          mapLine +
          "</div>";
      });
      container.innerHTML = html;

      container.querySelectorAll(".tech-job-card").forEach(function (card) {
        card.addEventListener("click", function (e) {
          if (e.target.closest(".card-address-nav")) return;
          var tid = card.getAttribute("data-ticket-id");
          if (tid) showTechJobDetail(tid);
        });
        card.addEventListener("keydown", function (e) {
          if (e.key !== "Enter" && e.key !== " ") return;
          if (e.target.closest(".card-address-nav")) return;
          e.preventDefault();
          var tid = card.getAttribute("data-ticket-id");
          if (tid) showTechJobDetail(tid);
        });
      });
    } catch (e) {
      console.error("loadTechJobs30Days", e);
      container.innerHTML =
        "<p style=\"color:#e74c3c;padding:16px;\">Could not load jobs.</p>";
    }
  }

  async function showTechJobDetail(ticketId) {
    selectedHistoryJobId = ticketId;
    var listEl = $("techJobs30List");
    var detailEl = $("techJobDetailView");
    var backBtn = $("techJobDetailBack");
    if (listEl) listEl.classList.add("hidden");
    if (detailEl) detailEl.classList.remove("hidden");
    if (backBtn) backBtn.classList.remove("hidden");

    var body = $("techJobDetailBody");
    if (!body) return;
    body.innerHTML =
      "<p style=\"color:#95a5a6;\">Loading…</p>";

    var job = await fetchTicketForWorkspace(ticketId);
    if (!job) {
      body.innerHTML = "<p>Ticket not found.</p>";
      return;
    }

    var navAddrDetail =
      typeof window.buildTicketNavAddress === "function"
        ? window.buildTicketNavAddress(job)
        : [job.locationAddress, job.custCity, job.custState].filter(Boolean).join(", ");
    var safeNavDetail = JSON.stringify(navAddrDetail || "");
    var pinSvgDetail =
      '<svg class="nav-map-pin" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
    var addressBlock =
      navAddrDetail
        ? "<button type=\"button\" class=\"card-address-nav\" style=\"margin:0 0 10px 0;padding-left:0\" onclick='launchNavigation(" +
          safeNavDetail +
          ")' aria-label=\"Open address in maps\">" +
          pinSvgDetail +
          '<span class="card-address-text">' +
          escapeHtml(navAddrDetail) +
          "</span></button>"
        : "<p style=\"margin:0 0 10px 0;font-size:13px;color:#95a5a6;\">📍 No address on file</p>";

    var head =
      "<h3 style=\"margin:0 0 8px 0;color:#1e4b85;\">" +
      escapeHtml(String(job.ticketNum || ticketId)) +
      "</h3>" +
      "<p style=\"margin:0 0 6px 0;font-size:14px;\"><strong>" +
      escapeHtml(String(job.customerName || "—")) +
      "</strong></p>" +
      addressBlock +
      "<p style=\"margin:0 0 12px 0;font-size:13px;color:#555;\">Date: " +
      escapeHtml(String(job.date || "—")) +
      " · Status: " +
      escapeHtml(String(job.status || "—")) +
      "</p>";

    var actions =
      "<div class=\"tech-job-detail-actions\">" +
      "<button type=\"button\" class=\"btn btn-primary\" id=\"techJobOpenWorkspace\">Open in workspace</button>" +
      "<button type=\"button\" class=\"btn btn-primary\" style=\"background:#16a085;margin-top:8px\" id=\"techJobLaunchPm\">Standard PM</button>" +
      "<button type=\"button\" class=\"btn btn-primary\" style=\"background:#8e44ad;margin-top:8px\" id=\"techJobLaunchQuote\">Repair Quote</button>" +
      "<button type=\"button\" class=\"btn btn-primary\" style=\"background:#34495e;margin-top:8px\" id=\"techJobAiScan\">Check notes for required forms (AI)</button>" +
      "</div>";

    var manualRow =
      "<div class=\"tech-job-manual-form-wrap\" style=\"margin-top:14px\">" +
      "<label style=\"font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:6px;\">Custom form (manual)</label>" +
      "<select id=\"techJobManualForm\" style=\"width:100%;padding:12px;border-radius:8px;border:1px solid #d1d9e0;font-size:15px;font-family:inherit;\">" +
      "<option value=\"\">— Choose template —</option></select></div>";

    var formsHtml = "<h4 style=\"margin:16px 0 8px 0;\">Saved forms for this ticket</h4>";
    try {
      var db = firebase.firestore();
      var pmSnap = await db
        .collection("pm_records")
        .where("ticketId", "==", ticketId)
        .get();
      var qSnap = await db
        .collection("field_quotes")
        .where("ticketId", "==", ticketId)
        .get();
      var dynSnap = await db
        .collection("field_form_submissions")
        .where("ticketId", "==", ticketId)
        .get();

      var blocks = [];
      pmSnap.forEach(function (d) {
        var x = d.data() || {};
        blocks.push(
          "<li><strong>PM</strong> " +
            escapeHtml(String(x.date || "")) +
            " — " +
            escapeHtml(String(x.filterSize || "") + " / belt " + String(x.beltSize || "")) +
            "</li>"
        );
      });
      qSnap.forEach(function (d) {
        var x = d.data() || {};
        blocks.push(
          "<li><strong>Quote</strong> " +
            escapeHtml(String(x.date || "")) +
            " — " +
            escapeHtml(String(x.description || "").slice(0, 80)) +
            "</li>"
        );
      });
      dynSnap.forEach(function (d) {
        var x = d.data() || {};
        blocks.push(
          "<li><strong>" +
            escapeHtml(String(x.templateName || "Form")) +
            "</strong> " +
            escapeHtml(String(x.date || "")) +
            "</li>"
        );
      });

      formsHtml +=
        blocks.length
          ? "<ul style=\"margin:0;padding-left:18px;font-size:14px;\">" +
            blocks.join("") +
            "</ul>"
          : "<p style=\"font-size:13px;color:#7f8c8d;\">No saved forms yet.</p>";
    } catch (e) {
      console.error(e);
      formsHtml +=
        "<p style=\"color:#e74c3c;\">Could not load forms.</p>";
    }

    var addendumBlock =
      "<hr class=\"soft\" style=\"margin:20px 0;\">" +
      "<h4 style=\"margin:0 0 10px 0;color:#2c3e50;font-size:15px;\">Supplemental addendums</h4>";
    try {
      var dbAdd = firebase.firestore();
      var addSnap = await dbAdd
        .collection("service_calls")
        .doc(ticketId)
        .collection("addendums")
        .get();
      var addRows = [];
      addSnap.forEach(function (d) {
        var x = d.data() || {};
        var ms = 0;
        var ts = x.timestamp;
        if (ts && typeof ts.toMillis === "function") ms = ts.toMillis();
        else if (ts && ts.seconds != null) ms = ts.seconds * 1000;
        addRows.push({ data: x, _tsMs: ms });
      });
      addRows.sort(function (a, b) {
        return b._tsMs - a._tsMs;
      });
      if (!addRows.length) {
        addendumBlock +=
          "<p style=\"font-size:13px;color:#7f8c8d;margin:0;\">No supplemental updates yet.</p>";
      } else {
        addendumBlock +=
          "<div style=\"display:flex;flex-direction:column;gap:12px;margin-top:4px;\">";
        addRows.forEach(function (row) {
          var x = row.data;
          var when = formatAddendumTs(x.timestamp);
          var who = escapeHtml(String(x.techName || "Technician"));
          var textRaw = String(x.text || "");
          var text = textRaw
            ? "<div style=\"font-size:14px;white-space:pre-wrap;word-break:break-word;color:#333;\">" +
              escapeHtml(textRaw) +
              "</div>"
            : "";
          var files = Array.isArray(x.fileUrls) ? x.fileUrls : [];
          var filesHtml = "";
          files.forEach(function (url, i) {
            filesHtml +=
              "<a href=\"" +
              escapeHtml(String(url)) +
              "\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:block;color:#1e4b85;font-weight:600;margin-top:4px;font-size:13px;\">Attachment " +
              (i + 1) +
              "</a>";
          });
          if (filesHtml) {
            filesHtml =
              "<div style=\"margin-top:10px;padding-top:10px;border-top:1px solid #f0f4f8;\">" +
              filesHtml +
              "</div>";
          }
          addendumBlock +=
            "<div style=\"background:#fff;border:1px solid #e1e8ed;border-radius:10px;padding:12px 14px;border-left:4px solid #1e4b85;\">" +
            "<div style=\"font-size:12px;font-weight:700;color:#1e4b85;margin-bottom:8px;\">" +
            escapeHtml(when) +
            " · " +
            who +
            "</div>" +
            text +
            filesHtml +
            "</div>";
        });
        addendumBlock += "</div>";
      }
    } catch (e) {
      console.error("addendums", e);
      addendumBlock +=
        "<p style=\"color:#e74c3c;font-size:13px;\">Could not load supplemental addendums.</p>";
    }

    body.innerHTML = head + actions + manualRow + formsHtml + addendumBlock;

    var openWs = $("techJobOpenWorkspace");
    if (openWs) {
      openWs.onclick = function () {
        window.openJobFromHistoryInWorkspace(ticketId);
      };
    }
    var bPm = $("techJobLaunchPm");
    if (bPm) {
      bPm.onclick = async function () {
        await window.openJobFromHistoryInWorkspace(ticketId);
        if (typeof renderForm === "function") renderForm("standard_pm");
      };
    }
    var bQ = $("techJobLaunchQuote");
    if (bQ) {
      bQ.onclick = async function () {
        await window.openJobFromHistoryInWorkspace(ticketId);
        if (typeof renderForm === "function") renderForm("repair_quote");
      };
    }
    var man = $("techJobManualForm");
    if (man && typeof getActiveFormTemplates === "function") {
      getActiveFormTemplates().then(function (templates) {
        templates.forEach(function (t) {
          var o = document.createElement("option");
          o.value = t.id;
          o.textContent = t.data.templateName || t.id;
          man.appendChild(o);
        });
        man.onchange = async function () {
          var id = man.value;
          if (!id) return;
          await window.openJobFromHistoryInWorkspace(ticketId);
          if (typeof renderDynamicForm === "function") renderDynamicForm(id);
          man.selectedIndex = 0;
        };
      });
    }
    var bAi = $("techJobAiScan");
    if (bAi) {
      bAi.onclick = async function () {
        var notes = job.techNotes || job.issue || "";
        if (typeof scanNotesForFormRequirements === "function") {
          await scanNotesForFormRequirements(notes);
        }
      };
    }
  }

  function hideTechJobDetail() {
    selectedHistoryJobId = null;
    var listEl = $("techJobs30List");
    var detailEl = $("techJobDetailView");
    var backBtn = $("techJobDetailBack");
    if (listEl) listEl.classList.remove("hidden");
    if (detailEl) detailEl.classList.add("hidden");
    if (backBtn) backBtn.classList.add("hidden");
  }

  function initTechJobHistory() {
    var tabSite = $("historyTabSite");
    var tabJobs = $("historyTabMyJobs");
    var panelSite = $("historySitePanel");
    var panelJobs = $("historyTechJobsPanel");
    var backBtn = $("techJobDetailBack");

    if (tabSite && tabJobs && panelSite && panelJobs) {
      tabSite.addEventListener("click", function () {
        tabSite.classList.add("active");
        tabJobs.classList.remove("active");
        panelSite.classList.remove("hidden");
        panelJobs.classList.add("hidden");
        hideTechJobDetail();
      });
      tabJobs.addEventListener("click", function () {
        tabJobs.classList.add("active");
        tabSite.classList.remove("active");
        panelJobs.classList.remove("hidden");
        panelSite.classList.add("hidden");
        loadTechJobs30Days();
        hideTechJobDetail();
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        hideTechJobDetail();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTechJobHistory);
  } else {
    initTechJobHistory();
  }

  window.loadTechJobs30Days = loadTechJobs30Days;
})();
