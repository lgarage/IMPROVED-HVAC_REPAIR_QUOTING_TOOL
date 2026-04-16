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

  var PILLAR_ORDER = ["PM", "QR", "SC", "IN", "WC"];
  var RPT_PALETTE = ["#0ea5e9", "#c89b53", "#475569", "#0ea5e9", "#ea580c"];

  function reportCssHref() {
    try {
      return new URL("dispatcher/css/report_builder.css?v=1", global.location.href).href;
    } catch (e) {
      return "dispatcher/css/report_builder.css?v=1";
    }
  }

  function jobTypeToPillar(type) {
    var t = String(type || "").trim();
    if (t === "Quoted Repair") return "QR";
    if (t === "Install") return "IN";
    if (t === "Preventative Maintenance") return "PM";
    if (t === "Warranty Call") return "WC";
    return "SC";
  }

  function getDefaultRateReport() {
    try {
      var p = parseFloat(localStorage.getItem("vc_insights_default_rate") || "");
      if (isFinite(p) && p > 0) return p;
    } catch (e) {}
    return 150;
  }

  function billableHoursForTicketReport(sc) {
    var raw = sc.Total_Billable_Hours;
    if (raw != null && raw !== "") {
      var p = parseFloat(raw);
      if (isFinite(p)) return Math.max(0, p);
    }
    if (typeof global.DispatcherTicketManager === "undefined" || !global.DispatcherTicketManager.computeTotalBillableHours) {
      return 0;
    }
    var n = 0;
    if (Array.isArray(sc.assignedTechs) && sc.assignedTechs.length) n = sc.assignedTechs.filter(Boolean).length;
    else if (sc.assignedTech) n = 1;
    var dur = sc.duration || "1.5";
    var mo = null;
    if (String(dur).trim() === "Multi-Day") {
      mo = {
        days: sc.multiDayDays != null ? parseInt(sc.multiDayDays, 10) : 2,
        includeWeekends: sc.multiDayIncludeWeekends === true,
      };
    }
    return global.DispatcherTicketManager.computeTotalBillableHours(n, dur, mo);
  }

  function normalizeSiteKey(t) {
    var cn = String(t.customerName || "")
      .trim()
      .toLowerCase();
    var ad = String(t.locationAddress || "")
      .trim()
      .toLowerCase();
    return cn + "|" + ad;
  }

  function buildSiteVisitTrendSeries(allTickets, t) {
    var key = normalizeSiteKey(t);
    if (!key || key === "|") return null;
    var months = [];
    var now = new Date();
    var mi;
    for (mi = 5; mi >= 0; mi--) {
      var d = new Date(now.getFullYear(), now.getMonth() - mi, 1);
      months.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
    }
    var counts = months.map(function () {
      return 0;
    });
    for (mi = 0; mi < allTickets.length; mi++) {
      var x = allTickets[mi];
      if (normalizeSiteKey(x) !== key) continue;
      if (!x.date || String(x.date).length < 7) continue;
      var ym = String(x.date).slice(0, 7);
      var idx = months.indexOf(ym);
      if (idx >= 0) counts[idx] += 1;
    }
    return { labels: months, counts: counts };
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
      var allTicketsRaw = [];
      scSnap.forEach(function (doc) {
        var d = doc.data() || {};
        d.id = doc.id;
        allTicketsRaw.push(d);
      });

      var tickets = allTicketsRaw.filter(function (t) {
        if (!t.date || t.date < fromYmd || t.date > toYmd) return false;
        if (idFilter.length && idFilter.indexOf(t.id) === -1) return false;
        return true;
      });
      tickets.sort(function (a, b) {
        return String(a.date).localeCompare(String(b.date)) || String(a.ticketNum || "").localeCompare(String(b.ticketNum || ""));
      });

      var laborByTicket = blocks.labor ? await loadLaborHoursByTicket(db, fromYmd, toYmd) : {};
      var rateRpt = getDefaultRateReport();

      var billableByPillar = {};
      var clockedByPillarRpt = {};
      var pi;
      for (pi = 0; pi < PILLAR_ORDER.length; pi++) {
        billableByPillar[PILLAR_ORDER[pi]] = 0;
        clockedByPillarRpt[PILLAR_ORDER[pi]] = 0;
      }
      for (pi = 0; pi < tickets.length; pi++) {
        var tx = tickets[pi];
        var px = jobTypeToPillar(tx.jobType);
        billableByPillar[px] = (billableByPillar[px] || 0) + billableHoursForTicketReport(tx);
        var lh = laborByTicket[tx.id] != null ? laborByTicket[tx.id] : 0;
        clockedByPillarRpt[px] = (clockedByPillarRpt[px] || 0) + lh;
      }

      var pieLabels = [];
      var pieData = [];
      var pieColors = [];
      for (pi = 0; pi < PILLAR_ORDER.length; pi++) {
        var pcode = PILLAR_ORDER[pi];
        var bh = billableByPillar[pcode] || 0;
        if (bh > 0.005) {
          pieLabels.push(pcode);
          pieData.push(Math.round(bh * rateRpt * 100) / 100);
          pieColors.push(RPT_PALETTE[pi % RPT_PALETTE.length]);
        }
      }
      if (!pieData.length) {
        pieLabels = ["No data"];
        pieData = [0];
        pieColors = ["#e2e8f0"];
      }

      var barQuoted = [];
      var barClocked = [];
      for (pi = 0; pi < PILLAR_ORDER.length; pi++) {
        var pc2 = PILLAR_ORDER[pi];
        barQuoted.push(Math.round((billableByPillar[pc2] || 0) * 100) / 100);
        barClocked.push(Math.round((clockedByPillarRpt[pc2] || 0) * 100) / 100);
      }

      var chartPayload = {
        pie: {
          type: "pie",
          data: {
            labels: pieLabels,
            datasets: [
              {
                data: pieData,
                backgroundColor: pieColors,
                borderWidth: 1,
                borderColor: "#fff",
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              title: { display: true, text: "Billable $ mix (hours × rate)", font: { size: 12 } },
              legend: { position: "bottom" },
            },
          },
        },
        bar: {
          type: "bar",
          data: {
            labels: PILLAR_ORDER,
            datasets: [
              {
                label: "Quoted billable (h)",
                data: barQuoted,
                backgroundColor: "rgba(30, 75, 133, 0.85)",
                borderColor: "#0ea5e9",
                borderWidth: 1,
              },
              {
                label: "Clocked labor (h)",
                data: barClocked,
                backgroundColor: "rgba(200, 155, 83, 0.85)",
                borderColor: "#c89b53",
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            scales: {
              y: { beginAtZero: true, title: { display: true, text: "Hours" } },
            },
            plugins: {
              title: { display: true, text: "Quoted vs clocked by job type", font: { size: 12 } },
              legend: { position: "bottom" },
            },
          },
        },
        siteTrends: [],
      };

      var brand =
        typeof APP_CONFIG !== "undefined" && APP_CONFIG.shortBrand
          ? APP_CONFIG.shortBrand
          : "Vertex-Core report";
      var logoUrl =
        typeof APP_CONFIG !== "undefined" && APP_CONFIG.logoUrl
          ? String(APP_CONFIG.logoUrl).trim()
          : "vertex_core_logo.png";
      try {
        logoUrl = new URL(logoUrl, global.location.href).href;
      } catch (e) {}

      var html = "";
      html += "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + esc(brand) + " — Report</title>";
      html += '<link rel="stylesheet" href="' + esc(reportCssHref()) + '" />';
      html +=
        '<link rel="preconnect" href="https://fonts.googleapis.com" /><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />';
      html +=
        '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>';
      html += "</head><body>";
      html += '<div class="vc-rpt-root">';
      html += '<div class="vc-print-header vc-print-header-fixed">';
      html += '<img class="vc-print-header__logo" src="' + esc(logoUrl) + '" alt="" />';
      html += '<div class="vc-print-header__titles"><h1>' + esc(brand) + "</h1>";
      html +=
        "<p>Vertex-Core Custom Report Studio · " +
        esc(fromYmd) +
        " – " +
        esc(toYmd) +
        " · " +
        tickets.length +
        " ticket(s)</p></div></div>";

      html += '<div class="vc-rpt-chart-row">';
      html += '<div class="vc-rpt-chart-box"><h3>Revenue mix</h3><canvas id="rptPie"></canvas></div>';
      html += '<div class="vc-rpt-chart-box"><h3>Labor efficiency</h3><canvas id="rptBar"></canvas></div>';
      html += "</div>";

      html +=
        "<p class='muted' style='margin:0 0 16px'>Charts reflect this report selection only. Save as PDF from your browser print dialog.</p>";

      for (var i = 0; i < tickets.length; i++) {
        var t = tickets[i];
        html += '<section class="vc-rpt-section">';
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
          var trend = buildSiteVisitTrendSeries(allTicketsRaw, t);
          if (trend) {
            var trendId = "rptSite" + i;
            html += '<div class="vc-rpt-section" style="margin-top:12px">';
            html += '<h3 style="font-size:13px;margin:0 0 6px">Site activity trend</h3>';
            html +=
              '<p class="muted" style="font-size:11px;margin:0 0 8px">Service visits at this address by month (Vertex-Core history).</p>';
            html += '<div style="height:150px;position:relative;max-width:420px">';
            html += '<canvas id="' + trendId + '"></canvas></div>';
            var maxC = Math.max.apply(null, trend.counts.concat([1]));
            var lastC = trend.counts[trend.counts.length - 1] || 0;
            var pct = Math.min(100, Math.round((lastC / maxC) * 100));
            html += '<p style="font-size:11px;color:#64748b;margin:6px 0 4px">Site health (recent vs peak in window)</p>';
            html += '<div class="vc-rpt-meter"><div class="vc-rpt-meter__fill" style="width:' + pct + '%"></div></div>';
            html += "</div>";
            chartPayload.siteTrends.push({
              canvasId: trendId,
              labels: trend.labels,
              counts: trend.counts,
            });
          }
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
        html += '<section class="vc-rpt-section"><h2>Labor totals (sum of attributed hours in selection)</h2>';
        html += "<p><strong>Total:</strong> " + total.toFixed(2) + " h</p></section>";
      }

      html += "</div>";
      var payloadJson = JSON.stringify(chartPayload).replace(/</g, "\\u003c");
      html += '<script type="application/json" id="vc-rpt-chart-json">' + payloadJson + "<\/script>";
      html +=
        "<script>(function(){function run(){var el=document.getElementById('vc-rpt-chart-json');if(!el||typeof Chart==='undefined')return;var d=JSON.parse(el.textContent);if(d.pie&&document.getElementById('rptPie'))new Chart(document.getElementById('rptPie'),d.pie);if(d.bar&&document.getElementById('rptBar'))new Chart(document.getElementById('rptBar'),d.bar);(d.siteTrends||[]).forEach(function(s){var c=document.getElementById(s.canvasId);if(!c)return;new Chart(c,{type:'line',data:{labels:s.labels,datasets:[{label:'Visits',data:s.counts,borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,0.12)',fill:true,tension:0.25}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});});}if(document.readyState==='complete')run();else window.addEventListener('load',run);})();<\/script>";
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
      }, 900);
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
