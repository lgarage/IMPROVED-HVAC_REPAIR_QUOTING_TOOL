/**
 * QuoteDataBuilder agent — parse compiled service report into structured quote_data.
 *
 * Slice 64g: Post-compile quote data extraction.
 * Invoked from conversational_timeline.js after compile when at least one
 * quote-relevant checklist template fired during the session, OR when the
 * compiled result already contains quoteRecommendations (raw-notes path).
 *
 * No DOM access, no state — orchestration remains in conversational_timeline.js.
 * Exposes: window.VCAgents.QuoteDataBuilder
 */
(function () {
  "use strict";

  /**
   * detectEquipmentRef(qr, findings) — match a recommendation to an equipment unit.
   * If there is exactly one finding, use its equipment name. Otherwise try to find
   * a finding whose equipment name appears in the recommendation text.
   */
  function detectEquipmentRef(qr, findings) {
    if (!Array.isArray(findings) || !findings.length) return "";
    if (findings.length === 1) return findings[0].equipment || "";
    var text = ((qr.part || "") + " " + (qr.description || "")).toLowerCase();
    for (var i = 0; i < findings.length; i++) {
      var name = (findings[i].equipment || "").toLowerCase();
      if (name && text.indexOf(name) !== -1) return findings[i].equipment;
    }
    return findings[0].equipment || "";
  }

  /**
   * parseLabor(laborEstimate) — parse a human-readable labor string into hours.
   * Handles: "2 hours", "1.5 hrs", "30 min", "90 minutes", bare numbers.
   * Returns a number (hours) or null if unparseable.
   */
  function parseLabor(laborEstimate) {
    if (laborEstimate === null || laborEstimate === undefined) return null;
    var str = String(laborEstimate).toLowerCase().trim();
    var minMatch = str.match(/(\d+(?:\.\d+)?)\s*min/);
    if (minMatch) return Math.round((parseFloat(minMatch[1]) / 60) * 100) / 100;
    var hrMatch = str.match(/(\d+(?:\.\d+)?)\s*h/);
    if (hrMatch) return parseFloat(hrMatch[1]);
    var numMatch = str.match(/^(\d+(?:\.\d+)?)$/);
    if (numMatch) return parseFloat(numMatch[1]);
    return null;
  }

  /**
   * sumLaborHours(repairs) — sum non-null laborHours values across repairs.
   * Returns the total as a number, or null if no repairs had parseable hours.
   */
  function sumLaborHours(repairs) {
    var total = null;
    (repairs || []).forEach(function (r) {
      if (r.laborHours !== null && r.laborHours !== undefined) {
        total = (total || 0) + r.laborHours;
      }
    });
    return total;
  }

  /**
   * buildQuoteData(compiledText, matchedTemplates, equipmentContext, apiKey, compiledResult)
   *
   * Dual-path quote extraction:
   *   Path A — quote-relevant templates fired → full Gemini extraction (existing behavior).
   *   Path B — no templates but compiledResult.quoteRecommendations present → lightweight
   *             object built directly from the already-structured data (no Gemini call).
   *
   * @param {string} compiledText       - The full compiled service report text
   * @param {Array}  matchedTemplates   - Templates that fired during this session
   *                  Each: { id: string, data: { templateName, quoteRelevant, associatedParts, targetKeyword } }
   * @param {Object} equipmentContext   - { activeEquipment: string, nameplateFields: Object|null }
   * @param {string} apiKey             - Gemini API key
   * @param {Object} [compiledResult]   - Raw JSON object from notes_parser.js
   *                  May contain: quoteRecommendations [{part, description, laborEstimate}]
   *                               equipmentFindings    [{equipment, diagnosis, actionsTaken}]
   * @returns {Promise<Object|null>}
   */
  function buildQuoteData(compiledText, matchedTemplates, equipmentContext, apiKey, compiledResult) {
    if (!compiledText || !apiKey) return Promise.resolve(null);

    var quoteTemplates = (matchedTemplates || []).filter(function (t) {
      return t && t.data && t.data.quoteRelevant;
    });

    // Path B — no templates fired but compiled result already has structured recommendations
    if (!quoteTemplates.length) {
      var recs = compiledResult && Array.isArray(compiledResult.quoteRecommendations)
        ? compiledResult.quoteRecommendations : [];
      if (!recs.length) return Promise.resolve(null);

      var findings = (compiledResult && Array.isArray(compiledResult.equipmentFindings))
        ? compiledResult.equipmentFindings : [];

      var repairs = recs.map(function (qr) {
        return {
          repairType: qr.part || "Repair",
          equipmentRef: detectEquipmentRef(qr, findings),
          laborHours: parseLabor(qr.laborEstimate),
          confirmedParts: [{ description: qr.part || "", specs: qr.description || "" }],
          suggestedParts: [],
          fieldNotes: qr.description || ""
        };
      });

      if (!repairs.length) return Promise.resolve(null);
      return Promise.resolve({ repairs: repairs, totalLaborHours: sumLaborHours(repairs) });
    }

    var templateSummary = quoteTemplates.map(function (t) {
      var parts = (t.data.associatedParts || []).map(function (p) {
        return p.description +
          (p.specs ? " (" + p.specs + ")" : "") +
          " x" + (p.qty || 1) +
          (p.alwaysInclude ? " [always include]" : "");
      }).join(", ");
      return "Template: " + t.data.templateName +
        (parts ? ". Associated parts: " + parts : "");
    }).join("\n");

    var equipment = (equipmentContext && equipmentContext.activeEquipment) || "";
    var nameplate = (equipmentContext && equipmentContext.nameplateFields)
      ? JSON.stringify(equipmentContext.nameplateFields) : "";

    var prompt =
      "You are an HVAC repair quoting assistant. Read this compiled service report " +
      "and extract structured repair data for a quote.\n\n" +
      "COMPILED REPORT:\n" + compiledText + "\n\n" +
      "ACTIVE EQUIPMENT: " + (equipment || "unknown") + "\n" +
      (nameplate ? "NAMEPLATE DATA: " + nameplate + "\n\n" : "\n") +
      "QUOTE-RELEVANT CHECKLIST TEMPLATES THAT FIRED THIS SESSION:\n" + templateSummary + "\n\n" +
      "Instructions:\n" +
      "1. Identify each distinct repair the tech performed or is recommending.\n" +
      "2. For each repair, extract: repairType (descriptive name), equipmentRef (unit name), " +
      "laborHours (number or null if not mentioned), " +
      "confirmedParts (parts the tech explicitly mentioned — array of {description, specs}), " +
      "fieldNotes (brief summary of findings for this repair).\n" +
      "3. For each repair, also include the suggestedParts from the matching template " +
      "(alwaysInclude parts are always in, others are optional suggestions).\n" +
      "4. If NO clear repair work was done or recommended (diagnostic only, no action needed), " +
      'return {"repairs": []}.\n' +
      'Return ONLY valid JSON: {"repairs": [{"repairType": string, "equipmentRef": string, ' +
      '"laborHours": number|null, "confirmedParts": [...], "suggestedParts": [...], ' +
      '"fieldNotes": string}], "totalLaborHours": number|null}';

    return fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        })
      }
    ).then(function (r) {
      return r.json();
    }).then(function (resp) {
      var text = resp &&
        resp.candidates &&
        resp.candidates[0] &&
        resp.candidates[0].content &&
        resp.candidates[0].content.parts &&
        resp.candidates[0].content.parts[0] &&
        resp.candidates[0].content.parts[0].text;
      if (!text) return null;
      var parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.repairs) || !parsed.repairs.length) return null;
      return parsed;
    }).catch(function () {
      return null;
    });
  }

  window.VCAgents = window.VCAgents || {};
  window.VCAgents.QuoteDataBuilder = { buildQuoteData: buildQuoteData };
}());
