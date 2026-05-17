/**
 * NameplateOCR agent — Gemini Vision calls for HVAC nameplate/data-plate
 * analysis. Consolidates vision logic from conversational_timeline.js and
 * equipment_manager.js into one module.
 *
 * No DOM access — UI rendering (confirmation cards, modals) stays in callers.
 *
 * Depends on: window.GeminiClient (gemini_client.js)
 * Exposes:    window.VCAgents.NameplateOCR
 */
(function () {
  "use strict";

  window.VCAgents = window.VCAgents || {};

  /* ── image prep ──────────────────────────────────────────────── */

  /**
   * Read an image File into a base64 data URL, down-scaled to max 1280px
   * on the longest side to keep the payload reasonable for Gemini Vision.
   * @param {File} file
   * @returns {Promise<string|null>} data URL or null on failure
   */
  function fileToClassificationDataUrl(file) {
    return new Promise(function (resolve) {
      try {
        var reader = new FileReader();
        reader.onload = function (e) {
          var img = new Image();
          img.onload = function () {
            try {
              var maxDim = 1280;
              var w = img.width, h = img.height;
              if (w > maxDim || h > maxDim) {
                var ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
              }
              var canvas = document.createElement("canvas");
              canvas.width = w;
              canvas.height = h;
              canvas.getContext("2d").drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL("image/jpeg", 0.85));
            } catch (ex) { resolve(null); }
          };
          img.onerror = function () { resolve(null); };
          img.src = e.target.result;
        };
        reader.onerror = function () { resolve(null); };
        reader.readAsDataURL(file);
      } catch (e) { resolve(null); }
    });
  }

  /**
   * Split a data URL into { base64, mimeType }.
   * If the input has no data: prefix, treats it as raw base64 with image/jpeg.
   */
  function splitDataUrl(dataUrl) {
    var base64 = dataUrl;
    var mimeType = "image/jpeg";
    var prefixMatch = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (prefixMatch) {
      mimeType = prefixMatch[1];
      base64 = dataUrl.slice(prefixMatch[0].length);
    }
    return { base64: base64, mimeType: mimeType };
  }

  /* ── prompts ─────────────────────────────────────────────────── */

  /**
   * Quick nameplate classification prompt (used by conversational_timeline.js
   * for background photo analysis). Returns compact JSON with 5 fields.
   */
  var QUICK_CLASSIFY_PROMPT =
    "Look at this image. If it shows a manufacturer nameplate, data plate, or model label " +
    "for an HVAC unit (RTU, AHU, chiller, boiler, etc.), extract the following fields.\n" +
    "If the image is NOT a nameplate, return all fields as null.\n" +
    'Return ONLY valid JSON:\n' +
    '{ "manufacturer": string|null, "modelNumber": string|null, "serialNumber": string|null, ' +
    '"voltage": string|null, "tonnage": string|null }';

  /**
   * Full data-plate OCR prompt (used by equipment_manager.js for detailed
   * plate analysis including manufacture year, tonnage decoding, etc.).
   */
  function buildFullPlatePrompt() {
    return [
      "You are an expert HVAC equipment data-plate OCR assistant.",
      "Analyze the image and extract ONLY what is visible. Return a single JSON object (no markdown) with these keys:",
      "brand (string), model (string), serial (string), voltage (string), phase (string), refrigerant (string), unitTag (string, e.g. RTU-2 or PRV-3 if shown),",
      "tonnageNumeric (number or null) — cooling/heating tonnage decoded from the model number if present,",
      "manufactureYear (number or null) — Priority order: (1) If the nameplate prints an explicit manufacture/build date (e.g. DATE OF MFG., MFG DATE, BUILT, DOM), read that and output the 4-digit year. For values like \"3.24\" or \"2-26\" interpret as month-year in Western order (March 2024 → 2024); never substitute digits from the serial for this. (2) Only if no printed date exists on the plate: try the manufacturer's serial/letter date-code rules. (3) If uncertain, null. Do not derive year from unrelated lines (QR text, unrelated numbers).",
      "ageYears (number or null) — years from manufactureYear to the current calendar year only if manufactureYear is known, else null,",
      "serialDateNotes (string) — quote the exact label text used for the date (e.g. \"DATE OF MFG.: 3.24 → 2024\") or explain that serial-only decoding was used and why.",
      "If a field is not on the plate, use empty string or null. Be conservative; do not invent model numbers from address text.",
    ].join(" ");
  }

  /* ── classify functions ──────────────────────────────────────── */

  /**
   * Quick nameplate classify — lightweight check if a photo contains a
   * nameplate. Returns { manufacturer, modelNumber, serialNumber, voltage,
   * tonnage } or null if not a nameplate / on failure.
   *
   * Used by conversational_timeline.js background photo analysis.
   *
   * @param {string} dataUrl - full data URL (data:image/...;base64,...)
   * @returns {Promise<Object|null>}
   */
  function classifyNameplate(dataUrl) {
    var parts = splitDataUrl(dataUrl);

    return window.GeminiClient.callVisionJson(
      QUICK_CLASSIFY_PROMPT,
      parts.base64,
      parts.mimeType,
      {
        temperature: 0.2,
        maxOutputTokens: 512,
        model: "gemini-2.0-flash",
        systemPrompt: "You are an HVAC unit data extraction assistant."
      }
    ).then(function (parsed) {
      if (!parsed.modelNumber && !parsed.serialNumber) return null;
      return parsed;
    }).catch(function () { return null; });
  }

  /**
   * Full data-plate OCR — detailed extraction for equipment_manager.js.
   * Returns the full plate data object or throws on failure.
   *
   * @param {string} base64Data - raw base64 image data (no data: prefix)
   * @param {string} [mimeType] - default "image/jpeg"
   * @returns {Promise<Object>}
   */
  function ocrDataPlate(base64Data, mimeType) {
    return window.GeminiClient.callVisionJson(
      buildFullPlatePrompt(),
      base64Data,
      mimeType || "image/jpeg",
      { temperature: 0.2, maxOutputTokens: 2048 }
    );
  }

  /**
   * Raw vision call — for equipment_manager.js callers that supply their
   * own prompt (e.g. dictation plate OCR). Returns raw text.
   *
   * @param {string} base64Data
   * @param {string} mimeType
   * @param {string} promptText
   * @returns {Promise<string>}
   */
  function callVisionRaw(base64Data, mimeType, promptText) {
    return window.GeminiClient.callVision(
      promptText,
      base64Data,
      mimeType || "image/jpeg",
      { temperature: 0.2, maxOutputTokens: 2048 }
    );
  }

  /* ── export ──────────────────────────────────────────────────── */

  window.VCAgents.NameplateOCR = {
    fileToClassificationDataUrl: fileToClassificationDataUrl,
    classifyNameplate: classifyNameplate,
    ocrDataPlate: ocrDataPlate,
    callVisionRaw: callVisionRaw,
    buildFullPlatePrompt: buildFullPlatePrompt
  };
})();
