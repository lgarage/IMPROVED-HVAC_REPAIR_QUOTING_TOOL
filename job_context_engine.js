(function () {
  "use strict";

  var LS_PREFIX = "vc_job_context_";
  var CACHE_TTL_MS = 4 * 60 * 60 * 1000;
  var EMPTY_CONTEXT = {
    siteNotes: "",
    siteAccessNotes: "",
    unresolvedIssues: [],
    equipment: [],
    recentReports: [],
    techNotes: "",
    quotes: [],
    activeEquipment: null,
    checklistState: {},
  };
  var currentTicketId = "";
  var currentContext = cloneContext(EMPTY_CONTEXT);
  var inflightByTicket = {};
  var _activeEquipment = null;

  function nowMs() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function safeTrim(value) {
    return String(value == null ? "" : value).trim();
  }

  function sanitizePathSegment(value) {
    var s = safeTrim(value);
    if (!s) return "";
    return s.replace(/[/\\]+/g, "_").replace(/\s+/g, " ").slice(0, 200);
  }

  function cloneContext(ctx) {
    var src = ctx || EMPTY_CONTEXT;
    return {
      siteNotes: safeTrim(src.siteNotes),
      siteAccessNotes: safeTrim(src.siteAccessNotes || ""),
      unresolvedIssues: Array.isArray(src.unresolvedIssues) ? src.unresolvedIssues.slice() : [],
      equipment: Array.isArray(src.equipment) ? src.equipment.slice() : [],
      recentReports: Array.isArray(src.recentReports) ? src.recentReports.slice() : [],
      techNotes: safeTrim(src.techNotes),
      quotes: Array.isArray(src.quotes) ? src.quotes.slice() : [],
      activeEquipment: null,
      checklistState: {},
    };
  }

  function storageKey(ticketId) {
    return LS_PREFIX + safeTrim(ticketId || "draft");
  }

  function readCache(ticketId) {
    try {
      var raw = localStorage.getItem(storageKey(ticketId));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (!parsed.context || typeof parsed.context !== "object") return null;
      return {
        ts: Number(parsed.ts || 0),
        context: cloneContext(parsed.context),
      };
    } catch (e) {
      return null;
    }
  }

  function writeCache(ticketId, context) {
    try {
      localStorage.setItem(
        storageKey(ticketId),
        JSON.stringify({
          ts: nowMs(),
          context: cloneContext(context),
        })
      );
    } catch (e) {
      // Ignore quota / private mode failures.
    }
  }

  function clearCache(ticketId) {
    try {
      localStorage.removeItem(storageKey(ticketId));
    } catch (e) {
      // Ignore storage errors.
    }
  }

  function isFresh(cacheEntry) {
    if (!cacheEntry || !cacheEntry.ts) return false;
    return nowMs() - cacheEntry.ts < CACHE_TTL_MS;
  }

  function ensureIndicatorStyle() {
    if (typeof document === "undefined" || document.getElementById("vc-job-context-style")) return;
    var style = document.createElement("style");
    style.id = "vc-job-context-style";
    style.textContent =
      "#vc-job-context-offline-indicator{position:fixed;right:12px;bottom:12px;z-index:9999;max-width:calc(100vw - 24px);padding:6px 10px;border:1px solid rgba(0,212,255,.35);border-radius:999px;background:rgba(26,26,46,.92);color:#e8fbff;font-size:11px;line-height:1.2;letter-spacing:.02em;box-shadow:0 8px 22px rgba(0,0,0,.18);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);pointer-events:none;opacity:.95}" +
      "#vc-job-context-offline-indicator[hidden]{display:none !important}";
    document.head.appendChild(style);
  }

  function ensureIndicator() {
    if (typeof document === "undefined") return null;
    ensureIndicatorStyle();
    var el = document.getElementById("vc-job-context-offline-indicator");
    if (!el) {
      el = document.createElement("div");
      el.id = "vc-job-context-offline-indicator";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.hidden = true;
      el.textContent = "Offline - using cached data";
      document.body.appendChild(el);
    }
    return el;
  }

  function setOfflineIndicator(visible, text) {
    var el = ensureIndicator();
    if (!el) return;
    if (text) el.textContent = text;
    el.hidden = !visible;
  }

  function getLocationLine(ticket) {
    var domLocation = "";
    if (typeof document !== "undefined") {
      var locEl = document.getElementById("location");
      if (locEl && locEl.value) domLocation = safeTrim(locEl.value);
    }
    if (domLocation) return domLocation;
    var t = ticket || {};
    var name = safeTrim(t.customerName);
    var city = safeTrim(t.custCity);
    var addr = safeTrim(t.locationAddress).replace(/^UNKNOWN\s*-\s*/i, "");
    if (name && city && city.toUpperCase() !== "UNKNOWN" && addr) return name + " - " + city + " - " + addr;
    if (name && addr) return name + " - " + addr;
    return safeTrim(t.locationLine || t.locationDisplay || t.site || "");
  }

  function getCustomerId(ticket) {
    return sanitizePathSegment((ticket && ticket.customerName) || "");
  }

  function getLocationId(ticket) {
    return sanitizePathSegment(getLocationLine(ticket));
  }

  function toMillis(value) {
    if (!value) return 0;
    if (typeof value === "number" && isFinite(value)) return value;
    if (typeof value.toMillis === "function") {
      try {
        return value.toMillis();
      } catch (e) {}
    }
    if (typeof value.seconds === "number") {
      return value.seconds * 1000 + Math.floor((Number(value.nanoseconds || 0) || 0) / 1000000);
    }
    var parsed = Date.parse(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  function toTextField(value, limit) {
    var text = safeTrim(value);
    if (!text) return "";
    return typeof limit === "number" && limit > 0 ? text.slice(0, limit) : text;
  }

  function combineNotes(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var part = safeTrim(parts[i]);
      if (!part) continue;
      if (out.length && out[out.length - 1] === part) continue;
      out.push(part);
    }
    return out.join("\n\n");
  }

  function normalizeSiteNotes(siteIntelData) {
    if (!siteIntelData) return "";
    return combineNotes([
      siteIntelData.notes,
      siteIntelData.fieldAccessNotes,
      siteIntelData.technicianInterOfficeNotes,
    ]);
  }

  function normalizeEquipmentDoc(doc) {
    var data = doc && doc.data ? doc.data : {};
    return {
      id: doc && doc.id ? String(doc.id) : "",
      unitTag: toTextField(data.unitTag || data.assetTag || data.equipmentTag || data.name || "", 120),
      brand: toTextField(data.brand || data.make || data.manufacturer || "", 120),
      model: toTextField(data.model || data.serialModel || "", 120),
      serial: toTextField(data.serial || data.serialNum || data.serialNumber || "", 120),
      mfrYear: toTextField(data.mfrYear || data.year || "", 20),
      age: toTextField(data.age || "", 20),
      refrigerant: toTextField(data.refrigerant || "", 60),
      tonnage: toTextField(data.tonnage || "", 20),
      voltage: toTextField(data.voltage || "", 20),
      phase: toTextField(data.phase || "", 20),
      integrityScore: data.integrityScore != null ? data.integrityScore : (data.healthScore != null ? data.healthScore : data.score != null ? data.score : null),
      crv: data.crv != null ? data.crv : null,
      overallPhotoUrl: toTextField(data.overallPhotoUrl || data.photoUrl || "", 500),
      dataPlatePhotoUrl: toTextField(data.dataPlatePhotoUrl || data.platePhotoUrl || "", 500),
      notes: toTextField(data.notes || data.description || "", 500),
      updatedAt: data.updatedAt != null ? data.updatedAt : (data.savedAt != null ? data.savedAt : null),
    };
  }

  function normalizeReportDoc(doc) {
    var data = doc && doc.data ? doc.data : {};
    return {
      id: doc && doc.id ? String(doc.id) : "",
      customerName: toTextField(data.customerName || "", 160),
      locationAddress: toTextField(data.locationAddress || "", 220),
      techName: toTextField(data.techName || "", 160),
      status: toTextField(data.status || "", 80),
      linkedTicketId: toTextField(data.linkedTicketId || "", 100),
      linkedEquipmentId: toTextField(data.Linked_Equipment_ID || data.linkedEquipmentId || "", 160),
      deviceSavedAt: toTextField(data.deviceSavedAt || "", 40),
      timestampMs: toMillis(data.timestamp || data.savedAt || data.deviceSavedAt),
      reportText: toTextField(
        data.fullReportText ||
          data.techNotes ||
          data.reportText ||
          data.notes ||
          "",
        5000
      ),
    };
  }

  function normalizeQuoteItem(item, fallbackId) {
    if (item == null) return null;
    if (typeof item === "string") {
      var text = safeTrim(item);
      if (!text) return null;
      return { id: fallbackId || "", text: text };
    }
    if (typeof item !== "object") {
      return { id: fallbackId || "", text: safeTrim(item) };
    }
    return {
      id: safeTrim(item.id || item.quoteId || item.quoteNum || fallbackId || ""),
      status: safeTrim(item.status || ""),
      quoteNum: safeTrim(item.quoteNum || ""),
      text: safeTrim(item.text || item.summary || item.description || item.note || ""),
      parts: Array.isArray(item.parts) ? item.parts.slice(0, 20) : [],
      laborHours: item.laborHours != null ? item.laborHours : null,
      total: item.total != null ? item.total : (item.grandTotal != null ? item.grandTotal : null),
    };
  }

  function extractQuotes(ticket) {
    var src = ticket || {};
    var fields = [
      "openQuotes",
      "quotes",
      "fieldQuotes",
      "quoteItems",
      "quote",
      "openQuote",
      "quoteSummary",
    ];
    for (var i = 0; i < fields.length; i++) {
      var value = src[fields[i]];
      if (value == null || value === "") continue;
      if (Array.isArray(value)) {
        return value
          .map(function (item, idx) {
            return normalizeQuoteItem(item, fields[i] + "_" + idx);
          })
          .filter(Boolean);
      }
      return [normalizeQuoteItem(value, fields[i])].filter(Boolean);
    }
    return [];
  }

  function getSiteIntelDocId(ticket) {
    var line = getLocationLine(ticket);
    if (!line) return "";
    if (window.DataProvider && typeof DataProvider.siteIntelDocIdFromLocationLine === "function") {
      return DataProvider.siteIntelDocIdFromLocationLine(line);
    }
    return sanitizePathSegment(line).toLowerCase();
  }

  function getDb() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return null;
    return firebase.firestore();
  }

  function getSiteIntelPromise(db, ticket) {
    var docId = getSiteIntelDocId(ticket);
    if (!docId) return Promise.resolve(null);
    if (window.VCFirestore && typeof VCFirestore.getSiteIntelDocOnceBridged === "function") {
      return VCFirestore.getSiteIntelDocOnceBridged(db, docId).then(function (got) {
        return got && got.exists ? got.data || null : null;
      });
    }
    var ref =
      window.VCFirestore && typeof VCFirestore.siteIntelligence === "function"
        ? VCFirestore.siteIntelligence(db).doc(docId)
        : db.collection("site_intelligence").doc(docId);
    return ref.get().then(function (snap) {
      return snap && snap.exists ? snap.data() || null : null;
    });
  }

  function getEquipmentPromise(db, ticket) {
    var customerId = getCustomerId(ticket);
    var locationId = getLocationId(ticket);
    if (!customerId || !locationId) return Promise.resolve([]);
    return db
      .collection("Customers")
      .doc(customerId)
      .collection("Locations")
      .doc(locationId)
      .collection("Equipment")
      .get()
      .then(function (snap) {
        var rows = [];
        snap.forEach(function (doc) {
          rows.push(normalizeEquipmentDoc(doc));
        });
        return rows;
      });
  }

  function getReportsPromise(db, ticket) {
    var customerName = safeTrim(ticket && ticket.customerName);
    var targetAddress = safeTrim(ticket && ticket.locationAddress).replace(/^UNKNOWN\s*-\s*/i, "");
    if (!customerName) return Promise.resolve([]);
    var query =
      window.VCFirestore && typeof VCFirestore.queryCompletedReportsWhereMerged === "function"
        ? VCFirestore.queryCompletedReportsWhereMerged(db, "customerName", "==", customerName, 30)
        : db.collection("completed_reports").where("customerName", "==", customerName).limit(30).get().then(function (snap) {
            var rows = [];
            snap.forEach(function (doc) {
              rows.push({ id: doc.id, data: doc.data() || {} });
            });
            return rows;
          });

    return Promise.resolve(query).then(function (rows) {
      var filtered = [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i] || {};
        var data = row.data || {};
        var addr = safeTrim(data.locationAddress).replace(/^UNKNOWN\s*-\s*/i, "");
        if (safeTrim(addr).toLowerCase() !== targetAddress.toLowerCase()) continue;
        filtered.push(normalizeReportDoc(row));
      }
      filtered.sort(function (a, b) {
        return b.timestampMs - a.timestampMs;
      });
      return filtered.slice(0, 10);
    });
  }

  function buildContext(ticket, payload) {
    var siteIntelData = payload && payload.siteIntelData ? payload.siteIntelData : null;
    var equipment = payload && Array.isArray(payload.equipment) ? payload.equipment : [];
    var reports = payload && Array.isArray(payload.reports) ? payload.reports : [];
    var quotes = extractQuotes(ticket);
    return {
      siteNotes: normalizeSiteNotes(siteIntelData),
      equipment: equipment,
      recentReports: reports,
      techNotes: combineNotes([
        ticket && ticket.internal_comms,
        ticket && ticket.techNotes,
      ]),
      quotes: quotes,
      activeEquipment: null,
    };
  }

  function setCurrent(ticketId, context) {
    currentTicketId = safeTrim(ticketId || "");
    currentContext = cloneContext(context);
    /* Preserve runtime-only activeEquipment across context refreshes (not cached). */
    currentContext.activeEquipment = _activeEquipment;
    window.VCJobContext = cloneContext(currentContext);
    window.VCJobContext.activeEquipment = _activeEquipment;
    return window.VCJobContext;
  }

  function setActiveEquipment(ref) {
    _activeEquipment = ref ? String(ref).trim() : null;
    currentContext.activeEquipment = _activeEquipment;
    window.VCJobContext.activeEquipment = _activeEquipment;
    try {
      window.dispatchEvent(
        new CustomEvent("vc:activeEquipmentChanged", {
          detail: { activeEquipment: _activeEquipment },
        })
      );
    } catch (e) {
      /* older browsers — no-op */
    }
  }

  function getActiveEquipment() {
    return _activeEquipment;
  }

  function applyCache(ticketId, cacheEntry) {
    var ctx = cacheEntry && cacheEntry.context ? cacheEntry.context : EMPTY_CONTEXT;
    setCurrent(ticketId, ctx);
    return window.VCJobContext;
  }

  function preloadContext(ticketId, ticket) {
    var tid = safeTrim(ticketId || (ticket && ticket.id) || "");
    if (!tid) {
      setCurrent("", EMPTY_CONTEXT);
      return Promise.resolve(window.VCJobContext);
    }

    var cache = readCache(tid);
    if (cache && isFresh(cache)) {
      setOfflineIndicator(false);
      return Promise.resolve(applyCache(tid, cache));
    }

    if (cache) {
      applyCache(tid, cache);
    } else {
      setCurrent(tid, EMPTY_CONTEXT);
    }

    if (inflightByTicket[tid]) {
      return inflightByTicket[tid];
    }

    var db = getDb();
    if (!db) {
      if (cache) setOfflineIndicator(true, "Offline - using cached data");
      return Promise.resolve(window.VCJobContext);
    }

    var activeTicket = ticket || {};
    var requests = [
      getSiteIntelPromise(db, activeTicket),
      getEquipmentPromise(db, activeTicket),
      getReportsPromise(db, activeTicket),
    ];

    var request = Promise.all(requests)
      .then(function (results) {
        var context = buildContext(activeTicket, {
          siteIntelData: results[0],
          equipment: results[1],
          reports: results[2],
        });
        writeCache(tid, context);
        setOfflineIndicator(false);
        return setCurrent(tid, context);
      })
      .catch(function (err) {
        if (cache) {
          setOfflineIndicator(true, "Offline - using cached data");
          return setCurrent(tid, cache.context);
        }
        setOfflineIndicator(false);
        return setCurrent(tid, EMPTY_CONTEXT);
      })
      .finally(function () {
        delete inflightByTicket[tid];
      });

    inflightByTicket[tid] = request;
    return request;
  }

  function getContext(ticketId) {
    var tid = safeTrim(ticketId || currentTicketId);
    if (tid && tid === currentTicketId) {
      return cloneContext(currentContext);
    }
    var cache = readCache(tid);
    return cache && cache.context ? cloneContext(cache.context) : cloneContext(EMPTY_CONTEXT);
  }

  function clearContext(ticketId) {
    var tid = safeTrim(ticketId || currentTicketId);
    if (tid) clearCache(tid);
    if (!ticketId || tid === currentTicketId) {
      currentTicketId = "";
      currentContext = cloneContext(EMPTY_CONTEXT);
      _activeEquipment = null;
      window.VCJobContext = cloneContext(EMPTY_CONTEXT);
      setOfflineIndicator(false);
      try {
        window.dispatchEvent(
          new CustomEvent("vc:activeEquipmentChanged", { detail: { activeEquipment: null } })
        );
      } catch (e) { /* older browsers */ }
    }
    return window.VCJobContext;
  }

  /**
   * getChecklistState — returns the current checklist mention state for a ticket.
   * Delegates to ChecklistReminderEngine if available; falls back to VCJobContext.
   */
  function getChecklistState(ticketId) {
    try {
      if (
        window.ChecklistReminderEngine &&
        typeof window.ChecklistReminderEngine.getActiveWorkflow === "function"
      ) {
        var tid = safeTrim(ticketId || currentTicketId);
        var lsKey = "vc_checklist_state_" + (tid || "draft");
        var raw = localStorage.getItem(lsKey);
        if (raw) {
          var parsed = JSON.parse(raw);
          return (parsed && typeof parsed === "object") ? parsed : {};
        }
        return {};
      }
    } catch (e) { /* no-op */ }
    return window.VCJobContext && window.VCJobContext.checklistState
      ? window.VCJobContext.checklistState
      : {};
  }

  /**
   * resolveEquipmentDocId — given a freeform equipment reference string (e.g. "RTU 3"),
   * searches the current context's equipment list for a matching unitTag and returns
   * its Firestore document ID.  Returns null if no match or no equipment loaded.
   */
  function resolveEquipmentDocId(ref) {
    if (!ref) return null;
    var needle = String(ref).replace(/[\s\-#]+/g, "").toLowerCase();
    if (!needle) return null;
    var equipment = currentContext.equipment || [];
    for (var i = 0; i < equipment.length; i++) {
      var item = equipment[i];
      if (!item) continue;
      var tag = String(item.unitTag || "").replace(/[\s\-#]+/g, "").toLowerCase();
      if (tag && tag === needle) return item.id || null;
      var idNorm = String(item.id || "").replace(/[\s\-#]+/g, "").toLowerCase();
      if (idNorm && idNorm === needle) return item.id || null;
    }
    return null;
  }

  /**
   * markChecklistItem — thin wrapper delegating to ChecklistReminderEngine.markMentioned.
   * Allows other modules to record a mention without importing ChecklistReminderEngine directly.
   */
  function markChecklistItem(ticketId, equipment, itemKey) {
    try {
      if (
        window.ChecklistReminderEngine &&
        typeof window.ChecklistReminderEngine.markMentioned === "function"
      ) {
        window.ChecklistReminderEngine.markMentioned(ticketId, equipment, itemKey);
      }
    } catch (e) { /* no-op */ }
  }

  window.VCJobContext = cloneContext(EMPTY_CONTEXT);
  window.JobContextEngine = {
    preloadContext: preloadContext,
    getContext: getContext,
    clearContext: clearContext,
    setActiveEquipment: setActiveEquipment,
    getActiveEquipment: getActiveEquipment,
    getChecklistState: getChecklistState,
    markChecklistItem: markChecklistItem,
    resolveEquipmentDocId: resolveEquipmentDocId,
  };
})();
