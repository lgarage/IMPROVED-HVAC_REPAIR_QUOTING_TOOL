/**
 * EquipmentClassifier agent — extract equipment references from timeline
 * entries and classify per-unit findings from compiled reports.
 *
 * Extracted from conversational_timeline.js (Slice 63f).
 * No DOM access — UI (save prompt cards) remains in conversational_timeline.js.
 *
 * Depends on: window.GeminiClient (gemini_client.js)
 * Exposes:    window.VCAgents.EquipmentClassifier
 */
(function () {
  "use strict";

  window.VCAgents = window.VCAgents || {};

  /* ── extractUniqueEquipmentRefs ──────────────────────────────── */

  function extractUniqueEquipmentRefs(entries) {
    var seen = {};
    var refs = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e || !e.meta) continue;
      var ref = e.meta.equipmentRef || e.meta.activeEquipment || null;
      if (ref && !seen[ref]) {
        seen[ref] = true;
        refs.push(ref);
      }
    }
    return refs;
  }

  /* ── buildEquipmentClassifyPrompt ────────────────────────────── */

  function buildEquipmentClassifyPrompt(compiledReport, equipmentRef) {
    var lines = [];
    lines.push("You are an HVAC service data extractor.");
    lines.push("From this compiled field service report, extract findings specific to \"" + equipmentRef + "\" that should be saved to the unit's permanent equipment history.");
    lines.push("");
    lines.push("COMPILED REPORT:");
    if (compiledReport.summary) lines.push("Summary: " + compiledReport.summary);
    if (compiledReport.equipmentFindings && compiledReport.equipmentFindings.length) {
      for (var i = 0; i < compiledReport.equipmentFindings.length; i++) {
        var ef = compiledReport.equipmentFindings[i];
        lines.push("Equipment: " + (ef.equipment || "") +
          " | Diagnosis: " + (ef.diagnosis || "") +
          " | Measurements: " + (ef.measurements || "") +
          " | Actions: " + (ef.actionsTaken || ""));
      }
    }
    if (compiledReport.equipmentHistoryUpdates && compiledReport.equipmentHistoryUpdates.length) {
      for (var j = 0; j < compiledReport.equipmentHistoryUpdates.length; j++) {
        var eh = compiledReport.equipmentHistoryUpdates[j];
        lines.push("History update: " + (eh.equipment || "") + " — " + (eh.dataPoints || ""));
      }
    }
    lines.push("");
    lines.push("Return ONLY valid JSON for \"" + equipmentRef + "\":");
    lines.push('{');
    lines.push('  "measurements": ["string — e.g. amp draw 18.5A, supply temp 52°F"],');
    lines.push('  "partsReplaced": ["string — e.g. contactor, capacitor"],');
    lines.push('  "repairOutcome": "string — verified working / needs follow-up / etc.",');
    lines.push('  "followUp": "string — any recommended follow-up for this unit, or empty string",');
    lines.push('  "summary": "string — 1-2 sentence summary of work done on this unit"');
    lines.push('}');
    return lines.join("\n");
  }

  /* ── classifyAll ─────────────────────────────────────────────── */

  /**
   * Classify findings for all unique equipment refs in the entries.
   * Returns Promise<Array<{equipmentRef, findings}>> — only valid results.
   *
   * @param {Object} compiledReport - merged compile result
   * @param {Array}  entries        - timeline entries
   * @returns {Promise<Array>}
   */
  function classifyAll(compiledReport, entries) {
    if (!compiledReport || !entries || !entries.length) {
      return Promise.resolve([]);
    }

    var equipRefs = extractUniqueEquipmentRefs(entries);
    if (!equipRefs.length) return Promise.resolve([]);

    var promises = [];
    for (var i = 0; i < equipRefs.length; i++) {
      (function (ref) {
        var prompt = buildEquipmentClassifyPrompt(compiledReport, ref);
        promises.push(
          window.GeminiClient.callJson(prompt, {
            temperature: 0.2,
            maxOutputTokens: 1024
          }).then(function (parsed) {
            return { equipmentRef: ref, findings: parsed };
          }).catch(function () {
            return null;
          })
        );
      })(equipRefs[i]);
    }

    return Promise.all(promises).then(function (results) {
      var valid = [];
      for (var j = 0; j < results.length; j++) {
        if (results[j] && results[j].findings) valid.push(results[j]);
      }
      return valid;
    });
  }

  /* ── export ──────────────────────────────────────────────────── */

  window.VCAgents.EquipmentClassifier = {
    extractUniqueEquipmentRefs: extractUniqueEquipmentRefs,
    buildEquipmentClassifyPrompt: buildEquipmentClassifyPrompt,
    classifyAll: classifyAll
  };
})();
