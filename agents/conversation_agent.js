/**
 * Conversation agent — cloud Gemini Q&A, rule-based response generation,
 * and follow-up response parsing.
 *
 * Extracted from conversational_timeline.js (Slices 41d, 43b, 44a).
 * No DOM access — UI rendering stays in conversational_timeline.js.
 *
 * Depends on: window.GeminiClient (gemini_client.js)
 * Exposes:    window.VCAgents.Conversation
 */
(function () {
  "use strict";

  window.VCAgents = window.VCAgents || {};

  var EQUIPMENT_REGEX = /\b(RTU|AHU|FCU|MAU|CU|HP|Unit|Chiller|Boiler)\s*#?\d+/i;

  /* ── askCloudGemini ──────────────────────────────────────────── */

  /**
   * Ask Gemini a field-service question with optional job context.
   * Returns Promise<string> — the AI answer text.
   *
   * @param {string} question
   * @param {Object} [context] - { customerName, address, issue, activeEquipment }
   */
  function askCloudGemini(question, context) {
    var ctx = context || {};
    var contextLines = [];
    if (ctx.customerName) contextLines.push("Customer: " + ctx.customerName);
    if (ctx.address) contextLines.push("Site: " + ctx.address);
    if (ctx.issue) contextLines.push("Issue: " + ctx.issue);
    if (ctx.activeEquipment) contextLines.push("Active equipment: " + ctx.activeEquipment);

    var prompt = "You are a knowledgeable HVAC field service assistant. " +
      "A technician is on-site and has a question. Provide a concise, practical answer.\n\n";
    if (contextLines.length) {
      prompt += "JOB CONTEXT:\n" + contextLines.join("\n") + "\n\n";
    }
    prompt += "QUESTION: " + question + "\n\nAnswer concisely (1-3 sentences):";

    return window.GeminiClient.callText(prompt, {
      temperature: 0.3,
      maxOutputTokens: 512
    });
  }

  /* ── generateResponse (rule-based, no AI) ────────────────────── */

  /**
   * Generate a quick system response for a timeline entry.
   * Pure rule-based — no Gemini call. Returns string or null.
   *
   * @param {Object} entry - timeline entry { text, meta }
   * @param {Object} [opts] - { fromEscalation: boolean }
   * @returns {string|null}
   */
  function generateResponse(entry, opts) {
    if (!entry) return null;
    var options = opts || {};

    if (entry.meta && entry.meta.mediaType) {
      if (entry.meta.mediaType === "video") return "\uD83C\uDFA5 Saved.";
      if (entry.meta.mediaType === "file")  return "\uD83D\uDCC4 File saved.";
      return "\uD83D\uDCF7 Saved.";
    }

    var text = String(entry.text || "").trim();
    if (!text) return null;

    var confidence = (entry.meta && typeof entry.meta.intentConfidence === "number")
      ? entry.meta.intentConfidence
      : 1;

    if (confidence < 0.6 && !options.fromEscalation) {
      return null;
    }

    var match = text.match(EQUIPMENT_REGEX);

    if (confidence >= 0.8) {
      if (match) return "Got it. " + match[0] + ".";
      return "Got it.";
    }

    var entities = (entry.meta && Array.isArray(entry.meta.entities)) ? entry.meta.entities : [];
    var hasEquipment = entities.some(function (e) { return e.type === "equipment"; });
    var hasTemp = entities.some(function (e) { return e.type === "temperature"; });
    var hasAmps = entities.some(function (e) { return e.type === "amp_draw"; });
    var hasPart = entities.some(function (e) { return e.type === "part"; });

    if (!hasEquipment && match) {
      return "Got it. " + match[0] + ".";
    }
    if (!hasEquipment) return "Got it.";
    if (hasPart && !hasAmps && !hasTemp) return "Reading?";
    if (match) return "Got it. " + match[0] + ".";
    return "Got it.";
  }

  /* ── parseFollowUpResponse ───────────────────────────────────── */

  /**
   * Classify a spoken or typed follow-up answer.
   * Returns { type, value? } where type is one of:
   *   "yes" | "no" | "skip" | "correction" | "number" | "equipment" | "text"
   *
   * @param {string} text
   * @returns {{ type: string, value?: string }}
   */
  function parseFollowUpResponse(text) {
    var t = String(text || "").trim().toLowerCase();

    if (/^(yes|yeah|yep|yup|correct|affirmative|that'?s right|confirmed?)$/.test(t)) {
      return { type: "yes" };
    }
    if (/^(no|nope|nah|negative|incorrect)$/.test(t)) {
      return { type: "no" };
    }
    if (/^(skip|next|pass|never ?mind|n\/a|none)$/.test(t)) {
      return { type: "skip" };
    }
    if (/^(correction|correct that|i meant|actually)/.test(t)) {
      return { type: "correction", value: text };
    }

    var eqMatch = String(text).match(EQUIPMENT_REGEX);
    if (eqMatch) {
      return { type: "equipment", value: eqMatch[0] };
    }

    var numMatch = String(text).match(/\b(\d+\.?\d*)\s*(psi|amps?|degrees?|°|rpm|cfm|volts?|watts?|hz|kw|ton|tons?)?\b/i);
    if (numMatch) {
      return { type: "number", value: numMatch[0] };
    }

    return { type: "text", value: text };
  }

  /* ── export ──────────────────────────────────────────────────── */

  window.VCAgents.Conversation = {
    EQUIPMENT_REGEX: EQUIPMENT_REGEX,
    askCloudGemini: askCloudGemini,
    generateResponse: generateResponse,
    parseFollowUpResponse: parseFollowUpResponse
  };
})();
