/**
 * Vertex Core — tenant-scoped Firestore paths (Phase 10).
 * Data lives under tenants/{tenantId}/… for isolation between companies.
 *
 * Requires: shared/config.js (APP_CONFIG.tenantId), firebase firestore.
 */
(function (global) {
  "use strict";

  function getTenantId() {
    if (typeof APP_CONFIG !== "undefined" && APP_CONFIG.tenantId) {
      return String(APP_CONFIG.tenantId).trim();
    }
    return "TWIN_PILLARS";
  }

  function tenantRoot(db) {
    return db.collection("tenants").doc(getTenantId());
  }

  /** @param {firebase.firestore.Firestore} db */
  function tenantCollection(db, name) {
    return tenantRoot(db).collection(String(name));
  }

  function serviceCalls(db) {
    return tenantCollection(db, "service_calls");
  }

  function siteIntelligence(db) {
    return tenantCollection(db, "site_intelligence");
  }

  /** Single roster document: names[], profiles{}, updatedAt */
  function rosterDoc(db) {
    return tenantCollection(db, "roster").doc("default");
  }

  function fieldQuotes(db) {
    return tenantCollection(db, "field_quotes");
  }

  function pmRecords(db) {
    return tenantCollection(db, "pm_records");
  }

  /** Dynamic / custom field form submissions (tenant-scoped). */
  function fieldFormSubmissions(db) {
    return tenantCollection(db, "field_form_submissions");
  }

  /** Office on-call rotation state (tenant-scoped). */
  function onCallStateDoc(db) {
    return tenantCollection(db, "on_call_state").doc("default");
  }

  /** Technician completed report uploads from field app (tenant-scoped). */
  function completedReports(db) {
    return tenantCollection(db, "completed_reports");
  }

  /**
   * Subcollection under a service call (addendums, etc.).
   * @param {firebase.firestore.Firestore} db
   * @param {string} ticketId
   * @param {string} sub
   */
  function serviceCallSubcollection(db, ticketId, sub) {
    return serviceCalls(db).doc(String(ticketId)).collection(String(sub));
  }

  global.VCFirestore = {
    getTenantId: getTenantId,
    tenantRoot: tenantRoot,
    tenantCollection: tenantCollection,
    serviceCalls: serviceCalls,
    siteIntelligence: siteIntelligence,
    rosterDoc: rosterDoc,
    fieldQuotes: fieldQuotes,
    pmRecords: pmRecords,
    fieldFormSubmissions: fieldFormSubmissions,
    onCallStateDoc: onCallStateDoc,
    completedReports: completedReports,
    serviceCallSubcollection: serviceCallSubcollection,
  };
})(typeof window !== "undefined" ? window : this);
