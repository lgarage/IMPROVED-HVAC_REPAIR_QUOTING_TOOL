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
          ? '<div class="uwp-card-unmatched">Unit not found on file — please verify or pick a different unit' +
            '<button type="button" class="uwp-btn-add-equipment" data-uwp-add-equip="' + idx + '">+ Add Equipment</button>' +
            '</div>'
          : "";

        // Photo prompt — matched unit with no photos saved
        var photoPromptHtml = "";
        if (r._matched && !r.overallPhotoUrl && !r.dataPlatePhotoUrl) {
          photoPromptHtml =
            '<div class="uwp-card-photo-prompt">' +
            '<div class="uwp-card-photo-prompt-label">📷 No photos on file for this unit — add now? <em class="uwp-card-photo-optional">(optional)</em></div>' +
            '<div class="uwp-card-photo-inputs">' +
            '<label class="uwp-photo-input-label">Data Plate' +
            '<input type="file" accept="image/*" class="uwp-card-photo-input" data-photo-type="plate" data-photo-idx="' + idx + '">' +
            '<div class="uwp-card-photo-preview" style="display:none"></div>' +
            '</label>' +
            '<label class="uwp-photo-input-label">Overall' +
            '<input type="file" accept="image/*" class="uwp-card-photo-input" data-photo-type="overall" data-photo-idx="' + idx + '">' +
            '<div class="uwp-card-photo-preview" style="display:none"></div>' +
            '</label>' +
            '</div>' +
            '<div class="uwp-card-photo-status"></div>' +
            '</div>';
        }

        var summaryLines = [];
        if (r.findings) summaryLines.push("<strong>Findings:</strong> " + escapeHtml(r.findings.slice(0, 120)) + (r.findings.length > 120 ? "…" : ""));
        if (r.repairs) summaryLines.push("<strong>Repairs:</strong> " + escapeHtml(r.repairs.slice(0, 120)) + (r.repairs.length > 120 ? "…" : ""));
        if (r.recommendations) summaryLines.push("<strong>Recs:</strong> " + escapeHtml(r.recommendations.slice(0, 80)) + (r.recommendations.length > 80 ? "…" : ""));
        if (r.partsUsed) summaryLines.push("<strong>Parts:</strong> " + escapeHtml(r.partsUsed));

        // Per-card confirm button
        var confirmOneHtml =
          '<div class="uwp-card-footer">' +
          '<button type="button" class="uwp-btn-confirm-one" data-uwp-confirm-one="' + idx + '">✓ OK — Save this unit</button>' +
          '</div>';

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
          photoPromptHtml +
          confirmOneHtml +
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

      // Per-card OK — confirm this one unit and keep the overlay open for the rest
      var confirmOneBtn = e.target.closest("[data-uwp-confirm-one]");
      if (confirmOneBtn) {
        var confirmIdx = parseInt(confirmOneBtn.getAttribute("data-uwp-confirm-one"), 10);
        var unitToConfirm = currentResults[confirmIdx];
        if (!unitToConfirm) return;
        // Fire the write for this single unit
        if (_onConfirmCallback) _onConfirmCallback([unitToConfirm]);
        // Remove it from the remaining list
        currentResults.splice(confirmIdx, 1);
        if (currentResults.length === 0) {
          removeOverlay();
          return;
        }
        var sheetOne = wrapper.querySelector(".uwp-cards-scroll");
        if (sheetOne) sheetOne.innerHTML = buildCardsOnly(currentResults);
        var countElOne = wrapper.querySelector(".uwp-sheet-count");
        if (countElOne) countElOne.textContent = currentResults.length + " unit" + (currentResults.length !== 1 ? "s" : "") + " remaining";
        return;
      }

      var addEquipBtn = e.target.closest("[data-uwp-add-equip]");
      if (addEquipBtn) {
        var addIdx = parseInt(addEquipBtn.getAttribute("data-uwp-add-equip"), 10);
        openEquipmentManagerForUnmatched(addIdx);
        return;
      }

      var saveFormBtn = e.target.closest("[data-uwp-save-idx]");
      if (saveFormBtn) {
        var saveIdx = parseInt(saveFormBtn.getAttribute("data-uwp-save-idx"), 10);
        saveInlineEquipment(saveIdx, wrapper);
        return;
      }

      var cancelFormBtn = e.target.closest("[data-uwp-cancel-form]");
      if (cancelFormBtn) {
        var cancelIdx = parseInt(cancelFormBtn.getAttribute("data-uwp-cancel-form"), 10);
        var cancelCard = wrapper.querySelector('.uwp-card[data-uwp-idx="' + cancelIdx + '"]');
        if (cancelCard) {
          var inlineForm = cancelCard.querySelector(".uwp-inline-form");
          if (inlineForm) inlineForm.remove();
          var restoreBtn = cancelCard.querySelector(".uwp-btn-add-equipment");
          if (restoreBtn) restoreBtn.style.display = "";
        }
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

    // Photo upload from matched-card photo prompt — fires immediately on file pick
    wrapper.addEventListener("change", function (e) {
      var photoInput = e.target.closest(".uwp-card-photo-input");
      if (!photoInput) return;
      var f = photoInput.files && photoInput.files[0];
      if (!f) return;

      var photoIdx = parseInt(photoInput.getAttribute("data-photo-idx"), 10);
      var photoType = photoInput.getAttribute("data-photo-type"); // "plate" | "overall"
      var result = currentResults[photoIdx];
      if (!result || !result.equipmentId) return;

      var parts = String(result.equipmentId).split("/");
      if (parts.length < 3) return;
      var cId = parts[0];
      var lId = parts[1];
      var uId = parts.slice(2).join("/");

      // Local preview
      var previewDiv = photoInput.nextElementSibling;
      if (previewDiv && previewDiv.classList.contains("uwp-card-photo-preview")) {
        var objUrl;
        try { objUrl = URL.createObjectURL(f); } catch (ex) {}
        if (objUrl) {
          var prevImg = document.createElement("img");
          prevImg.src = objUrl;
          prevImg.alt = "Preview";
          prevImg.className = "uwp-card-photo-preview-img";
          prevImg.addEventListener("click", function () { showLightbox(objUrl); });
          previewDiv.innerHTML = "";
          previewDiv.appendChild(prevImg);
          previewDiv.style.display = "block";
        }
      }

      // Status
      var prompt = photoInput.closest(".uwp-card-photo-prompt");
      var statusDiv = prompt && prompt.querySelector(".uwp-card-photo-status");
      if (statusDiv) { statusDiv.textContent = "⏳ Uploading…"; statusDiv.style.color = "#d97706"; }

      // Background upload via existing helper
      if (typeof firebase !== "undefined" && firebase.firestore) {
        var db = firebase.firestore();
        var equipRef = db
          .collection("Customers").doc(cId)
          .collection("Locations").doc(lId)
          .collection("Equipment").doc(uId);
        var overallFile = photoType === "overall" ? f : null;
        var plateFile   = photoType === "plate"   ? f : null;
        uploadInlinePhotos(cId, lId, uId, overallFile, plateFile, equipRef);
        // Optimistic status — uploadInlinePhotos doesn't return a promise we can chain here
        if (statusDiv) {
          setTimeout(function () {
            if (statusDiv) { statusDiv.textContent = "✓ Photo uploading in background"; statusDiv.style.color = "#16a34a"; }
          }, 400);
        }
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

  var PLATE_OCR_PROMPT =
    "You are an expert HVAC equipment data-plate OCR assistant. " +
    "Analyze the image and extract ONLY what is visible. Return a single JSON object (no markdown) with these keys: " +
    "brand (string), model (string), serial (string), voltage (string), phase (string), refrigerant (string), " +
    "unitTag (string, e.g. RTU-2 or PRV-3 if shown), " +
    "tonnageNumeric (number or null) — cooling/heating tonnage decoded from the model number if present, " +
    "manufactureYear (number or null). " +
    "If a field is not on the plate, use empty string or null. Be conservative; do not invent model numbers.";

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var dataUrl = String(r.result || "");
        var i = dataUrl.indexOf("base64,");
        resolve(i >= 0 ? dataUrl.slice(i + 7) : dataUrl);
      };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(file);
    });
  }

  function runPlateOcr(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      return Promise.reject(new Error("Choose a photo."));
    }
    return fileToBase64(file).then(function (b64) {
      return getGeminiApiKey().then(function (key) {
        if (!key) throw new Error("No Gemini API key.");
        var url =
          "https://generativelanguage.googleapis.com/v1beta/models/" +
          geminiModelId() + ":generateContent?key=" + encodeURIComponent(key);
        var body = {
          contents: [{
            role: "user",
            parts: [
              { text: PLATE_OCR_PROMPT },
              { inlineData: { mimeType: file.type || "image/jpeg", data: b64 } }
            ]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" }
        };
        return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }).then(function (res) { return res.json(); }).then(function (data) {
        var parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        if (!parts || !parts.length) return null;
        var raw = parts.map(function (p) { return p.text || ""; }).join("\n");
        return parseGeminiJson(raw);
      });
    });
  }

  /** Piecewise-linear CRV estimate (mirrors equipment_manager.js estimateCRV). */
  function uwpEstimateCRV(tonnage) {
    var t = Number(tonnage);
    if (!isFinite(t) || t <= 0) return 0;
    if (t <= 5)  return Math.round((t / 5) * 10000);
    if (t <= 10) return Math.round(10000 + ((t - 5) / 5) * 5000);
    if (t <= 20) return Math.round(15000 + ((t - 10) / 10) * 10000);
    return Math.round(25000 + (t - 20) * 1000);
  }

  /** Health score: 100 − 2.5×age − (repairs+proposed)/CRV×50, clamped 0–100. */
  function uwpCalcHealth(age, prev, prop, crv) {
    age  = Math.max(0, Number(age)  || 0);
    prev = Math.max(0, Number(prev) || 0);
    prop = Math.max(0, Number(prop) || 0);
    crv  = Math.max(0, Number(crv)  || 0);
    var score = 100 - 2.5 * age - (crv > 0 ? (prev + prop) / crv * 50 : 0);
    score = Math.floor(Math.max(0, Math.min(100, score)));
    var grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
    return { score: score, grade: grade };
  }

  /** Wire a file input to show a local URL.createObjectURL preview below it. */
  function wireUwpPhotoPreview(fileInput, previewContainer, onClickLightbox) {
    if (!fileInput || !previewContainer) return;
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      var prev = previewContainer.querySelector(".uwp-photo-preview-img");
      if (prev && prev._objectUrl) {
        try { URL.revokeObjectURL(prev._objectUrl); } catch (e) {}
        prev.remove();
      }
      if (!f) { previewContainer.style.display = "none"; return; }
      var url;
      try { url = URL.createObjectURL(f); } catch (e) { return; }
      var img = document.createElement("img");
      img.className = "uwp-photo-preview-img";
      img._objectUrl = url;
      img.src = url;
      img.alt = "Preview";
      img.addEventListener("click", function () { onClickLightbox(url); });
      previewContainer.innerHTML = "";
      previewContainer.appendChild(img);
      previewContainer.style.display = "block";
    });
  }

  /**
   * Show inline quick-add form directly on the unmatched card.
   * Full parity with EquipmentManager modal: photos, OCR, all fields, health score.
   */
  function openEquipmentManagerForUnmatched(idx) {
    var result = currentResults[idx];
    if (!result) return;

    if (typeof activeTicket === "undefined" || !activeTicket) {
      alert("Select a job from your schedule first.");
      return;
    }
    var locEl = document.getElementById("location");
    var locLine = locEl && locEl.value ? String(locEl.value).trim() : "";
    if (!locLine) {
      alert("Set a location on this ticket before adding equipment.");
      return;
    }

    var cardEl = overlayEl && overlayEl.querySelector('.uwp-card[data-uwp-idx="' + idx + '"]');
    if (!cardEl) return;

    if (cardEl.querySelector(".uwp-inline-form")) return;

    var prefillTag = escapeHtml(result.rawReference || "");
    var formHtml =
      '<div class="uwp-inline-form" data-uwp-form-idx="' + idx + '">' +
      '<div class="uwp-inline-form-title">Quick Add Unit</div>' +

      // --- Photo inputs ---
      '<div class="uwp-inline-field">' +
      '<label>📷 Data Plate Photo <span class="uwp-inline-hint">(AI reads this automatically)</span></label>' +
      '<input type="file" accept="image/*" class="uwp-inline-file uwp-inline-plate" data-field="platePhoto">' +
      '<div class="uwp-photo-preview uwp-plate-preview" style="display:none"></div>' +
      '<div class="uwp-ocr-status"></div>' +
      '</div>' +

      '<div class="uwp-inline-field">' +
      '<label>📷 Overall Equipment Photo</label>' +
      '<input type="file" accept="image/*" class="uwp-inline-file uwp-inline-overall" data-field="overallPhoto">' +
      '<div class="uwp-photo-preview uwp-overall-preview" style="display:none"></div>' +
      '</div>' +

      '<div class="uwp-inline-divider"></div>' +

      // --- Core ID fields ---
      '<div class="uwp-inline-field"><label>Unit Tag</label><input type="text" class="uwp-inline-input" data-field="unitTag" value="' + prefillTag + '"></div>' +
      '<div class="uwp-inline-row">' +
      '<div class="uwp-inline-field uwp-inline-half"><label>Brand</label><input type="text" class="uwp-inline-input" data-field="brand" placeholder="e.g. Carrier"></div>' +
      '<div class="uwp-inline-field uwp-inline-half"><label>Model</label><input type="text" class="uwp-inline-input" data-field="model" placeholder="e.g. 48TCDD08"></div>' +
      '</div>' +
      '<div class="uwp-inline-field"><label>Serial</label><input type="text" class="uwp-inline-input" data-field="serial" placeholder="Auto-filled from data plate"></div>' +
      '<div class="uwp-inline-row">' +
      '<div class="uwp-inline-field uwp-inline-half"><label>Voltage</label><input type="text" class="uwp-inline-input" data-field="voltage" placeholder="e.g. 208/230"></div>' +
      '<div class="uwp-inline-field uwp-inline-half"><label>Phase</label><input type="text" class="uwp-inline-input" data-field="phase" placeholder="e.g. 3"></div>' +
      '</div>' +
      '<div class="uwp-inline-row">' +
      '<div class="uwp-inline-field uwp-inline-half"><label>Refrigerant</label><input type="text" class="uwp-inline-input" data-field="refrigerant" placeholder="e.g. R-410A"></div>' +
      '<div class="uwp-inline-field uwp-inline-half"><label>Tonnage</label><input type="text" class="uwp-inline-input uwp-tonnage-input" data-field="tonnage" placeholder="e.g. 5"></div>' +
      '</div>' +

      '<div class="uwp-inline-divider"></div>' +

      // --- Age / financial fields ---
      '<div class="uwp-inline-row">' +
      '<div class="uwp-inline-field uwp-inline-half"><label>Manufacture Year</label><input type="text" class="uwp-inline-input" data-field="manufactureYear" placeholder="e.g. 2015"></div>' +
      '<div class="uwp-inline-field uwp-inline-half"><label>Age (years)</label><input type="text" class="uwp-inline-input uwp-age-input" data-field="ageYears" placeholder="e.g. 9"></div>' +
      '</div>' +
      '<div class="uwp-inline-field"><label>Est. CRV ($) <span class="uwp-inline-hint">auto-filled from tonnage</span></label><input type="text" class="uwp-inline-input uwp-crv-input" data-field="estimatedCRV" placeholder="e.g. 10000"></div>' +
      '<div class="uwp-inline-row">' +
      '<div class="uwp-inline-field uwp-inline-half"><label>Prior Repairs ($)</label><input type="text" class="uwp-inline-input uwp-health-input" data-field="totalPreviousRepairs" placeholder="0"></div>' +
      '<div class="uwp-inline-field uwp-inline-half"><label>Proposed Repair ($)</label><input type="text" class="uwp-inline-input uwp-health-input" data-field="proposedRepairCost" placeholder="0"></div>' +
      '</div>' +

      // --- Live health score ---
      '<div class="uwp-inline-health" style="display:none">' +
      '<span class="uwp-health-label">Health Score:</span> ' +
      '<span class="uwp-health-value">—</span>' +
      '</div>' +

      '<div class="uwp-inline-actions">' +
      '<button type="button" class="uwp-inline-save" data-uwp-save-idx="' + idx + '">Save Unit</button>' +
      '<button type="button" class="uwp-inline-cancel" data-uwp-cancel-form="' + idx + '">Cancel</button>' +
      '</div>' +
      '<div class="uwp-inline-status"></div>' +
      '</div>';

    cardEl.insertAdjacentHTML("beforeend", formHtml);

    var addBtn = cardEl.querySelector(".uwp-btn-add-equipment");
    if (addBtn) addBtn.style.display = "none";

    var form = cardEl.querySelector(".uwp-inline-form");

    // --- Photo previews ---
    var plateInput   = form.querySelector('.uwp-inline-plate');
    var overallInput = form.querySelector('.uwp-inline-overall');
    var platePreview  = form.querySelector('.uwp-plate-preview');
    var overallPreview = form.querySelector('.uwp-overall-preview');

    wireUwpPhotoPreview(platePreview ? plateInput : null, platePreview, showLightbox);
    wireUwpPhotoPreview(overallPreview ? overallInput : null, overallPreview, showLightbox);

    // --- Plate OCR ---
    if (plateInput) {
      plateInput.addEventListener("change", function () {
        var f = plateInput.files && plateInput.files[0];
        if (!f) return;
        var ocrStatus = form.querySelector(".uwp-ocr-status");
        if (ocrStatus) { ocrStatus.textContent = "⏳ Reading data plate…"; ocrStatus.className = "uwp-ocr-status uwp-ocr-status--working"; }

        runPlateOcr(f).then(function (data) {
          if (!data) {
            if (ocrStatus) { ocrStatus.textContent = "Could not read plate — fill in manually"; ocrStatus.className = "uwp-ocr-status uwp-ocr-status--error"; }
            return;
          }
          if (ocrStatus) { ocrStatus.textContent = "✓ Data plate read successfully"; ocrStatus.className = "uwp-ocr-status uwp-ocr-status--done"; }
          var setVal = function (field, val) {
            if (val == null || val === "") return;
            var el = form.querySelector('[data-field="' + field + '"]');
            if (el && !el.value) el.value = String(val);
          };
          setVal("brand", data.brand);
          setVal("model", data.model);
          setVal("serial", data.serial);
          setVal("voltage", data.voltage);
          setVal("phase", data.phase);
          setVal("refrigerant", data.refrigerant);
          if (data.tonnageNumeric) setVal("tonnage", data.tonnageNumeric);
          if (data.unitTag) {
            var utEl = form.querySelector('[data-field="unitTag"]');
            if (utEl && !utEl.value) utEl.value = String(data.unitTag);
          }
          if (data.manufactureYear) {
            setVal("manufactureYear", data.manufactureYear);
            var yrEl = form.querySelector('[data-field="ageYears"]');
            if (yrEl && !yrEl.value) {
              var age = Math.max(0, new Date().getFullYear() - Number(data.manufactureYear));
              if (isFinite(age)) yrEl.value = String(age);
            }
          }
          // Auto-fill CRV from OCR tonnage
          if (data.tonnageNumeric) {
            var crvEl = form.querySelector('[data-field="estimatedCRV"]');
            if (crvEl && !crvEl.value) {
              var crv = uwpEstimateCRV(data.tonnageNumeric);
              if (crv > 0) crvEl.value = String(crv);
            }
          }
          refreshUwpHealth(form);
        }).catch(function (err) {
          console.error("[UnitWorkParser] plateOCR", err);
          if (ocrStatus) { ocrStatus.textContent = "OCR failed — fill in manually"; ocrStatus.className = "uwp-ocr-status uwp-ocr-status--error"; }
        });
      });
    }

    // --- Tonnage → CRV auto-fill ---
    var tonnageEl = form.querySelector('.uwp-tonnage-input');
    if (tonnageEl) {
      tonnageEl.addEventListener("input", function () {
        var crvEl = form.querySelector('[data-field="estimatedCRV"]');
        if (!crvEl) return;
        var crv = uwpEstimateCRV(tonnageEl.value);
        if (crv > 0) crvEl.value = String(crv);
        refreshUwpHealth(form);
      });
    }

    // --- Health score live recalc ---
    form.querySelectorAll('.uwp-age-input, .uwp-health-input, .uwp-crv-input').forEach(function (el) {
      el.addEventListener("input", function () { refreshUwpHealth(form); });
    });
  }

  /** Recalculate and display live health score inside an inline form. */
  function refreshUwpHealth(form) {
    if (!form) return;
    var getV = function (field) {
      var el = form.querySelector('[data-field="' + field + '"]');
      return el ? el.value : "";
    };
    var h = uwpCalcHealth(getV("ageYears"), getV("totalPreviousRepairs"), getV("proposedRepairCost"), getV("estimatedCRV"));
    var healthEl = form.querySelector(".uwp-inline-health");
    var valEl    = form.querySelector(".uwp-health-value");
    if (valEl) {
      valEl.textContent = h.score + " — Grade " + h.grade;
      valEl.className = "uwp-health-value uwp-health-" + h.grade.toLowerCase();
    }
    if (healthEl) {
      var show = getV("ageYears") || getV("totalPreviousRepairs") || getV("proposedRepairCost") || getV("estimatedCRV");
      healthEl.style.display = show ? "flex" : "none";
    }
  }

  /**
   * Save inline form data to Firestore Equipment collection, update card to matched.
   * Writes full field set matching EquipmentManager field names.
   */
  function saveInlineEquipment(idx, wrapper) {
    var cardEl = wrapper && wrapper.querySelector('.uwp-card[data-uwp-idx="' + idx + '"]');
    if (!cardEl) return;
    var form = cardEl.querySelector(".uwp-inline-form");
    if (!form) return;
    var statusEl = form.querySelector(".uwp-inline-status");

    var getField = function (name) {
      var el = form.querySelector('[data-field="' + name + '"]');
      return el ? (el.value || "").trim() : "";
    };

    var unitTag          = getField("unitTag");
    var brand            = getField("brand");
    var model            = getField("model");
    var serial           = getField("serial");
    var voltage          = getField("voltage");
    var phase            = getField("phase");
    var refrigerant      = getField("refrigerant");
    var tonnage          = getField("tonnage");
    var manufactureYear  = getField("manufactureYear");
    var ageYears         = getField("ageYears");
    var estimatedCRV     = getField("estimatedCRV");
    var prevRepairs      = getField("totalPreviousRepairs");
    var proposedCost     = getField("proposedRepairCost");

    // If CRV not filled but tonnage present, compute it now
    if (!estimatedCRV && tonnage) {
      var crv = uwpEstimateCRV(tonnage);
      if (crv > 0) estimatedCRV = String(crv);
    }

    var health = uwpCalcHealth(ageYears, prevRepairs, proposedCost, estimatedCRV);

    var overallInput = form.querySelector('[data-field="overallPhoto"]');
    var plateInput   = form.querySelector('[data-field="platePhoto"]');
    var overallFile  = overallInput && overallInput.files && overallInput.files[0];
    var plateFile    = plateInput   && plateInput.files   && plateInput.files[0];

    if (!unitTag) {
      if (statusEl) { statusEl.textContent = "Unit tag is required."; statusEl.className = "uwp-inline-status uwp-inline-status--error"; }
      return;
    }

    var saveBtn = form.querySelector(".uwp-inline-save");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }
    if (statusEl) { statusEl.textContent = ""; statusEl.className = "uwp-inline-status"; }

    var locEl = document.getElementById("location");
    var locLine = locEl && locEl.value ? String(locEl.value).trim() : "";
    var customerId = sanitizePathSegment(activeTicket.customerName || "");
    var locationId = sanitizePathSegment(locLine);
    var unitId = sanitizePathSegment(unitTag);

    // Create blob URLs so any optimistic hub inject shows photo previews
    var localOverallUrl = "";
    var localPlateUrl   = "";
    if (overallFile) {
      try { localOverallUrl = URL.createObjectURL(overallFile); } catch (e) {}
    }
    if (plateFile) {
      try { localPlateUrl = URL.createObjectURL(plateFile); } catch (e) {}
    }

    var profile = {
      unitTag:              unitTag,
      brand:                brand,
      model:                model,
      serialJob:            serial,
      voltage:              voltage,
      phase:                phase,
      refrigerant:          refrigerant,
      tonnage:              tonnage,
      manufactureYear:      manufactureYear,
      ageYears:             ageYears,
      estimatedCRV:         estimatedCRV,
      totalPreviousRepairs: prevRepairs,
      proposedRepairCost:   proposedCost,
      healthScore:          health.score,
      healthGrade:          health.grade,
      overallPhotoUrl:      localOverallUrl,
      dataPlatePhotoUrl:    localPlateUrl,
      savedAt:              new Date().toISOString(),
    };

    // Firestore profile omits blob URLs — real URLs written by uploadInlinePhotos
    var firestoreProfile = Object.assign({}, profile, {
      overallPhotoUrl:   "",
      dataPlatePhotoUrl: "",
    });

    var db = firebase.firestore();
    var equipRef = db
      .collection("Customers").doc(customerId)
      .collection("Locations").doc(locationId)
      .collection("Equipment").doc(unitId);

    equipRef.set(firestoreProfile, { merge: true }).then(function () {
      var equipmentId = customerId + "/" + locationId + "/" + unitId;

      var card = currentResults[idx];
      if (card) {
        card.equipmentId = equipmentId;
        card.unitTag = unitTag;
        card.brand = brand;
        card.model = model;
        card.overallPhotoUrl = localOverallUrl;
        card._matched = true;
      }

      // Inject into Equipment Hub with blob URLs for immediate photo visibility
      if (typeof injectEquipmentUnit === "function") {
        injectEquipmentUnit(unitId, profile);
      }

      var scroll = wrapper.querySelector(".uwp-cards-scroll");
      if (scroll) scroll.innerHTML = buildCardsOnly(currentResults);

      if (overallFile || plateFile) {
        uploadInlinePhotos(customerId, locationId, unitId, overallFile, plateFile, equipRef);
      }
    }).catch(function (err) {
      console.error("[UnitWorkParser] saveInlineEquipment", err);
      if (statusEl) { statusEl.textContent = "Save failed — " + (err.message || "try again"); statusEl.className = "uwp-inline-status uwp-inline-status--error"; }
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Unit"; }
    });
  }

  /**
   * Lazily loads firebase-storage-compat.js if the Storage SDK was not loaded yet
   * (e.g. tech opens Parse & Link without first opening Equipment Manager).
   */
  function _ensureFirebaseStorage() {
    if (typeof firebase !== "undefined" && firebase.storage) {
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage-compat.js";
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Failed to load firebase-storage-compat.js")); };
      document.head.appendChild(s);
    });
  }

  /**
   * Background upload of photos after inline save completes.
   * Calls _ensureFirebaseStorage() first so this works whether or not
   * Equipment Manager was opened before Parse & Link.
   */
  function uploadInlinePhotos(customerId, locationId, unitId, overallFile, plateFile, equipRef) {
    if (!overallFile && !plateFile) return;
    _ensureFirebaseStorage().then(function () {
      var storage = firebase.storage();
      var base = ["equipment_photos", customerId, locationId, unitId].join("/");
      var ts = Date.now();
      var promises = [];
      var urls = { overallPhotoUrl: "", dataPlatePhotoUrl: "" };

      if (overallFile) {
        var oRef  = storage.ref().child(base + "/overall_" + ts + ".jpg");
        var oMeta = { contentType: overallFile.type || "image/jpeg" };
        promises.push(
          oRef.put(overallFile, oMeta)
            .then(function () { return oRef.getDownloadURL(); })
            .then(function (url) { urls.overallPhotoUrl = url; })
            .catch(function (err) {
              if (typeof VCStorageOutbox !== "undefined") {
                VCStorageOutbox.enqueue(oRef.fullPath, overallFile, oMeta, {
                  hook: "equipmentOverallPhoto",
                  payload: { customerId: customerId, locationId: locationId, unitId: unitId },
                });
              }
              console.warn("[UnitWorkParser] overall photo upload failed — queued for retry", err);
            })
        );
      }
      if (plateFile) {
        var pRef  = storage.ref().child(base + "/dataplate_" + ts + ".jpg");
        var pMeta = { contentType: plateFile.type || "image/jpeg" };
        promises.push(
          pRef.put(plateFile, pMeta)
            .then(function () { return pRef.getDownloadURL(); })
            .then(function (url) { urls.dataPlatePhotoUrl = url; })
            .catch(function (err) {
              if (typeof VCStorageOutbox !== "undefined") {
                VCStorageOutbox.enqueue(pRef.fullPath, plateFile, pMeta, {
                  hook: "equipmentDataPlatePhoto",
                  payload: { customerId: customerId, locationId: locationId, unitId: unitId },
                });
              }
              console.warn("[UnitWorkParser] plate photo upload failed — queued for retry", err);
            })
        );
      }

      return Promise.all(promises).then(function () {
        var patch = {};
        if (urls.overallPhotoUrl) patch.overallPhotoUrl = urls.overallPhotoUrl;
        if (urls.dataPlatePhotoUrl) patch.dataPlatePhotoUrl = urls.dataPlatePhotoUrl;
        if (Object.keys(patch).length) {
          return equipRef.set(patch, { merge: true }).then(function () {
            if (typeof refreshEquipmentHubList === "function") {
              refreshEquipmentHubList();
            }
          });
        }
      });
    }).catch(function (err) {
      console.warn("[UnitWorkParser] uploadInlinePhotos", err);
    });
  }

  // --- Deduplication: track parsed content per ticket to avoid double-writes ---
  var _lastParsedHash = "";

  function hashText(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return String(h);
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

    // Offline guard
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("No internet connection. Connect to Wi-Fi or cellular and try again.");
    }

    // Deduplication: same notes + same ticket = warn
    var ticketId = getActiveTicketId();
    var contentHash = hashText(ticketId + "|" + diagText + "|" + recsText);
    if (contentHash === _lastParsedHash) {
      var proceed = confirm("You already parsed these exact notes for this ticket. Parse again?");
      if (!proceed) return;
    }

    var statusEl = document.getElementById("uwpParseStatus");
    if (statusEl) {
      statusEl.textContent = "Analyzing notes…";
      statusEl.className = "uwp-parse-status uwp-parse-status--working";
    }

    try {
      var siteEquipment = await loadSiteEquipment();
      currentSiteEquipment = siteEquipment;
      // If no equipment is on file, Gemini still extracts unit references as unmatched cards
      // so the tech can Quick-Add them directly from the overlay.
      if (!siteEquipment.length && statusEl) {
        statusEl.textContent = "No equipment on file — parsing notes for new units…";
        statusEl.className = "uwp-parse-status uwp-parse-status--working";
      }

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
        _lastParsedHash = contentHash;
        window.dispatchEvent(
          new CustomEvent("uwp:confirmed", { detail: { units: confirmed, ticketId: ticketId } })
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
      var originalText = btn.textContent;
      btn.textContent = "⏳ Parsing…";
      runParseAndLink()
        .catch(function (err) {
          var statusEl = document.getElementById("uwpParseStatus");
          if (statusEl) {
            statusEl.textContent = err.message || "Parse failed";
            statusEl.className = "uwp-parse-status uwp-parse-status--error";
          }
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = originalText;
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
