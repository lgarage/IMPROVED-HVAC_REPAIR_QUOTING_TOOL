/**
 * Voice customer / site search — shared by dispatcher (service_call.js) and field admin job create.
 * Hold-to-speak → CRM lookup → Google Places fallback → picker when multiple matches.
 */
(function () {
  "use strict";

  var recognition = null;
  var isRecording = false;
  var currentText = "";
  var carryover = "";
  var currentResults = [];
  var cfg = null;

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
    btn.textContent = cfg.defaultLabel || "🎤 Hold to speak customer name";
    btn.style.backgroundColor = cfg.defaultBg || "#f39c12";
    btn.style.transform = "";
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
      if (isRecording && btn) {
        var label = currentText.length > 42 ? currentText.slice(0, 39) + "…" : currentText;
        btn.textContent = "🗣️ " + label;
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
      resetMicBtn();
    };
    return recognition;
  }

  function queryMatchesHaystack(haystack, q) {
    if (haystack.indexOf(q) !== -1) return true;
    var stop = { IN: 1, AT: 1, THE: 1, AND: 1, ON: 1 };
    var tokens = q.split(/[\s,]+/).filter(function (w) {
      w = w.trim();
      return w.length >= 2 && !stop[w];
    });
    if (!tokens.length) return false;
    for (var t = 0; t < tokens.length; t++) {
      if (haystack.indexOf(tokens[t]) === -1) return false;
    }
    return true;
  }

  function searchInternal(query) {
    var q = String(query || "").trim().toUpperCase();
    var db = typeof getCustomerDB === "function" ? getCustomerDB() : {};
    var matches = [];
    var custName;
    var cust;
    var locId;
    var loc;
    for (custName in db) {
      cust = db[custName];
      if (!cust || !cust.locations) continue;
      for (locId in cust.locations) {
        loc = cust.locations[locId];
        var contactName = String(loc.contact || "").toUpperCase();
        var streetAddr = String(loc.street || "").toUpperCase();
        var city = String(loc.city || "").toUpperCase();
        var haystack = custName + " " + contactName + " " + streetAddr + " " + city + " " + String(loc.state || "").toUpperCase();
        if (queryMatchesHaystack(haystack, q)) {
          matches.push({
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
          });
        }
      }
    }
    return matches;
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
          "<span class=\"vc-voice-result-addr\">📍 " + escapeHtml(result.street + ", " + result.city + ", " + result.state + " " + result.zip) + "</span>";
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
    getNotify()("⚠️ Multiple matches — pick one");
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
    var internalMatches = searchInternal(query);
    if (internalMatches.length === 1) {
      if (cfg && typeof cfg.onApply === "function") cfg.onApply(internalMatches[0]);
      resetMicBtn();
      getNotify()("✓ " + internalMatches[0].custName);
      return;
    }
    if (internalMatches.length > 1) {
      currentResults = internalMatches;
      showResultsModal("Internal Database Matches", "We found multiple locations in your CRM. Select the correct one:");
      return;
    }
    try {
      var googleResults = await searchGoogle(query);
      if (googleResults.length === 1) {
        if (cfg && typeof cfg.onApply === "function") cfg.onApply(googleResults[0]);
        resetMicBtn();
        getNotify()("✓ " + googleResults[0].custName);
        return;
      }
      if (googleResults.length > 1) {
        currentResults = googleResults;
        showResultsModal("Google Maps Results", "Select the correct location:");
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
    window.removeEventListener("mouseup", stopListening);
    window.removeEventListener("touchend", stopListening);
    try { recognition.stop(); } catch (e) { /* ignore */ }
    var btn = micEl();
    if (currentText.trim()) {
      if (btn) {
        btn.textContent = "⏳ Searching…";
        btn.style.backgroundColor = "#95a5a6";
      }
      getNotify()("🎤 Heard: " + currentText);
      processQuery(currentText);
    } else {
      resetMicBtn();
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
      btn.textContent = "🔴 LISTENING…";
      btn.style.backgroundColor = "#e74c3c";
      btn.style.transform = "scale(0.97)";
    }
    window.addEventListener("mouseup", stopListening);
    window.addEventListener("touchend", stopListening);
    try { recognition.start(); } catch (e) { /* ignore */ }
  }

  function wireMicButton() {
    var btn = micEl();
    if (!btn || btn._vcVoiceWired) return;
    btn._vcVoiceWired = true;
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); startListening(); });
    btn.addEventListener("touchstart", function (e) { e.preventDefault(); startListening(); }, { passive: false });
  }

  function init(options) {
    cfg = options || {};
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
