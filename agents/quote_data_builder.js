/**
 * QuoteDataBuilder agent — parse compiled service report into structured quote_data.
 *
 * Slice 64g: Post-compile quote data extraction.
 * Invoked from conversational_timeline.js after compile when at least one
 * quote-relevant checklist template fired during the session.
 *
 * No DOM access, no state — orchestration remains in conversational_timeline.js.
 * Exposes: window.VCAgents.QuoteDataBuilder
 */
(function () {
  "use strict";

  /**
   * buildQuoteData(compiledText, matchedTemplates, equipmentContext, apiKey)
   *
   * Uses Gemini to parse the compiled service report and extract repair-related data.
   * Returns a Promise resolving to a quote_data object or null if no repairs detected.
   *
   * @param {string} compiledText       - The full compiled service report text
   * @param {Array}  matchedTemplates   - Templates that fired during this session
   *                  Each: { id: string, data: { templateName, quoteRelevant, associatedParts, targetKeyword } }
   * @param {Object} equipmentContext   - { activeEquipment: string, nameplateFields: Object|null }
   * @param {string} apiKey             - Gemini API key
   * @returns {Promise<Object|null>}
   */
  function buildQuoteData(compiledText, matchedTemplates, equipmentContext, apiKey) {
    if (!compiledText || !apiKey) return Promise.resolve(null);

    var quoteTemplates = (matchedTemplates || []).filter(function (t) {
      return t && t.data && t.data.quoteRelevant;
    });
    if (!quoteTemplates.length) return Promise.resolve(null);

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
