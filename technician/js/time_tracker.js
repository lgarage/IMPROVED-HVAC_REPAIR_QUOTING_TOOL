/**
 * Lite seat — high-contrast clock dashboard, geotagged labor_logs, read-only job shell hooks.
 */
(function (global) {
  "use strict";

  var laborTicketId = "";

  function isLiteSeat() {
    try {
      return localStorage.getItem("vc_time_tracking_only") === "1";
    } catch (e) {
      return false;
    }
  }

  function payrollKeyFromName(name) {
    return String(name || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64) || "USER";
  }

  function todayYmd() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function ymdToDocSuffix(ymd) {
    return String(ymd || "").replace(/-/g, "_");
  }

  function laborDocId(payrollKey, ymd) {
    return payrollKey + "_" + ymdToDocSuffix(ymd);
  }

  function getTechName() {
    try {
      return String(localStorage.getItem("tp_saved_tech") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function getLeadTechName(ticket, currentName) {
    if (!ticket) return "";
    var names = [];
    if (Array.isArray(ticket.assignedTechs)) {
      names = ticket.assignedTechs.filter(Boolean).map(function (n) {
        return String(n).trim();
      });
    }
    if (ticket.assignedTech && names.indexOf(String(ticket.assignedTech).trim()) < 0) {
      names.unshift(String(ticket.assignedTech).trim());
    }
    var me = String(currentName || "").trim();
    var others = names.filter(function (n) {
      return n && n !== me;
    });
    if (others.length) return others[0];
    return "";
  }

  function parseEntries(data) {
    var arr = data && Array.isArray(data.entries) ? data.entries : [];
    return arr.slice();
  }

  function computeHoursSeconds(entries) {
    var sorted = entries
      .filter(function (e) {
        return e && e.at && (e.action === "IN" || e.action === "OUT");
      })
      .map(function (e) {
        return {
          t: new Date(e.at).getTime(),
          action: e.action,
        };
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
    return { seconds: sec, openIn: openIn };
  }

  function formatHms(totalSec) {
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    return h + "h " + m + "m";
  }

  function dutyLabel(entries) {
    if (!entries.length) return "Off duty";
    var last = entries[entries.length - 1];
    if (last && last.action === "IN") return "On duty";
    return "Off duty";
  }

  /**
   * GPS snapshot for labor / reports: wait up to 5s for a fix; if none, allow proceed with location_estimated.
   * @returns {Promise<{ lat: number|null, lng: number|null, location_estimated: boolean }>}
   */
  function captureGeoSnapshot() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) {
        resolve({ lat: null, lng: null, location_estimated: true });
        return;
      }
      var settled = false;
      function finish(lat, lng, estimated) {
        if (settled) return;
        settled = true;
        resolve({
          lat: lat != null && !isNaN(lat) ? lat : null,
          lng: lng != null && !isNaN(lng) ? lng : null,
          location_estimated: !!estimated,
        });
      }
      var timer = global.setTimeout(function () {
        finish(null, null, true);
      }, 5000);
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          try {
            global.clearTimeout(timer);
          } catch (e) {}
          finish(pos.coords.latitude, pos.coords.longitude, false);
        },
        function () {
          try {
            global.clearTimeout(timer);
          } catch (e) {}
          finish(null, null, true);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  }

  function appendLaborEntry(action, ticketIdOpt) {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      return Promise.reject(new Error("Firebase not ready"));
    }
    if (typeof VCFirestore === "undefined" || !VCFirestore.laborLogs) {
      return Promise.reject(new Error("VCFirestore.laborLogs missing"));
    }
    var tech = getTechName();
    var pk = payrollKeyFromName(tech);
    var ymd = todayYmd();
    var docId = laborDocId(pk, ymd);
    var db = firebase.firestore();
    var ref = VCFirestore.laborLogs(db).doc(docId);
    var iso = new Date().toISOString();
    return captureGeoSnapshot().then(function (geo) {
      var entry = {
        at: iso,
        action: action,
        lat: geo.lat,
        lng: geo.lng,
        location_estimated: !!geo.location_estimated,
        ticketId: ticketIdOpt ? String(ticketIdOpt) : "",
      };
      return db.runTransaction(function (tx) {
        return tx.get(ref).then(function (snap) {
          var prev = snap.exists && snap.data() ? snap.data() : {};
          var entries = parseEntries(prev);
          entries.push(entry);
          tx.set(
            ref,
            {
              dateYmd: ymd,
              payrollKey: pk,
              employeeName: tech,
              entries: entries,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });
      });
    });
  }

  function subscribeTodayLabor(onNext) {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return function () {};
    var tech = getTechName();
    var pk = payrollKeyFromName(tech);
    var ymd = todayYmd();
    var docId = laborDocId(pk, ymd);
    var db = firebase.firestore();
    var ref = VCFirestore.laborLogs(db).doc(docId);
    return ref.onSnapshot(
      function (snap) {
        var data = snap.exists && snap.data() ? snap.data() : {};
        onNext(parseEntries(data));
      },
      function () {
        onNext([]);
      }
    );
  }

  function wireLite(root) {
    var unsub = null;
    var lastEntries = [];
    function paint(entries) {
      lastEntries = entries || [];
      var dutyEl = root.querySelector("[data-vc-lite-duty]");
      var hoursEl = root.querySelector("[data-vc-lite-hours]");
      var btnIn = root.querySelector("[data-vc-lite-clock-in]");
      var btnOut = root.querySelector("[data-vc-lite-clock-out]");
      if (dutyEl) dutyEl.textContent = dutyLabel(lastEntries);
      var h = computeHoursSeconds(lastEntries);
      var extra = 0;
      if (h.openIn != null) {
        extra = Math.floor((Date.now() - h.openIn) / 1000);
      }
      if (hoursEl) hoursEl.textContent = formatHms(h.seconds + extra);
      var lastIn = lastEntries.length && lastEntries[lastEntries.length - 1].action === "IN";
      if (btnIn) btnIn.disabled = !!lastIn;
      if (btnOut) btnOut.disabled = !lastIn;
    }
    unsub = subscribeTodayLabor(paint);
    var leadEl = root.querySelector("[data-vc-lite-lead]");
    function paintLead() {
      var lead = "";
      try {
        if (typeof activeTicket !== "undefined" && activeTicket) {
          lead = getLeadTechName(activeTicket, getTechName());
        }
      } catch (e) {}
      if (leadEl) leadEl.textContent = lead ? lead : "—";
    }
    paintLead();
    var leadIv = global.setInterval(paintLead, 8000);
    var tickIv = global.setInterval(function () {
      paint(lastEntries);
    }, 15000);

    return function () {
      if (typeof unsub === "function") unsub();
      global.clearInterval(leadIv);
      global.clearInterval(tickIv);
    };
  }

  function mountLiteShell() {
    var host = document.getElementById("vcLiteSeatRoot");
    if (!host || host.dataset.vcLiteMounted === "1") return;
    if (host._vcLiteCleanup) {
      try {
        host._vcLiteCleanup();
      } catch (e) {}
      host._vcLiteCleanup = null;
    }
    host.dataset.vcLiteMounted = "1";
    host.innerHTML =
      '<div class="vc-lite-seat">' +
      '<div class="vc-lite-seat__card">' +
      '<p class="vc-lite-seat__label">Duty status</p>' +
      '<p class="vc-lite-seat__duty" data-vc-lite-duty>—</p>' +
      '<p class="vc-lite-seat__label">Hours today</p>' +
      '<p class="vc-lite-seat__hours" data-vc-lite-hours>0h 0m</p>' +
      '<p class="vc-lite-seat__label">Lead tech (this job)</p>' +
      '<p class="vc-lite-seat__lead" data-vc-lite-lead>—</p>' +
      "</div>" +
      '<div class="vc-lite-seat__actions">' +
      '<button type="button" class="vc-lite-btn vc-lite-btn--in" data-vc-lite-clock-in>CLOCK IN</button>' +
      '<button type="button" class="vc-lite-btn vc-lite-btn--out" data-vc-lite-clock-out disabled>CLOCK OUT</button>' +
      "</div>" +
      '<p class="vc-lite-seat__hint" data-vc-lite-status aria-live="polite"></p>' +
      "</div>";

    var cleanup = wireLite(host);
    host.dataset.vcLiteCleanup = "1";
    host._vcLiteCleanup = cleanup;

    host.querySelector("[data-vc-lite-clock-in]").addEventListener("click", function () {
      var st = host.querySelector("[data-vc-lite-status]");
      if (st) st.textContent = "Getting location…";
      var tid = laborTicketId || (typeof activeTicket !== "undefined" && activeTicket ? activeTicket.id : "");
      appendLaborEntry("IN", tid)
        .then(function () {
          if (st) st.textContent = "Clocked in.";
        })
        .catch(function (e) {
          if (st) st.textContent = e && e.message ? e.message : "Clock in failed.";
        });
    });
    host.querySelector("[data-vc-lite-clock-out]").addEventListener("click", function () {
      var st = host.querySelector("[data-vc-lite-status]");
      if (st) st.textContent = "Getting location…";
      appendLaborEntry("OUT", "")
        .then(function () {
          if (st) st.textContent = "Clocked out.";
        })
        .catch(function (e) {
          if (st) st.textContent = e && e.message ? e.message : "Clock out failed.";
        });
    });
  }

  function initLiteSeatShell() {
    if (!isLiteSeat()) return;
    document.body.classList.add("vc-lite-seat-mode");
    var navHist = document.getElementById("nav-history");
    var navClock = document.getElementById("nav-clock");
    if (navHist) navHist.classList.add("hidden");
    if (navClock) navClock.classList.remove("hidden");
    mountLiteShell();
  }

  function setLaborTicketId(ticketId) {
    laborTicketId = ticketId ? String(ticketId) : "";
  }

  global.VcTimeTracker = {
    isLiteSeat: isLiteSeat,
    initLiteSeatShell: initLiteSeatShell,
    setLaborTicketId: setLaborTicketId,
    payrollKeyFromName: payrollKeyFromName,
    laborDocId: laborDocId,
    todayYmd: todayYmd,
    computeHoursSeconds: computeHoursSeconds,
    appendLaborEntry: appendLaborEntry,
    captureGeoSnapshot: captureGeoSnapshot,
  };
})(typeof window !== "undefined" ? window : this);
