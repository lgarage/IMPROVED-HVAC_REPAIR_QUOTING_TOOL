/**
 * Executive Insights & Revenue dashboard — pillars vs labor, tech efficiency,
 * unbilled revenue (Client Verified / Ready for Billing), system health.
 */
(function (global) {
  "use strict";

  var PILLAR_ORDER = ["PM", "QR", "SC", "IN", "WC"];
  var PILLAR_LABEL = {
    PM: "Preventative Maintenance",
    QR: "Quoted Repair",
    SC: "Service Call",
    IN: "Install",
    WC: "Warranty Call",
  };
  var LS_RATE_KEY = "vc_insights_default_rate";

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

  function daysAgoIso(days) {
    var d = new Date();
    d.setDate(d.getDate() - days);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  /** Monday 00:00 local for the week containing `d`. */
  function startOfWeekMonday(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = x.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function jobTypeToPillar(type) {
    var t = String(type || "").trim();
    if (t === "Quoted Repair") return "QR";
    if (t === "Install") return "IN";
    if (t === "Preventative Maintenance") return "PM";
    if (t === "Warranty Call") return "WC";
    return "SC";
  }

  function normalizeTech(name) {
    return String(name || "")
      .trim()
      .toLowerCase();
  }

  function tsToMillis(ts) {
    if (!ts) return NaN;
    if (typeof ts === "string" || typeof ts === "number") {
      var d = new Date(ts);
      return isNaN(d.getTime()) ? NaN : d.getTime();
    }
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (ts.seconds != null) return ts.seconds * 1000;
    return NaN;
  }

  function getAssignedTechCount(sc) {
    if (Array.isArray(sc.assignedTechs) && sc.assignedTechs.length) {
      return sc.assignedTechs.filter(Boolean).length;
    }
    if (sc.assignedTech && String(sc.assignedTech).trim()) return 1;
    return 0;
  }

  function billableHoursForTicket(sc) {
    var raw = sc.Total_Billable_Hours;
    if (raw != null && raw !== "") {
      var p = parseFloat(raw);
      if (isFinite(p)) return Math.max(0, p);
    }
    if (typeof global.DispatcherTicketManager === "undefined" || !global.DispatcherTicketManager.computeTotalBillableHours) {
      return 0;
    }
    var n = getAssignedTechCount(sc);
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

  /** Pair IN with following OUT; attribute duration to IN.ticketId when present (lite seat pattern). */
  function addClockedHoursFromEntries(entries, acc) {
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

  function computeShiftHours(entries) {
    var sorted = (entries || [])
      .filter(function (e) {
        return e && e.at && (e.action === "IN" || e.action === "OUT");
      })
      .map(function (e) {
        return { t: new Date(e.at).getTime(), action: e.action };
      })
      .filter(function (e) {
        return !isNaN(e.t);
      })
      .sort(function (a, b) {
        return a.t - b.t;
      });
    var sec = 0;
    var openIn = null;
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].action === "IN") {
        openIn = sorted[i].t;
      } else if (sorted[i].action === "OUT" && openIn != null) {
        sec += Math.max(0, Math.floor((sorted[i].t - openIn) / 1000));
        openIn = null;
      }
    }
    return sec / 3600;
  }

  function forEachServiceCallSnap(snap, cb) {
    if (!snap || typeof snap.forEach !== "function") return;
    snap.forEach(function (doc) {
      cb(doc);
    });
  }

  function docToTicket(doc) {
    var data = doc.data() ? doc.data() : {};
    return { id: doc.id, data: data };
  }

  function loadCompletedReportsMergedOnce(db) {
    if (typeof VCFirestore === "undefined" || !VCFirestore.completedReports) {
      return Promise.resolve([]);
    }
    var cr = VCFirestore.completedReports(db);
    if (VCFirestore.isSandboxDataPath && VCFirestore.isSandboxDataPath()) {
      return cr.get().then(function (snap) {
        var rows = [];
        snap.forEach(function (d) {
          rows.push({ id: d.id, data: d.data() || {} });
        });
        return rows;
      });
    }
    if (!VCFirestore.isBridgeTenant || !VCFirestore.isBridgeTenant()) {
      return cr.get().then(function (snap) {
        var rows = [];
        snap.forEach(function (d) {
          rows.push({ id: d.id, data: d.data() || {} });
        });
        return rows;
      });
    }
    return Promise.all([cr.get(), db.collection("completed_reports").get()]).then(function (pair) {
      var byId = {};
      pair[1].forEach(function (d) {
        byId[d.id] = d.data() || {};
      });
      pair[0].forEach(function (d) {
        byId[d.id] = d.data() || {};
      });
      return Object.keys(byId).map(function (id) {
        return { id: id, data: byId[id] };
      });
    });
  }

  function loadSiteIntelligenceMergedOnce(db) {
    if (typeof VCFirestore === "undefined" || !VCFirestore.siteIntelligence) {
      return Promise.resolve([]);
    }
    var si = VCFirestore.siteIntelligence(db);
    if (!VCFirestore.isBridgeTenant || !VCFirestore.isBridgeTenant()) {
      return si.get().then(function (snap) {
        var rows = [];
        snap.forEach(function (d) {
          rows.push({ id: d.id, data: d.data() || {} });
        });
        return rows;
      });
    }
    return Promise.all([si.get(), db.collection("site_intelligence").get()]).then(function (pair) {
      var byId = {};
      pair[1].forEach(function (d) {
        byId[d.id] = d.data() || {};
      });
      pair[0].forEach(function (d) {
        byId[d.id] = d.data() || {};
      });
      return Object.keys(byId).map(function (id) {
        return { id: id, data: byId[id] };
      });
    });
  }

  function ticketDateInRange(dateStr, fromYmd, toYmd) {
    var s = String(dateStr || "").trim();
    if (!s) return false;
    return s >= fromYmd && s <= toYmd;
  }

  function techOnTicket(sc, techNorm) {
    var names = [];
    if (Array.isArray(sc.assignedTechs)) names = sc.assignedTechs.filter(Boolean).map(function (n) {
      return String(n).trim();
    });
    else if (sc.assignedTech) names = [String(sc.assignedTech).trim()];
    for (var i = 0; i < names.length; i++) {
      if (normalizeTech(names[i]) === techNorm) return true;
    }
    return false;
  }

  function getDefaultRate() {
    try {
      var fromLs = parseFloat(localStorage.getItem(LS_RATE_KEY) || "");
      if (isFinite(fromLs) && fromLs > 0) return fromLs;
    } catch (e) {}
    if (typeof APP_CONFIG !== "undefined" && APP_CONFIG.defaultBillableRatePerHour != null) {
      var p = parseFloat(APP_CONFIG.defaultBillableRatePerHour);
      if (isFinite(p) && p > 0) return p;
    }
    return 150;
  }

  function fmtMoney(n) {
    return (
      "$" +
      n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function buildPillarInsight(rows) {
    var parts = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.clocked > r.billable * 1.08 && r.billable > 0.25) {
        parts.push(
          PILLAR_LABEL[r.code] +
            ": quoted " +
            r.billable.toFixed(1) +
            "h billable vs " +
            r.clocked.toFixed(1) +
            "h clocked — consider raising rates or tightening scope."
        );
      }
    }
    if (!parts.length) {
      return "Billable hours and clocked labor are broadly aligned for this period. Adjust the date range to compare other weeks.";
    }
    return "Manager insight — " + parts.join(" ");
  }

  function renderPillarSection(host, pillarRows, maxBar) {
    var html = '<div class="insights-table-wrap"><table class="insights-table">';
    html +=
      "<thead><tr><th>Type</th><th class=\"num\">Billable (quoted) h</th><th class=\"num\">Clocked h</th><th class=\"num\">Δ</th></tr></thead><tbody>";
    for (var i = 0; i < pillarRows.length; i++) {
      var r = pillarRows[i];
      var delta = r.clocked - r.billable;
      html +=
        "<tr><td><strong>" +
        r.code +
        "</strong> · " +
        PILLAR_LABEL[r.code] +
        "</td><td class=\"num\">" +
        r.billable.toFixed(2) +
        "</td><td class=\"num\">" +
        r.clocked.toFixed(2) +
        "</td><td class=\"num\">" +
        (delta >= 0 ? "+" : "") +
        delta.toFixed(2) +
        "</td></tr>";
    }
    html += "</tbody></table></div>";

    var m = Math.max(maxBar, 0.01);
    html += '<div style="margin-top:14px">';
    for (var j = 0; j < pillarRows.length; j++) {
      var p = pillarRows[j];
      var wBill = Math.min(100, (p.billable / m) * 100);
      var wClk = Math.min(100, (p.clocked / m) * 100);
      html += '<div class="insights-bar-row"><span class="insights-bar-label">' + p.code + "</span>";
      html += '<div><div class="insights-bar-track"><div class="insights-bar-fill" style="width:' + wBill + '%"></div></div>';
      html +=
        '<div class="insights-bar-track" style="margin-top:4px"><div class="insights-bar-fill insights-bar-fill--clock" style="width:' +
        wClk +
        '%"></div></div></div>';
      html += '<span class="num" style="font-size:11px;color:#64748b">' + p.billable.toFixed(1) + " / " + p.clocked.toFixed(1) + "</span></div>";
    }
    html += "</div>";
    html += '<p class="insights-muted" style="margin-top:8px;font-size:11px">Bars: blue = billable (scheduled), gold = clocked labor attributed to jobs.</p>';

    host.innerHTML = html;
  }

  function renderTechTable(tbody, rows) {
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="insights-muted">No completed reports in range.</td></tr>';
      return;
    }
    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var badge =
        r.tier === "rockstar"
          ? '<span class="insights-badge insights-badge--rockstar">Rockstar</span>'
          : r.tier === "train"
            ? '<span class="insights-badge insights-badge--train">Coaching</span>'
            : "";
      html +=
        "<tr><td><strong>" +
        escapeHtml(r.name) +
        "</strong> " +
        badge +
        "</td><td class=\"num\">" +
        r.reports +
        "</td><td class=\"num\">" +
        (r.avgCloseHours != null ? r.avgCloseHours.toFixed(1) : "—") +
        "</td><td class=\"num\">" +
        (r.verifyPct != null ? Math.round(r.verifyPct * 100) + "%" : "—") +
        "</td><td class=\"num\">" +
        r.laborHours.toFixed(1) +
        "</td><td class=\"num\">" +
        r.verifiedTickets +
        "/" +
        r.eligibleTickets +
        "</td></tr>";
    }
    tbody.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refreshInsights() {
    var errEl = document.getElementById("insightsErr");
    var btn = document.getElementById("insightsRefreshBtn");
    var fromEl = document.getElementById("insightsDateFrom");
    var toEl = document.getElementById("insightsDateTo");
    var rateEl = document.getElementById("insightsDefaultRate");
    if (errEl) errEl.textContent = "";
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      if (errEl) errEl.textContent = "Firebase not initialized.";
      return;
    }
    var fromYmd = fromEl && fromEl.value ? fromEl.value : daysAgoIso(30);
    var toYmd = toEl && toEl.value ? toEl.value : todayIso();
    if (fromYmd > toYmd) {
      if (errEl) errEl.textContent = "Start date must be before end date.";
      return;
    }
    var rate = rateEl && rateEl.value ? parseFloat(rateEl.value) : getDefaultRate();
    if (!isFinite(rate) || rate <= 0) rate = getDefaultRate();
    try {
      localStorage.setItem(LS_RATE_KEY, String(rate));
    } catch (e) {}

    if (btn) btn.disabled = true;

    try {
      var db = firebase.firestore();
      var ticketById = {};

      var scSnap = await VCFirestore.loadServiceCallsMergedOnce(db);
      forEachServiceCallSnap(scSnap, function (doc) {
        var t = docToTicket(doc);
        ticketById[t.id] = t.data;
      });

      var laborSnap = await VCFirestore.laborLogs(db)
        .where("dateYmd", ">=", fromYmd)
        .where("dateYmd", "<=", toYmd)
        .get();

      var clockedByTicket = {};
      laborSnap.forEach(function (ldoc) {
        var d = ldoc.data() || {};
        var entries = Array.isArray(d.entries) ? d.entries : [];
        addClockedHoursFromEntries(entries, clockedByTicket);
      });

      var laborHoursByTech = {};
      laborSnap.forEach(function (ldoc) {
        var d = ldoc.data() || {};
        var name = String(d.employeeName || "").trim() || ldoc.id;
        var entries = Array.isArray(d.entries) ? d.entries : [];
        var h = computeShiftHours(entries);
        var key = normalizeTech(name);
        laborHoursByTech[key] = (laborHoursByTech[key] || 0) + h;
      });

      var billableByPillar = {};
      var i;
      for (i = 0; i < PILLAR_ORDER.length; i++) {
        billableByPillar[PILLAR_ORDER[i]] = 0;
      }
      var clockedByPillar = {};
      for (i = 0; i < PILLAR_ORDER.length; i++) {
        clockedByPillar[PILLAR_ORDER[i]] = 0;
      }

      Object.keys(ticketById).forEach(function (tid) {
        var sc = ticketById[tid];
        if (!ticketDateInRange(sc.date, fromYmd, toYmd)) return;
        var pillar = jobTypeToPillar(sc.jobType);
        billableByPillar[pillar] = (billableByPillar[pillar] || 0) + billableHoursForTicket(sc);
      });

      Object.keys(clockedByTicket).forEach(function (tid) {
        var sc = ticketById[tid];
        if (!sc) return;
        var pillar = jobTypeToPillar(sc.jobType);
        clockedByPillar[pillar] = (clockedByPillar[pillar] || 0) + clockedByTicket[tid];
      });

      var pillarRows = [];
      var maxBar = 0;
      for (i = 0; i < PILLAR_ORDER.length; i++) {
        var code = PILLAR_ORDER[i];
        var b = billableByPillar[code] || 0;
        var c = clockedByPillar[code] || 0;
        pillarRows.push({ code: code, billable: b, clocked: c });
        maxBar = Math.max(maxBar, b, c);
      }

      var pillarHost = document.getElementById("insightsPillarSection");
      if (pillarHost) renderPillarSection(pillarHost, pillarRows, maxBar);
      var insightEl = document.getElementById("insightsManagerLine");
      if (insightEl) insightEl.textContent = buildPillarInsight(pillarRows);

      var reports = await loadCompletedReportsMergedOnce(db);
      var weekStart = startOfWeekMonday(new Date());
      var weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      weekEnd.setMilliseconds(weekEnd.getMilliseconds() - 1);

      var reportRowsInRange = [];
      for (i = 0; i < reports.length; i++) {
        var rd = reports[i].data;
        var rts = tsToMillis(rd.timestamp || rd.deviceSavedAt);
        if (!isFinite(rts)) continue;
        var day = new Date(rts);
        var y =
          day.getFullYear() +
          "-" +
          String(day.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(day.getDate()).padStart(2, "0");
        if (y < fromYmd || y > toYmd) continue;
        reportRowsInRange.push({
          techName: String(rd.techName || "").trim(),
          linkedTicketId: String(rd.linkedTicketId || "").trim(),
          ts: rts,
        });
      }

      var techAgg = {};
      function ensureTech(nm) {
        var k = normalizeTech(nm);
        if (!k) return null;
        if (!techAgg[k]) {
          techAgg[k] = {
            name: nm,
            reports: 0,
            closeHoursSum: 0,
            closeHoursN: 0,
            verifiedTickets: 0,
            eligibleTickets: 0,
          };
        }
        return k;
      }

      laborSnap.forEach(function (ldoc) {
        var ld = ldoc.data() || {};
        var en = String(ld.employeeName || "").trim() || ldoc.id;
        ensureTech(en);
      });

      for (i = 0; i < reportRowsInRange.length; i++) {
        var rr = reportRowsInRange[i];
        if (!rr.techName || !rr.linkedTicketId) continue;
        var tk = ensureTech(rr.techName);
        if (!tk) continue;
        techAgg[tk].reports += 1;
        var tsc = ticketById[rr.linkedTicketId];
        if (tsc && tsc.date) {
          var sched = new Date(String(tsc.date) + "T12:00:00");
          var diffH = (rr.ts - sched.getTime()) / 3600000;
          if (isFinite(diffH) && diffH >= 0 && diffH < 720) {
            techAgg[tk].closeHoursSum += diffH;
            techAgg[tk].closeHoursN += 1;
          }
        }
      }

      Object.keys(ticketById).forEach(function (tid) {
        var sc = ticketById[tid];
        if (!ticketDateInRange(sc.date, fromYmd, toYmd)) return;
        var st = String(sc.status || "").trim();
        var eligible = st === "Completed" || st === "Client Verified / Ready for Billing";
        if (!eligible) return;
        var verified = st === "Client Verified / Ready for Billing";
        var names = [];
        if (Array.isArray(sc.assignedTechs)) names = sc.assignedTechs.filter(Boolean);
        else if (sc.assignedTech) names = [sc.assignedTech];
        var seen = {};
        for (var j = 0; j < names.length; j++) {
          var nm = String(names[j]).trim();
          if (!nm) continue;
          var kk = ensureTech(nm);
          if (!kk || seen[kk]) continue;
          seen[kk] = true;
          techAgg[kk].eligibleTickets += 1;
          if (verified) techAgg[kk].verifiedTickets += 1;
        }
      });

      var techList = Object.keys(techAgg)
        .map(function (k) {
          var a = techAgg[k];
          var avgClose = a.closeHoursN ? a.closeHoursSum / a.closeHoursN : null;
          var verifyPct = a.eligibleTickets ? a.verifiedTickets / a.eligibleTickets : null;
          var laborH = laborHoursByTech[k] || 0;
          return {
            key: k,
            name: a.name || k,
            reports: a.reports,
            avgCloseHours: avgClose,
            verifyPct: verifyPct,
            laborHours: laborH,
            verifiedTickets: a.verifiedTickets,
            eligibleTickets: a.eligibleTickets,
          };
        })
        .filter(function (t) {
          return t.reports > 0 || t.laborHours > 0.02 || t.eligibleTickets > 0;
        });

      techList.sort(function (a, b) {
        var va = a.verifyPct != null ? a.verifyPct : -1;
        var vb = b.verifyPct != null ? b.verifyPct : -1;
        if (vb !== va) return vb - va;
        var ca = a.avgCloseHours != null ? a.avgCloseHours : 9999;
        var cb = b.avgCloseHours != null ? b.avgCloseHours : 9999;
        if (ca !== cb) return ca - cb;
        return b.reports - a.reports;
      });

      var medianVerify =
        techList.length && techList.filter(function (x) {
          return x.verifyPct != null;
        }).length
          ? (function () {
              var vals = techList
                .map(function (x) {
                  return x.verifyPct;
                })
                .filter(function (v) {
                  return v != null;
                })
                .sort(function (a, b) {
                  return a - b;
                });
              var mid = Math.floor(vals.length / 2);
              return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
            })()
          : 0.5;

      for (i = 0; i < techList.length; i++) {
        var trow = techList[i];
        var tier = "";
        if (trow.reports >= 3 && trow.verifyPct != null) {
          if (trow.verifyPct >= medianVerify && (trow.avgCloseHours == null || trow.avgCloseHours <= 72)) {
            tier = "rockstar";
          } else if (trow.verifyPct < medianVerify * 0.7 || (trow.avgCloseHours != null && trow.avgCloseHours > 120)) {
            tier = "train";
          }
        }
        trow.tier = tier;
      }

      var techBody = document.getElementById("insightsTechBody");
      if (techBody) renderTechTable(techBody, techList);

      var unbilled = [];
      var unbilledTotal = 0;
      Object.keys(ticketById).forEach(function (tid) {
        var sc = ticketById[tid];
        if (String(sc.status || "").trim() !== "Client Verified / Ready for Billing") return;
        var bh = billableHoursForTicket(sc);
        var rev = bh * rate;
        unbilledTotal += rev;
        var cust = String(sc.customerName || "").trim() || "Customer";
        var addr = String(sc.locationAddress || sc.location || "").trim();
        unbilled.push({
          id: tid,
          label: cust + (addr ? " — " + addr : ""),
          hours: bh,
          revenue: rev,
        });
      });
      unbilled.sort(function (a, b) {
        return b.revenue - a.revenue;
      });

      var ubTotalEl = document.getElementById("insightsUnbilledTotal");
      if (ubTotalEl) ubTotalEl.textContent = "Total potential revenue (at " + fmtMoney(rate) + "/hr): " + fmtMoney(unbilledTotal);

      var ubBody = document.getElementById("insightsUnbilledBody");
      if (ubBody) {
        if (!unbilled.length) {
          ubBody.innerHTML = '<p class="insights-muted">No tickets in <strong>Client Verified / Ready for Billing</strong> right now.</p>';
        } else {
          var uhtml = '<ul class="insights-list-compact">';
          for (var u = 0; u < unbilled.length && u < 40; u++) {
            var row = unbilled[u];
            uhtml +=
              "<li><span><a href=\"#\" data-insights-ticket=\"" +
              escapeHtml(row.id) +
              "\">" +
              escapeHtml(row.label) +
              "</a> · " +
              row.hours.toFixed(2) +
              "h → " +
              fmtMoney(row.revenue) +
              "</span><span>" +
              escapeHtml(row.id) +
              "</span></li>";
          }
          if (unbilled.length > 40) {
            uhtml += '<li class="insights-muted">…and ' + (unbilled.length - 40) + " more.</li>";
          }
          uhtml += "</ul>";
          ubBody.innerHTML = uhtml;
          ubBody.querySelectorAll("[data-insights-ticket]").forEach(function (a) {
            a.addEventListener("click", function (ev) {
              ev.preventDefault();
              var id = a.getAttribute("data-insights-ticket");
              if (typeof global.switchTab === "function") global.switchTab("service");
              global.setTimeout(function () {
                if (typeof global.loadServiceCall === "function") {
                  void global.loadServiceCall(id);
                }
              }, 200);
            });
          });
        }
      }

      var siRows = await loadSiteIntelligenceMergedOnce(db);
      var memosWeek = 0;
      var memosTotal = 0;
      var siteWeek = 0;

      Object.keys(ticketById).forEach(function (tid) {
        var sc = ticketById[tid];
        var memo = String(sc.clientPortalMemo || "").trim();
        if (!memo.length) return;
        memosTotal += 1;
        var sent = tsToMillis(sc.portalVerificationSentAt);
        if (isFinite(sent) && sent >= weekStart.getTime() && sent <= weekEnd.getTime()) {
          memosWeek += 1;
        }
      });

      for (i = 0; i < siRows.length; i++) {
        var sud = siRows[i].data;
        var uts = tsToMillis(sud.updatedAt);
        if (isFinite(uts) && uts >= weekStart.getTime() && uts <= weekEnd.getTime()) {
          siteWeek += 1;
        }
      }

      var healthEl = document.getElementById("insightsHealthBody");
      if (healthEl) {
        healthEl.innerHTML =
          '<div class="insights-health-metrics">' +
          '<div class="insights-health-metric"><div class="val">' +
          memosWeek +
          '</div><div class="lbl">Client portal memos (AI / letter) — verification sends this week</div></div>' +
          '<div class="insights-health-metric"><div class="val">' +
          memosTotal +
          '</div><div class="lbl">Tickets with a non-empty client portal memo (all time in dataset)</div></div>' +
          '<div class="insights-health-metric"><div class="val">' +
          siteWeek +
          '</div><div class="lbl">Site intel docs updated this calendar week (Mon 00:00–Sun 23:59)</div></div>' +
          "</div>" +
          '<p class="insights-muted" style="margin-top:12px">Shared Brain usage is proxied from <code>portalVerificationSentAt</code> (memos tied to a sent verification) and <code>site_intelligence.updatedAt</code>.</p>';
      }
    } catch (e) {
      console.error(e);
      if (errEl) errEl.textContent = e && e.message ? e.message : String(e);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function initInsightsDashboard() {
    var fromEl = document.getElementById("insightsDateFrom");
    var toEl = document.getElementById("insightsDateTo");
    var rateEl = document.getElementById("insightsDefaultRate");
    var btn = document.getElementById("insightsRefreshBtn");
    if (fromEl && !fromEl.value) fromEl.value = daysAgoIso(30);
    if (toEl && !toEl.value) toEl.value = todayIso();
    if (rateEl && !rateEl.value) rateEl.value = String(getDefaultRate());
    if (btn && btn.dataset.vcInsightsWired !== "1") {
      btn.dataset.vcInsightsWired = "1";
      btn.addEventListener("click", function () {
        void refreshInsights();
      });
    }
  }

  global.VcInsightsManager = {
    initInsightsDashboard: initInsightsDashboard,
    refreshInsights: refreshInsights,
  };
})(typeof window !== "undefined" ? window : this);
