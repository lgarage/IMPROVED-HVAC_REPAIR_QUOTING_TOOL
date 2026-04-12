/**
 * Labor & payroll CSV export — queries tenants/{tenantId}/labor_logs.
 */
(function (global) {
  "use strict";

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

  function csvEscape(s) {
    var t = String(s == null ? "" : s);
    if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
    return t;
  }

  function todayIsoDate() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function firstOfMonthIso() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
  }

  function downloadCsv(filename, text) {
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    global.setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 2000);
  }

  async function resolveTicketLabel(db, ticketId, cache) {
    var tid = String(ticketId || "").trim();
    if (!tid) return "";
    if (cache[tid]) return cache[tid];
    if (typeof VCFirestore === "undefined" || !VCFirestore.getServiceCallOnceBridged) {
      cache[tid] = tid;
      return cache[tid];
    }
    try {
      var got = await VCFirestore.getServiceCallOnceBridged(db, tid);
      var data = got && got.data ? got.data : {};
      var cn = String(data.customerName || "").trim();
      var la = String(data.locationAddress || "").trim();
      var label = cn ? cn + (la ? " — " + la : "") : tid;
      cache[tid] = label;
      return label;
    } catch (e) {
      cache[tid] = tid;
      return tid;
    }
  }

  async function exportLaborRange(startYmd, endYmd) {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      throw new Error("Firebase not initialized");
    }
    if (typeof VCFirestore === "undefined" || !VCFirestore.laborLogs) {
      throw new Error("VCFirestore.laborLogs unavailable");
    }
    var db = firebase.firestore();
    var col = VCFirestore.laborLogs(db);
    var snap = await col
      .where("dateYmd", ">=", String(startYmd))
      .where("dateYmd", "<=", String(endYmd))
      .get();

    var ticketCache = {};
    var lines = [["Employee Name", "Date", "Total Shift Hours", "Job Site(s)", "Overtime (if >8hrs)"]];

    for (var i = 0; i < snap.docs.length; i++) {
      var doc = snap.docs[i];
      var d = doc.data() || {};
      var name = String(d.employeeName || "").trim() || doc.id;
      var date = String(d.dateYmd || "").trim();
      var entries = Array.isArray(d.entries) ? d.entries : [];
      var hours = computeShiftHours(entries);
      var ticketIds = {};
      for (var j = 0; j < entries.length; j++) {
        if (entries[j] && entries[j].ticketId) {
          ticketIds[String(entries[j].ticketId)] = true;
        }
      }
      var siteParts = [];
      var keys = Object.keys(ticketIds);
      for (var k = 0; k < keys.length; k++) {
        siteParts.push(await resolveTicketLabel(db, keys[k], ticketCache));
      }
      var jobSites = siteParts.filter(Boolean).join("; ");
      var ot = hours > 8 ? (hours - 8).toFixed(2) : "0";
      lines.push([
        name,
        date,
        hours.toFixed(2),
        jobSites,
        ot,
      ]);
    }

    return lines
      .map(function (row) {
        return row.map(csvEscape).join(",");
      })
      .join("\n");
  }

  function initPayrollManager() {
    var fromEl = document.getElementById("vcPayrollFrom");
    var toEl = document.getElementById("vcPayrollTo");
    var btn = document.getElementById("vcPayrollExportBtn");
    var errEl = document.getElementById("vcPayrollExportErr");
    if (!fromEl || !toEl || !btn) return;
    if (btn.dataset.vcPayrollWired === "1") return;
    btn.dataset.vcPayrollWired = "1";
    try {
      fromEl.value = firstOfMonthIso();
      toEl.value = todayIsoDate();
    } catch (e) {}
    btn.addEventListener("click", function () {
      if (errEl) errEl.textContent = "";
      var start = fromEl.value;
      var end = toEl.value;
      if (!start || !end) {
        if (errEl) errEl.textContent = "Choose start and end dates.";
        return;
      }
      if (start > end) {
        if (errEl) errEl.textContent = "Start date must be before end date.";
        return;
      }
      btn.disabled = true;
      exportLaborRange(start, end)
        .then(function (csv) {
          var fname = "labor_export_" + start + "_to_" + end + ".csv";
          downloadCsv(fname, csv);
        })
        .catch(function (e) {
          console.error(e);
          if (errEl) errEl.textContent = e && e.message ? e.message : String(e);
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPayrollManager);
  } else {
    initPayrollManager();
  }

  global.VcPayrollManager = {
    exportLaborRange: exportLaborRange,
    initPayrollManager: initPayrollManager,
  };
})(typeof window !== "undefined" ? window : this);
