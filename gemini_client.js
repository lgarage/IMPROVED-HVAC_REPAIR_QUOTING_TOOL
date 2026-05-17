/**
 * GeminiClient — shared Gemini API wrapper for the Vertex-Core field app.
 *
 * Consolidates 4+ independent fetch implementations across the codebase into
 * one reusable client. Depends on firebase-config.js globals:
 *   - getGeminiApiKey()       (async, returns cached API key from Firestore)
 *   - GEMINI_GENERATE_MODEL   (string, e.g. "gemini-2.5-flash")
 *
 * Exposes: window.GeminiClient
 */
(function () {
  "use strict";

  var GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
  var DEFAULT_FALLBACK_MODEL = "gemini-2.5-flash";

  /* ── helpers ──────────────────────────────────────────────────── */

  function getModel(override) {
    if (override) return override;
    if (typeof GEMINI_GENERATE_MODEL !== "undefined" && GEMINI_GENERATE_MODEL) {
      return GEMINI_GENERATE_MODEL;
    }
    return DEFAULT_FALLBACK_MODEL;
  }

  function parseJsonResponse(raw) {
    var t = String(raw || "").trim();
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try { return JSON.parse(t); } catch (e) { return null; }
  }

  function ensureApiKey() {
    if (typeof getGeminiApiKey !== "function") {
      return Promise.reject(new Error("Gemini API key loader not available"));
    }
    return getGeminiApiKey().then(function (key) {
      if (!key) throw new Error("No Gemini API key configured");
      return key;
    });
  }

  function buildUrl(model, key) {
    return GEMINI_API_BASE + encodeURIComponent(model) +
      ":generateContent?key=" + encodeURIComponent(key);
  }

  function extractText(data) {
    var part =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0];
    return (part && part.text) ? String(part.text).trim() : "";
  }

  function handleResponseError(resp) {
    if (resp.ok) return resp.json();
    return resp.text().then(function (errBody) {
      var reason = "";
      try {
        var parsed = JSON.parse(errBody);
        var errObj = parsed && parsed.error;
        if (errObj) reason = " — " + (errObj.status || "") + ": " + (errObj.message || "");
      } catch (e) { reason = errBody ? " — " + errBody.slice(0, 200) : ""; }
      throw new Error("Gemini API error: " + resp.status + reason);
    });
  }

  /* ── core request builder ────────────────────────────────────── */

  /**
   * Low-level Gemini API call. Returns Promise<string> (raw text from first candidate).
   *
   * @param {Object} opts
   * @param {Array}  opts.contents        - Gemini contents array
   * @param {number} [opts.temperature]   - 0.0–1.0 (default 0.2)
   * @param {number} [opts.maxOutputTokens] - default 2048
   * @param {boolean} [opts.jsonMode]     - set responseMimeType to application/json
   * @param {string} [opts.model]         - model override
   * @param {string} [opts.systemPrompt]  - optional system instruction text
   */
  function callRaw(opts) {
    return ensureApiKey().then(function (key) {
      var model = getModel(opts.model);
      var url = buildUrl(model, key);

      var body = { contents: opts.contents };

      var genConfig = {};
      genConfig.temperature = (typeof opts.temperature === "number") ? opts.temperature : 0.2;
      genConfig.maxOutputTokens = opts.maxOutputTokens || 2048;
      if (opts.jsonMode) genConfig.responseMimeType = "application/json";
      body.generationConfig = genConfig;

      if (opts.systemPrompt) {
        body.systemInstruction = { parts: [{ text: opts.systemPrompt }] };
      }

      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(handleResponseError).then(extractText);
    });
  }

  /* ── public API ──────────────────────────────────────────────── */

  /**
   * Text-only Gemini call. Returns Promise<string>.
   * @param {string} prompt
   * @param {Object} [opts] - { temperature, maxOutputTokens, model, systemPrompt }
   */
  function callText(prompt, opts) {
    var o = opts || {};
    return callRaw({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      temperature: o.temperature,
      maxOutputTokens: o.maxOutputTokens,
      model: o.model,
      systemPrompt: o.systemPrompt
    });
  }

  /**
   * Text-only Gemini call expecting JSON. Returns Promise<Object>.
   * Sends responseMimeType: "application/json" and parses the response.
   * @param {string} prompt
   * @param {Object} [opts] - { temperature, maxOutputTokens, model, systemPrompt }
   */
  function callJson(prompt, opts) {
    var o = opts || {};
    return callRaw({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      temperature: o.temperature,
      maxOutputTokens: o.maxOutputTokens,
      jsonMode: true,
      model: o.model,
      systemPrompt: o.systemPrompt
    }).then(function (raw) {
      var parsed = parseJsonResponse(raw);
      if (!parsed) throw new Error("Failed to parse Gemini JSON response\n\nRaw:\n" + raw.slice(0, 500));
      return parsed;
    });
  }

  /**
   * Vision Gemini call (image + text). Returns Promise<string>.
   * @param {string} prompt     - text prompt
   * @param {string} base64Data - base64-encoded image (no data: prefix)
   * @param {string} [mimeType] - default "image/jpeg"
   * @param {Object} [opts]     - { temperature, maxOutputTokens, model, systemPrompt }
   */
  function callVision(prompt, base64Data, mimeType, opts) {
    var o = opts || {};
    return callRaw({
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }
        ]
      }],
      temperature: o.temperature,
      maxOutputTokens: o.maxOutputTokens,
      model: o.model,
      systemPrompt: o.systemPrompt
    });
  }

  /**
   * Vision Gemini call expecting JSON. Returns Promise<Object>.
   * @param {string} prompt
   * @param {string} base64Data
   * @param {string} [mimeType]
   * @param {Object} [opts]
   */
  function callVisionJson(prompt, base64Data, mimeType, opts) {
    var o = opts || {};
    return callRaw({
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }
        ]
      }],
      temperature: o.temperature,
      maxOutputTokens: o.maxOutputTokens,
      jsonMode: true,
      model: o.model,
      systemPrompt: o.systemPrompt
    }).then(function (raw) {
      var parsed = parseJsonResponse(raw);
      if (!parsed) throw new Error("Failed to parse Gemini Vision JSON\n\nRaw:\n" + raw.slice(0, 500));
      return parsed;
    });
  }

  /* ── export ──────────────────────────────────────────────────── */

  window.GeminiClient = {
    getModel: getModel,
    parseJsonResponse: parseJsonResponse,
    callText: callText,
    callJson: callJson,
    callVision: callVision,
    callVisionJson: callVisionJson
  };
})();
