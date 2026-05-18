/**
 * Admin Conversation Engine — Gemini-driven checklist builder agent.
 *
 * Phase 66 / Slice 66b
 *
 * Handles all workspace input when localStorage 'vc_admin_session' === '1'.
 * Guides the admin through creating or updating form_templates via a
 * stateful conversation driven by Gemini intent classification.
 *
 * Depends on: window.GeminiClient (gemini_client.js), firebase (firestore-compat)
 * Exposes: window.VCAdminAgent.{ processAdminEntry, getAdminDraftTemplate, resetAdminSession }
 */
(function () {
  "use strict";

  window.VCAdminAgent = window.VCAdminAgent || {};

  /* ── private state ───────────────────────────────────────────── */

  var _state = "idle";          // idle | collecting | confirming
  var _intent = null;           // "create" | "update"
  var _draft = null;            // in-progress template object
  var _updateTargetId = null;   // docId when updating an existing template

  /* ── private helpers ─────────────────────────────────────────── */

  function slugField(label) {
    return String(label || "").trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field";
  }

  function formatDraftStepList(fields) {
    if (!fields || !fields.length) return "(no steps yet)";
    return fields.map(function (f, i) {
      return (i + 1) + ". " + f.label;
    }).join("\n");
  }

  function blankDraft() {
    return {
      templateName: "",
      targetKeyword: "",
      triggerWords: [],
      fields: [],
      active: true,
      formCategory: "general",
      assignedJobTypes: [],
      assignedRepairTypes: [],
      isDefault: false,
      sortIndex: 0,
      quoteRelevant: false,
      associatedParts: []
    };
  }

  /* ── buildAdminPreviewBubble stub (filled in by 66d) ─────────── */

  function buildAdminPreviewBubble(d) {
    return "<div>Preview coming in 66d</div>";
  }

  /* ── askAdminGemini ──────────────────────────────────────────── */

  function askAdminGemini(prompt) {
    return window.GeminiClient.callText(prompt, {
      temperature: 0.2,
      maxOutputTokens: 512
    });
  }

  /* ── classifyAdminIntent ─────────────────────────────────────── */

  function classifyAdminIntent(text) {
    var prompt =
      'You are classifying an HVAC service management command. Respond with JSON only.\n' +
      'Input: "' + text.replace(/"/g, '\\"') + '"\n' +
      'Classify into one of: CREATE_CHECKLIST, UPDATE_CHECKLIST, ADD_STEP, REMOVE_STEP, ' +
      'SET_TRIGGER, PREVIEW, CONFIRM_SAVE, CANCEL, QUERY, UNKNOWN.\n' +
      'Also extract: { templateName, triggerWord, steps: string[], fieldToAdd, fieldToRemove }\n' +
      'Response format: { "intent": string, "templateName": string|null, "triggerWord": string|null, ' +
      '"steps": string[]|null, "fieldToAdd": string|null, "fieldToRemove": string|null }';

    return askAdminGemini(prompt).then(function (raw) {
      try {
        // Strip markdown code fences if present
        var cleaned = String(raw || "").trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "");
        // Extract outermost JSON object as fallback
        var brace = cleaned.indexOf("{");
        var lastBrace = cleaned.lastIndexOf("}");
        if (brace !== -1 && lastBrace !== -1) {
          cleaned = cleaned.slice(brace, lastBrace + 1);
        }
        return JSON.parse(cleaned);
      } catch (e) {
        return { intent: "UNKNOWN" };
      }
    }).catch(function () {
      return { intent: "UNKNOWN" };
    });
  }

  /* ── step → field object ─────────────────────────────────────── */

  function stepToField(label) {
    return {
      label: String(label).trim(),
      type: "checkbox",
      name: slugField(label),
      required: false
    };
  }

  /* ── state machine ───────────────────────────────────────────── */

  function handleIdle(cls, text) {
    var intent = cls.intent;

    if (intent === "CREATE_CHECKLIST") {
      _state = "collecting";
      _intent = "create";
      _draft = blankDraft();

      if (cls.templateName) {
        _draft.templateName = cls.templateName;
      }
      if (cls.triggerWord) {
        _draft.targetKeyword = cls.triggerWord.toLowerCase().trim();
        _draft.triggerWords = [_draft.targetKeyword];
      } else if (_draft.templateName) {
        // derive a default trigger from the name
        _draft.targetKeyword = _draft.templateName.toLowerCase().trim();
        _draft.triggerWords = [_draft.targetKeyword];
      }
      if (Array.isArray(cls.steps) && cls.steps.length) {
        cls.steps.forEach(function (s) {
          if (s && String(s).trim()) {
            _draft.fields.push(stepToField(s));
          }
        });
      }

      var name = _draft.templateName || "(unnamed)";
      var reply = "Got it — starting a \"" + name + "\" checklist.";
      if (_draft.fields.length) {
        reply += " I captured " + _draft.fields.length + " step(s):\n" + formatDraftStepList(_draft.fields);
        reply += "\n\nAnything else to add, or say done to review.";
      } else {
        reply += " What steps should the tech complete? List them one by one or all at once.";
      }
      return Promise.resolve(reply);
    }

    if (intent === "UPDATE_CHECKLIST") {
      _state = "collecting";
      _intent = "update";
      var name = cls.templateName || "";
      if (!name) {
        return Promise.resolve(
          "Which template would you like to update? Please include the name."
        );
      }
      return firebase.firestore()
        .collection("form_templates")
        .where("templateName", "==", name)
        .limit(1)
        .get()
        .then(function (snap) {
          if (snap.empty) {
            _state = "idle";
            _intent = null;
            return "I couldn't find a template called \"" + name + "\" — check the name and try again.";
          }
          var doc = snap.docs[0];
          _draft = Object.assign(blankDraft(), doc.data());
          _updateTargetId = doc.id;
          return "Found \"" + name + "\". Current steps:\n" +
            formatDraftStepList(_draft.fields) +
            "\n\nWhat would you like to change?";
        })
        .catch(function (e) {
          _state = "idle";
          _intent = null;
          return "Error looking up template: " + (e && e.message ? e.message : String(e));
        });
    }

    if (intent === "QUERY") {
      var qPrompt =
        "You are an expert HVAC service manager assistant. " +
        "Answer the following question concisely:\n\n" + text;
      return askAdminGemini(qPrompt);
    }

    return Promise.resolve(
      "Admin mode active. You can say:\n" +
      "\u2022 \"Create a supply fan motor checklist\"\n" +
      "\u2022 \"Update the belt replacement checklist\"\n" +
      "\u2022 \"What templates are there?\""
    );
  }

  function handleCollecting(cls, text) {
    var intent = cls.intent;

    if (intent === "ADD_STEP" && cls.fieldToAdd) {
      _draft.fields.push(stepToField(cls.fieldToAdd));
      return Promise.resolve(
        "Added that step. Current steps:\n" +
        formatDraftStepList(_draft.fields) +
        "\n\nAnything else to add?"
      );
    }

    if (intent === "REMOVE_STEP" && cls.fieldToRemove) {
      var target = String(cls.fieldToRemove).toLowerCase();
      _draft.fields = _draft.fields.filter(function (f) {
        return f.label.toLowerCase().indexOf(target) === -1;
      });
      return Promise.resolve(
        "Removed that step. Current steps:\n" + formatDraftStepList(_draft.fields)
      );
    }

    if (intent === "SET_TRIGGER" && cls.triggerWord) {
      _draft.targetKeyword = cls.triggerWord.toLowerCase().trim();
      _draft.triggerWords = [_draft.targetKeyword];
      return Promise.resolve(
        "Got it — trigger word set to \"" + _draft.targetKeyword + "\"."
      );
    }

    if (intent === "CREATE_CHECKLIST") {
      if (cls.templateName) {
        _draft.templateName = cls.templateName;
      }
      if (Array.isArray(cls.steps) && cls.steps.length) {
        var added = 0;
        cls.steps.forEach(function (s) {
          if (s && String(s).trim()) {
            _draft.fields.push(stepToField(s));
            added++;
          }
        });
        return Promise.resolve(
          "Added " + added + " step(s). Total steps: " + _draft.fields.length + "\n" +
          formatDraftStepList(_draft.fields) +
          "\n\nAnything else to add, or say done to review."
        );
      }
    }

    if (intent === "PREVIEW") {
      return Promise.resolve({ type: "preview", html: buildAdminPreviewBubble(_draft) });
    }

    if (intent === "CONFIRM_SAVE") {
      _state = "confirming";
      return Promise.resolve(buildConfirmationSummary());
    }

    if (intent === "CANCEL") {
      _state = "idle";
      _intent = null;
      _draft = null;
      _updateTargetId = null;
      return Promise.resolve("Cancelled. What would you like to do?");
    }

    // UNKNOWN or other: treat as a step if >=3 words
    var words = text.trim().split(/\s+/);
    if (words.length >= 3) {
      _draft.fields.push(stepToField(text.trim()));
      return Promise.resolve(
        "Added that step. Current steps:\n" +
        formatDraftStepList(_draft.fields) +
        "\n\nAnything else to add?"
      );
    }

    // Gemini follow-up question
    var followPrompt =
      "You are helping an HVAC manager build a checklist. " +
      "The admin said: \"" + text.replace(/"/g, '\\"') + "\". " +
      "The draft template so far: " + JSON.stringify(_draft) + ". " +
      "Reply with one short follow-up question to collect missing info.";
    return askAdminGemini(followPrompt);
  }

  function handleConfirming(cls, text) {
    var intent = cls.intent;

    if (intent === "CONFIRM_SAVE") {
      // 66c will implement this
      return Promise.resolve("Save logic coming in 66c.");
    }

    if (intent === "CANCEL") {
      _state = "idle";
      _intent = null;
      _draft = null;
      _updateTargetId = null;
      return Promise.resolve("Cancelled. What would you like to do?");
    }

    // Anything else — re-show confirmation
    return Promise.resolve(
      buildConfirmationSummary() +
      "\n\nSay confirm to save or tell me what to change."
    );
  }

  function buildConfirmationSummary() {
    if (!_draft) return "No draft in progress.";
    return (
      "Here\u2019s what I\u2019ll save:\n" +
      "  Name: " + (_draft.templateName || "(unnamed)") + "\n" +
      "  Trigger word: " + (_draft.targetKeyword || "(none set)") + "\n" +
      "  Steps:\n" +
      formatDraftStepList(_draft.fields).split("\n").map(function (l) {
        return "  " + l;
      }).join("\n") +
      "\n\nSay confirm to save, or tell me what to change."
    );
  }

  /* ── processAdminEntry — main entry point ────────────────────── */

  function processAdminEntry(text) {
    var t = String(text || "").trim();
    if (!t) return Promise.resolve("I didn\u2019t catch that. Try again.");

    return classifyAdminIntent(t).then(function (cls) {
      if (_state === "idle") {
        return handleIdle(cls, t);
      }
      if (_state === "collecting") {
        return handleCollecting(cls, t);
      }
      if (_state === "confirming") {
        return handleConfirming(cls, t);
      }
      return Promise.resolve("Admin mode active. How can I help?");
    });
  }

  /* ── exports ─────────────────────────────────────────────────── */

  window.VCAdminAgent.processAdminEntry = processAdminEntry;

  window.VCAdminAgent.getAdminDraftTemplate = function () {
    return _draft;
  };

  window.VCAdminAgent.resetAdminSession = function () {
    _state = "idle";
    _intent = null;
    _draft = null;
    _updateTargetId = null;
  };

})();
