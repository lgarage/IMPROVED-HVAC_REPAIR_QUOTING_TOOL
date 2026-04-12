/**
 * Global site directory & search (Vertex-Core native). Uses DataProvider.getAllLocations().
 */
(function () {
  "use strict";

  var cached = [];
  var cacheAt = 0;
  var CACHE_MS = 60000;

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function ensureHistoryModal() {
    var existing = document.getElementById("vcUnitHistoryModal");
    if (existing) return existing;
    var wrap = document.createElement("div");
    wrap.id = "vcUnitHistoryModal";
    wrap.className = "vc-modal hidden";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML =
      '<div class="vc-modal-backdrop" data-vc-uh-close="1"></div>' +
      '<div class="vc-modal-sheet vc-modal-sheet--wide">' +
      '<div class="vc-modal-head">' +
      "<h2>Unit / visit history (VC)</h2>" +
      '<button type="button" class="vc-modal-close" data-vc-uh-close="1" aria-label="Close">&times;</button>' +
      "</div>" +
      '<p id="vcUhLocation" class="vc-site-intel-location"></p>' +
      '<div id="vcUhBody" class="vc-unit-history-body"></div>' +
      "</div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-vc-uh-close")) wrap.classList.add("hidden");
    });
    return wrap;
  }

  function openMapsDeepLink(mapsQuery) {
    var q = String(mapsQuery || "").trim();
    if (!q) return;
    var url = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openUnitHistoryForLocation(displayLine) {
    var line = String(displayLine || "").trim();
    var modal = ensureHistoryModal();
    document.getElementById("vcUhLocation").textContent = line || "—";
    var body = document.getElementById("vcUhBody");
    body.innerHTML = "<p>Loading…</p>";
    modal.classList.remove("hidden");

    if (!line || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      body.innerHTML = "<p>History unavailable.</p>";
      return;
    }

    var dbLm = firebase.firestore();
    var loadRows =
      typeof VCFirestore !== "undefined" && VCFirestore.queryCompletedReportsWhereMerged
        ? VCFirestore.queryCompletedReportsWhereMerged(dbLm, "location", "==", line, 40)
        : dbLm
            .collection("completed_reports")
            .where("location", "==", line)
            .limit(40)
            .get()
            .then(function (snap) {
              var rows = [];
              snap.forEach(function (doc) {
                rows.push({ id: doc.id, data: doc.data() || {} });
              });
              return rows;
            });
    loadRows
      .then(function (rows) {
        rows.sort(function (a, b) {
          var ta = a.data.timestamp && a.data.timestamp.toMillis ? a.data.timestamp.toMillis() : 0;
          var tb = b.data.timestamp && b.data.timestamp.toMillis ? b.data.timestamp.toMillis() : 0;
          return tb - ta;
        });
        if (!rows.length) {
          body.innerHTML =
            "<p class=\"vc-muted\">No completed reports found for this exact location line yet.</p>";
          return;
        }
        var html = '<ul class="vc-unit-history-list">';
        rows.forEach(function (r) {
          var d = r.data;
          var when = d.deviceSavedAt || (d.timestamp && d.timestamp.toDate ? d.timestamp.toDate().toLocaleString() : "");
          var mode = d.mode || d.currentMode || "";
          var tech = d.techName || "";
          var snippet = String(d.fullReportText || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 160);
          html +=
            "<li><div class=\"vc-uh-row\"><strong>" +
            escapeHtml(when) +
            "</strong>" +
            (mode ? " · " + escapeHtml(mode) : "") +
            (tech ? " · " + escapeHtml(tech) : "") +
            "</div>" +
            (snippet ? "<div class=\"vc-uh-snippet\">" + escapeHtml(snippet) + "…</div>" : "") +
            "</li>";
        });
        html += "</ul>";
        body.innerHTML = html;
      })
      .catch(function (err) {
        body.innerHTML =
          "<p>Could not load history. " + escapeHtml(err && err.message ? err.message : String(err)) + "</p>";
      });
  }

  async function refreshCache() {
    if (!window.DataProvider || typeof DataProvider.getAllLocations !== "function") {
      cached = [];
      return cached;
    }
    if (cached.length && Date.now() - cacheAt < CACHE_MS) return cached;
    cached = await DataProvider.getAllLocations();
    cacheAt = Date.now();
    return cached;
  }

  function filterLocations(query, list) {
    var q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return list.slice();
    return list.filter(function (row) {
      return String(row.displayLine || "")
        .toLowerCase()
        .includes(q);
    });
  }

  function renderResults(container, rows) {
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = "<p class=\"vc-site-search-empty\">No matches.</p>";
      return;
    }
    var html = '<ul class="vc-site-search-list">';
    rows.forEach(function (r) {
      var disp = r.displayLine || "";
      var enc = encodeURIComponent(disp);
      html += '<li class="vc-site-search-item">';
      html += "<div class=\"vc-site-search-line\">" + escapeHtml(disp) + "</div>";
      html += '<div class="vc-site-search-actions">';
      html +=
        '<button type="button" class="btn btn-secondary vc-sa-nav" data-vc-line="' +
        enc +
        '">Navigate</button>';
      html +=
        '<button type="button" class="btn btn-secondary vc-sa-intel" data-vc-line="' +
        enc +
        '">Site Intel</button>';
      html +=
        '<button type="button" class="btn btn-secondary vc-sa-hist" data-vc-line="' +
        enc +
        '">Unit History</button>';
      html += "</div></li>";
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  function initGlobalSiteDirectory() {
    var input = document.getElementById("globalSiteSearchInput");
    var results = document.getElementById("globalSiteSearchResults");
    if (!input || !results || input.dataset.wired === "1") return;
    input.dataset.wired = "1";

    function runFilter() {
      refreshCache().then(function (list) {
        var f = filterLocations(input.value, list);
        results.hidden = false;
        renderResults(results, f);
      });
    }

    input.addEventListener("focus", function () {
      refreshCache().then(function () {
        runFilter();
      });
    });
    input.addEventListener("input", function () {
      refreshCache().then(function (list) {
        var f = filterLocations(input.value, list);
        results.hidden = false;
        renderResults(results, f);
      });
    });

    results.addEventListener("click", function (e) {
      var nav = e.target.closest(".vc-sa-nav");
      var intel = e.target.closest(".vc-sa-intel");
      var hist = e.target.closest(".vc-sa-hist");
      var raw =
        (nav && nav.getAttribute("data-vc-line")) ||
        (intel && intel.getAttribute("data-vc-line")) ||
        (hist && hist.getAttribute("data-vc-line"));
      if (!raw) return;
      var line = decodeURIComponent(raw);
      if (nav) {
        openMapsDeepLink(line);
      } else if (intel) {
        if (typeof window.openSiteIntelForLocation === "function") {
          window.openSiteIntelForLocation(line);
        }
      } else if (hist) {
        openUnitHistoryForLocation(line);
      }
    });
  }

  window.initGlobalSiteDirectory = initGlobalSiteDirectory;
  window.openUnitHistoryForLocation = openUnitHistoryForLocation;
  window.refreshLocationDirectoryCache = function () {
    cached = [];
    cacheAt = 0;
  };
})();
