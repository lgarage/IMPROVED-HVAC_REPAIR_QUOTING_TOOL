/**
 * Conversational Timeline — Slice 41b.
 *
 * Slice 41a: localStorage-only timeline, bubble layout, workspace integration.
 * Slice 41b: Hold-to-Talk action bar + live Web Speech API STT.
 *   - #ct-action-bar: fixed bottom bar inside the timeline section.
 *   - #ct-talk-btn: 56px circular hold-to-talk button with cyan recording glow.
 *   - #ct-type-input: text fallback (Enter key submits).
 *   - Draft bubble with pulsing border shows interim transcript while recording.
 *   - Release → finalise → addEntry("tech") in localStorage timeline.
 *   - Handles: permission denied, browser not-supported, interim vs. final results.
 *   - Compatible with iOS Safari (webkitSpeechRecognition) and Chrome Android.
 *
 * Exports: startListening, stopListening (required by slice validation).
 */
(function () {
  "use strict";

  /* ── localStorage helpers ─────────────────────────────────────── */

  var LS_PREFIX = "vc_conversational_timeline_";
  var currentTicketId = "draft";
  var initialized = false;

  function storageKey(ticketId) {
    return LS_PREFIX + (ticketId || "draft");
  }

  function loadEntries(ticketId) {
    try {
      var raw = localStorage.getItem(storageKey(ticketId));
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveEntries(ticketId, entries) {
    try {
      localStorage.setItem(storageKey(ticketId), JSON.stringify(entries || []));
    } catch (e) {
      /* quota exceeded — degrade silently */
    }
  }

  /* ── id / ticket helpers ──────────────────────────────────────── */

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function normalizeTicketId(ticketId) {
    if (ticketId && String(ticketId).trim()) return String(ticketId).trim();
    var ticket = getActiveTicket();
    if (ticket) {
      return resolveTicketIdFromObject(ticket) || "draft";
    }
    return "draft";
  }

  function resolveTicketIdFromObject(ticket) {
    if (!ticket || typeof ticket !== "object") return "";
    return (
      ticket.ticketId ||
      ticket.id ||
      ticket.tid ||
      ticket.ticketNum ||
      ticket.ticket ||
      ""
    );
  }

  function getActiveTicket() {
    return typeof activeTicket !== "undefined" ? activeTicket : null;
  }

  /* ── DOM helpers ──────────────────────────────────────────────── */

  function getListElement() {
    return document.getElementById("ct-message-list");
  }

  function safeText(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(String(value)));
    return div.innerHTML;
  }

  function formatTime(isoString) {
    try {
      var d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  /* ── entry model ──────────────────────────────────────────────── */

  function createEntry(role, text, meta) {
    var normalizedRole = role === "system" ? "system" : "tech";
    var trimmed = safeText(text);
    if (!trimmed) return null;
    return {
      id: createId(),
      ts: new Date().toISOString(),
      role: normalizedRole,
      text: trimmed,
      meta: meta || null
    };
  }

  /* ── ticket context seed ──────────────────────────────────────── */

  function buildContextText(ticket) {
    if (!ticket || typeof ticket !== "object") return "";
    var parts = [];
    var jobInfo = safeText(ticket.jobNum || ticket.ticketNum || ticket.ticket || ticket.tid || "");
    var customer = safeText(ticket.customerName || ticket.customer || "");
    var site = safeText(ticket.address || ticket.locationAddress || ticket.location || "");
    if (jobInfo) parts.push("Job: " + jobInfo);
    if (customer) parts.push("Customer: " + customer);
    if (site) parts.push("Site: " + site);
    return parts.join("\n");
  }

  function hasContextSeed(entries, ticketId) {
    if (!Array.isArray(entries)) return false;
    for (var i = 0; i < entries.length; i++) {
      var item = entries[i];
      if (!item || !item.meta) continue;
      if (item.meta.seed === "ticket-context" && item.meta.ticketId === ticketId) {
        return true;
      }
    }
    return false;
  }

  function seedFromTicket(ticketId) {
    var ticket = getActiveTicket();
    if (!ticket || typeof ticket !== "object") return;
    var entries = loadEntries(ticketId);
    var contextText = buildContextText(ticket);
    if (!contextText) return;
    if (hasContextSeed(entries, ticketId)) return;
    entries.push(createEntry("system", contextText, {
      seed: "ticket-context",
      ticketId: ticketId
    }));
    saveEntries(ticketId, entries);
  }

  /* ── render ───────────────────────────────────────────────────── */

  function scrollToBottom() {
    var list = getListElement();
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }

  function renderTimeline(ticketId) {
    var id = normalizeTicketId(ticketId);
    var list = getListElement();
    if (!list) return;
    currentTicketId = id;
    var entries = loadEntries(id);

    if (!entries.length) {
      list.innerHTML = '<p class="ct-empty">No messages yet. Additions are persisted per ticket.</p>';
      return;
    }

    var html = "";
    for (var i = 0; i < entries.length; i++) {
      var item = entries[i];
      if (!item || !item.text) continue;
      var isTech = item.role === "tech";
      var alignClass = isTech ? "tech" : "system";
      var senderLabel = isTech ? "Technician" : "System";
      html +=
        '<div class="ct-message ct-message--' + alignClass + '">' +
          '<span class="ct-message__body">' + escapeHtml(item.text) + "</span>" +
          '<span class="ct-message__meta">' +
            escapeHtml(senderLabel) + " · " + escapeHtml(formatTime(item.ts)) +
          "</span>" +
        "</div>";
    }
    list.innerHTML = html;
    scrollToBottom();
  }

  function addEntry(text, role, ticketId, meta) {
    var id = normalizeTicketId(ticketId);
    var entry = createEntry(role, text, meta);
    if (!entry) return null;
    var entries = loadEntries(id);
    entries.push(entry);
    saveEntries(id, entries);
    if (id === currentTicketId) {
      renderTimeline(id);
    }
    return entry;
  }

  /* ── STT / Hold-to-Talk ───────────────────────────────────────── */

  var _recognition = null;
  var _isRecording = false;
  var _draftEl = null;
  var _finalTranscript = "";
  var _interimTranscript = "";

  function getSpeechRecognitionClass() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function isSTTSupported() {
    return getSpeechRecognitionClass() !== null;
  }

  function createRecognition() {
    var SRClass = getSpeechRecognitionClass();
    if (!SRClass) return null;
    var r = new SRClass();
    r.continuous = false;     /* iOS Safari does not support continuous reliably */
    r.interimResults = true;
    r.lang = "en-US";
    r.maxAlternatives = 1;
    return r;
  }

  function showDraftBubble(text) {
    var list = getListElement();
    if (!list) return;

    /* Remove "no messages" placeholder if present */
    var placeholder = list.querySelector(".ct-empty");
    if (placeholder) placeholder.remove();

    if (!_draftEl) {
      _draftEl = document.createElement("div");
      _draftEl.className = "ct-message ct-message--tech ct-message--draft";
      list.appendChild(_draftEl);
    }
    _draftEl.textContent = text || "…";
    scrollToBottom();
  }

  function removeDraftBubble() {
    if (_draftEl) {
      if (_draftEl.parentNode) _draftEl.parentNode.removeChild(_draftEl);
      _draftEl = null;
    }
  }

  function setRecordingState(active) {
    _isRecording = active;
    var btn = document.getElementById("ct-talk-btn");
    if (!btn) return;
    if (active) {
      btn.classList.add("ct-recording");
      btn.setAttribute("aria-pressed", "true");
      btn.textContent = "🔴";
    } else {
      btn.classList.remove("ct-recording");
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = "🎙️";
    }
  }

  function showPermissionDeniedHint() {
    var list = getListElement();
    if (!list) return;
    var hint = document.createElement("p");
    hint.className = "ct-empty";
    hint.textContent = "Microphone access denied — use the text field to add notes.";
    list.appendChild(hint);
    scrollToBottom();
  }

  /**
   * startListening — exported.
   * Activates webkitSpeechRecognition / SpeechRecognition, shows a draft bubble
   * with live interim transcript. If STT is not supported, focuses the text input.
   */
  function startListening() {
    if (_isRecording) return;

    if (!isSTTSupported()) {
      var input = document.getElementById("ct-type-input");
      if (input) input.focus();
      return;
    }

    _finalTranscript = "";
    _interimTranscript = "";
    setRecordingState(true);
    showDraftBubble("…");

    _recognition = createRecognition();
    if (!_recognition) {
      setRecordingState(false);
      removeDraftBubble();
      return;
    }

    _recognition.onresult = function (e) {
      var finalTxt = "";
      var interimTxt = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTxt += e.results[i][0].transcript;
        } else {
          interimTxt += e.results[i][0].transcript;
        }
      }
      _finalTranscript += finalTxt;
      _interimTranscript = interimTxt;
      showDraftBubble(_finalTranscript + _interimTranscript || "…");
    };

    _recognition.onerror = function (e) {
      setRecordingState(false);
      removeDraftBubble();
      _recognition = null;
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        showPermissionDeniedHint();
      }
      /* no-speech, aborted, network — degrade silently */
    };

    _recognition.onend = function () {
      setRecordingState(false);
      removeDraftBubble();
      _recognition = null;
      var finalText = (_finalTranscript + _interimTranscript).trim();
      if (finalText) {
        addEntry(finalText, "tech", currentTicketId);
      } else if (loadEntries(currentTicketId).length === 0) {
        /* restore placeholder if no entries and nothing captured */
        var list = getListElement();
        if (list && !list.querySelector(".ct-message")) {
          list.innerHTML = '<p class="ct-empty">No messages yet. Additions are persisted per ticket.</p>';
        }
      }
    };

    try {
      _recognition.start();
    } catch (e) {
      setRecordingState(false);
      removeDraftBubble();
      _recognition = null;
    }
  }

  /**
   * stopListening — exported.
   * Stops the active recognition session; onend fires and finalises the entry.
   */
  function stopListening() {
    if (!_isRecording) return;
    if (!_recognition) {
      setRecordingState(false);
      return;
    }
    try {
      _recognition.stop();
    } catch (e) {
      setRecordingState(false);
      removeDraftBubble();
      _recognition = null;
    }
  }

  /* ── action bar wiring ────────────────────────────────────────── */

  function wireActionBar() {
    var talkBtn = document.getElementById("ct-talk-btn");
    var typeInput = document.getElementById("ct-type-input");

    if (talkBtn) {
      if (!isSTTSupported()) {
        talkBtn.title = "Speech recognition not supported — use the text field";
        talkBtn.style.opacity = "0.45";
        talkBtn.style.cursor = "not-allowed";
      }

      var hasPointerEvents = (typeof window.PointerEvent !== "undefined");

      if (hasPointerEvents) {
        talkBtn.addEventListener("pointerdown", function (e) {
          e.preventDefault(); /* prevents ghost click on mobile */
          startListening();
        });
        talkBtn.addEventListener("pointerup", function (e) {
          e.preventDefault();
          stopListening();
        });
        talkBtn.addEventListener("pointercancel", function () {
          stopListening();
        });
        talkBtn.addEventListener("pointerleave", function () {
          if (_isRecording) stopListening();
        });
      } else {
        /* iOS Safari < 13 — pointer events not available */
        talkBtn.addEventListener("touchstart", function (e) {
          if (e.cancelable) e.preventDefault();
          startListening();
        }, { passive: false });
        talkBtn.addEventListener("touchend", function (e) {
          if (e.cancelable) e.preventDefault();
          stopListening();
        }, { passive: false });
        talkBtn.addEventListener("touchcancel", function () {
          stopListening();
        });
      }
    }

    if (typeInput) {
      typeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          var text = typeInput.value.trim();
          if (text) {
            addEntry(text, "tech", currentTicketId);
            typeInput.value = "";
          }
        }
      });
    }
  }

  /* ── workspace integration ────────────────────────────────────── */

  function onWorkspaceOpen(ticketId) {
    currentTicketId = normalizeTicketId(ticketId || resolveTicketIdFromObject(getActiveTicket()));
    seedFromTicket(currentTicketId);
    renderTimeline(currentTicketId);
  }

  /* ── init ─────────────────────────────────────────────────────── */

  function init() {
    if (initialized) return;
    initialized = true;

    wireActionBar();

    try {
      window.addEventListener("vc:workspaceOpened", function () {
        onWorkspaceOpen();
      });
    } catch (e) {
      /* older browsers: no-op */
    }

    if (typeof activeTicket !== "undefined" && activeTicket) {
      onWorkspaceOpen(resolveTicketIdFromObject(activeTicket));
    } else {
      renderTimeline(currentTicketId);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.ConversationalTimeline = {
    init: init,
    addEntry: addEntry,
    renderTimeline: renderTimeline,
    scrollToBottom: scrollToBottom,
    onWorkspaceOpen: onWorkspaceOpen,
    startListening: startListening,
    stopListening: stopListening
  };
})();
