/**
 * Dictation-first workspace: Firestore asset tray + Gemini "HVAC Rosetta Stone" mapping.
 *
 * Firestore: customers/{customerId}/sites/{siteId}/assets/{assetId}
 *
 * Depends on: firebase, activeTicket, getGeminiApiKey, GEMINI_GENERATE_MODEL (technician app)
 */
(function () {
  "use strict";

  /** After a successful Process, re-applied when Firestore refreshes the tray. null = never processed this session. */
  var rosettaState = { ids: null };
  var lastDictationTicketId = null;

  var assetsUnsub = null;
  var notesInputBound = false;
  var notesDebounce = null;
  var locationBlurBound = false;

  var SYSTEM_INSTRUCTION = [
    "You are a master HVAC data-mapper. Follow these rules exactly.",
    "",
    "SLANG → STANDARD CODES:",
    '- "Entrance Heater" / "Vestibule Heater" → VH',
    '- "Roof Fan" / "Exhaust Fan" → EF',
    '- "Hanging Heater" / "Unit Heater" → UH',
    '- "Package Unit" / "Rooftop Unit" → RTU',
    '- "Fresh Air Unit" / "MUA" → MUA',
    "",
    "QUANTITY / MULTIPLIERS:",
    'Spelled or spoken quantities must expand into numbered asset ids (e.g. "Two RTUs" → RTU1 and RTU2).',
    'Use digit counts when given: 1 → one id, 2 → two ids, etc.',
    'The words "both", "pair", or "a pair" mean 2 units of the preceding or implied equipment type.',
    'The word "handful" means 3 units.',
    'If quantity is unclear, infer conservatively from context or use a single unit (…1).',
    "",
    "OUTPUT:",
    "Return ONLY valid JSON (no markdown fences) with exactly these keys:",
    '- "identifiedAssetIds": array of strings like ["RTU1","RTU2","VH1","EF1"]',
    '- "locationTransposed": string, standardized as "CUSTOMER - CITY - STREET" using ALL CAPS for the three parts; use hyphens with spaces as shown. If unknown, use best effort from context or empty string "".',
    '- "visitSummary": one clean sentence summarizing work mentioned in the notes.',
  ].join("\n");

  function sanitizePathSegment(s) {
    return (
      String(s || "")
        .trim()
        .replace(/[/\\]+/g, "_")
        .replace(/\s+/g, " ")
        .slice(0, 200) || "unknown"
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad2(n) {
    return String(n).length < 2 ? "0" + n : String(n);
  }

  function formatLastServiceDate(v) {
    if (v == null || v === "") return "—";
    if (typeof v === "string") return v;
    if (v.toDate && typeof v.toDate === "function") {
      try {
        var d = v.toDate();
        return (
          d.getFullYear() +
          "-" +
          pad2(d.getMonth() + 1) +
          "-" +
          pad2(d.getDate())
        );
      } catch (e) {}
    }
    return "—";
  }

  function pickThumbUrl(images) {
    if (!images || typeof images !== "object") return "";
    var g = images.ghost;
    var n = images.nameplate;
    if (g && g.thumbUrl) return String(g.thumbUrl);
    if (g && g.url) return String(g.url);
    if (n && n.thumbUrl) return String(n.thumbUrl);
    if (n && n.url) return String(n.url);
    return "";
  }

  function normalizeUnitId(s) {
    return String(s || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
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
      var o = t.indexOf("{");
      var c = t.lastIndexOf("}");
      if (o >= 0 && c > o) {
        try {
          return JSON.parse(t.slice(o, c + 1));
        } catch (e2) {}
      }
      return null;
    }
  }

  function getNotesEl() {
    return document.getElementById("dictationHubNotes");
  }

  function setProcessStatus(kind, message) {
    var el = document.getElementById("dictationProcessStatus");
    if (!el) return;
    el.classList.remove("dictation-process-status--done");
    el.textContent = message || "";
    if (kind === "done") el.classList.add("dictation-process-status--done");
  }

  function clearRosettaUi() {
    rosettaState.ids = null;
    var tray = document.getElementById("dictationActionTray");
    if (tray) {
      tray.querySelectorAll(".dictation-asset-card").forEach(function (c) {
        c.classList.remove("active-asset");
      });
      tray.querySelectorAll(".dictation-asset-card--ghost").forEach(function (g) {
        g.remove();
      });
    }
    setProcessStatus("", "");
  }

  function unsubscribeAssetsOnly() {
    if (typeof assetsUnsub === "function") {
      assetsUnsub();
      assetsUnsub = null;
    }
  }

  function removeGhostCards(tray) {
    tray.querySelectorAll(".dictation-asset-card--ghost").forEach(function (g) {
      g.remove();
    });
  }

  function applyRosettaOverlay() {
    var tray = document.getElementById("dictationActionTray");
    if (!tray || rosettaState.ids === null) return;

    var ids = Array.isArray(rosettaState.ids) ? rosettaState.ids : [];
    var idSet = [];
    ids.forEach(function (id) {
      var n = normalizeUnitId(id);
      if (n && idSet.indexOf(n) < 0) idSet.push(n);
    });

    tray.querySelectorAll(".dictation-asset-card").forEach(function (c) {
      c.classList.remove("active-asset");
    });
    removeGhostCards(tray);

    var matched = {};
    tray.querySelectorAll(".dictation-asset-card:not(.dictation-asset-card--ghost)").forEach(function (card) {
      var lid = card.getAttribute("data-logical-id");
      if (!lid) return;
      var key = normalizeUnitId(lid);
      if (idSet.indexOf(key) >= 0) {
        card.classList.add("active-asset");
        matched[key] = true;
      }
    });

    idSet.forEach(function (key) {
      if (matched[key]) return;
      tray.appendChild(createGhostAssetCard(key));
    });
  }

  function createGhostAssetCard(logicalId) {
    var article = document.createElement("article");
    article.className = "dictation-asset-card dictation-asset-card--ghost";
    article.setAttribute("data-logical-id", logicalId);
    article.setAttribute("data-ghost-asset", "1");

    var thumb = document.createElement("div");
    thumb.className = "dictation-asset-card-thumb";
    var uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "dictation-ghost-upload-btn";
    uploadBtn.setAttribute(
      "title",
      "Open site equipment to add this unit"
    );
    uploadBtn.setAttribute("aria-label", "Add asset or open equipment hub");
    uploadBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
    uploadBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var hub = document.getElementById("btnOpenEquipmentHub");
      if (hub) hub.click();
    });
    thumb.appendChild(uploadBtn);

    var body = document.createElement("div");
    body.className = "dictation-asset-card-body";
    body.innerHTML =
      '<div class="dictation-asset-card-id">' +
      escapeHtml("NEW ASSET: " + logicalId) +
      "</div>" +
      '<div class="dictation-asset-card-meta">Not in site list</div>' +
      '<div class="dictation-asset-card-loc">Tap upload to open Equipment Hub and capture nameplate.</div>' +
      '<div class="dictation-asset-card-date">AI identified</div>';

    article.appendChild(thumb);
    article.appendChild(body);
    return article;
  }

  /**
   * Gemini: map raw notes → JSON; update location, highlight tray, ghost cards.
   * @param {string} text Raw visit / dictation notes
   */
  async function processVisitNotes(text) {
    var raw = String(text || "").trim();
    if (!raw) {
      throw new Error("Enter some notes before processing.");
    }

    if (typeof getGeminiApiKey !== "function") {
      throw new Error("Gemini API key is not available (getGeminiApiKey).");
    }
    var key = await getGeminiApiKey();
    if (!key) {
      throw new Error("Add the Gemini API key under Settings → Integrations & API Keys.");
    }

    var locEl = document.getElementById("location");
    var locCtx =
      locEl && locEl.value ? String(locEl.value).trim() : "";

    var userPayload =
      "Technician dictation / notes:\n" +
      raw +
      "\n\nCurrent location field (may help standardize locationTransposed):\n" +
      (locCtx || "(empty)") +
      "\n\nRespond with JSON only.";

    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      geminiModelId() +
      ":generateContent?key=" +
      encodeURIComponent(key);

    var body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPayload }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
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
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Could not parse Gemini JSON. Check the console.");
    }

    var identified =
      parsed.identifiedAssetIds != null
        ? parsed.identifiedAssetIds
        : parsed.identified_asset_ids;
    if (!Array.isArray(identified)) {
      identified = [];
    }

    var locationTransposed =
      parsed.locationTransposed != null
        ? String(parsed.locationTransposed).trim()
        : parsed.location_transposed != null
          ? String(parsed.location_transposed).trim()
          : "";

    if (locationTransposed && locEl) {
      locEl.value = locationTransposed;
      if (typeof saveDraft === "function") saveDraft();
    }

    rosettaState.ids = identified.map(function (x) {
      return String(x || "").trim();
    }).filter(Boolean);

    applyRosettaOverlay();

    var summary =
      parsed.visitSummary != null
        ? String(parsed.visitSummary).trim()
        : parsed.visit_summary != null
          ? String(parsed.visit_summary).trim()
          : "";
    if (summary) {
      console.log("[DictationHub] visitSummary:", summary);
    }

    setProcessStatus("done", "✓ AI processed");
  }

  function storageKeyForTicket() {
    if (typeof activeTicket === "undefined" || !activeTicket || !activeTicket.id) {
      return "dictationHubNotes_draft";
    }
    return "dictationHubNotes_" + activeTicket.id;
  }

  function loadNotesFromStorage() {
    var el = getNotesEl();
    if (!el) return;
    try {
      var v = localStorage.getItem(storageKeyForTicket());
      if (v != null) el.value = v;
    } catch (e) {}
  }

  function schedulePersistNotes() {
    var el = getNotesEl();
    if (!el) return;
    if (notesDebounce) clearTimeout(notesDebounce);
    notesDebounce = setTimeout(function () {
      notesDebounce = null;
      try {
        localStorage.setItem(storageKeyForTicket(), el.value);
      } catch (e) {}
    }, 400);
  }

  function wireNotesPersistence() {
    var el = getNotesEl();
    if (!el || notesInputBound) return;
    notesInputBound = true;
    el.addEventListener("input", schedulePersistNotes);
  }

  function wireLocationResubscribe() {
    var loc = document.getElementById("location");
    if (!loc || locationBlurBound) return;
    locationBlurBound = true;
    loc.addEventListener("blur", function () {
      if (typeof window.startDictationHubFromWorkspace === "function") {
        window.startDictationHubFromWorkspace();
      }
    });
  }

  function renderActionTray(docs) {
    var tray = document.getElementById("dictationActionTray");
    if (!tray) return;

    var hasDocs = docs && docs.length > 0;

    if (!hasDocs) {
      if (rosettaState.ids === null) {
        tray.innerHTML =
          '<p class="dictation-action-tray-empty">No assets for this customer/site yet. Add documents under <code>customers / sites / assets</code> in Firestore.</p>';
        return;
      }
      tray.innerHTML = "";
    } else {
      var html = "";
      docs.forEach(function (row) {
        var d = row.data || {};
        var logical =
          d.id != null && String(d.id).trim()
            ? String(d.id).trim()
            : row.id;
        var logicalNorm = normalizeUnitId(logical);
        var typ = d.type != null ? String(d.type) : "—";
        var locDesc =
          d.locationDescription != null ? String(d.locationDescription) : "—";
        var last = formatLastServiceDate(d.lastServiceDate);
        var thumb = pickThumbUrl(d.images);
        var thumbBlock = thumb
          ? '<div class="dictation-asset-card-thumb"><img src="' +
            escapeHtml(thumb) +
            '" alt="" loading="lazy"></div>'
          : '<div class="dictation-asset-card-thumb dictation-asset-card-thumb--placeholder" aria-hidden="true">◇</div>';

        html +=
          '<article class="dictation-asset-card" data-asset-id="' +
          escapeHtml(row.id) +
          '" data-logical-id="' +
          escapeHtml(logicalNorm) +
          '">' +
          thumbBlock +
          '<div class="dictation-asset-card-body">' +
          '<div class="dictation-asset-card-id">' +
          escapeHtml(logical) +
          "</div>" +
          '<div class="dictation-asset-card-meta">' +
          escapeHtml(typ) +
          "</div>" +
          '<div class="dictation-asset-card-loc">' +
          escapeHtml(locDesc) +
          "</div>" +
          '<div class="dictation-asset-card-date">Last: ' +
          escapeHtml(last) +
          "</div>" +
          "</div></article>";
      });
      tray.innerHTML = html;
    }

    applyRosettaOverlay();
  }

  function teardownDictationHub() {
    unsubscribeAssetsOnly();
    lastDictationTicketId = null;
    clearRosettaUi();
  }

  function startDictationHubAssetsListener() {
    if (typeof activeTicket !== "undefined" && activeTicket && activeTicket.id) {
      if (lastDictationTicketId !== activeTicket.id) {
        rosettaState.ids = null;
        setProcessStatus("", "");
        lastDictationTicketId = activeTicket.id;
      }
    }

    unsubscribeAssetsOnly();
    loadNotesFromStorage();
    wireNotesPersistence();
    wireLocationResubscribe();

    var tray = document.getElementById("dictationActionTray");
    if (tray) {
      tray.innerHTML =
        '<p class="dictation-action-tray-loading">Loading assets…</p>';
    }

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      if (tray) {
        tray.innerHTML =
          '<p class="dictation-action-tray-empty">Firebase not available.</p>';
      }
      return;
    }

    if (typeof activeTicket === "undefined" || !activeTicket) {
      if (tray) {
        tray.innerHTML =
          '<p class="dictation-action-tray-empty">Select a job to load site assets.</p>';
      }
      return;
    }

    var locEl = document.getElementById("location");
    var locLine =
      locEl && locEl.value
        ? String(locEl.value).trim()
        : activeTicket.customerName + " - " + (activeTicket.locationAddress || "");
    var customerId = sanitizePathSegment(activeTicket.customerName || "");
    var siteId = sanitizePathSegment(locLine);

    var db = firebase.firestore();
    var ref = db
      .collection("customers")
      .doc(customerId)
      .collection("sites")
      .doc(siteId)
      .collection("assets");

    assetsUnsub = ref.onSnapshot(
      function (snap) {
        var rows = [];
        snap.forEach(function (doc) {
          rows.push({ id: doc.id, data: doc.data() || {} });
        });
        rows.sort(function (a, b) {
          return String(a.id).localeCompare(String(b.id));
        });
        renderActionTray(rows);
      },
      function (err) {
        console.error("[DictationHub] assets listener", err);
        if (tray) {
          tray.innerHTML =
            '<p class="dictation-action-tray-empty">Could not load assets. ' +
            escapeHtml(err.message || String(err)) +
            "</p>";
        }
      }
    );
  }

  function onProcessNotesClick() {
    var el = getNotesEl();
    var raw = el ? el.value : "";
    var btn = document.getElementById("dictationProcessBtn");
    setProcessStatus("", "…");
    if (btn) btn.disabled = true;
    processVisitNotes(raw)
      .then(function () {
        if (btn) btn.disabled = false;
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        setProcessStatus("", "");
        var msg =
          err && err.message ? err.message : "Processing failed.";
        console.error("[DictationHub] processVisitNotes", err);
        alert(msg);
      });
  }

  function wireProcessButton() {
    var btn = document.getElementById("dictationProcessBtn");
    if (!btn || btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", onProcessNotesClick);
  }

  window.processVisitNotes = processVisitNotes;
  window.teardownDictationHub = teardownDictationHub;
  window.startDictationHubFromWorkspace = function () {
    wireProcessButton();
    startDictationHubAssetsListener();
  };
})();
