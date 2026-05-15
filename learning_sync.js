/**
 * Learning Sync — Slice 50a.
 *
 * Post-job passive learning upload. After Compile Notes submission, silently
 * uploads session learning data to Firestore:
 *   - Vocabulary corrections made during session (from EdgeIntentEngine dictionary
 *     + localStorage vc_ct_vocab_corrections).
 *   - Confidence scores per entity extraction across all timeline entries.
 *   - Cloud escalation results (Gemini structured parses from low-confidence entries).
 *   - Dispatcher edit history (from completed_reports/{docId}/review_edits).
 *
 * Firestore path: tenants/{tid}/learning_data/{autoId}
 *
 * Weight adjustment: if a dispatcher consistently removes a finding type (e.g.
 * always deletes "belt_size" findings), the system reduces that type's default
 * inclusion weight in future Gemini compile prompts. Weights are stored locally
 * (vc_learning_weights) and uploaded with each learning payload.
 *
 * Technicians do NOT manually train the system — learning is entirely passive.
 * No ML model retraining; no real-time learning during active jobs.
 *
 * Gate: window.VC_LEARNING_SYNC_ENABLED (default true).
 * Rollback: remove this file + its <script> tag.
 *
 * Exports: uploadLearningData, getInclusionWeights
 */
(function () {
  "use strict";

  /* ── feature gate ─────────────────────────────────────────────── */

  function isEnabled() {
    if (typeof window.VC_LEARNING_SYNC_ENABLED !== "undefined") {
      return !!window.VC_LEARNING_SYNC_ENABLED;
    }
    return true;
  }

  /* ── constants ────────────────────────────────────────────────── */

  var LS_WEIGHTS_KEY = "vc_learning_weights";
  var LS_VOCAB_KEY = "vc_ct_vocab_corrections";
  var LS_TIMELINE_PREFIX = "vc_conversational_timeline_";
  var LS_UPLOAD_QUEUE_KEY = "vc_learning_upload_queue";
  var LS_EDITS_CACHE_PREFIX = "vc_learning_dispatcher_edits_";
  var WEIGHT_DECAY = 0.05;
  var WEIGHT_FLOOR = 0.2;
  var REMOVAL_THRESHOLD = 3;

  /* ── helpers ──────────────────────────────────────────────────── */

  function getDb() {
    try {
      if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
        return firebase.firestore();
      }
    } catch (e) { /* offline or unavailable */ }
    return null;
  }

  function getTenantId() {
    if (typeof VCFirestore !== "undefined" && VCFirestore.getTenantId) {
      return VCFirestore.getTenantId();
    }
    if (typeof APP_CONFIG !== "undefined" && APP_CONFIG.tenantId) {
      return String(APP_CONFIG.tenantId).trim();
    }
    return "";
  }

  function getTechnicianName() {
    try {
      if (window.firebase && window.firebase.auth) {
        var u = window.firebase.auth().currentUser;
        if (u) return u.displayName || u.email || "Technician";
      }
    } catch (e) {}
    try {
      if (typeof window.technicianName !== "undefined" && window.technicianName) {
        return String(window.technicianName);
      }
    } catch (e) {}
    try {
      var saved = localStorage.getItem("tp_saved_tech");
      if (saved) return saved;
    } catch (e) {}
    return "Technician";
  }

  function safeJsonParse(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function isOnline() {
    return typeof navigator !== "undefined" ? navigator.onLine !== false : true;
  }

  function loadUploadQueue() {
    try {
      var raw = localStorage.getItem(LS_UPLOAD_QUEUE_KEY);
      if (!raw) return [];
      var parsed = safeJsonParse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveUploadQueue(queue) {
    try {
      localStorage.setItem(LS_UPLOAD_QUEUE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
    } catch (e) { /* quota exceeded */ }
  }

  function enqueueLearningPayload(payload) {
    if (!payload || typeof payload !== "object") return;
    var safePayload = preparePayloadForQueue(payload);
    var queue = loadUploadQueue();
    queue.push(safePayload);
    saveUploadQueue(queue);
  }

  function preparePayloadForQueue(payload) {
    var out = {};
    var key;
    for (key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) out[key] = payload[key];
    }
    var createdAtType = typeof out.createdAt;
    if (
      out.createdAt == null ||
      createdAtType === "function" ||
      (createdAtType === "object" && !(out.createdAt instanceof Date))
    ) {
      out.createdAt = out.uploadedAt || new Date().toISOString();
    }
    if (out.createdAt instanceof Date) {
      out.createdAt = out.createdAt.toISOString();
    }
    return out;
  }

  function editsCacheKey(reportDocId) {
    return LS_EDITS_CACHE_PREFIX + String(reportDocId || "");
  }

  function loadDispatcherEditsCache(reportDocId) {
    try {
      if (!reportDocId) return [];
      var raw = localStorage.getItem(editsCacheKey(reportDocId));
      if (!raw) return [];
      var parsed = safeJsonParse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveDispatcherEditsCache(reportDocId, edits) {
    try {
      if (!reportDocId) return;
      localStorage.setItem(editsCacheKey(reportDocId), JSON.stringify(Array.isArray(edits) ? edits : []));
    } catch (e) { /* quota exceeded */ }
  }

  /* ── vocabulary corrections ───────────────────────────────────── */

  function collectVocabCorrections() {
    try {
      var raw = localStorage.getItem(LS_VOCAB_KEY);
      if (!raw) return {};
      return safeJsonParse(raw) || {};
    } catch (e) { return {}; }
  }

  /* ── timeline entity + confidence data ────────────────────────── */

  function loadTimelineEntries(ticketId) {
    try {
      var key = LS_TIMELINE_PREFIX + (ticketId || "draft");
      var raw = localStorage.getItem(key);
      if (!raw) return [];
      var parsed = safeJsonParse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function collectEntityConfidences(ticketId) {
    var entries = loadTimelineEntries(ticketId);
    var results = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e || e.role !== "tech") continue;
      if (e.meta && e.meta.seed) continue;

      var record = {
        entryId: e.id || "",
        timestamp: e.ts || "",
        intentConfidence: (e.meta && typeof e.meta.intentConfidence === "number")
          ? e.meta.intentConfidence : null,
        entities: [],
        hadCorrections: !!(e.meta && e.meta.intentCorrections && e.meta.intentCorrections.length),
        wasCorrectedByUser: !!(e.correctedText)
      };

      if (e.meta && Array.isArray(e.meta.entities)) {
        for (var j = 0; j < e.meta.entities.length; j++) {
          var ent = e.meta.entities[j];
          if (!ent) continue;
          record.entities.push({
            type: ent.type || "",
            value: String(ent.value || ""),
            confidence: typeof ent.confidence === "number" ? ent.confidence : null
          });
        }
      }

      if (record.intentConfidence !== null || record.entities.length || record.hadCorrections || record.wasCorrectedByUser) {
        results.push(record);
      }
    }
    return results;
  }

  /* ── cloud escalation results ─────────────────────────────────── */

  function collectEscalationResults(ticketId) {
    var entries = loadTimelineEntries(ticketId);
    var escalations = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e || e.role !== "tech") continue;
      if (!e.meta) continue;
      if (e.meta.intentConfidence !== undefined && e.meta.intentConfidence < 0.6) {
        escalations.push({
          entryId: e.id || "",
          text: e.text || "",
          confidence: e.meta.intentConfidence,
          correctedText: e.meta.correctedText || null
        });
      }
    }
    return escalations;
  }

  /* ── dispatcher edit history ──────────────────────────────────── */

  function fetchDispatcherEdits(reportDocId) {
    if (!reportDocId) return Promise.resolve([]);
    var db = getDb();
    var cached = loadDispatcherEditsCache(reportDocId);
    if (!db) return Promise.resolve(cached);

    var crCol;
    try {
      crCol = (typeof VCFirestore !== "undefined" && VCFirestore.completedReports)
        ? VCFirestore.completedReports(db)
        : db.collection("completed_reports");
    } catch (e) {
      return Promise.resolve(cached);
    }

    try {
      return crCol.doc(reportDocId).collection("review_edits")
        .orderBy("timestamp", "desc")
        .limit(200)
        .get()
        .then(function (snap) {
          var edits = [];
          snap.forEach(function (doc) {
            var d = doc.data();
            edits.push({
              field: d.field || "",
              original: d.original || "",
              edited: d.edited || "",
              editedBy: d.editedBy || "",
              findingId: d.findingId || ""
            });
          });
          saveDispatcherEditsCache(reportDocId, edits);
          return edits;
        })
        .catch(function () { return cached; });
    } catch (e) {
      return Promise.resolve(cached);
    }
  }

  function uploadPayload(payload) {
    var db = getDb();
    var tid = getTenantId();
    if (!db || !tid || !isOnline()) {
      enqueueLearningPayload(payload);
      return Promise.resolve(null);
    }

    try {
      return db.collection("tenants").doc(tid)
        .collection("learning_data")
        .add(payload)
        .then(function () { return true; })
        .catch(function () {
          enqueueLearningPayload(payload);
          return null;
        });
    } catch (e) {
      enqueueLearningPayload(payload);
      return Promise.resolve(null);
    }
  }

  function flushQueuedUploads() {
    if (!isOnline()) return Promise.resolve(0);
    var db = getDb();
    var tid = getTenantId();
    if (!db || !tid) return Promise.resolve(0);

    var queue = loadUploadQueue();
    if (!queue.length) return Promise.resolve(0);

    var remaining = [];
    var writes = [];

    for (var i = 0; i < queue.length; i++) {
      (function (payload) {
        try {
          writes.push(
            db.collection("tenants").doc(tid).collection("learning_data").add(payload)
              .catch(function () {
                remaining.push(payload);
                return null;
              })
          );
        } catch (e) {
          remaining.push(payload);
        }
      })(queue[i]);
    }

    return Promise.all(writes).then(function () {
      saveUploadQueue(remaining);
      return queue.length - remaining.length;
    }).catch(function () {
      saveUploadQueue(queue);
      return 0;
    });
  }

  /* ── inclusion weight management ──────────────────────────────── */

  function loadWeights() {
    try {
      var raw = localStorage.getItem(LS_WEIGHTS_KEY);
      if (!raw) return {};
      return safeJsonParse(raw) || {};
    } catch (e) { return {}; }
  }

  function saveWeights(weights) {
    try {
      localStorage.setItem(LS_WEIGHTS_KEY, JSON.stringify(weights));
    } catch (e) { /* quota exceeded */ }
  }

  /**
   * Analyze dispatcher edits: if a dispatcher removes an entire finding (edited
   * to empty or field is a removal marker), track it by entity type. After
   * REMOVAL_THRESHOLD cumulative removals of a type, decay that type's weight.
   */
  function adjustWeightsFromEdits(dispatcherEdits) {
    if (!dispatcherEdits || !dispatcherEdits.length) return;

    var weights = loadWeights();
    if (!weights._removalCounts) weights._removalCounts = {};

    for (var i = 0; i < dispatcherEdits.length; i++) {
      var edit = dispatcherEdits[i];
      var wasRemoval = (
        edit.original &&
        (!edit.edited || edit.edited.trim() === "" || edit.edited.trim() === "[removed]")
      );
      if (!wasRemoval) continue;

      var entityType = inferEntityTypeFromField(edit.field, edit.original);
      if (!entityType) continue;

      if (!weights._removalCounts[entityType]) {
        weights._removalCounts[entityType] = 0;
      }
      weights._removalCounts[entityType]++;

      if (weights._removalCounts[entityType] >= REMOVAL_THRESHOLD) {
        var currentWeight = (typeof weights[entityType] === "number") ? weights[entityType] : 1.0;
        var newWeight = Math.max(WEIGHT_FLOOR, currentWeight - WEIGHT_DECAY);
        weights[entityType] = Math.round(newWeight * 100) / 100;
      }
    }

    saveWeights(weights);
  }

  function inferEntityTypeFromField(field, original) {
    var f = String(field || "").toLowerCase();
    var o = String(original || "").toLowerCase();

    if (f.indexOf("temperature") !== -1 || /\d+\s*°/.test(o)) return "temperature";
    if (f.indexOf("amp") !== -1 || /\d+\s*a(mp)?s?\b/.test(o)) return "amp_draw";
    if (f.indexOf("refrigerant") !== -1 || /r-?\d{2,3}/i.test(o)) return "refrigerant";
    if (f.indexOf("belt") !== -1) return "belt_size";
    if (f.indexOf("capacit") !== -1 || /\d+\s*(uf|mfd|microfarad)/i.test(o)) return "capacitance";
    if (f.indexOf("equipment") !== -1 || /\b(rtu|ahu|fcu|mau|unit)\b/i.test(o)) return "equipment";
    if (f.indexOf("part") !== -1 || /\b(capacitor|contactor|relay|motor|belt|filter)\b/i.test(o)) return "part";
    if (f.indexOf("finding") !== -1 || f.indexOf("diagnosis") !== -1) return "finding";
    if (f.indexOf("quote") !== -1 || f.indexOf("recommend") !== -1) return "quote_recommendation";
    return "";
  }

  /**
   * getInclusionWeights — exported.
   * Returns the current per-entity-type inclusion weights (0.2–1.0).
   * Gemini compile prompts can use these to deprioritize finding types
   * that dispatchers consistently remove.
   */
  function getInclusionWeights() {
    var weights = loadWeights();
    var result = {};
    for (var key in weights) {
      if (Object.prototype.hasOwnProperty.call(weights, key) && key !== "_removalCounts") {
        result[key] = weights[key];
      }
    }
    return result;
  }

  /* ── main upload ──────────────────────────────────────────────── */

  /**
   * uploadLearningData — exported.
   *
   * Silently gathers all passive learning signals from the current session
   * and writes them to Firestore: tenants/{tid}/learning_data/{autoId}.
   *
   * @param {Object} opts
   * @param {string} opts.ticketId - Active ticket/job id
   * @param {string} [opts.reportDocId] - completed_reports doc id (for dispatcher edit fetch)
   * @param {Object} [opts.compileResult] - The Gemini compile result object
   * @returns {Promise} resolves when upload completes (or degrades silently)
   */
  function uploadLearningData(opts) {
    if (!isEnabled()) return Promise.resolve(null);

    var options = opts || {};
    var ticketId = options.ticketId || "draft";
    var reportDocId = options.reportDocId || "";

    var vocabCorrections = collectVocabCorrections();
    var entityConfidences = collectEntityConfidences(ticketId);
    var escalationResults = collectEscalationResults(ticketId);

    return fetchDispatcherEdits(reportDocId).then(function (dispatcherEdits) {
      adjustWeightsFromEdits(dispatcherEdits);

      var payload = buildLearningPayload(
        options,
        ticketId,
        vocabCorrections,
        entityConfidences,
        escalationResults,
        dispatcherEdits
      );
      return uploadPayload(payload);
    }).catch(function () {
      return null;
    });
  }

  function buildLearningPayload(options, ticketId, vocabCorrections, entityConfidences, escalationResults, dispatcherEdits) {
    var payload = {
      ticketId: ticketId,
      technicianName: getTechnicianName(),
      uploadedAt: new Date().toISOString(),
      source: "conversational_timeline_compile",
      buildVersion: window.VC_BUILD || "",
      vocabCorrections: vocabCorrections,
      vocabCorrectionCount: Object.keys(vocabCorrections).length,
      entityConfidences: entityConfidences,
      entityConfidenceCount: entityConfidences.length,
      escalationResults: escalationResults,
      escalationCount: escalationResults.length,
      dispatcherEdits: dispatcherEdits,
      dispatcherEditCount: dispatcherEdits.length,
      inclusionWeights: getInclusionWeights(),
      sessionStats: buildSessionStats(entityConfidences, escalationResults, vocabCorrections)
    };

    try {
      if (typeof firebase !== "undefined" && firebase.firestore && firebase.firestore.FieldValue) {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      }
    } catch (e) {
      /* offline-safe fallback below */
    }
    if (!payload.createdAt) payload.createdAt = payload.uploadedAt;

    if (options.compileResult && typeof options.compileResult === "object") {
      payload.compileResultSummary = options.compileResult.summary || "";
      payload.findingTypes = extractFindingTypes(options.compileResult);
    }

    return payload;
  }

  function buildSessionStats(entityConfidences, escalations, vocabMap) {
    var totalEntries = entityConfidences.length;
    var totalEntities = 0;
    var totalConfidence = 0;
    var confidenceCount = 0;
    var correctedEntries = 0;
    var typeCounts = {};

    for (var i = 0; i < entityConfidences.length; i++) {
      var ec = entityConfidences[i];
      if (ec.intentConfidence !== null) {
        totalConfidence += ec.intentConfidence;
        confidenceCount++;
      }
      if (ec.wasCorrectedByUser) correctedEntries++;
      totalEntities += ec.entities.length;
      for (var j = 0; j < ec.entities.length; j++) {
        var t = ec.entities[j].type;
        if (t) typeCounts[t] = (typeCounts[t] || 0) + 1;
      }
    }

    return {
      totalEntries: totalEntries,
      totalEntities: totalEntities,
      avgConfidence: confidenceCount > 0
        ? Math.round((totalConfidence / confidenceCount) * 100) / 100
        : null,
      escalationCount: escalations.length,
      correctedEntries: correctedEntries,
      vocabCorrections: Object.keys(vocabMap).length,
      entityTypeCounts: typeCounts
    };
  }

  function extractFindingTypes(compileResult) {
    var types = [];
    if (compileResult.equipmentFindings && compileResult.equipmentFindings.length) {
      types.push("equipmentFindings");
    }
    if (compileResult.quoteRecommendations && compileResult.quoteRecommendations.length) {
      types.push("quoteRecommendations");
    }
    if (compileResult.unresolvedIssues && compileResult.unresolvedIssues.length) {
      types.push("unresolvedIssues");
    }
    if (compileResult.equipmentHistoryUpdates && compileResult.equipmentHistoryUpdates.length) {
      types.push("equipmentHistoryUpdates");
    }
    return types;
  }

  function init() {
    try {
      window.addEventListener("online", function () {
        flushQueuedUploads();
      });
    } catch (e) {}
    flushQueuedUploads();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ── exports ──────────────────────────────────────────────────── */

  window.LearningSync = {
    uploadLearningData: uploadLearningData,
    getInclusionWeights: getInclusionWeights
  };
})();
