/**
 * UniFiX (UFX) integration plugin for Vertex-Core.
 * Maps UFX / dispatch-shaped documents into the provider-agnostic Standard Ticket.
 *
 * When DATA_SOURCE === 'UFX', DataProvider routes schedule subscription here.
 * For environments without a live UFX API yet, this uses the same Firestore
 * service_calls feed as NATIVE and applies UFX-oriented field mapping.
 */
(function () {
  "use strict";

  /**
   * Map a raw service call / UFX-shaped row to Standard Ticket fields.
   * @param {object} raw
   * @param {string} [docId]
   * @returns {object|null} StandardTicket-shaped object
   */
  function mapUFXToStandardTicket(raw, docId) {
    if (!raw) return null;
    var id = docId != null ? String(docId) : String(raw.id || "");
    var locationName = String(raw.customerName || raw.locationName || "").trim();
    var description = String(
      raw.issue != null
        ? raw.issue
        : raw.description != null
          ? raw.description
          : raw.workDescription != null
            ? raw.workDescription
            : ""
    ).trim();
    var priority = String(raw.priority || "Normal").trim() || "Normal";
    return {
      id: id,
      locationName: locationName,
      description: description,
      priority: priority,
      providerMetadata: {
        source: "UFX",
        ticketNum: raw.ticketNum != null ? String(raw.ticketNum) : "",
        jobType: raw.jobType != null ? String(raw.jobType) : "",
        externalRef: raw.ufxId != null ? String(raw.ufxId) : "",
      },
    };
  }

  /**
   * Subscribe to schedule when UFX is the configured source.
   * Delegates to the native Firestore implementation until a dedicated UFX API exists.
   * @param {function(boolean): void} onFirstSnapshot
   * @param {boolean} runDeepLink
   * @returns {void}
   */
  function subscribeSchedule(onFirstSnapshot, runDeepLink) {
    if (typeof window._implSubscribeToMyTickets !== "function") {
      console.error("[UFXAdapter] Native schedule bridge not available.");
      return;
    }
    console.info("[UFXAdapter] Schedule subscription (UFX plugin → native Firestore bridge).");
    return window._implSubscribeToMyTickets(onFirstSnapshot, runDeepLink);
  }

  /**
   * UFX export gatekeeper: only pass fields UniFiX is allowed to receive.
   * Never forwards internal_comms, site_intelligence, or other VC-native vault fields.
   * @param {object} summary Candidate payload (may include extra keys from merged objects)
   * @returns {{ resolution: string, parts: string, hours: string }}
   */
  function pushTicketSummary(summary) {
    var s = summary && typeof summary === "object" ? summary : {};
    function pick(key) {
      var v = s[key];
      return v != null && v !== undefined ? String(v) : "";
    }
    return {
      resolution: pick("resolution"),
      parts: pick("parts"),
      hours: pick("hours"),
    };
  }

  window.UFXAdapter = {
    mapUFXToStandardTicket: mapUFXToStandardTicket,
    subscribeSchedule: subscribeSchedule,
    pushTicketSummary: pushTicketSummary,
  };
})();
