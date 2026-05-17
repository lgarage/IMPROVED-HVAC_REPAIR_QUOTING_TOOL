/**
 * LocationParts agent — AI-powered location and parts parsing for the
 * field app ticket intake forms.
 *
 * Extracted from inline <script> in technician/index.html.
 * Pure AI parsing — DOM wiring (saveDraft, autoGrow, field reads) stays
 * in index.html which calls these functions and handles the result.
 *
 * Depends on: window.GeminiClient (gemini_client.js)
 * Exposes:    window.VCAgents.LocationParts
 */
(function () {
  "use strict";

  window.VCAgents = window.VCAgents || {};

  /* ── parseLocation ───────────────────────────────────────────── */

  /**
   * Parse a spoken/typed location string into structured { business, city, street }.
   * Returns Promise<{ business, city, street }|null>.
   * Returns null if Gemini is unavailable or the response can't be parsed.
   *
   * @param {string} rawText - raw technician input (e.g. "Planet Fitness Dallas on Main Street")
   * @returns {Promise<{ business: string, city: string, street: string }|null>}
   */
  function parseLocation(rawText) {
    if (!rawText || !rawText.trim()) return Promise.resolve(null);

    var prompt =
      "You are a strict data extraction AI for an HVAC dispatch system.\n" +
      "Extract the Business Name, City, and Street from the technician's spoken text.\n\n" +
      "RULES:\n" +
      "1. ONLY use the information provided in the input text. DO NOT invent cities or names.\n" +
      "2. Identify the Business, City, and Street, REGARDLESS of the order they are spoken.\n" +
      "3. IGNORE conversational filler.\n" +
      "4. STRIP leading articles like \"A\", \"AN\", or \"THE\" from the Business Name.\n" +
      "5. Map the extracted entities to a JSON object with EXACTLY these keys: \"business\", \"city\", \"street\".\n" +
      "6. Abbreviate street types standardly.\n" +
      "7. If a piece of information is missing entirely, leave its value as an empty string \"\".\n\n" +
      "Text: \"" + rawText + "\"\nOutput:";

    return window.GeminiClient.callJson(prompt, {
      temperature: 0.0
    }).then(function (data) {
      if (!data) return null;
      return {
        business: String(data.business || "").toUpperCase().trim(),
        city: String(data.city || "").toUpperCase().trim(),
        street: String(data.street || "").toUpperCase().trim()
      };
    }).catch(function () { return null; });
  }

  /* ── parseParts ──────────────────────────────────────────────── */

  /**
   * Parse a spoken/typed parts list into a structured array of "QTY - PART" strings.
   * Returns Promise<string[]|null>.
   * Returns null if Gemini is unavailable or the response can't be parsed.
   *
   * @param {string} rawText       - raw technician dictation
   * @param {Array<string>} knownFilters - valid filter sizes array
   * @param {Array<string>} knownBelts   - valid belt sizes array
   * @returns {Promise<string[]|null>}
   */
  function parseParts(rawText, knownFilters, knownBelts) {
    if (!rawText || !rawText.trim()) return Promise.resolve(null);

    var filterList = (knownFilters || []).join(", ");
    var beltList = (knownBelts || []).join(", ");

    var prompt =
      "You are a strict data extraction AI for an HVAC dispatch system.\n" +
      "The technician dictated a list of HVAC parts into their phone, resulting in a run-on sentence without commas.\n" +
      "Your job is to identify each distinct part and its quantity, and output them as a JSON array of strings.\n\n" +
      "KNOWN INVENTORY:\n" +
      "Valid Filters: " + filterList + "\n" +
      "Valid Belts: " + beltList + "\n\n" +
      "RULES:\n" +
      "1. Convert spelled-out numbers (\"one\", \"two\", \"to\", \"six\") into digits (1, 2, 6).\n" +
      "2. Format filter sizes as NumXNumXNum. If the dictation is slightly garbled, snap it to the closest match in the Valid Filters list.\n" +
      "3. Format belt sizes with NO spaces. Snap to the closest match in the Valid Belts list.\n" +
      "4. Remove the words \"filter\", \"filters\", \"belt\", and \"belts\" from the output string.\n" +
      "5. Each string in the JSON array must follow the exact format: \"QTY - PART_NAME\" (e.g., \"2 - 14X20X2\").\n" +
      "6. Output ONLY the raw JSON array format. No backticks, no markdown.\n\n" +
      "Text: \"" + rawText + "\"\nOutput:";

    return window.GeminiClient.callJson(prompt, {
      temperature: 0.0
    }).then(function (data) {
      if (!Array.isArray(data) || !data.length) return null;
      return data;
    }).catch(function () { return null; });
  }

  /* ── export ──────────────────────────────────────────────────── */

  window.VCAgents.LocationParts = {
    parseLocation: parseLocation,
    parseParts: parseParts
  };
})();
