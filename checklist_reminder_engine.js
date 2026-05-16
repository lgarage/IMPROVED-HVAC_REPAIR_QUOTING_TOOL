/**
 * Checklist Reminder Engine — Slice 45a / updated Slice 63b.
 *
 * Loads PM / service workflow checklists dynamically from Firestore
 * form_templates collection (same collection used by field_forms.js).
 * NEVER hardcodes checklist items — all items come from form_templates.
 *
 * Responsibilities:
 *   - loadWorkflow(ticketTypeStr) → Promise<workflow | null>
 *       Queries form_templates where active=true; matches targetKeyword
 *       against the ticket type string (PM, service call, etc.).
 *   - checkMissing(workflow, mentionedKeys) → missing items[]
 *       Pure function; returns workflow items not yet mentioned.
 *   - getReminders(equipment, ticketId) → string[]
 *       Short prompts like "RTU6 capacitor?" for items not yet mentioned
 *       on the given equipment unit.
 *   - updateFromEntry(entry, ticketId, equipment)
 *       Called by ConversationalTimeline.processEntry; extracts keyword
 *       matches from entry text + EdgeIntentEngine entities and marks
 *       matched checklist items as mentioned.
 *   - onJobCheckin(ticket)
 *       Called on workspace open; resolves ticket type → loadWorkflow.
 *
 * Reminder philosophy: assist and remind, never hard-block or force forms.
 * Surfaces at most MAX_REMINDERS_PER_SWITCH gentle bubbles per equipment switch.
 *
 * Exports: window.ChecklistReminderEngine
 *   { loadWorkflow, checkMissing, getReminders, markMentioned,
 *     updateFromEntry, onJobCheckin, setActiveWorkflow, getActiveWorkflow }
 */
