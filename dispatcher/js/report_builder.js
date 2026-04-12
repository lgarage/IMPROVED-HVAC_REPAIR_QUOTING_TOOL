/**
 * Custom Report Studio — printable HTML reports from service_calls + labor_logs + site_intelligence.
 */
(function (global) {
  "use strict";

  function todayIso() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function daysAgoIso(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function siteIntelDocIdFromLocationLine(locationLine) {
    var key = String(locationLine || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (!key) return "";
    var h = 5381;
    for (var i = 0; i < key.length; i++) {
      h = (h * 33) ^ key.charCodeAt(i);
    }
    return "vc_site_" + (h >>> 0).toString(16);
  }

  function locationLineFromTicket(t) {
    var cn = String(t.customerName || "").trim();
    var ad = String(t.locationAddress || "").trim();
    if (cn && ad) return cn + " - " + ad;
    return cn || ad || "";
  }

  function addClockedHoursByTicketFromEntries(entries, acc) {
    var sorted = (entries || [])
      .filter(function (e) {
        return e && e.at && (e.action === "IN" || e.action === "OUT");
      })
      .map(function (e) {
        return {
          t: new Date(e.at).getTime(),
          action: e.action,
          ticketId: e.ticketId ? String(e.ticketId).trim() : "",
        };
      })
      .filter(function (e) {
        return !isNaN(e.t);
      })
      .sort(function (a, b) {
        return a.t - b.t;
      });
    var openIn = null;
    var openTicket = "";
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].action === "IN") {
        openIn = sorted[i].t;
        openTicket = sorted[i].ticketId || "";
      } else if (sorted[i].action === "OUT" && openIn != null) {
        var hrs = Math.max(0, (sorted[i].t - openIn) / 3600000);
        if (openTicket) {
          acc[openTicket] = (acc[openTicket] || 0) + hrs;
        }
        openIn = null;
        openTicket = "";
      }
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadSiteIntelNote(db, ticket) {
    var line = locationLineFromTicket(ticket);
    if (!line || typeof VCFirestore === "undefined" || !VCFirestore.getSiteIntelDocOnceBridged) {
      return "";
    }
    var id = siteIntelDocIdFromLocationLine(line);
    if (!id) return "";
    try {
      var got = await VCFirestore.getSiteIntelDocOnceBridged(db, id);
      if (got && got.exists && got.data && got.data.notes) {
        return String(got.data.notes || "").trim();
      }
    } catch (e) {}
    return "";
  }

  async function loadLaborHoursByTicket(db, fromYmd, toYmd) {
    var acc = {};
    if (typeof VCFirestore === "undefined" || !VCFirestore.laborLogs) return acc;
    var snap = await VCFirestore.laborLogs(db)
      .where("dateYmd", ">=", fromYmd)
      .where("dateYmd", "<=", toYmd)
      .get();
    snap.forEach(function (doc) {
      var d = doc.data() || {};
      var entries = Array.isArray(d.entries) ? d.entries : [];
      addClockedHoursByTicketFromEntries(entries, acc);
    });
    return acc;
  }

  function parseTicketIdList(raw) {
    return String(raw || "")
      .split(/[\s,;]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  async function generateCustomReport() {
    var errEl = document.getElementById("reportStudioErr");
    var btn = document.getElementById("reportStudioGenerateBtn");
    if (errEl) errEl.textContent = "";
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      if (errEl) errEl.textContent = "Firebase not initialized.";
      return;
    }
    if (typeof VCFirestore === "undefined" || !VCFirestore.loadServiceCallsMergedOnce) {
      if (errEl) errEl.textContent = "VCFirestore not available.";
      return;
    }
    var fromEl = document.getElementById("reportStudioDateFrom");
    var toEl = document.getElementById("reportStudioDateTo");
    var idsEl = document.getElementById("reportStudioTicketIds");
    var fromYmd = fromEl && fromEl.value ? fromEl.value : daysAgoIso(30);
    var toYmd = toEl && toEl.value ? toEl.value : todayIso();
    if (fromYmd > toYmd) {
      if (errEl) errEl.textContent = "Start date must be before end date.";
      return;
    }

    var blocks = {
      job: document.getElementById("reportBlockJob") && document.getElementById("reportBlockJob").checked,
      notes: document.getElementById("reportBlockNotes") && document.getElementById("reportBlockNotes").checked,
      intel: document.getElementById("reportBlockIntel") && document.getElementById("reportBlockIntel").checked,
      photos: document.getElementById("reportBlockPhotos") && document.getElementById("reportBlockPhotos").checked,
      labor: document.getElementById("reportBlockLabor") && document.getElementById("reportBlockLabor").checked,
    };

    var idFilter = parseTicketIdList(idsEl && idsEl.value ? idsEl.value : "");

    if (btn) btn.disabled = true;
    try {
      var db = firebase.firestore();
      var scSnap = await VCFirestore.loadServiceCallsMergedOnce(db);
      var tickets = [];
      scSnap.forEach(function (doc) {
        var d = doc.data() || {};
        d.id = doc.id;
        tickets.push(d);
      });

      tickets = tickets.filter(function (t) {
        if (!t.date || t.date < fromYmd || t.date > toYmd) return false;
        if (idFilter.length && idFilter.indexOf(t.id) === -1) return false;
        return true;
      });
      tickets.sort(function (a, b) {
        return String(a.date).localeCompare(String(b.date)) || String(a.ticketNum || "").localeCompare(String(b.ticketNum || ""));
      });

      var laborByTicket = blocks.labor ? await loadLaborHoursByTicket(db, fromYmd, toYmd) : {};

      var brand =
        typeof APP_CONFIG !== "undefined" && APP_CONFIG.shortBrand
          ? APP_CONFIG.shortBrand
          : "Service report";

      var html = "";
      html += "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + esc(brand) + " — Custom report</title>";
      html +=
        "<style>body{font-family:Segoe UI,system-ui,sans-serif;color:#1e293b;margin:24px;}h1{color:#1e4b85;font-size:1.25rem;}h2{font-size:1rem;margin-top:20px;color:#334155;border-bottom:1px solid #e2e8f0;padding-bottom:6px;}section{margin-bottom:18px;}table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;}th{background:#f8fafc;}.muted{color:#64748b;font-size:12px;}img{max-width:180px;max-height:140px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;margin:4px 6px 4px 0;}@media print{body{margin:12px}}</style></head><body>";
      html += "<h1>" + esc(brand) + " — Custom Report Studio</h1>";
      html +=
        "<p class='muted'>Period " +
        esc(fromYmd) +
        " to " +
        esc(toYmd) +
        " · " +
        tickets.length +
        " ticket(s)</p>";

      for (var i = 0; i < tickets.length; i++) {
        var t = tickets[i];
        html += "<section>";
        html += "<h2>" + esc(t.ticketNum || t.id) + " · " + esc(t.customerName || "") + "</h2>";

        if (blocks.job) {
          html += "<p><strong>Date:</strong> " + esc(t.date || "—") + "</p>";
          html += "<p><strong>Status:</strong> " + esc(t.status || "—") + " &nbsp; <strong>Type:</strong> " + esc(t.jobType || "—") + "</p>";
          html +=
            "<p><strong>Site:</strong> " +
            esc([t.locationAddress, [t.custCity, t.custState, t.custZip].filter(Boolean).join(" ")].filter(Boolean).join(", ")) +
            "</p>";
          if (t.equip) html += "<p><strong>Equipment:</strong> " + esc(t.equip) + "</p>";
        }

        if (blocks.notes) {
          html += "<h3 style='font-size:13px;margin-top:12px;'>Public notes</h3>";
          if (t.issue) html += "<p style='white-space:pre-wrap;font-size:12px;'>" + esc(t.issue) + "</p>";
          if (t.techNotes) {
            html +=
              "<p style='margin-top:8px;font-size:12px;'><strong>Technician report</strong></p><pre style='white-space:pre-wrap;font-size:12px;background:#f8fafc;padding:10px;border-radius:6px;'>" +
              esc(t.techNotes) +
              "</pre>";
          }
          if (t.clientPortalMemo) {
            html +=
              "<p style='margin-top:8px;font-size:12px;'><strong>Client portal memo</strong></p><p style='white-space:pre-wrap;font-size:12px;'>" +
              esc(t.clientPortalMemo) +
              "</p>";
          }
        }

        if (blocks.intel) {
          var siteNote = await loadSiteIntelNote(db, t);
          html += "<h3 style='font-size:13px;margin-top:12px;'>Equipment &amp; site intel</h3>";
          if (t.equip) html += "<p style='font-size:12px;'><strong>Equipment line:</strong> " + esc(t.equip) + "</p>";
          html +=
            "<p style='white-space:pre-wrap;font-size:12px;background:#fffbeb;padding:10px;border-radius:6px;border:1px solid #fde68a;'>" +
            (siteNote ? esc(siteNote) : "<em class='muted'>No site intelligence note for this address.</em>") +
            "</p>";
        }

        if (blocks.photos && typeof VCClientPortal !== "undefined" && VCClientPortal.filterPublicEvidencePhotoUrls) {
          var pub = VCClientPortal.filterPublicEvidencePhotoUrls(t.evidencePhotoUrls);
          html += "<h3 style='font-size:13px;margin-top:12px;'>Public field photos</h3>";
          if (!pub.length) {
            html += "<p class='muted'>No client-visible field photos.</p>";
          } else {
            pub.forEach(function (url) {
              var u = String(url).trim();
              if (/\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(u)) {
                html += "<img src='" + esc(u) + "' alt='' />";
              } else {
                html += "<p><a href='" + esc(u) + "'>Attachment</a></p>";
              }
            });
          }
        }

        if (blocks.labor) {
          var lh = laborByTicket[t.id] != null ? laborByTicket[t.id] : 0;
          html += "<h3 style='font-size:13px;margin-top:12px;'>Labor (clocked to this ticket)</h3>";
          html += "<p class='muted'>Attributed hours from paired IN/OUT entries with job ticket id: <strong>" + lh.toFixed(2) + " h</strong></p>";
        }

        html += "</section>";
      }

      if (blocks.labor && tickets.length) {
        var total = 0;
        for (var j = 0; j < tickets.length; j++) {
          var tid = tickets[j].id;
          total += laborByTicket[tid] != null ? laborByTicket[tid] : 0;
        }
        html += "<section><h2>Labor totals (sum of attributed hours in selection)</h2>";
        html += "<p><strong>Total:</strong> " + total.toFixed(2) + " h</p></section>";
      }

      html += "</body></html>";

      var w = global.open("", "_blank");
      if (!w) {
        if (errEl) errEl.textContent = "Popup blocked — allow popups to print.";
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      global.setTimeout(function () {
        try {
          w.print();
        } catch (e) {}
      }, 400);
    } catch (e) {
      console.error(e);
      if (errEl) errEl.textContent = e && e.message ? e.message : String(e);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function initReportStudio() {
    var btn = document.getElementById("reportStudioGenerateBtn");
    var fromEl = document.getElementById("reportStudioDateFrom");
    var toEl = document.getElementById("reportStudioDateTo");
    if (fromEl && !fromEl.value) fromEl.value = daysAgoIso(30);
    if (toEl && !toEl.value) toEl.value = todayIso();
    if (btn && btn.dataset.vcReportWired !== "1") {
      btn.dataset.vcReportWired = "1";
      btn.addEventListener("click", function () {
        void generateCustomReport();
      });
    }
  }

  global.VcReportStudio = {
    initReportStudio: initReportStudio,
    generateCustomReport: generateCustomReport,
  };
})(typeof window !== "undefined" ? window : this);
