/**
 * Checklist Intent Agent — AI-powered checklist suggestion from tech chat.
 *
 * Listens to tech messages and uses Gemini to detect whether the tech's
 * statement implies a specific repair checklist should be opened. Fires
 * asynchronously (non-blocking) after each tech entry.
 *
 * Depends on: window.GeminiClient (gemini_client.js)
 *             window.getActiveFormTemplates (field_forms.js)
 *             window.renderDynamicForm (field_forms.js)
 * Exposes:    window.VCAgents.ChecklistIntent
 */
(function () {
  "use strict";

  window.VCAgents = window.VCAgents || {};

  var _lastSuggestionTemplateId = null;
  var _lastSuggestionTime = 0;
  var DEDUP_WINDOW_MS = 5 * 60 * 1000;

  /**
   * detectChecklist — core AI call.
   * Given a tech message, asks Gemini which (if any) available checklist
   * matches the intent. Returns Promise<{templateId, templateName} | null>.
   */
  function detectChecklist(techMessage) {
    var text = String(techMessage || "").trim();
    if (!text || text.length < 5) return Promise.resolve(null);

    if (typeof window.getActiveFormTemplates !== "function") {
      return Promise.resolve(null);
    }
    if (!window.GeminiClient || typeof window.GeminiClient.callText !== "function") {
      return Promise.resolve(null);
    }

    return window.getActiveFormTemplates().then(function (templates) {
      if (!templates || !templates.length) return null;

      var catalog = [];
      for (var i = 0; i < templates.length; i++) {
        var t = templates[i];
        var d = t.data || t;
        var cat = String(d.formCategory || "").toLowerCase();
        if (cat === "service_call" || cat === "quote") continue;
        var triggers = Array.isArray(d.triggerWords) && d.triggerWords.length
          ? d.triggerWords
          : [d.targetKeyword || ""];
        catalog.push({
          id: t.id,
          name: String(d.templateName || t.id),
          triggerWords: triggers
        });
      }
      if (!catalog.length) return null;

      var keywordList = catalog.map(function (c) {
        return c.name + " [" + c.triggerWords.join(", ") + "]";
      }).join("\n");

      var prompt =
        "A technician just said: " + JSON.stringify(text) + "\n\n" +
        "Available repair checklists:\n" + keywordList + "\n\n" +
        "Is the technician diagnosing, repairing, or replacing something " +
        "that matches one of these checklists? Casual mentions like " +
        "\"checked the fan\" or \"looked at the unit\" do NOT count.\n\n" +
        "Reply with ONLY the exact checklist name if there is a match, " +
        "or NONE if no match. One word/phrase only, no explanation.";

      return window.GeminiClient.callText(prompt, {
        temperature: 0.1,
        maxOutputTokens: 64
      }).then(function (raw) {
        var answer = String(raw || "").trim()
          .replace(/^["'`]+/, "").replace(/["'`]+$/, "")
          .replace(/^\*+/, "").replace(/\*+$/, "")
          .trim();
        if (!answer || answer.toUpperCase() === "NONE") return null;

        var answerLower = answer.toLowerCase();
        var matched = null;
        for (var j = 0; j < catalog.length; j++) {
          var c = catalog[j];
          var cName = c.name.toLowerCase();
          if (answerLower === cName || answerLower.indexOf(cName) >= 0 || cName.indexOf(answerLower) >= 0) {
            matched = c;
            break;
          }
          for (var k = 0; k < c.triggerWords.length; k++) {
            var tw = String(c.triggerWords[k]).toLowerCase();
            if (answerLower === tw || answerLower.indexOf(tw) >= 0 || tw.indexOf(answerLower) >= 0) {
              matched = c;
              break;
            }
          }
          if (matched) break;
        }
        if (!matched) return null;

        return { templateId: matched.id, templateName: matched.name };
      });
    }).catch(function () {
      return null;
    });
  }

  /**
   * suggestFromEntry — called from processEntry after each tech message.
   * Fires Gemini in the background; if a match is found, injects a
   * suggestion chip into the chat via the provided callback.
   *
   * @param {string} text — the tech's raw message
   * @param {string} ticketId — current ticket
   * @param {function} addEntryCb — addEntry(html, "system", ticketId, meta)
   */
  function suggestFromEntry(text, ticketId, addEntryCb) {
    if (typeof addEntryCb !== "function") return;

    detectChecklist(text).then(function (result) {
      if (!result) return;

      if (
        result.templateId === _lastSuggestionTemplateId &&
        (Date.now() - _lastSuggestionTime) < DEDUP_WINDOW_MS
      ) {
        return;
      }

      _lastSuggestionTemplateId = result.templateId;
      _lastSuggestionTime = Date.now();

      var safeId = String(result.templateId).replace(/[^a-zA-Z0-9_-]/g, "");
      var safeName = String(result.templateName)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

      var html =
        '<div class="ct-checklist-suggest" data-template-id="' + safeId + '">' +
          '<div class="ct-checklist-suggest__icon">\uD83D\uDCCB</div>' +
          '<div class="ct-checklist-suggest__body">' +
            '<div class="ct-checklist-suggest__label">Suggested checklist</div>' +
            '<div class="ct-checklist-suggest__name">' + safeName + '</div>' +
          '</div>' +
          '<button class="ct-checklist-suggest__btn" ' +
            'onclick="if(typeof renderDynamicForm===\'function\')renderDynamicForm(\'' + safeId + '\')">' +
            'Open' +
          '</button>' +
        '</div>';

      addEntryCb(html, "system", ticketId, { isHtml: true, checklistSuggestion: true });
    }).catch(function () {
      /* swallow — best-effort enrichment */
    });
  }

  /**
   * resetDedup — clear dedup state (e.g. when switching tickets).
   */
  function resetDedup() {
    _lastSuggestionTemplateId = null;
    _lastSuggestionTime = 0;
  }

  window.VCAgents.ChecklistIntent = {
    detectChecklist: detectChecklist,
    suggestFromEntry: suggestFromEntry,
    resetDedup: resetDedup
  };
})();
