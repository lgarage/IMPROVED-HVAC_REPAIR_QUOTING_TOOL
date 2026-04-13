/**
 * Vertex-Core — provider-agnostic data layer (SaaS-ready).
 * UI must depend only on DataProvider + Standard Ticket shape, not on UniFiX or any vendor.
 */
(function () {
  "use strict";

  /**
   * Default data source: 'NATIVE' = Firestore service_calls, 'UFX' = UniFiX plugin,
   * 'LEGACY_PLATFORM' = reserved alias for native-shaped rows. Runtime: set window.DATA_SOURCE before data_provider loads.
   */
  var DEFAULT_DATA_SOURCE = "NATIVE";
  if (typeof window.DATA_SOURCE === "undefined") {
    window.DATA_SOURCE = DEFAULT_DATA_SOURCE;
  }

  function currentDataSource() {
    var s = window.DATA_SOURCE;
    if (s === "UFX" || s === "NATIVE" || s === "LEGACY_PLATFORM") return s;
    return DEFAULT_DATA_SOURCE;
  }

  /**
   * Standard Ticket — provider-neutral job contract for the app.
   * @typedef {Object} StandardTicket
   * @property {string} id — Internal document id (always present)
   * @property {string} locationName — Primary site / customer line for UI
   * @property {string} description — Work description / issue
   * @property {string} priority — e.g. Normal, Emergency
   * @property {Object} [providerMetadata] — Optional: ticket #, external ids (never required for core UI)
   */

  /**
   * Map a native service_calls document to Standard Ticket.
   * @param {object} raw
   * @param {string} [docId]
   * @returns {StandardTicket|null}
   */
  function mapServiceCallToStandard(raw, docId) {
    if (!raw) return null;
    var id = docId != null ? String(docId) : String(raw.id || "");
    var locationName = String(raw.customerName || raw.locationName || "").trim();
    var description = String(
      raw.issue != null
        ? raw.issue
        : raw.description != null
          ? raw.description
          : ""
    ).trim();
    var priority = String(raw.priority || "Normal").trim() || "Normal";
    return {
      id: id,
      locationName: locationName,
      description: description,
      priority: priority,
      providerMetadata: {
        source: "NATIVE",
        ticketNum: raw.ticketNum != null ? String(raw.ticketNum) : "",
        jobType: raw.jobType != null ? String(raw.jobType) : "",
      },
    };
  }

  /**
   * Map any supported raw row to Standard Ticket (dispatches by DATA_SOURCE).
   * @param {object} raw
   * @param {string} [docId]
   * @returns {StandardTicket|null}
   */
  function mapToStandardTicket(raw, docId) {
    var src = currentDataSource();
    if (src === "UFX" && window.UFXAdapter && typeof window.UFXAdapter.mapUFXToStandardTicket === "function") {
      return window.UFXAdapter.mapUFXToStandardTicket(raw, docId);
    }
    if (src === "LEGACY_PLATFORM") {
      return mapServiceCallToStandard(raw, docId);
    }
    return mapServiceCallToStandard(raw, docId);
  }

  /**
   * Subscribe to the technician schedule. UI calls this — not Firestore and not UFX directly.
   * @param {function(boolean): void} [onFirstSnapshot]
   * @param {boolean} [runDeepLink]
   */
  function getSchedule(onFirstSnapshot, runDeepLink) {
    if (currentDataSource() === "UFX") {
      if (window.UFXAdapter && typeof window.UFXAdapter.subscribeSchedule === "function") {
        return window.UFXAdapter.subscribeSchedule(onFirstSnapshot, runDeepLink);
      }
      console.warn("[DataProvider] UFX selected but UFXAdapter missing; falling back to NATIVE.");
    }
    if (typeof window._implSubscribeToMyTickets !== "function") {
      console.error("[DataProvider] Native schedule bridge (_implSubscribeToMyTickets) not ready.");
      return;
    }
    return window._implSubscribeToMyTickets(onFirstSnapshot, runDeepLink);
  }

  /**
   * Canonical string for a site (customer + address line). Used for site_intelligence keys and search.
   * @param {string} locationLine e.g. "Acme - 123 Main St"
   * @returns {string}
   */
  function normalizeLocationKey(locationLine) {
    return String(locationLine || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  /**
   * Stable Firestore document id for site_intelligence (avoids invalid path chars / length issues).
   * @param {string} locationLine
   * @returns {string}
   */
  function siteIntelDocIdFromLocationLine(locationLine) {
    var key = normalizeLocationKey(locationLine);
    if (!key) return "";
    var h = 5381;
    for (var i = 0; i < key.length; i++) {
      h = (h * 33) ^ key.charCodeAt(i);
    }
    return "vc_site_" + (h >>> 0).toString(16);
  }

  /**
   * Global directory: unique sites from native Firestore (service_calls + site_intelligence).
   * Provider-agnostic; always reads Vertex-Core Firebase.
   * @returns {Promise<Array<{ id: string, displayLine: string, address: string, customerName: string, mapsQuery: string }>>}
   */
  function getAllLocations() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      return Promise.resolve([]);
    }
    var db = firebase.firestore();
    var sc =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.serviceCalls(db)
        : db.collection("service_calls");
    var si =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.siteIntelligence(db)
        : db.collection("site_intelligence");
    var byKey = {};

    function addRow(customerName, locationAddress) {
      var cn = String(customerName || "").trim();
      var addr = String(locationAddress || "").trim();
      var displayLine = cn && addr ? cn + " - " + addr : cn || addr;
      if (!displayLine) return;
      var nk = normalizeLocationKey(displayLine);
      if (!nk) return;
      if (byKey[nk]) return;
      byKey[nk] = {
        id: siteIntelDocIdFromLocationLine(displayLine),
        displayLine: displayLine,
        address: addr,
        customerName: cn,
        mapsQuery: displayLine,
      };
    }

    function ingestServiceCallSnap(snap) {
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        addRow(d.customerName, d.locationAddress);
      });
    }
    function ingestSiteIntelSnap(snap) {
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        var line = String(d.locationDisplay || d.displayLine || "").trim();
        if (line) {
          var dash = line.indexOf(" - ");
          if (dash > 0) {
            addRow(line.slice(0, dash).trim(), line.slice(dash + 3).trim());
          } else {
            addRow(line, "");
          }
          return;
        }
        if (d.customerName || d.address) {
          addRow(d.customerName, d.address);
        }
      });
    }

    var bridge =
      typeof VCFirestore !== "undefined" &&
      VCFirestore.isBridgeTenant &&
      VCFirestore.isBridgeTenant() &&
      !(typeof VCFirestore.isSandboxDataPath === "function" && VCFirestore.isSandboxDataPath());

    var p1 = bridge
      ? Promise.all([
          sc.limit(800).get(),
          db.collection("service_calls").limit(800).get(),
        ])
          .then(function (pair) {
            ingestServiceCallSnap(pair[0]);
            ingestServiceCallSnap(pair[1]);
          })
          .catch(function (e) {
            console.warn("[DataProvider] getAllLocations service_calls", e);
          })
      : sc
          .limit(800)
          .get()
          .then(ingestServiceCallSnap)
          .catch(function (e) {
            console.warn("[DataProvider] getAllLocations service_calls", e);
          });

    var p2 = bridge
      ? Promise.all([
          si.limit(500).get(),
          db.collection("site_intelligence").limit(500).get(),
        ])
          .then(function (pair) {
            ingestSiteIntelSnap(pair[0]);
            ingestSiteIntelSnap(pair[1]);
          })
          .catch(function () {
            /* collection may be empty */
          })
      : si
          .limit(500)
          .get()
          .then(ingestSiteIntelSnap)
          .catch(function () {
            /* collection may be empty */
          });

    return Promise.all([p1, p2]).then(function () {
      return Object.keys(byKey)
        .sort()
        .map(function (k) {
          return byKey[k];
        });
    });
  }

  window.DataProvider = {
    get dataSource() {
      return currentDataSource();
    },
    /** @type {typeof mapToStandardTicket} */
    mapToStandardTicket: mapToStandardTicket,
    mapServiceCallToStandard: mapServiceCallToStandard,
    getSchedule: getSchedule,
    normalizeLocationKey: normalizeLocationKey,
    siteIntelDocIdFromLocationLine: siteIntelDocIdFromLocationLine,
    getAllLocations: getAllLocations,
  };

  /** Route public schedule API through DataProvider; keep native impl for NATIVE/UFX bridge. */
  (function bridgeSchedule() {
    if (typeof window.subscribeToMyTickets !== "function") return;
    if (typeof window._implSubscribeToMyTickets === "function") return;
    window._implSubscribeToMyTickets = window.subscribeToMyTickets;
    window.subscribeToMyTickets = function (onFirstSnapshot, runDeepLink) {
      return window.DataProvider.getSchedule(onFirstSnapshot, runDeepLink);
    };
  })();
})();
