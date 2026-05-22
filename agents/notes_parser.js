/**
 * NotesParser agent — compile prompts, merge results, format display.
 *
 * Pure functions extracted from conversational_timeline.js.
 * No DOM access, no state — orchestration remains in conversational_timeline.js.
 *
 * Depends on: window.GeminiClient (gemini_client.js)
 * Exposes:    window.VCAgents.NotesParser
 */
(function () {
  "use strict";

  window.VCAgents = window.VCAgents || {};

  /* ── constants ───────────────────────────────────────────────── */

  var COMPILE_FULL_MAX_TOKENS  = 8192;
  var COMPILE_DELTA_MAX_TOKENS = 2048;

  /* ── data preservation preamble (shared by full + delta) ────── */

  function dataPreservationRules() {
    return [
      "CRITICAL DATA PRESERVATION RULES — follow these exactly:",
      "1. EXACT MEASUREMENTS: Copy filter dimensions (e.g. 16x20x2), pressures, temperatures, voltages, and quantities VERBATIM from the timeline. Never round, convert, abbreviate, or paraphrase numbers.",
      "2. EXACT PART NAMES: Belt designations (e.g. BX56), part numbers, and model/serial numbers must appear exactly as stated. Never substitute, generalize, or infer part names.",
      "3. EQUIPMENT LABELS: RTU labels (e.g. RTU 1, RTU 2), unit names, and system identifiers are literal — do not merge, conflate, or rename them.",
      "4. QUANTITIES: If the technician states a specific count (e.g. 'four filters', '4 filters'), preserve the exact number. Never change quantities.",
      "5. DO NOT INVENT: Never add part numbers, measurements, quantities, or specifications not explicitly present in the timeline entries."
    ];
  }

  /* ── JSON output schema (shared by full + delta) ────────────── */

  function outputSchema(summaryNote) {
    return [
      '{',
      '  "equipmentFindings": [',
      '    { "equipment": "string", "diagnosis": "string", "measurements": "string", "actionsTaken": "string" }',
      '  ],',
      '  "quoteRecommendations": [',
      '    { "part": "string", "description": "string", "laborEstimate": "string" }',
      '  ],',
      '  "quoteNeeded": false,',
      '  "unresolvedIssues": [',
      '    { "issue": "string", "severity": "low|medium|high", "notes": "string" }',
      '  ],',
      '  "equipmentHistoryUpdates": [',
      '    { "equipment": "string", "dataPoints": "string" }',
      '  ],',
      '  "summary": "string (' + (summaryNote || "1-2 sentence overall summary") + ')"',
      '}',
      'Set quoteNeeded to true if any quoteRecommendations were identified, or if the tech describes a repair that was not completed and requires a quote. Set to false for maintenance/PM visits and diagnostic-only calls with no outstanding repair work.'
    ];
  }

  /* ── entry formatting (shared by full + delta) ─────────────── */

  function formatEntryLine(e) {
    if (!e) return null;
    var prefix = e.role === "system" ? "[SYSTEM]" : "[TECH]";
    var meta = "";
    if (e.meta && e.meta.mediaType) meta = " (media: " + e.meta.mediaType + ")";
    var eqRef = (e.meta && (e.meta.equipmentRef || e.meta.activeEquipment)) || null;
    if (eqRef) meta += " (equipment: " + eqRef + ")";
    return prefix + " " + (e.ts || "") + " — " + (e.text || "") + meta;
  }

  function appendJobContext(lines, ticket) {
    if (!ticket) return;
    lines.push("");
    lines.push("JOB CONTEXT:");
    if (ticket.customerName) lines.push("Customer: " + ticket.customerName);
    if (ticket.address || ticket.locationAddress) {
      lines.push("Location: " + (ticket.address || ticket.locationAddress));
    }
    if (ticket.issue) lines.push("Reported issue: " + ticket.issue);
  }

  /* ── buildCompilePrompt ──────────────────────────────────────── */

  function buildCompilePrompt(context) {
    var lines = [];
    lines.push("You are an HVAC field service report compiler. Analyze the following technician timeline entries and produce a structured JSON report.");
    lines.push("MEDIA EQUIPMENT RULE: Media entries (photo/video) tagged with (equipment: X) are explicitly tied to that equipment. For any media entry WITHOUT an (equipment:) tag, associate it with the equipment or issue most recently mentioned in the timeline entries immediately before it.");
    lines.push("");
    lines.push.apply(lines, dataPreservationRules());
    lines.push("");
    lines.push("TIMELINE ENTRIES:");
    for (var i = 0; i < context.entries.length; i++) {
      var line = formatEntryLine(context.entries[i]);
      if (line) lines.push(line);
    }

    appendJobContext(lines, context.ticket);

    if (context.equipmentContext) {
      lines.push("");
      lines.push("ACTIVE EQUIPMENT: " + context.equipmentContext);
    }

    if (context.checklistState && context.checklistState.items) {
      lines.push("");
      lines.push("CHECKLIST STATE:");
      var items = context.checklistState.items;
      for (var j = 0; j < items.length; j++) {
        var ci = items[j];
        var status = ci.completed ? "DONE" : "PENDING";
        lines.push("  - [" + status + "] " + (ci.label || ci.id || "item " + j));
      }
    }

    lines.push("");
    lines.push("OUTPUT FORMAT — Return ONLY valid JSON with this structure:");
    lines.push.apply(lines, outputSchema("1-2 sentence overall summary"));

    return lines.join("\n");
  }

  /* ── buildDeltaCompilePrompt ─────────────────────────────────── */

  function buildDeltaCompilePrompt(newEntries, existingResult, context) {
    var lines = [];
    lines.push("You are an HVAC field service report compiler processing incremental timeline entries.");
    lines.push("MEDIA EQUIPMENT RULE: Media entries (photo/video) tagged with (equipment: X) are explicitly tied to that equipment. For any media entry WITHOUT an (equipment:) tag, associate it with the equipment or issue most recently mentioned in the timeline entries immediately before it.");
    lines.push("");
    lines.push.apply(lines, dataPreservationRules());
    lines.push("");

    if (existingResult && existingResult.summary) {
      lines.push("EXISTING REPORT CONTEXT (already compiled from earlier entries):");
      lines.push("Summary so far: " + existingResult.summary);
      if (existingResult.equipmentFindings && existingResult.equipmentFindings.length) {
        lines.push("Equipment already found: " + existingResult.equipmentFindings.map(function (f) { return f.equipment || ""; }).filter(Boolean).join(", "));
      }
      lines.push("");
    }

    lines.push("NEW TIMELINE ENTRIES (compile only these — merge context with existing report):");
    for (var i = 0; i < newEntries.length; i++) {
      var line = formatEntryLine(newEntries[i]);
      if (line) lines.push(line);
    }

    appendJobContext(lines, context && context.ticket);

    lines.push("");
    lines.push("OUTPUT FORMAT — Return ONLY valid JSON. Update the summary to cover ALL entries (both existing and new). Only include findings/issues found in the NEW entries above (the existing ones are already tracked):");
    lines.push.apply(lines, outputSchema("1-2 sentence summary covering ALL entries, including previous context"));
    return lines.join("\n");
  }

  /* ── mergeCompileResults ─────────────────────────────────────── */

  function mergeCompileResults(existing, delta) {
    if (!existing) return delta;
    if (!delta) return existing;
    return {
      equipmentFindings: (existing.equipmentFindings || []).concat(delta.equipmentFindings || []),
      quoteRecommendations: (existing.quoteRecommendations || []).concat(delta.quoteRecommendations || []),
      quoteNeeded: !!(existing.quoteNeeded || delta.quoteNeeded),
      unresolvedIssues: (existing.unresolvedIssues || []).concat(delta.unresolvedIssues || []),
      equipmentHistoryUpdates: (existing.equipmentHistoryUpdates || []).concat(delta.equipmentHistoryUpdates || []),
      summary: delta.summary || existing.summary || ""
    };
  }

  /* ── formatCompileResultForDisplay ───────────────────────────── */

  function formatCompileResultForDisplay(result) {
    var lines = [];
    lines.push("═══ COMPILED FIELD NOTES ═══");
    lines.push("");

    if (result.summary) {
      lines.push("SUMMARY:");
      lines.push(result.summary);
      lines.push("");
    }

    if (result.equipmentFindings && result.equipmentFindings.length) {
      lines.push("─── EQUIPMENT FINDINGS ───");
      for (var i = 0; i < result.equipmentFindings.length; i++) {
        var ef = result.equipmentFindings[i];
        lines.push("");
        lines.push("▸ " + (ef.equipment || "Unknown Equipment"));
        if (ef.diagnosis) lines.push("  Diagnosis: " + ef.diagnosis);
        if (ef.measurements) lines.push("  Measurements: " + ef.measurements);
        if (ef.actionsTaken) lines.push("  Actions: " + ef.actionsTaken);
      }
      lines.push("");
    }

    if (result.quoteRecommendations && result.quoteRecommendations.length) {
      lines.push("─── QUOTE RECOMMENDATIONS ───");
      for (var j = 0; j < result.quoteRecommendations.length; j++) {
        var qr = result.quoteRecommendations[j];
        lines.push("  • " + (qr.part || "Item") + (qr.description ? " — " + qr.description : ""));
        if (qr.laborEstimate) lines.push("    Labor: " + qr.laborEstimate);
      }
      lines.push("");
    }

    if (result.unresolvedIssues && result.unresolvedIssues.length) {
      lines.push("─── UNRESOLVED ISSUES ───");
      for (var k = 0; k < result.unresolvedIssues.length; k++) {
        var ui = result.unresolvedIssues[k];
        var sev = ui.severity ? " [" + ui.severity.toUpperCase() + "]" : "";
        lines.push("  ⚠ " + (ui.issue || "Unknown issue") + sev);
        if (ui.notes) lines.push("    " + ui.notes);
      }
      lines.push("");
    }

    if (result.equipmentHistoryUpdates && result.equipmentHistoryUpdates.length) {
      lines.push("─── EQUIPMENT HISTORY UPDATES ───");
      for (var m = 0; m < result.equipmentHistoryUpdates.length; m++) {
        var eh = result.equipmentHistoryUpdates[m];
        lines.push("  • " + (eh.equipment || "Unknown") + ": " + (eh.dataPoints || ""));
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /* ── callCompile (convenience wrapper) ──────────────────────── */

  /**
   * Send a compile prompt to Gemini and return parsed JSON result.
   * @param {string} prompt
   * @param {number} [maxTokens]
   * @returns {Promise<Object>}
   */
  function callCompile(prompt, maxTokens) {
    return window.GeminiClient.callJson(prompt, {
      temperature: 0.2,
      maxOutputTokens: maxTokens || COMPILE_FULL_MAX_TOKENS
    });
  }

  /* ── export ──────────────────────────────────────────────────── */

  window.VCAgents.NotesParser = {
    COMPILE_FULL_MAX_TOKENS: COMPILE_FULL_MAX_TOKENS,
    COMPILE_DELTA_MAX_TOKENS: COMPILE_DELTA_MAX_TOKENS,
    buildCompilePrompt: buildCompilePrompt,
    buildDeltaCompilePrompt: buildDeltaCompilePrompt,
    mergeCompileResults: mergeCompileResults,
    formatCompileResultForDisplay: formatCompileResultForDisplay,
    callCompile: callCompile
  };
})();
