/**
 * Unit Work Parser — Parse technician notes into per-unit work records.
 * Reads #diagnosis + #recommendations, sends to Gemini with site equipment context,
 * returns structured per-unit JSON. Renders confirmation cards for tech review.
 *
 * Depends on: firebase, getGeminiApiKey, GEMINI_GENERATE_MODEL (from firebase-config.js),
 *             activeTicket, #location (workspace context)
 */
(function () {
  "use strict";

  var PARSE_SYSTEM_INSTRUCTION =
    "You are a structured data extraction assistant for an HVAC field service app. " +
    "The technician has written free-text notes about work performed on one or more equipment units at a job site. " +
    "Your task: identify EACH equipment unit mentioned in the notes and extract ONLY the work described for that specific unit.\n\n" +
    "You will receive:\n" +
    "1. The technician's findings/diagnosis & repairs text.\n" +
    "2. The technician's recommendations/next steps text.\n" +
    "3. A JSON array of equipment units currently on file for this site (with unitTag, brand, model, equipmentId).\n\n" +
    "Rules:\n" +
    "- Match unit references in the notes (e.g. 'RTU-1', 'rooftop unit 2', 'the Carrier on the roof', 'unit heater by loading dock') to the known equipment list.\n" +
    "- If a unit reference clearly matches a known unit, use that unit's equipmentId.\n" +
    "- If a unit is mentioned but does NOT match any known equipment, set equipmentId to null and include the raw reference text.\n" +
    "- Extract findings, repairs performed, recommendations, and parts used for EACH unit separately.\n" +
    "- If the notes only discuss one unit, return an array with one element.\n" +
    "- If no specific unit can be identified from the text, return an empty array.\n" +
    "- Do NOT invent information. Only extract what the technician actually wrote.\n\n" +
    "Respond with a JSON array. Each element:\n" +
    "{\n" +
    '  "equipmentId": "<composite id from the known list, or null if unknown>",\n' +
    '  "matchedUnitTag": "<the unitTag of the matched unit, or null>",\n' +
    '  "rawReference": "<the text the tech used to refer to this unit, e.g. \'RTU-1\' or \'rooftop unit on north side\'>",\n' +
    '  "confidence": "high" | "medium" | "low",\n' +
    '  "findings": "<extracted findings/diagnosis for this unit only>",\n' +
    '  "repairs": "<repairs performed on this unit only>",\n' +
    '  "recommendations": "<recommendations for this unit only>",\n' +
    '  "partsUsed": "<parts used on this unit only, or empty string>"\n' +
    "}\n\n" +
    "Return ONLY the JSON array, no other text.";

  function sanitizePathSegment(s) {
    return (
      String(s || "")
        .trim()
        .replace(/[/\\]+/g, "_")
        .replace(/\s+/g, " ")
        .slice(0, 200) || "unknown"
    );
  }

  function geminiModelId() {
    if (typeof GEMINI_GENERATE_MODEL !== "undefined" && GEMINI_GENERATE_MODEL) {
      return GEMINI_GENERATE_MODEL;
    }
    return "gemini-2.5-flash";
  }

  function parseGeminiJson(text) {
    if (!text) return null;
    var t = String(text).trim();
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    try {
      return JSON.parse(t);
    } catch (e) {
      var o = t.indexOf("[");
      var c = t.lastIndexOf("]");
      if (o >= 0 && c > o) {
        try {
          return JSON.parse(t.slice(o, c + 1));
        } catch (e2) {}
      }
      o = t.indexOf("{");
      c = t.lastIndexOf("}");
      if (o >= 0 && c > o) {
        try {
          return JSON.parse("[" + t.slice(o, c + 1) + "]");
        } catch (e3) {}
      }
      return null;
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Load all equipment units for the current site.
   * Returns array of { equipmentId, unitTag, brand, model, overallPhotoUrl }
   */
  async function loadSiteEquipment() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      return [];
    }
    if (typeof activeTicket === "undefined" || !activeTicket) return [];
    var locEl = document.getElementById("location");
    var locLine = locEl && locEl.value ? String(locEl.value).trim() : "";
    if (!locLine) return [];

    var customerId = sanitizePathSegment(activeTicket.customerName || "");
    var locationId = sanitizePathSegment(locLine);

    var snap = await firebase
      .firestore()
      .collection("Customers")
      .doc(customerId)
      .collection("Locations")
      .doc(locationId)
      .collection("Equipment")
      .get();

    var units = [];
    snap.forEach(function (doc) {
      var d = doc.data() || {};
      units.push({
        equipmentId: customerId + "/" + locationId + "/" + doc.id,
        unitTag: d.unitTag || d.brand || doc.id || "Unit",
        brand: d.brand || "",
        model: d.model || "",
        overallPhotoUrl: d.overallPhotoUrl || "",
        dataPlatePhotoUrl: d.dataPlatePhotoUrl || "",
      });
    });
    return units;
  }

  /**
   * Call Gemini to parse technician notes into per-unit work records.
   * @param {string} diagnosisText - from #diagnosis
   * @param {string} recommendationsText - from #recommendations
   * @param {Array} siteEquipment - from loadSiteEquipment()
   * @returns {Promise<Array>} parsed unit work array
   */
  async function parseNotesForUnits(diagnosisText, recommendationsText, siteEquipment) {
    if (typeof getGeminiApiKey !== "function") {
      throw new Error("Gemini API key is not available.");
    }
    var key = await getGeminiApiKey();
    if (!key) {
      throw new Error("Add the Gemini API key under Settings → Integrations & API Keys.");
    }

    var equipmentContext = siteEquipment.map(function (u) {
      return {
        equipmentId: u.equipmentId,
        unitTag: u.unitTag,
        brand: u.brand,
        model: u.model,
      };
    });

    var userPayload =
      "TECHNICIAN FINDINGS / DIAGNOSIS & REPAIRS:\n" +
      (diagnosisText || "(empty)") +
      "\n\nTECHNICIAN RECOMMENDATIONS / NEXT STEPS:\n" +
      (recommendationsText || "(empty)") +
      "\n\nKNOWN EQUIPMENT ON SITE:\n" +
      JSON.stringify(equipmentContext, null, 2) +
      "\n\nExtract per-unit work records. Respond with JSON array only.";

    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      geminiModelId() +
      ":generateContent?key=" +
      encodeURIComponent(key);

    var body = {
      systemInstruction: {
        parts: [{ text: PARSE_SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPayload }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    };

    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    var data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || "Gemini request failed.");
    }

    var part =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0];
    var rawOut = part && part.text ? String(part.text) : "";
    var parsed = parseGeminiJson(rawOut);

    if (!Array.isArray(parsed)) {
      if (parsed && typeof parsed === "object" && parsed.equipmentId !== undefined) {
        parsed = [parsed];
      } else {
        throw new Error("Could not parse unit work response from AI.");
      }
    }
    return parsed;
  }

  /**
   * Merge Gemini results with site equipment data (add photos, validate matches).
   */
  function enrichParsedResults(parsedUnits, siteEquipment) {
    return parsedUnits.map(function (pu) {
      var matched = null;
      if (pu.equipmentId) {
        matched = siteEquipment.find(function (se) {
          return se.equipmentId === pu.equipmentId;
        });
      }
      if (!matched && pu.matchedUnitTag) {
        var tag = String(pu.matchedUnitTag).toLowerCase().replace(/[\s\-_]+/g, "");
        matched = siteEquipment.find(function (se) {
          var seTag = String(se.unitTag).toLowerCase().replace(/[\s\-_]+/g, "");
          return seTag === tag;
        });
      }
      return {
        equipmentId: matched ? matched.equipmentId : null,
        unitTag: matched ? matched.unitTag : pu.matchedUnitTag || null,
        brand: matched ? matched.brand : "",
        model: matched ? matched.model : "",
        overallPhotoUrl: matched ? matched.overallPhotoUrl : "",
        rawReference: pu.rawReference || pu.matchedUnitTag || "Unknown unit",
        confidence: pu.confidence || "medium",
        findings: pu.findings || "",
        repairs: pu.repairs || "",
        recommendations: pu.recommendations || "",
        partsUsed: pu.partsUsed || "",
        _matched: !!matched,
      };
    });
  }

  // --- UI: Confirmation Overlay ---

  var overlayEl = null;
  var currentResults = [];
  var currentSiteEquipment = [];
  var _onConfirmCallback = null;

  function buildOverlayHtml(enrichedResults) {
    var cards = enrichedResults
      .map(function (r, idx) {
        var thumbSrc = r.overallPhotoUrl || "";
        var thumbHtml = thumbSrc
          ? '<img src="' + escapeHtml(thumbSrc) + '" class="uwp-card-thumb" alt="' + escapeHtml(r.unitTag || "Unit") + '" data-uwp-lightbox="' + escapeHtml(thumbSrc) + '">'
          : '<div class="uwp-card-thumb uwp-card-thumb--empty">No photo</div>';

        var tagLine = escapeHtml(r.unitTag || r.rawReference || "Unknown");
        var subLine = [r.brand, r.model].filter(Boolean).join(" · ");
        var confidencePill =
          r.confidence === "high"
            ? '<span class="uwp-confidence uwp-confidence--high">High match</span>'
            : r.confidence === "medium"
              ? '<span class="uwp-confidence uwp-confidence--medium">Possible match</span>'
              : '<span class="uwp-confidence uwp-confidence--low">Low match</span>';

        var unmatchedBanner = !r._matched
          ? '<div class="uwp-card-unmatched">Unit not found on file — please verify or pick a different unit</div>'
          : "";

        var summaryLines = [];
        if (r.findings) summaryLines.push("<strong>Findings:</strong> " + escapeHtml(r.findings.slice(0, 120)) + (r.findings.length > 120 ? "…" : ""));
        if (r.repairs) summaryLines.push("<strong>Repairs:</strong> " + escapeHtml(r.repairs.slice(0, 120)) + (r.repairs.length > 120 ? "…" : ""));
        if (r.recommendations) summaryLines.push("<strong>Recs:</strong> " + escapeHtml(r.recommendations.slice(0, 80)) + (r.recommendations.length > 80 ? "…" : ""));
        if (r.partsUsed) summaryLines.push("<strong>Parts:</strong> " + escapeHtml(r.partsUsed));

        return (
          '<div class="uwp-card" data-uwp-idx="' + idx + '">' +
          '<button type="button" class="uwp-card-remove" aria-label="Remove" data-uwp-remove="' + idx + '">✕</button>' +
          '<div class="uwp-card-top">' +
          thumbHtml +
          '<div class="uwp-card-info">' +
          '<div class="uwp-card-tag">' + tagLine + "</div>" +
          (subLine ? '<div class="uwp-card-sub">' + escapeHtml(subLine) + "</div>" : "") +
          confidencePill +
          "</div></div>" +
          unmatchedBanner +
          '<div class="uwp-card-summary">' + summaryLines.join("<br>") + "</div>" +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="uwp-overlay" id="uwpOverlay">' +
      '<div class="uwp-sheet">' +
      '<div class="uwp-sheet-header">' +
      '<h3 class="uwp-sheet-title">Link work to equipment</h3>' +
      '<span class="uwp-sheet-count">' + enrichedResults.length + " unit" + (enrichedResults.length !== 1 ? "s" : "") + " identified</span>" +
      "</div>" +
      '<div class="uwp-cards-scroll">' +
      cards +
      "</div>" +
      '<div class="uwp-sheet-footer">' +
      '<button type="button" class="uwp-btn-confirm" id="uwpConfirmAllBtn">Confirm All</button>' +
      '<button type="button" class="uwp-btn-cancel" id="uwpCancelBtn">Cancel</button>' +
      "</div></div></div>"
    );
  }

  function showConfirmationOverlay(enrichedResults, onConfirm) {
    removeOverlay();
    currentResults = enrichedResults.slice();
    _onConfirmCallback = onConfirm;

    var wrapper = document.createElement("div");
    wrapper.id = "uwpOverlayWrap";
    wrapper.innerHTML = buildOverlayHtml(currentResults);
    document.body.appendChild(wrapper);
    overlayEl = wrapper;

    wrapper.addEventListener("click", function (e) {
      var removeBtn = e.target.closest("[data-uwp-remove]");
      if (removeBtn) {
        var idx = parseInt(removeBtn.getAttribute("data-uwp-remove"), 10);
        currentResults.splice(idx, 1);
        if (currentResults.length === 0) {
          removeOverlay();
          return;
        }
        var sheet = wrapper.querySelector(".uwp-cards-scroll");
        if (sheet) sheet.innerHTML = buildCardsOnly(currentResults);
        var countEl = wrapper.querySelector(".uwp-sheet-count");
        if (countEl) countEl.textContent = currentResults.length + " unit" + (currentResults.length !== 1 ? "s" : "") + " identified";
        return;
      }

      if (e.target.id === "uwpConfirmAllBtn") {
        var confirmed = currentResults.slice();
        removeOverlay();
        if (_onConfirmCallback) _onConfirmCallback(confirmed);
        return;
      }

      if (e.target.id === "uwpCancelBtn" || e.target.classList.contains("uwp-overlay")) {
        removeOverlay();
        return;
      }

      var lightboxTarget = e.target.closest("[data-uwp-lightbox]");
      if (lightboxTarget) {
        var src = lightboxTarget.getAttribute("data-uwp-lightbox");
        if (src) showLightbox(src);
      }
    });
  }

  function buildCardsOnly(results) {
    var temp = document.createElement("div");
    temp.innerHTML = buildOverlayHtml(results);
    var scroll = temp.querySelector(".uwp-cards-scroll");
    return scroll ? scroll.innerHTML : "";
  }

  function removeOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    currentResults = [];
    _onConfirmCallback = null;
  }

  function showLightbox(src) {
    var existing = document.getElementById("uwpLightbox");
    if (existing) existing.remove();
    var lb = document.createElement("div");
    lb.id = "uwpLightbox";
    lb.className = "uwp-lightbox";
    lb.innerHTML =
      '<div class="uwp-lightbox-backdrop"></div>' +
      '<img src="' + escapeHtml(src) + '" class="uwp-lightbox-img" alt="Equipment photo">' +
      '<button type="button" class="uwp-lightbox-close" aria-label="Close">✕</button>';
    lb.addEventListener("click", function (e) {
      if (e.target.classList.contains("uwp-lightbox-backdrop") || e.target.classList.contains("uwp-lightbox-close")) {
        lb.remove();
      }
    });
    document.body.appendChild(lb);
  }

  // --- Main entry point: triggered by the Parse & Link button ---

  async function runParseAndLink() {
    var diagEl = document.getElementById("diagnosis");
    var recsEl = document.getElementById("recommendations");
    var diagText = diagEl ? diagEl.value.trim() : "";
    var recsText = recsEl ? recsEl.value.trim() : "";

    if (!diagText && !recsText) {
      throw new Error("Enter your findings or recommendations before parsing.");
    }

    var statusEl = document.getElementById("uwpParseStatus");
    if (statusEl) {
      statusEl.textContent = "Analyzing notes…";
      statusEl.className = "uwp-parse-status uwp-parse-status--working";
    }

    try {
      var siteEquipment = await loadSiteEquipment();
      if (!siteEquipment.length) {
        throw new Error("No equipment on file for this site. Add units via the Equipment Hub first.");
      }
      currentSiteEquipment = siteEquipment;

      var parsedUnits = await parseNotesForUnits(diagText, recsText, siteEquipment);
      if (!parsedUnits || !parsedUnits.length) {
        throw new Error("No equipment units could be identified in your notes. Mention a unit tag or equipment description.");
      }

      var enriched = enrichParsedResults(parsedUnits, siteEquipment);
      if (statusEl) {
        statusEl.textContent = enriched.length + " unit" + (enriched.length !== 1 ? "s" : "") + " found";
        statusEl.className = "uwp-parse-status uwp-parse-status--done";
      }

      showConfirmationOverlay(enriched, function (confirmed) {
        window.dispatchEvent(
          new CustomEvent("uwp:confirmed", { detail: { units: confirmed, ticketId: getActiveTicketId() } })
        );
      });
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = err.message || "Parse failed";
        statusEl.className = "uwp-parse-status uwp-parse-status--error";
      }
      console.error("[UnitWorkParser]", err);
    }
  }

  function getActiveTicketId() {
    var sel = document.getElementById("ticketSelector");
    return sel && sel.value ? sel.value : "";
  }

  // --- Wire the Parse & Link button ---
  function wireParseButton() {
    var btn = document.getElementById("uwpParseBtn");
    if (!btn || btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", function () {
      btn.disabled = true;
      runParseAndLink().finally(function () {
        btn.disabled = false;
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireParseButton);
  } else {
    wireParseButton();
  }

  /**
   * Write work_history docs to Firestore: one per confirmed unit.
   * Path: Customers/{customerId}/Locations/{locationId}/Equipment/{unitDocId}/work_history/{autoId}
   */
  async function writeWorkHistory(confirmedUnits, ticketId) {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      throw new Error("Firebase not available.");
    }
    var db = firebase.firestore();
    var techName = "";
    try {
      techName = localStorage.getItem("tp_saved_tech") || "";
    } catch (e) {}
    var today = new Date().toISOString().slice(0, 10);
    var now = new Date().toISOString();

    var writes = confirmedUnits.map(function (unit) {
      if (!unit.equipmentId) return Promise.resolve(null);
      var parts = String(unit.equipmentId).split("/");
      if (parts.length < 3) return Promise.resolve(null);
      var customerId = parts[0];
      var locationId = parts[1];
      var unitDocId = parts.slice(2).join("/");

      var doc = {
        ticketId: ticketId || "",
        techName: techName,
        date: today,
        findings: unit.findings || "",
        repairs: unit.repairs || "",
        recommendations: unit.recommendations || "",
        partsUsed: unit.partsUsed || "",
        unitTag: unit.unitTag || "",
        brand: unit.brand || "",
        model: unit.model || "",
        rawReference: unit.rawReference || "",
        confidence: unit.confidence || "medium",
        savedAt: now,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      return db
        .collection("Customers")
        .doc(customerId)
        .collection("Locations")
        .doc(locationId)
        .collection("Equipment")
        .doc(unitDocId)
        .collection("work_history")
        .add(doc);
    });

    var results = await Promise.all(writes);
    return results.filter(Boolean);
  }

  window.addEventListener("uwp:confirmed", function (e) {
    var detail = e.detail || {};
    var units = detail.units || [];
    var ticketId = detail.ticketId || "";

    var statusEl = document.getElementById("uwpParseStatus");
    if (!units.length) return;

    if (statusEl) {
      statusEl.textContent = "Saving…";
      statusEl.className = "uwp-parse-status uwp-parse-status--working";
    }

    writeWorkHistory(units, ticketId)
      .then(function (docs) {
        var count = docs.length;
        console.log("[UnitWorkParser] Saved " + count + " work_history doc(s) for ticket " + ticketId);
        if (statusEl) {
          statusEl.textContent = "Linked " + count + " unit" + (count !== 1 ? "s" : "") + " ✓";
          statusEl.className = "uwp-parse-status uwp-parse-status--done";
        }
      })
      .catch(function (err) {
        console.error("[UnitWorkParser] writeWorkHistory failed", err);
        if (statusEl) {
          statusEl.textContent = "Save failed — try again";
          statusEl.className = "uwp-parse-status uwp-parse-status--error";
        }
      });
  });

  // Exports
  window.UnitWorkParser = {
    run: runParseAndLink,
    loadSiteEquipment: loadSiteEquipment,
    parseNotesForUnits: parseNotesForUnits,
    removeOverlay: removeOverlay,
  };
})();
