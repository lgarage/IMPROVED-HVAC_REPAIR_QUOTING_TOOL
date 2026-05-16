(function () {
  "use strict";

  var DICTIONARY = [
    ["cat pastor", "capacitor"],
    ["cat pastors", "capacitor"],
    ["cat postor", "capacitor"],
    ["capcitor", "capacitor"],
    ["capacitar", "capacitor"],
    ["capactor", "capacitor"],
    ["capicitor", "capacitor"],
    ["compressor pack", "compressor"],
    ["compress her", "compressor"],
    ["compresser", "compressor"],
    ["comprssr", "compressor"],
    ["com pressure", "compressor"],
    ["motorr", "motor"],
    ["moter", "motor"],
    ["mo tor", "motor"],
    ["contactor", "contactor"],
    ["contacter", "contactor"],
    ["contactorr", "contactor"],
    ["contact her", "contactor"],
    ["relayr", "relay"],
    ["relly", "relay"],
    ["relayer", "relay"],
    ["shive", "sheave"],
    ["shiv", "sheave"],
    ["shev", "sheave"],
    ["bel t", "belt"],
    ["bilt", "belt"],
    ["filtar", "filter"],
    ["filterr", "filter"],
    ["micro farad", "microfarad"],
    ["microfard", "microfarad"],
    ["mcfarad", "microfarad"],
    ["mike farad", "microfarad"],
    ["mc ferry", "microfarad"],
    ["colonizer", "economizer"],
    ["colanizer", "economizer"],
    ["econolizer", "economizer"],
    ["ec o nomizer", "economizer"],
    ["eco nizer", "economizer"],
    ["connector fan", "condenser fan"],
    ["condensor fan", "condenser fan"],
    ["condenserf an", "condenser fan"],
    ["condensor", "condenser"],
    ["condenserd", "condenser"]
  ];

  var EQUIPMENT_REGEX = /\b(?:RTU|AHU|FCU|MAU|Unit)\s*[#-]?\s*\d+\b/gi;
  var TEMP_SUFFIX_REGEX = /\b(\d{1,3}(?:\.\d{1,2})?)\s*(?:°\s*[CF]|degrees?\b(?:\s*[CF])?|deg\b(?:\s*[CF])?)/gi;
  var TEMP_PREFIX_REGEX = /\b(?:supply|return|temp(?:erature)?)\b[^0-9A-Za-z]{0,12}(\d{1,3}(?:\.\d{1,2})?)(?:\s*(?:°\s*[CF]|degrees?\b(?:\s*[CF])?|deg\b(?:\s*[CF])?))?/gi;
  var AMP_SUFFIX_REGEX = /\b(\d{1,4}(?:\.\d{1,2})?)\s*(?:amps?|A)\b/gi;
  var AMP_PREFIX_REGEX = /\b(?:amps?|draw(?:s|n)?|current)\b[^0-9A-Za-z]{0,10}(\d{1,4}(?:\.\d{1,2})?)(?:\s*(?:amps?|A))?\b/gi;
  var REFRIGERANT_REGEX = /\bR[-\s]?(\d{2,3}[a-zA-Z]?)\b/gi;
  var BELT_SIZE_REGEX = /\b[A-Za-z][Xx]?\d{2,3}\b/g;
  var PARTS_REGEX = /\b(capacitor|contactor|relay|motor|belt|filter|condenser|compressor|sheave|thermostat|blower|evaporator|valve)\b/gi;
  var CAPACITANCE_REGEX = /\b(\d{1,4}(?:\.\d{1,2})?)\s*(?:microfarad|micro-farad|microfarads|mfd|uf|uF|\u00B5f)\b/gi;

  function safeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function clamp01(value) {
    if (typeof value !== "number" || !isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function uniqueList(items) {
    var out = [];
    var seen = {};
    var i;
    var item;
    var key;
    for (i = 0; i < items.length; i++) {
      item = items[i];
      if (!item || !item.type || !item.value) continue;
      key = item.type + "|" + item.value.toLowerCase() + "|" + (item.raw || "").toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push(item);
    }
    return out;
  }

  function addEntity(list, entity) {
    if (!entity || !entity.type || entity.value === undefined) return;
    list.push({
      type: String(entity.type),
      value: String(entity.value),
      raw: entity.raw || String(entity.value),
      confidence: clamp01(typeof entity.confidence === "number" ? entity.confidence : 1),
      unit: entity.unit || null
    });
  }

  function correctVocab(text) {
    var source = safeText(text);
    var next = source;
    var map;
    var corrections = [];
    var i = 0;
    var replaced = false;
    for (i = 0; i < DICTIONARY.length; i++) {
      map = DICTIONARY[i];
      replaced = false;
      next = next.replace(new RegExp("\\b" + escapeRegex(map[0]) + "\\b", "gi"), function (match) {
        replaced = true;
        corrections.push({
          from: map[0],
          to: map[1],
          raw: match
        });
        return map[1];
      });
      if (!replaced && map[0].indexOf(" ") !== -1) {
        next = next.replace(new RegExp(escapeRegex(map[0]), "gi"), function (match) {
          corrections.push({
            from: map[0],
            to: map[1],
            raw: match
          });
          return map[1];
        });
      }
    }
    return {
      text: next,
      corrections: corrections
    };
  }

  function extractEntities(text) {
    var source = safeText(text);
    var entities = [];
    var m;
    var unitPrefix;

    while ((m = EQUIPMENT_REGEX.exec(source)) !== null) {
      addEntity(entities, {
        type: "equipment",
        value: m[0].toUpperCase().replace(/\s+/g, " ").trim(),
        raw: m[0],
        confidence: 0.96
      });
    }
    EQUIPMENT_REGEX.lastIndex = 0;

    while ((m = TEMP_SUFFIX_REGEX.exec(source)) !== null) {
      unitPrefix = /[cC]/.test(m[0]) ? "°C" : "°F";
      addEntity(entities, {
        type: "temperature",
        value: parseFloat(m[1]),
        raw: m[0],
        confidence: 0.9,
        unit: unitPrefix
      });
    }
    TEMP_SUFFIX_REGEX.lastIndex = 0;

    while ((m = TEMP_PREFIX_REGEX.exec(source)) !== null) {
      unitPrefix = /[cC]/.test(m[0]) ? "°C" : "°F";
      addEntity(entities, {
        type: "temperature",
        value: parseFloat(m[1]),
        raw: m[0],
        confidence: 0.85,
        unit: unitPrefix
      });
    }
    TEMP_PREFIX_REGEX.lastIndex = 0;

    while ((m = AMP_SUFFIX_REGEX.exec(source)) !== null) {
      addEntity(entities, {
        type: "amp_draw",
        value: parseFloat(m[1]),
        raw: m[0],
        confidence: 0.93,
        unit: "A"
      });
    }
    AMP_SUFFIX_REGEX.lastIndex = 0;

    while ((m = AMP_PREFIX_REGEX.exec(source)) !== null) {
      addEntity(entities, {
        type: "amp_draw",
        value: parseFloat(m[1]),
        raw: m[0],
        confidence: 0.86,
        unit: "A"
      });
    }
    AMP_PREFIX_REGEX.lastIndex = 0;

    while ((m = REFRIGERANT_REGEX.exec(source)) !== null) {
      var refRaw = String(m[0]).toUpperCase();
      var refNum = String(m[1]).toUpperCase().replace(/\s+/g, "");
      var normalizedRef = "R-" + refNum;
      if (/R-\d{2,3}/.test(normalizedRef)) {
        addEntity(entities, {
          type: "refrigerant",
          value: normalizedRef,
          raw: refRaw,
          confidence: 0.95
        });
      }
    }
    REFRIGERANT_REGEX.lastIndex = 0;

    while ((m = BELT_SIZE_REGEX.exec(source)) !== null) {
      var belt = String(m[0]).toUpperCase().replace(/\s+/g, "");
      addEntity(entities, {
        type: "belt_size",
        value: belt,
        raw: m[0],
        confidence: 0.9
      });
    }
    BELT_SIZE_REGEX.lastIndex = 0;

    while ((m = PARTS_REGEX.exec(source)) !== null) {
      addEntity(entities, {
        type: "part",
        value: String(m[0]).toLowerCase(),
        raw: m[0],
        confidence: 0.82
      });
    }
    PARTS_REGEX.lastIndex = 0;

    while ((m = CAPACITANCE_REGEX.exec(source)) !== null) {
      var capValue = parseFloat(m[1]);
      var capUnit = /microfarad|micro-farad|microfarads|\u00B5f/i.test(m[0]) ? "uF" : "mfd";
      addEntity(entities, {
        type: "capacitance",
        value: capValue,
        raw: m[0],
        unit: capUnit,
        confidence: 0.95
      });
    }
    CAPACITANCE_REGEX.lastIndex = 0;

    return uniqueList(entities);
  }

  function computeConfidence(text, entities, corrections) {
    var normalized = safeText(text);
    if (!normalized) return 0;

    var entityCount = (entities && entities.length) ? entities.length : 0;
    var correctionCount = (corrections && corrections.length) ? corrections.length : 0;
    var score = 0.45;
    score += Math.min(0.35, entityCount * 0.08);
    score += Math.min(0.15, correctionCount * 0.03);
    if (/R-\d{2,3}/i.test(normalized)) score += 0.05;
    if (/\b(rtu|ahu|fcu|mau|unit)\b/i.test(normalized)) score += 0.03;
    return clamp01(score);
  }

  function parse(text) {
    var corrected = correctVocab(text);
    var entities = extractEntities(corrected.text);
    return {
      rawText: safeText(text),
      text: corrected.text,
      confidence: computeConfidence(corrected.text, entities, corrected.corrections),
      corrections: corrected.corrections,
      entities: entities
    };
  }

  /* ── Cloud escalation (Slice 43b) ──────────────────────────────── */

  var GEMINI_ESCALATION_PROMPT =
    "Extract structured HVAC field data from this technician note. Return JSON with: " +
    "equipment, temperatures, ampDraws, parts, deficiencies, actions. Note: ";

  function getGeminiModel() {
    if (typeof GEMINI_GENERATE_MODEL !== "undefined" && GEMINI_GENERATE_MODEL) {
      return GEMINI_GENERATE_MODEL;
    }
    return "gemini-2.0-flash";
  }

  function parseGeminiResponse(raw) {
    var t = String(raw || "").trim();
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try { return JSON.parse(t); } catch (e) { return null; }
  }

  function isOnline() {
    return typeof navigator !== "undefined" ? navigator.onLine !== false : true;
  }

  function escalateToCloud(text) {
    var source = safeText(text);
    if (!source) {
      return Promise.resolve(null);
    }
    if (!isOnline()) {
      return Promise.resolve(null);
    }

    if (typeof getGeminiApiKey !== "function") {
      return Promise.resolve(null);
    }

    return getGeminiApiKey().then(function (key) {
      if (!key) return null;

      var url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        getGeminiModel() +
        ":generateContent?key=" +
        encodeURIComponent(key);

      var body = {
        contents: [
          {
            role: "user",
            parts: [{ text: GEMINI_ESCALATION_PROMPT + source }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: "application/json"
        }
      };

      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (res) {
        return res.json();
      }).then(function (data) {
        if (data.error) return null;
        var part =
          data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts &&
          data.candidates[0].content.parts[0];
        var rawOut = part && part.text ? String(part.text) : "";
        return parseGeminiResponse(rawOut);
      }).catch(function () {
        return null;
      });
    }).catch(function () {
      return null;
    });
  }

  window.EdgeIntentEngine = {
    parse: parse,
    correctVocab: correctVocab,
    extractEntities: extractEntities,
    escalateToCloud: escalateToCloud
  };
})();
