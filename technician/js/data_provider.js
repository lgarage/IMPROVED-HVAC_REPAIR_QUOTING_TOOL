/**
 * Vertex-Core — provider-agnostic data layer (SaaS-ready).
 * UI must depend only on DataProvider + Standard Ticket shape, not on UniFiX or any vendor.
 */
(function () {
  "use strict";

  /**
   * Default data source: 'NATIVE' = Firestore service_calls, 'UFX' = UniFiX plugin,
   * 'SERVICETITAN' = reserved. Runtime: set window.DATA_SOURCE before data_provider loads.
   */
  var DEFAULT_DATA_SOURCE = "NATIVE";
  if (typeof window.DATA_SOURCE === "undefined") {
    window.DATA_SOURCE = DEFAULT_DATA_SOURCE;
  }

  function currentDataSource() {
    var s = window.DATA_SOURCE;
    if (s === "UFX" || s === "NATIVE" || s === "SERVICETITAN") return s;
    return DEFAULT_DATA_SOURCE;
  }

  /**
   * Standard Ticket — internal VC contract for jobs (provider-neutral).
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
    if (src === "SERVICETITAN") {
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

  window.DataProvider = {
    get dataSource() {
      return currentDataSource();
    },
    /** @type {typeof mapToStandardTicket} */
    mapToStandardTicket: mapToStandardTicket,
    mapServiceCallToStandard: mapServiceCallToStandard,
    getSchedule: getSchedule,
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