(function () {
  "use strict";

  var LS_PREFIX = "vc_checklist_state_";
  var LS_WORKFLOW_CACHE_PREFIX = "vc_checklist_workflow_";
  var MAX_REMINDERS_PER_SWITCH = 2; /* cap gentle follow-ups to avoid overwhelming */

  /* current loaded workflow for this job session */
  var _activeWorkflow = null;

  /* in-memory workflow cache keyed by normalized ticket type string */
  var _workflowCache = {};

  /* ── localStorage helpers ─────────────────────────────────────── */

  function storageKey(ticketId) {
    return LS_PREFIX + (ticketId || "draft");
  }

  function loadState(ticketId) {
    try {
      var raw = localStorage.getItem(storageKey(ticketId));
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveState(ticketId, state) {
    try {
      localStorage.setItem(storageKey(ticketId), JSON.stringify(state || {}));
    } catch (e) { /* quota exceeded — degrade silently */ }
  }

  function workflowCacheKey(typeKey) {
    return LS_WORKFLOW_CACHE_PREFIX + String(typeKey || "").trim().toLowerCase();
  }

  function loadWorkflowCache(typeKey) {
    try {
      var raw = localStorage.getItem(workflowCacheKey(typeKey));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (!Array.isArray(parsed.items)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveWorkflowCache(typeKey, workflow) {
    try {
      if (!workflow) return;
      localStorage.setItem(workflowCacheKey(typeKey), JSON.stringify(workflow));
    } catch (e) { /* quota exceeded — degrade silently */ }
  }

  /* ── Firestore helpers ────────────────────────────────────────── */

  function getDb() {
    try {
      if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return null;
      return firebase.firestore();
    } catch (e) {
      return null;
    }
  }

  /* ── checklist item extraction ────────────────────────────────── */

  /**
   * extractChecklistItems — converts form_templates fields[] into
   * { key, label } checklist items for mention tracking.
   * All field types are included (checkbox, text, number, etc.) since
   * any field represents something the tech should address.
   */
  function extractChecklistItems(data) {
    var fields = Array.isArray(data.fields) ? data.fields : [];
    var items = [];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (!f || !f.name) continue;
      var key = String(f.name).trim();
      var label = String(f.label || f.name).trim();
      if (!key) continue;
      items.push({ key: key, label: label });
    }
    return items;
  }

  /* ── workflow loading ─────────────────────────────────────────── */

  /**
   * matchesTriggerWords — checks whether a form_templates document matches
   * the given typeKey string using its triggerWords[] array (Slice 63b) or
   * falling back to targetKeyword for backward compatibility.
   *
   * @param {object} data  — doc.data() from form_templates
   * @param {string} typeKey — normalized (trimmed, lowercased) ticket type
   * @returns {{ matched: boolean, bestKwLen: number }}
   *   bestKwLen is the length of the longest matching word (used for
   *   "most specific" ranking so longer keywords win ties).
   */
  function matchesTriggerWords(data, typeKey) {
    var words;
    if (Array.isArray(data.triggerWords) && data.triggerWords.length) {
      words = data.triggerWords;
    } else {
      /* backward compat — templates without triggerWords fall back to targetKeyword */
      words = [data.targetKeyword || ""];
    }
    var matched = false;
    var bestKwLen = 0;
    for (var i = 0; i < words.length; i++) {
      var word = String(words[i] || "").trim().toLowerCase();
      if (!word) continue;
      if (typeKey.indexOf(word) !== -1 || word.indexOf(typeKey) !== -1) {
        matched = true;
        if (word.length > bestKwLen) bestKwLen = word.length;
      }
    }
    return { matched: matched, bestKwLen: bestKwLen };
  }

  /**
   * loadWorkflow — exported.
   * Queries form_templates for a template whose targetKeyword matches
   * the given ticketType string (case-insensitive, substring match).
   * Returns Promise<{ templateId, templateName, items[], triggerWords[], targetKeyword } | null>.
   * Results are memoized in-memory for the session.
   */
  function loadWorkflow(ticketType) {
    var typeKey = String(ticketType || "").trim().toLowerCase();
    if (!typeKey) return Promise.resolve(null);

    if (Object.prototype.hasOwnProperty.call(_workflowCache, typeKey)) {
      return Promise.resolve(_workflowCache[typeKey]);
    }

    var cachedWorkflow = loadWorkflowCache(typeKey);

    var db = getDb();
    if (!db) {
      _workflowCache[typeKey] = cachedWorkflow;
      return Promise.resolve(cachedWorkflow);
    }

    try {
      return db
        .collection("form_templates")
        .where("active", "==", true)
        .get()
        .then(function (snap) {
          var best = null;
          snap.forEach(function (doc) {
            var data = doc.data() || {};
            /* Slice 63b: check triggerWords[] array with fallback to targetKeyword */
            var mr = matchesTriggerWords(data, typeKey);
            if (!mr.matched) return;
            /* prefer the most specific match (longest trigger word length) */
            if (!best || mr.bestKwLen > best._kwLen) {
              best = {
                templateId: doc.id,
                templateName: String(data.templateName || doc.id),
                items: extractChecklistItems(data),
                triggerWords: Array.isArray(data.triggerWords) ? data.triggerWords : [],
                targetKeyword: String(data.targetKeyword || ""),
                _kwLen: mr.bestKwLen
              };
            }
          });
          var result = best
            ? {
                templateId: best.templateId,
                templateName: best.templateName,
                items: best.items,
                triggerWords: best.triggerWords,
                targetKeyword: best.targetKeyword
              }
            : null;
          _workflowCache[typeKey] = result;
          if (result) saveWorkflowCache(typeKey, result);
          return result || cachedWorkflow;
        })
        .catch(function () {
          _workflowCache[typeKey] = cachedWorkflow;
          return cachedWorkflow;
        });
    } catch (e) {
      _workflowCache[typeKey] = cachedWorkflow;
      return Promise.resolve(cachedWorkflow);
    }
  }

  /* ── missing items check ──────────────────────────────────────── */

  /**
   * checkMissing — exported.
   * Pure function: given a loaded workflow and a set of already-mentioned
   * item keys, returns the items that have not yet been mentioned.
   * @param {{ items: {key,label}[] }} workflow
   * @param {string[]} mentionedKeys
   * @returns {{ key: string, label: string }[]}
   */
  function checkMissing(workflow, mentionedKeys) {
    if (!workflow || !Array.isArray(workflow.items)) return [];
    var mentioned = Array.isArray(mentionedKeys) ? mentionedKeys : [];
    return workflow.items.filter(function (item) {
      return mentioned.indexOf(item.key) === -1;
    });
  }

  /* ── reminder generation ──────────────────────────────────────── */

  /**
   * getReminders — exported.
   * Returns up to MAX_REMINDERS_PER_SWITCH short reminder strings for
   * checklist items not yet mentioned on the given equipment unit.
   * Format: "RTU6 capacitor?" — short, not aggressive.
   * @param {string} equipment  e.g. "RTU6"
   * @param {string} ticketId
   * @returns {string[]}
   */
  function getReminders(equipment, ticketId) {
    if (!_activeWorkflow || !equipment || !ticketId) return [];
    var eq = String(equipment).trim();
    var state = loadState(ticketId);
    var equipState = state[eq] || { mentionedItems: [] };
    var missing = checkMissing(_activeWorkflow, equipState.mentionedItems);
    return missing
      .slice(0, MAX_REMINDERS_PER_SWITCH)
      .map(function (item) {
        return eq + " " + item.label.toLowerCase() + "?";
      });
  }

  /* ── mention tracking ─────────────────────────────────────────── */

  /**
   * markMentioned — exported.
   * Records that a checklist item was addressed for a given equipment unit.
   * Persists to localStorage and updates window.VCJobContext.checklistState
   * so the state is visible to other modules without circular dependencies.
   */
  function markMentioned(ticketId, equipment, itemKey) {
    if (!ticketId || !equipment || !itemKey) return;
    var eq = String(equipment).trim();
    var state = loadState(ticketId);
    if (!state[eq]) state[eq] = { mentionedItems: [], lastUpdated: null };
    if (state[eq].mentionedItems.indexOf(itemKey) === -1) {
      state[eq].mentionedItems.push(itemKey);
    }
    state[eq].lastUpdated = new Date().toISOString();
    saveState(ticketId, state);

    /* reflect into VCJobContext.checklistState for external visibility */
    try {
      if (window.VCJobContext) {
        if (!window.VCJobContext.checklistState) window.VCJobContext.checklistState = {};
        if (!window.VCJobContext.checklistState[eq]) {
          window.VCJobContext.checklistState[eq] = { mentionedItems: [] };
        }
        if (window.VCJobContext.checklistState[eq].mentionedItems.indexOf(itemKey) === -1) {
          window.VCJobContext.checklistState[eq].mentionedItems.push(itemKey);
        }
      }
    } catch (e) { /* VCJobContext not ready — degrade silently */ }
  }

  /* ── corpus keyword matching ──────────────────────────────────── */

  /**
   * corpusContains — checks whether any significant word from needle
   * appears in haystack. Words under 3 chars are skipped (too generic).
   * Both arguments must already be lowercase.
   */
  function corpusContains(haystack, needle) {
    var words = needle.split(/[\s_\-\/]+/);
    for (var i = 0; i < words.length; i++) {
      var w = words[i].trim();
      if (w.length < 3) continue;
      if (haystack.indexOf(w) !== -1) return true;
    }
    return false;
  }

  /**
   * updateFromEntry — exported.
   * Called by ConversationalTimeline.processEntry after EdgeIntentEngine
   * has parsed the entry. Scans entry text + extracted entities for
   * keyword matches against the active workflow's checklist items and
   * marks any matched items as mentioned for the given equipment.
   */
  function updateFromEntry(entry, ticketId, equipment) {
    if (!entry || !equipment || !ticketId) return;
    if (!_activeWorkflow || !_activeWorkflow.items || !_activeWorkflow.items.length) return;

    var text = String(entry.text || "").toLowerCase();
    var entities = (entry.meta && Array.isArray(entry.meta.entities)) ? entry.meta.entities : [];

    /* build a combined corpus: entry text + all entity values */
    var corpus = text;
    for (var i = 0; i < entities.length; i++) {
      if (entities[i] && entities[i].value) {
        corpus += " " + String(entities[i].value).toLowerCase();
      }
    }

    for (var j = 0; j < _activeWorkflow.items.length; j++) {
      var item = _activeWorkflow.items[j];
      if (!item) continue;
      var labelLower = item.label.toLowerCase();
      var keyLower = item.key.toLowerCase();
      if (corpusContains(corpus, labelLower) || corpusContains(corpus, keyLower)) {
        markMentioned(ticketId, equipment, item.key);
      }
    }
  }

  /* ── job check-in integration ─────────────────────────────────── */

  /**
   * onJobCheckin — exported.
   * Called when workspace opens with an active ticket.
   * Resolves the ticket type and loads the matching workflow from
   * form_templates. Sets _activeWorkflow for the session.
   */
  function onJobCheckin(ticket) {
    if (!ticket) return;
    /* build a type string from any available ticket classification fields */
    var typeStr = String(
      ticket.ticketType ||
      ticket.jobType ||
      ticket.serviceType ||
      ticket.type ||
      ticket.jobDescription ||
      ticket.description ||
      ""
    ).trim();
    if (!typeStr) return;
    loadWorkflow(typeStr).then(function (workflow) {
      _activeWorkflow = workflow;
    });
  }

  /**
   * setActiveWorkflow — exported.
   * Allows external code to inject a workflow directly (e.g. dispatcher
   * sets a specific template for the ticket before the tech checks in).
   */
  function setActiveWorkflow(workflow) {
    _activeWorkflow = workflow || null;
  }

  /**
   * getActiveWorkflow — exported.
   * Returns the currently loaded workflow (or null if none loaded yet).
   */
  function getActiveWorkflow() {
    return _activeWorkflow;
  }

  /* ── exports ──────────────────────────────────────────────────── */

  window.ChecklistReminderEngine = {
    loadWorkflow: loadWorkflow,
    checkMissing: checkMissing,
    getReminders: getReminders,
    markMentioned: markMentioned,
    updateFromEntry: updateFromEntry,
    onJobCheckin: onJobCheckin,
    setActiveWorkflow: setActiveWorkflow,
    getActiveWorkflow: getActiveWorkflow
  };
})();
