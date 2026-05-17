/**
 * Vertex Core — tenant-scoped Firestore paths (Phase 10).
 * Data lives under tenants/{tenantId}/… for isolation between companies.
 *
 * Requires: shared/config.js (APP_CONFIG.tenantId), firebase firestore.
 *
 * KI-002 Plan B1: this file is now versioned (`?v=N`) by every caller
 * (`index.html`, `technician/index.html`, `proof_of_service.html`). Bump
 * `FIREBASE_LOGIC_VERSION` below + the `?v=` query string in all three
 * callers in lockstep whenever you change merge-bridge logic so a stale
 * cached copy can never silently win on any device.
 */
(function (global) {
  "use strict";

  var FIREBASE_LOGIC_VERSION = 3;
  try {
    console.info("[VC] firebase_logic v=" + FIREBASE_LOGIC_VERSION + " loaded");
  } catch (e) {}
  try { global.__VC_FIREBASE_LOGIC_VERSION = FIREBASE_LOGIC_VERSION; } catch (e) {}

  function getTenantId() {
    if (typeof APP_CONFIG !== "undefined" && APP_CONFIG.tenantId) {
      return String(APP_CONFIG.tenantId).trim();
    }
    return "TWIN_PILLARS";
  }

  /**
   * KI-002 Plan A standard helpers — eliminate silent failures.
   *
   * `VCRequireTicketId(tid, label)` returns a non-empty trimmed ticket id, or "" if missing.
   * On miss it warns to console AND pushes onto the `__vcWriteFailures` ring buffer so the
   * iPhone debug overlay (technician/index.html) can surface it. Callers MUST short-circuit
   * on "" — do NOT fall through to a write that would skip silently.
   *
   * `VCSurfaceWriteFailure(ctx, err)` is the canonical replacement for `.catch(console.warn)`.
   * It console.errors with a `[VC write failed] <ctx>:` prefix and pushes a {at, ctx, msg}
   * record onto the same ring buffer (capped at 10). Pair this with a user-visible affordance
   * at the call site (red banner, alert, save-cue, etc.) — never let a write die silently.
   */
  function recordWriteFailure(ctx, err) {
    var msg;
    try {
      msg = err && err.message ? String(err.message) : (err == null ? "unknown" : String(err));
    } catch (e) { msg = "unknown"; }
    try { console.error("[VC write failed] " + String(ctx || "?") + ":", err); } catch (e) {}
    try {
      if (typeof global !== "undefined") {
        if (!Array.isArray(global.__vcWriteFailures)) global.__vcWriteFailures = [];
        global.__vcWriteFailures.push({ at: Date.now(), ctx: String(ctx || ""), msg: msg });
        while (global.__vcWriteFailures.length > 10) global.__vcWriteFailures.shift();
      }
    } catch (e) {}
  }

  function vcRequireTicketId(tid, label) {
    var s = (tid == null ? "" : String(tid)).trim();
    if (s) return s;
    var ctx = "empty-tid:" + (label || "?");
    try { console.warn("[VC] " + ctx); } catch (e) {}
    recordWriteFailure(ctx, new Error("empty ticket id"));
    return "";
  }

  /** Training / sandbox data path (Field App training accounts only). */
  function isSandboxDataPath() {
    try {
      return typeof global !== "undefined" && global.VC_SANDBOX_DATA === true;
    } catch (e) {
      return false;
    }
  }

  function sandboxDefaultSubcollection(db, name) {
    return tenantRoot(db).collection("sandbox").doc("default").collection(String(name));
  }

  function tenantRoot(db) {
    return db.collection("tenants").doc(getTenantId());
  }

  /** @param {firebase.firestore.Firestore} db */
  function tenantCollection(db, name) {
    return tenantRoot(db).collection(String(name));
  }

  function serviceCalls(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "service_calls");
    }
    return tenantCollection(db, "service_calls");
  }

  function siteIntelligence(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "site_intelligence");
    }
    return tenantCollection(db, "site_intelligence");
  }

  /** Enterprise user directory (imported roster / Vertex-Core CSV). */
  function tenantUsers(db) {
    return tenantCollection(db, "users");
  }

  /** Live field presence + shadow coaching (Phase 19). Doc id = presence key (payroll key). */
  function livePresence(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "live_presence");
    }
    return tenantCollection(db, "live_presence");
  }

  /** Legacy platform equipment rows keyed by site + normalized location (import hub). */
  function tenantImportedEquipment(db) {
    return tenantCollection(db, "imported_equipment");
  }

  /** Geotagged clock IN/OUT punches (lite seat time tracking). Doc id: {payrollKey}_{YYYY_MM_DD}. */
  function laborLogs(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "labor_logs");
    }
    return tenantCollection(db, "labor_logs");
  }

  /** Client proof-of-service magic links (token doc id = opaque string in URL). */
  function portalTokens(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "portal_tokens");
    }
    return tenantCollection(db, "portal_tokens");
  }

  /** Single roster document: names[], profiles{}, updatedAt */
  function rosterDoc(db) {
    return tenantCollection(db, "roster").doc("default");
  }

  function fieldQuotes(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "field_quotes");
    }
    return tenantCollection(db, "field_quotes");
  }

  function officeQuotes(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "office_quotes");
    }
    return tenantCollection(db, "office_quotes");
  }

  function vendors(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "vendors");
    }
    return tenantCollection(db, "vendors");
  }

  function pmRecords(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "pm_records");
    }
    return tenantCollection(db, "pm_records");
  }

  /** Dynamic / custom field form submissions (tenant-scoped). */
  function fieldFormSubmissions(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "field_form_submissions");
    }
    return tenantCollection(db, "field_form_submissions");
  }

  /** Office on-call rotation state (tenant-scoped). */
  function onCallStateDoc(db) {
    return tenantCollection(db, "on_call_state").doc("default");
  }

  /** Technician completed report uploads from field app (tenant-scoped). */
  function completedReports(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "completed_reports");
    }
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

  /** Legacy root collections — used for TWIN_PILLARS dual-read during migration. */
  var BRIDGE_TENANT_ID = "TWIN_PILLARS";

  function isBridgeTenant() {
    return getTenantId() === BRIDGE_TENANT_ID;
  }

  function rootCollection(db, name) {
    return db.collection(String(name));
  }

  function mergeDocSnapshots(tenantSnap, rootSnap) {
    var byId = {};
    if (rootSnap) {
      rootSnap.forEach(function (d) {
        byId[d.id] = d;
      });
    }
    if (tenantSnap) {
      tenantSnap.forEach(function (d) {
        byId[d.id] = d;
      });
    }
    return byId;
  }

  function mergedSnapshotForEach(byIdObj) {
    var ids = Object.keys(byIdObj);
    return {
      forEach: function (cb) {
        for (var i = 0; i < ids.length; i++) {
          cb(byIdObj[ids[i]]);
        }
      },
    };
  }

  /**
   * Full collection listener: tenant wins when both have the same doc id.
   * For non–TWIN_PILLARS tenants, tenant only.
   */
  function subscribeServiceCallsMerged(db, onNext, onError) {
    if (isSandboxDataPath()) {
      return serviceCalls(db).onSnapshot(onNext, onError);
    }
    if (!isBridgeTenant()) {
      return serviceCalls(db).onSnapshot(onNext, onError);
    }
    var tSnap = null;
    var rSnap = null;
    function emit() {
      if (tSnap === null && rSnap === null) return;
      var merged = mergeDocSnapshots(tSnap, rSnap);
      onNext(mergedSnapshotForEach(merged));
    }
    var u1 = serviceCalls(db).onSnapshot(
      function (s) {
        tSnap = s;
        emit();
      },
      onError
    );
    var u2 = rootCollection(db, "service_calls").onSnapshot(
      function (s) {
        rSnap = s;
        emit();
      },
      onError
    );
    return function () {
      u1();
      u2();
    };
  }

  function subscribeSiteIntelligenceMerged(db, onNext, onError) {
    if (isSandboxDataPath()) {
      return siteIntelligence(db).onSnapshot(onNext, onError);
    }
    if (!isBridgeTenant()) {
      return siteIntelligence(db).onSnapshot(onNext, onError);
    }
    var tSnap = null;
    var rSnap = null;
    function emit() {
      if (tSnap === null && rSnap === null) return;
      var merged = mergeDocSnapshots(tSnap, rSnap);
      onNext(mergedSnapshotForEach(merged));
    }
    var u1 = siteIntelligence(db).onSnapshot(
      function (s) {
        tSnap = s;
        emit();
      },
      onError
    );
    var u2 = rootCollection(db, "site_intelligence").onSnapshot(
      function (s) {
        rSnap = s;
        emit();
      },
      onError
    );
    return function () {
      u1();
      u2();
    };
  }

  /**
   * Same query executed on tenant + root collections; merged doc map (tenant wins).
   */
  function subscribeBridgedServiceCallQuery(db, buildQuery, onNext, onError) {
    if (isSandboxDataPath()) {
      return buildQuery(serviceCalls(db)).onSnapshot(onNext, onError);
    }
    if (!isBridgeTenant()) {
      return buildQuery(serviceCalls(db)).onSnapshot(onNext, onError);
    }
    var tSnap = null;
    var rSnap = null;
    function emit() {
      if (tSnap === null && rSnap === null) return;
      var merged = mergeDocSnapshots(tSnap, rSnap);
      onNext(mergedSnapshotForEach(merged));
    }
    var u1 = buildQuery(serviceCalls(db)).onSnapshot(
      function (s) {
        tSnap = s;
        emit();
      },
      onError
    );
    var u2 = buildQuery(rootCollection(db, "service_calls")).onSnapshot(
      function (s) {
        rSnap = s;
        emit();
      },
      onError
    );
    return function () {
      u1();
      u2();
    };
  }

  /**
   * Single doc: tenant first; for TWIN_PILLARS fallback to root if missing.
   */
  function getServiceCallOnceBridged(db, ticketId) {
    var tid = String(ticketId || "");
    var tRef = serviceCalls(db).doc(tid);
    return tRef.get().then(function (snap) {
      if (snap.exists) {
        return { exists: true, data: snap.data(), ref: tRef, source: "tenant" };
      }
      if (isSandboxDataPath() || !isBridgeTenant()) {
        return { exists: false, data: null, ref: tRef, source: "tenant" };
      }
      var rRef = rootCollection(db, "service_calls").doc(tid);
      return rRef.get().then(function (snap2) {
        if (snap2.exists) {
          return { exists: true, data: snap2.data(), ref: rRef, source: "root" };
        }
        return { exists: false, data: null, ref: tRef, source: "tenant" };
      });
    });
  }

  /**
   * Write to tenant path; if TWIN_PILLARS and a root copy exists, remove it after migrate.
   */
  function setServiceCallMerged(db, ticketId, data, merge) {
    /* KI-002 Plan A8 — refuse empty ticket id loudly instead of writing to a doc whose id is "". */
    var tid = vcRequireTicketId(ticketId, "setServiceCallMerged");
    if (!tid) {
      return Promise.reject(new Error("setServiceCallMerged: empty ticket id"));
    }
    var tRef = serviceCalls(db).doc(tid);
    return tRef.set(data, { merge: !!merge }).then(function () {
      if (isSandboxDataPath() || !isBridgeTenant()) return;
      var rRef = rootCollection(db, "service_calls").doc(tid);
      return rRef.get().then(function (snap) {
        if (snap.exists) return rRef.delete();
      });
    });
  }

  function getSiteIntelDocOnceBridged(db, docId) {
    var id = String(docId || "");
    var tRef = siteIntelligence(db).doc(id);
    return tRef.get().then(function (snap) {
      if (snap.exists) {
        return { exists: true, data: snap.data(), ref: tRef, source: "tenant" };
      }
      if (isSandboxDataPath() || !isBridgeTenant()) {
        return { exists: false, data: null, ref: tRef, source: "tenant" };
      }
      var rRef = rootCollection(db, "site_intelligence").doc(id);
      return rRef.get().then(function (s2) {
        if (s2.exists) {
          return { exists: true, data: s2.data(), ref: rRef, source: "root" };
        }
        return { exists: false, data: null, ref: tRef, source: "tenant" };
      });
    });
  }

  function setSiteIntelMerged(db, docId, data, merge) {
    var id = String(docId || "");
    var tRef = siteIntelligence(db).doc(id);
    return tRef.set(data, { merge: !!merge }).then(function () {
      if (isSandboxDataPath() || !isBridgeTenant()) return;
      var rRef = rootCollection(db, "site_intelligence").doc(id);
      return rRef.get().then(function (snap) {
        if (snap.exists) return rRef.delete();
      });
    });
  }

  function queryCompletedReportsWhereMerged(db, field, op, value, limitN) {
    var lim = limitN != null ? limitN : 40;
    var tc = completedReports(db);
    var rc = rootCollection(db, "completed_reports");
    function snapToRows(snap) {
      var rows = [];
      snap.forEach(function (d) {
        rows.push({ id: d.id, data: d.data() || {} });
      });
      return rows;
    }
    if (isSandboxDataPath() || !isBridgeTenant()) {
      return tc
        .where(field, op, value)
        .limit(lim)
        .get()
        .then(snapToRows);
    }
    return Promise.all([
      tc.where(field, op, value).limit(lim).get(),
      rc.where(field, op, value).limit(lim).get(),
    ]).then(function (pair) {
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

  function loadServiceCallsMergedOnce(db) {
    var tc = serviceCalls(db);
    if (isSandboxDataPath() || !isBridgeTenant()) {
      return tc.get();
    }
    return Promise.all([tc.get(), rootCollection(db, "service_calls").get()]).then(function (pair) {
      var merged = mergeDocSnapshots(pair[0], pair[1]);
      return mergedSnapshotForEach(merged);
    });
  }

  /**
   * @param {function(firebase.firestore.CollectionReference): firebase.firestore.Query} buildWhere
   * @returns {Promise<Object.<string, firebase.firestore.DocumentSnapshot>>}
   */
  function getServiceCallsWhereMergedOnce(db, buildWhere) {
    if (isSandboxDataPath() || !isBridgeTenant()) {
      return buildWhere(serviceCalls(db))
        .get()
        .then(function (snap) {
          var o = {};
          snap.forEach(function (d) {
            o[d.id] = d;
          });
          return o;
        });
    }
    return Promise.all([
      buildWhere(serviceCalls(db)).get(),
      buildWhere(rootCollection(db, "service_calls")).get(),
    ]).then(function (pair) {
      return mergeDocSnapshots(pair[0], pair[1]);
    });
  }

  /**
   * Single site_intel doc: listen to tenant + root (TWIN_PILLARS); notes from tenant win if both set.
   */
  function subscribeSiteIntelDocMerged(db, docId, onNotesTrimmed, onError) {
    var id = String(docId || "");
    var tRef = siteIntelligence(db).doc(id);
    if (isSandboxDataPath() || !isBridgeTenant()) {
      return tRef.onSnapshot(
        function (snap) {
          var notes = "";
          if (snap.exists && snap.data()) {
            var data = snap.data() || {};
            var base = String(data.notes || "").trim();
            var interOffice = String(data.technicianInterOfficeNotes || "").trim();
            notes = (base + "\n" + interOffice).trim();
          }
          onNotesTrimmed(notes);
        },
        onError
      );
    }
    var rRef = rootCollection(db, "site_intelligence").doc(id);
    var lastT = null;
    var lastR = null;
    function emit() {
      var tEx = lastT && lastT.exists;
      var rEx = lastR && lastR.exists;
      var tNotes = "";
      var rNotes = "";
      if (tEx && lastT.data()) {
        var tData = lastT.data() || {};
        tNotes = (String(tData.notes || "").trim() + "\n" + String(tData.technicianInterOfficeNotes || "").trim()).trim();
      }
      if (rEx && lastR.data()) {
        var rData = lastR.data() || {};
        rNotes = (String(rData.notes || "").trim() + "\n" + String(rData.technicianInterOfficeNotes || "").trim()).trim();
      }
      if (tEx) {
        onNotesTrimmed(tNotes);
        return;
      }
      onNotesTrimmed(rNotes);
    }
    var u1 = tRef.onSnapshot(
      function (s) {
        lastT = s;
        emit();
      },
      onError
    );
    var u2 = rRef.onSnapshot(
      function (s) {
        lastR = s;
        emit();
      },
      onError
    );
    return function () {
      u1();
      u2();
    };
  }

  /**
   * Phase 33 (ADR-011 §2) — bridged equipment read.
   *
   * Merges three sources for a given site:
   *   1. Legacy per-site assets at `customers/{customerId}/sites/{siteId}/assets`
   *      (write source pre-Phase 33: dictation_hub Vision Hub + retire flow).
   *   2. Tenant `imported_equipment` rows tagged with `customerId` + `siteId`
   *      (write source Phase 33+: field-add + field-edit + new CSV imports).
   *   3. Tenant `imported_equipment` rows tagged with `normalizedLocationKey`
   *      only (write source pre-Phase 33: legacy CSV importer at
   *      `dispatcher/js/import_hub.js`). Pass the `locationLine` arg to
   *      include this slice; without it the bridge skips the legacy CSV index.
   *
   * Per ADR-011 §2: rows from `imported_equipment` always win on conflict
   * regardless of `source` flag — they are by definition newer or
   * field-corrected. Conflict identity (per §4) is `unitType + unitNumber`,
   * falling back to `unitTag`, then to the legacy doc id (e.g. "RTU3").
   *
   * Each merged row carries a `source` discriminator (`"imported"` |
   * `"legacy"`) so the UI can badge field-corrected rows distinctly if
   * desired. The original Firestore `docSnap` is preserved on legacy rows for
   * back-compat with dictation_hub helpers (`wrapDocSnapForRow`).
   */
  function normalizeLocationKeyForBridge(locationLine) {
    return String(locationLine || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function unitIdentityForRow(data, fallbackId) {
    var d = data || {};
    var ut = d.unitType != null ? String(d.unitType).trim() : "";
    var un = d.unitNumber != null ? String(d.unitNumber).trim() : "";
    if (ut && un) return ut + un;
    if (d.unitTag != null && String(d.unitTag).trim()) {
      return String(d.unitTag).trim();
    }
    return String(fallbackId || "");
  }

  function rowsFromQuerySnapshot(snap) {
    var rows = [];
    if (!snap) return rows;
    snap.forEach(function (doc) {
      rows.push({ id: doc.id, data: doc.data() || {}, docSnap: doc });
    });
    return rows;
  }

  function mergeBridgedEquipmentRows(legacyRows, importedRows) {
    var byIdentity = {};
    var order = [];

    function addRow(row, source) {
      var ident = unitIdentityForRow(row.data, row.id);
      if (!ident) return;
      var existing = byIdentity[ident];
      if (existing) {
        if (existing.source === "imported" && source === "legacy") return;
      } else {
        order.push(ident);
      }
      byIdentity[ident] = {
        id: ident,
        data: row.data,
        docSnap: source === "legacy" ? row.docSnap : null,
        source: source,
        legacyDocId: source === "legacy" ? row.id : (existing && existing.legacyDocId) || "",
        importedDocId: source === "imported" ? row.id : (existing && existing.importedDocId) || "",
      };
    }

    (legacyRows || []).forEach(function (r) { addRow(r, "legacy"); });
    (importedRows || []).forEach(function (r) { addRow(r, "imported"); });

    return order.map(function (id) { return byIdentity[id]; });
  }

  function dedupeImportedRowsById(rowsA, rowsB) {
    var seen = {};
    var out = [];
    function push(r) {
      if (!r || !r.id) return;
      if (seen[r.id]) return;
      seen[r.id] = true;
      out.push(r);
    }
    (rowsA || []).forEach(push);
    (rowsB || []).forEach(push);
    return out;
  }

  function legacyAssetsCollection(db, customerId, siteId) {
    return db
      .collection("customers")
      .doc(String(customerId || ""))
      .collection("sites")
      .doc(String(siteId || ""))
      .collection("assets");
  }

  /**
   * One-shot bridged fetch. Returns Promise<Array<{id,data,docSnap,source,legacyDocId,importedDocId}>>.
   * @param {firebase.firestore.Firestore} db
   * @param {string} customerId  sanitized path segment (e.g. result of `sanitizePathSegment(activeTicket.customerName)`)
   * @param {string} siteId      sanitized path segment for the location line
   * @param {string} [locationLine]  raw location display string; enables the legacy CSV (`normalizedLocationKey`) slice
   */
  function getEquipmentForSiteBridged(db, customerId, siteId, locationLine) {
    var legacyP = legacyAssetsCollection(db, customerId, siteId)
      .get()
      .then(rowsFromQuerySnapshot)
      .catch(function (err) {
        recordWriteFailure("getEquipmentForSiteBridged:legacy", err);
        return [];
      });

    var tCol = tenantImportedEquipment(db);
    var bySiteP = tCol
      .where("customerId", "==", String(customerId || ""))
      .where("siteId", "==", String(siteId || ""))
      .get()
      .then(rowsFromQuerySnapshot)
      .catch(function (err) {
        recordWriteFailure("getEquipmentForSiteBridged:bySite", err);
        return [];
      });

    var nk = normalizeLocationKeyForBridge(locationLine);
    var byNkP = nk
      ? tCol
          .where("normalizedLocationKey", "==", nk)
          .get()
          .then(rowsFromQuerySnapshot)
          .catch(function (err) {
            recordWriteFailure("getEquipmentForSiteBridged:byNk", err);
            return [];
          })
      : Promise.resolve([]);

    return Promise.all([legacyP, bySiteP, byNkP]).then(function (parts) {
      var imported = dedupeImportedRowsById(parts[1], parts[2]);
      return mergeBridgedEquipmentRows(parts[0], imported);
    });
  }

  /**
   * Live bridged subscription. Mirrors `getEquipmentForSiteBridged` but with
   * `onSnapshot` semantics. `onNext` receives the merged row array on every
   * source emit; returns a single unsubscribe function that detaches all
   * underlying listeners. Same arg shape as the once-fetch.
   */
  function subscribeEquipmentForSiteBridged(db, customerId, siteId, locationLine, onNext, onError) {
    var legacyRows = null;
    var bySiteRows = null;
    var byNkRows = null;

    function emit() {
      if (legacyRows === null && bySiteRows === null && byNkRows === null) return;
      var imported = dedupeImportedRowsById(bySiteRows || [], byNkRows || []);
      try {
        onNext(mergeBridgedEquipmentRows(legacyRows || [], imported));
      } catch (e) {
        recordWriteFailure("subscribeEquipmentForSiteBridged:emit", e);
      }
    }

    function wrapErr(ctx) {
      return function (err) {
        recordWriteFailure("subscribeEquipmentForSiteBridged:" + ctx, err);
        if (typeof onError === "function") {
          try { onError(err); } catch (e2) {}
        }
      };
    }

    var u1 = legacyAssetsCollection(db, customerId, siteId).onSnapshot(
      function (snap) { legacyRows = rowsFromQuerySnapshot(snap); emit(); },
      wrapErr("legacy")
    );

    var tCol = tenantImportedEquipment(db);
    var u2 = tCol
      .where("customerId", "==", String(customerId || ""))
      .where("siteId", "==", String(siteId || ""))
      .onSnapshot(
        function (snap) { bySiteRows = rowsFromQuerySnapshot(snap); emit(); },
        wrapErr("bySite")
      );

    var nk = normalizeLocationKeyForBridge(locationLine);
    var u3 = function () {};
    if (nk) {
      u3 = tCol
        .where("normalizedLocationKey", "==", nk)
        .onSnapshot(
          function (snap) { byNkRows = rowsFromQuerySnapshot(snap); emit(); },
          wrapErr("byNk")
        );
    } else {
      byNkRows = [];
    }

    return function () {
      try { u1(); } catch (e) {}
      try { u2(); } catch (e) {}
      try { u3(); } catch (e) {}
    };
  }

  /* KI-002 Plan A — also publish the helpers as bare globals so call sites can write
     `VCRequireTicketId(...)` / `VCSurfaceWriteFailure(...)` without typing the namespace. */
  global.VCRequireTicketId = vcRequireTicketId;
  global.VCSurfaceWriteFailure = recordWriteFailure;

  global.VCFirestore = {
    requireTicketId: vcRequireTicketId,
    surfaceWriteFailure: recordWriteFailure,
    getTenantId: getTenantId,
    isSandboxDataPath: isSandboxDataPath,
    tenantRoot: tenantRoot,
    tenantCollection: tenantCollection,
    tenantUsers: tenantUsers,
    livePresence: livePresence,
    tenantImportedEquipment: tenantImportedEquipment,
    laborLogs: laborLogs,
    portalTokens: portalTokens,
    serviceCalls: serviceCalls,
    siteIntelligence: siteIntelligence,
    rosterDoc: rosterDoc,
    fieldQuotes: fieldQuotes,
    officeQuotes: officeQuotes,
    vendors: vendors,
    pmRecords: pmRecords,
    fieldFormSubmissions: fieldFormSubmissions,
    onCallStateDoc: onCallStateDoc,
    completedReports: completedReports,
    serviceCallSubcollection: serviceCallSubcollection,
    isBridgeTenant: isBridgeTenant,
    subscribeServiceCallsMerged: subscribeServiceCallsMerged,
    subscribeSiteIntelligenceMerged: subscribeSiteIntelligenceMerged,
    subscribeBridgedServiceCallQuery: subscribeBridgedServiceCallQuery,
    getServiceCallOnceBridged: getServiceCallOnceBridged,
    setServiceCallMerged: setServiceCallMerged,
    getSiteIntelDocOnceBridged: getSiteIntelDocOnceBridged,
    setSiteIntelMerged: setSiteIntelMerged,
    queryCompletedReportsWhereMerged: queryCompletedReportsWhereMerged,
    loadServiceCallsMergedOnce: loadServiceCallsMergedOnce,
    subscribeSiteIntelDocMerged: subscribeSiteIntelDocMerged,
    getServiceCallsWhereMergedOnce: getServiceCallsWhereMergedOnce,
    getEquipmentForSiteBridged: getEquipmentForSiteBridged,
    subscribeEquipmentForSiteBridged: subscribeEquipmentForSiteBridged,
    normalizeLocationKey: normalizeLocationKeyForBridge,
    unitIdentityForRow: unitIdentityForRow,
  };
})(typeof window !== "undefined" ? window : this);
