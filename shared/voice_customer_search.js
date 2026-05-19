/**
 * Voice customer / site search — shared by dispatcher (service_call.js) and field admin job create.
 * Tap (field) or hold (dispatcher) → CRM lookup → Google Places fallback → picker when multiple matches.
 */
(function () {
  "use strict";

  var recognition = null;
  var isRecording = false;
  var currentText = "";
  var carryover = "";
  var currentResults = [];
  var cfg = null;

  var STOP_WORDS = { IN: 1, AT: 1, THE: 1, AND: 1, ON: 1, A: 1 };

  function getNotify() {
    if (cfg && typeof cfg.notify === "function") return cfg.notify;
    if (typeof showSaveCue === "function") return showSaveCue;
    if (typeof showVcFieldToast === "function") return showVcFieldToast;
    return function () {};
  }

  function micEl() {
    return cfg && cfg.micBtnId ? document.getElementById(cfg.micBtnId) : null;
  }

  function resetMicBtn() {
    var btn = micEl();
    if (!btn) return;
    btn.textContent = cfg.defaultLabel || "🎤 Tap to speak customer name";
    btn.style.backgroundColor = cfg.defaultBg || "#f39c12";
    btn.style.transform = "";
    btn.setAttribute("aria-pressed", "false");
  }

  function tokenizeQuery(q) {
    return String(q || "").toUpperCase().split(/[\s,]+/).map(function (w) {
      return w.trim();
    }).filter(function (w) {
      return w.length >= 2 && !STOP_WORDS[w];
    });
  }

  function initRecognition() {
    if (recognition) return recognition;
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return null;
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = function (event) {
      var segment = "";
      for (var i = 0; i < event.results.length; i++) {
        segment += event.results[i][0].transcript;
      }
      var seg = segment.trim();
      currentText = (carryover + (carryover && seg ? " " : "") + seg).trim();
      var btn = micEl();
      if (isRecording && btn && cfg.interactionMode === "tap") {
        var heard = currentText.length > 36 ? currentText.slice(0, 33) + "…" : currentText;
        btn.textContent = "🗣️ " + (heard || "Listening…");
      } else if (isRecording && btn) {
        btn.textContent = "🗣️ " + (currentText.length > 42 ? currentText.slice(0, 39) + "…" : currentText);
      }
    };

    recognition.onend = function () {
      if (isRecording) {
        carryover = currentText;
        try { recognition.start(); } catch (e) { /* ignore */ }
      }
    };

    recognition.onerror = function (event) {
      if (event.error === "aborted") return;
      if (event.error === "no-speech" && isRecording) return;
      console.error("[VCVoiceCustomerSearch]", event.error);
      isRecording = false;
      resetMicBtn();
    };
    return recognition;
  }

  function buildLocationResult(custName, cust, locId, loc) {
    return {
      source: "internal",
      custName: custName,
      custId: cust.id,
      locId: locId,
      contact: loc.contact || "",
      phone: loc.phone || "",
      email: loc.email || "",
      street: loc.street || "",
      city: loc.city || "",
      state: loc.state || "",
      zip: loc.zip || ""
    };
  }

  function queryMatchesHaystack(haystack, q, tokens) {
    if (haystack.indexOf(q) !== -1) return true;
    if (!tokens || !tokens.length) tokens = tokenizeQuery(q);
    if (!tokens.length) return false;
    for (var t = 0; t < tokens.length; t++) {
      if (haystack.indexOf(tokens[t]) === -1) return false;
    }
    return true;
  }

  function customerNameMatchesTokens(custName, tokens) {
    var cn = String(custName || "").toUpperCase();
    if (!tokens.length) return false;
    var hit = 0;
    for (var i = 0; i < tokens.length; i++) {
      if (cn.indexOf(tokens[i]) !== -1) hit++;
    }
    return hit >= Math.min(2, tokens.length);
  }

  function locationMatchesCityTokens(loc, cityTokens) {
    if (!cityTokens.length) return true;
    var place = (
      String(loc.city || "") + " " +
      String(loc.street || "") + " " +
      String(loc.state || "") + " " +
      String(loc.zip || "")
    ).toUpperCase();
    for (var i = 0; i < cityTokens.length; i++) {
      if (place.indexOf(cityTokens[i]) === -1) return false;
    }
    return true;
  }

  function dedupeResults(list) {
    var seen = {};
    var out = [];
    list.forEach(function (item) {
      var key = item.custName + "|" + item.locId + "|" + item.street;
      if (seen[key]) return;
      seen[key] = true;
      out.push(item);
    });
    return out;
  }

  /**
   * When the user says "planet fitness in green bay", include every CRM location for that
   * customer whose city/address matches the city tokens — not just the first strict match.
   */
  function expandMultiLocationMatches(matches, query) {
    var db = typeof getCustomerDB === "function" ? getCustomerDB() : {};
    var tokens = tokenizeQuery(query);
    if (!tokens.length) return matches;

    var expanded = matches.slice();
    var custName;
    var cust;
    var locId;
    var loc;

    for (custName in db) {
      cust = db[custName];
      if (!cust || !cust.locations) continue;
      if (!customerNameMatchesTokens(custName, tokens)) continue;

      var locIds = Object.keys(cust.locations);
      if (locIds.length < 2) continue;

      var cityTokens = [];
      locIds.forEach(function (id) {
        var c = String((cust.locations[id] && cust.locations[id].city) || "").toUpperCase();
        tokens.forEach(function (t) {
          if (c.indexOf(t) !== -1 && cityTokens.indexOf(t) === -1) cityTokens.push(t);
        });
      });

      locIds.forEach(function (id) {
        loc = cust.locations[id];
        if (!loc) return;
        if (!locationMatchesCityTokens(loc, cityTokens)) return;
        expanded.push(buildLocationResult(custName, cust, id, loc));
      });
    }

    return dedupeResults(expanded);
  }

  function searchInternal(query) {
    var q = String(query || "").trim().toUpperCase();
    var tokens = tokenizeQuery(q);
    var db = typeof getCustomerDB === "function" ? getCustomerDB() : {};
    var matches = [];

    for (var custName in db) {
      var cust = db[custName];
      if (!cust || !cust.locations) continue;
      for (var locId in cust.locations) {
        var loc = cust.locations[locId];
        var haystack = (
          custName + " " +
          String(loc.contact || "") + " " +
          String(loc.street || "") + " " +
          String(loc.city || "") + " " +
          String(loc.state || "")
        ).toUpperCase();
        if (queryMatchesHaystack(haystack, q, tokens)) {
          matches.push(buildLocationResult(custName, cust, locId, loc));
        }
      }
    }

    return expandMultiLocationMatches(dedupeResults(matches), query);
  }

  async function ensureCustomerDbLoaded() {
    if (typeof getCustomerDB !== "function") return;
    var db = getCustomerDB();
    if (Object.keys(db).length > 0) return;
    if (typeof loadCustomersFromCloud === "function") {
      try { await loadCustomersFromCloud(); } catch (e) {
        console.warn("[VCVoiceCustomerSearch] CRM load failed", e);
      }
    }
  }

  async function searchGoogle(query) {
    if (typeof google === "undefined" || typeof google.maps === "undefined") {
      throw new Error("Google Maps API unavailable");
    }
    if (window.googleMapsPromise) await window.googleMapsPromise;
    var lib = await google.maps.importLibrary("places");
    var Place = lib.Place;
    var resp = await Place.searchByText({
      textQuery: query,
      fields: ["displayName", "formattedAddress"],
      maxResultCount: 10,
      region: "us"
    });
    var places = resp.places || [];
    return places.map(function (place) {
      var name = String(place.displayName || "").toUpperCase();
      var addressStr = String(place.formattedAddress || "").toUpperCase();
      var addrParts = addressStr.split(",").map(function (p) { return p.trim(); });
      if (addrParts[addrParts.length - 1] === "USA") addrParts.pop();
      var city = "";
      var state = "";
      var zip = "";
      var street = "";
      if (addrParts.length >= 3) {
        var stateZip = addrParts[addrParts.length - 1].split(" ");
        city = addrParts[addrParts.length - 2];
        street = addrParts.slice(0, addrParts.length - 2).join(", ");
        if (stateZip.length >= 1) state = stateZip[0];
        if (stateZip.length >= 2) zip = stateZip[1];
      } else {
        street = addressStr;
      }
      return {
        source: "google",
        custName: name,
        street: street,
        city: city,
        state: state,
        zip: zip,
        custId: "",
        locId: "",
        contact: "",
        phone: "",
        email: "",
        rawAddress: addressStr
      };
    });
  }

  function showResultsModal(titleText, subtitleText) {
    var modal = document.getElementById(cfg.modalId);
    var listContainer = document.getElementById(cfg.listId);
    if (!modal || !listContainer) return;
    var h2 = modal.querySelector("[data-vc-voice-title]");
    var p = modal.querySelector("[data-vc-voice-subtitle]");
    if (h2) h2.textContent = titleText;
    if (p) p.textContent = subtitleText;
    listContainer.innerHTML = "";
    currentResults.forEach(function (result, index) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "vc-voice-result-row" + (result.source === "internal" ? " vc-voice-result-row--internal" : "");
      if (result.source === "internal") {
        row.innerHTML =
          "<strong>" + escapeHtml(result.custName) + "</strong>" +
          "<span class=\"vc-voice-result-meta\">Contact: " + escapeHtml(result.contact || "None") + "</span>" +
          "<span class=\"vc-voice-result-addr\">📍 " + escapeHtml(result.street + ", " + result.city + ", " + result.state + " " + result.zip) + "</span>" +
          "<span class=\"vc-voice-result-meta\">Loc #: " + escapeHtml(result.locId || "") + "</span>";
      } else {
        row.innerHTML =
          "<strong>" + escapeHtml(result.custName) + "</strong> <span class=\"vc-voice-result-tag\">(Google)</span>" +
          "<span class=\"vc-voice-result-addr\">📍 " + escapeHtml(result.rawAddress || "") + "</span>";
      }
      row.addEventListener("click", function () { selectResult(index); });
      listContainer.appendChild(row);
    });
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    getNotify()("Pick the correct location");
  }

  function closeModal() {
    var modal = document.getElementById(cfg.modalId);
    if (modal) {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }
    resetMicBtn();
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function selectResult(index) {
    var selected = currentResults[index];
    closeModal();
    if (selected && cfg && typeof cfg.onApply === "function") {
      cfg.onApply(selected);
    }
    resetMicBtn();
  }

  async function processQuery(query) {
    await ensureCustomerDbLoaded();
    var internalMatches = searchInternal(query);

    if (internalMatches.length > 1) {
      currentResults = internalMatches;
      showResultsModal("Multiple Locations Found", "We found multiple locations in your CRM. Select the correct one:");
      return;
    }
    if (internalMatches.length === 1) {
      if (cfg && typeof cfg.onApply === "function") cfg.onApply(internalMatches[0]);
      resetMicBtn();
      getNotify()("✓ " + internalMatches[0].custName);
      return;
    }

    try {
      var googleResults = await searchGoogle(query);
      if (googleResults.length > 1) {
        currentResults = googleResults;
        showResultsModal("Google Maps Results", "Select the correct location:");
        return;
      }
      if (googleResults.length === 1) {
        if (cfg && typeof cfg.onApply === "function") cfg.onApply(googleResults[0]);
        resetMicBtn();
        getNotify()("✓ " + googleResults[0].custName);
        return;
      }
      alert("No matches found for \"" + query + "\". Try again or type manually.");
      resetMicBtn();
    } catch (err) {
      console.error("[VCVoiceCustomerSearch]", err);
      alert("No internal matches and Google search failed. Type the customer manually.");
      resetMicBtn();
    }
  }

  function stopListening() {
    if (!isRecording) return;
    isRecording = false;
    carryover = "";
    if (cfg.interactionMode !== "tap") {
      window.removeEventListener("mouseup", stopListening);
      window.removeEventListener("touchend", stopListening);
    }
    try { recognition.stop(); } catch (e) { /* ignore */ }
    var btn = micEl();
    if (btn) btn.setAttribute("aria-pressed", "false");
    if (currentText.trim()) {
      if (btn) {
        btn.textContent = "⏳ Searching…";
        btn.style.backgroundColor = "#95a5a6";
      }
      getNotify()("🎤 Heard: " + currentText);
      processQuery(currentText);
    } else {
      resetMicBtn();
      getNotify()("Didn't catch that — tap and try again");
    }
  }

  function startListening() {
    if (!initRecognition()) {
      alert("Voice search not supported in this browser. Use Chrome or Safari.");
      return;
    }
    if (isRecording) return;
    isRecording = true;
    currentText = "";
    carryover = "";
    var btn = micEl();
    if (btn) {
      if (cfg.interactionMode === "tap") {
        btn.textContent = cfg.listeningLabel || "🔴 Tap again to search";
      } else {
        btn.textContent = "🔴 LISTENING… (release when done)";
      }
      btn.style.backgroundColor = "#e74c3c";
      btn.style.transform = "scale(0.97)";
      btn.setAttribute("aria-pressed", "true");
    }
    if (cfg.interactionMode !== "tap") {
      window.addEventListener("mouseup", stopListening);
      window.addEventListener("touchend", stopListening);
    }
    try { recognition.start(); } catch (e) { /* ignore */ }
  }

  function toggleMic() {
    if (isRecording) stopListening();
    else startListening();
  }

  function wireMicButton() {
    var btn = micEl();
    if (!btn || btn._vcVoiceWired) return;
    btn._vcVoiceWired = true;

    if (cfg.interactionMode === "tap") {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        toggleMic();
      });
      return;
    }

    btn.addEventListener("mousedown", function (e) { e.preventDefault(); startListening(); });
    btn.addEventListener("touchstart", function (e) { e.preventDefault(); startListening(); }, { passive: false });
  }

  function init(options) {
    cfg = options || {};
    if (!cfg.interactionMode) cfg.interactionMode = "tap";
    initRecognition();
    wireMicButton();
    var modal = document.getElementById(cfg.modalId);
    if (modal && !modal._vcVoiceWired) {
      modal._vcVoiceWired = true;
      modal.addEventListener("click", function (e) {
        if (e.target === modal || e.target.closest("[data-vc-voice-cancel]")) closeModal();
      });
    }
    resetMicBtn();
  }

  window.VCVoiceCustomerSearch = {
    init: init,
    resetMicBtn: resetMicBtn,
    closeModal: closeModal
  };
})();
