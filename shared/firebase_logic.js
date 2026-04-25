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
          var notes = snap.exists && snap.data() ? String(snap.data().notes || "").trim() : "";
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
      var tNotes =
        tEx && lastT.data() ? String(lastT.data().notes || "").trim() : "";
      var rNotes =
        rEx && lastR.data() ? String(lastR.data().notes || "").trim() : "";
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
  };
})(typeof window !== "undefined" ? window : this);
