/**
 * Conversational Timeline — Slice 44a.
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
 * Slice 41c: Media capture button + timeline attachment.
 *   - #ct-media-btn: 56px camera button (left of action bar).
 *   - Tap → photo picker (input[type=file] accept=image/*, no capture attr for iOS).
 *   - Hold 500ms → MediaRecorder video capture; release → stop + save.
 *   - Media entries render as timeline bubbles with 80px thumbnail, timestamp, size.
 *   - Upload to Firebase Storage: field_evidence/{ticketId}/{ts}_{filename}.
 *   - Progress bar on timeline entry; dashed border while uploading.
 *   - Auto-attaches: activeTicketId, technicianName, timestamp.
 * Slice 41d: Vertex system responses (confirmation + short follow-ups).
 *   - Rule-based v1 (no AI): confirmation, media saved, equipment echo.
 *   - Equipment regex: RTU, AHU, Unit, Chiller, VAV, FCU, HP, MAU, EF.
 *   - 300 ms delay before system response appears (natural pacing).
 *   - System bubbles show a "V" monogram icon in a circle.
 *   - Follow-up stub: "Which unit?" if last 3 entries lack equipment refs.
 * Slice 42b: Active equipment context tracking.
 *   - #ct-active-equipment: sticky chip showing current active equipment.
 *   - processEntry calls JobContextEngine.setActiveEquipment() on equipment match.
 *   - Chip is tappable — tap to clear active equipment.
 *   - Media captures auto-tagged with activeEquipment in meta.
 *   - Listens for vc:activeEquipmentChanged to sync chip UI.
 * Slice 43b: Confidence-based cloud escalation.
 *   - High confidence (≥0.8) → "Got it." (no follow-up).
 *   - Medium confidence (0.6–0.8) → short clarification bubble.
 *   - Low confidence (<0.6) → silent Gemini escalation → structured parse.
 *   - Uses EdgeIntentEngine.escalateToCloud() for Gemini structured extraction.
 * Slice 44a: Voice responses to follow-up prompts + settings.
 *   - STT auto-activates for 3 s when a follow-up prompt appears (voice_text mode).
 *   - parseFollowUpResponse(): yes/no/skip/correct/number/equipment/text.
 *   - handleFollowUpResponse(): exported — processes spoken/tapped reply.
 *   - Quick-reply buttons [Yes] [No] [Skip] rendered below every follow-up.
 *   - Settings stored in localStorage (vc_ct_settings):
 *       voice_text  — spoken prompts + text bubbles (default)
 *       text_only   — text bubbles + ding/vibration notification
 *       silent      — visual only, no sound
 *   - #ct-settings-gear: small gear icon in timeline header.
 *   - #ct-settings-voice: element ID inside the settings bottom-sheet.
 *
 * Slice 45a: Checklist reminder engine integration.
 *   - onWorkspaceOpen calls ChecklistReminderEngine.onJobCheckin(ticket) to load
 *     the matching workflow from form_templates for this ticket type.
 *   - processEntry: before setActiveEquipment, captures the previous equipment
 *     reference. When equipment changes, scheduleChecklistReminders() fires
 *     gentle follow-up system bubbles for any missed items on the previous unit.
 *   - processEntry: calls ChecklistReminderEngine.updateFromEntry() to track
 *     which checklist items the tech has mentioned in timeline entries.
 *
 * Exports: startListening, stopListening, capturePhoto, captureVideo,
 *          processEntry, generateResponse, handleFollowUpResponse.
 */
(function () {
  "use strict";

  /* ── localStorage helpers ─────────────────────────────────────── */

  var LS_PREFIX = "vc_conversational_timeline_";
  var LS_SETTINGS_KEY = "vc_ct_settings";
  var currentTicketId = "draft";
  var initialized = false;

  /* ── settings helpers (Slice 44a) ────────────────────────────── */

  var VALID_MODES = ["voice_text", "text_only", "silent"];

  function loadSettings() {
    try {
      var raw = localStorage.getItem(LS_SETTINGS_KEY);
      if (!raw) return { mode: "voice_text" };
      var parsed = JSON.parse(raw);
      if (parsed && VALID_MODES.indexOf(parsed.mode) !== -1) return parsed;
      return { mode: "voice_text" };
    } catch (e) {
      return { mode: "voice_text" };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) { /* quota exceeded */ }
  }

  function getMode() {
    return loadSettings().mode || "voice_text";
  }

  function setMode(mode) {
    if (VALID_MODES.indexOf(mode) === -1) return;
    saveSettings({ mode: mode });
    updateSettingsSheetUI(mode);
  }

  /* ── ding notification (Slice 44a) ───────────────────────────── */

  function playFollowUpDing() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var oscillator = ctx.createOscillator();
      var gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
      gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.35);
    } catch (e) { /* AudioContext unavailable — no-op */ }
  }

  function triggerFollowUpNotification() {
    var mode = getMode();
    if (mode === "silent") return;
    if (mode === "text_only") {
      playFollowUpDing();
      if (navigator.vibrate) {
        try { navigator.vibrate([80, 40, 80]); } catch (e) { /* no-op */ }
      }
    }
    /* voice_text: notification handled by auto-listen audio cue */
  }

  /* ── equipment reference pattern (Slice 42b — supersedes 41d) ── */

  var EQUIPMENT_REGEX = /\b(RTU|AHU|FCU|MAU|CU|HP|Unit|Chiller|Boiler)\s*#?\d+/i;

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

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    var k = 1024;
    var sizes = ["B", "KB", "MB", "GB"];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
  }

  function renderMediaEntryHtml(item) {
    var meta = item.meta || {};
    var isUploading = meta.uploadStatus === "uploading";
    var isError = meta.uploadStatus === "error";

    var thumbHtml;
    if (meta.thumbnailDataUrl) {
      /* data URLs only contain base64 chars — safe in attribute without further escaping */
      thumbHtml = '<img class="ct-media-thumb" src="' + meta.thumbnailDataUrl + '" alt="Media thumbnail" loading="lazy">';
    } else if (meta.mediaType === "video") {
      thumbHtml = '<div class="ct-media-thumb ct-media-thumb--icon">&#9654;</div>';
    } else {
      thumbHtml = '<div class="ct-media-thumb ct-media-thumb--icon">&#128247;</div>';
    }

    var sizeLabel = meta.fileSize ? " \u00b7 " + formatFileSize(meta.fileSize) : "";
    var statusLabel = isError
      ? " \u00b7 \u26a0\ufe0f Upload failed"
      : (isUploading ? " \u00b7 Uploading\u2026" : "");
    var typeLabel = meta.mediaType === "video" ? "Video" : "Photo";

    var entryClass = "ct-message ct-message--tech ct-media-entry" +
      (isUploading ? " ct-media-uploading" : "") +
      (isError ? " ct-media-error" : "");

    var progressHtml = isUploading
      ? '<div class="ct-upload-bar"><div class="ct-upload-bar__fill" data-entry-id="' +
        escapeHtml(item.id) + '" style="width:0%"></div></div>'
      : "";

    return (
      '<div class="' + entryClass + '" data-entry-id="' + escapeHtml(item.id) + '">' +
        thumbHtml +
        '<div class="ct-media-info">' +
          '<span class="ct-media-filename">' +
            escapeHtml(meta.fileName || item.text || "Media") +
          "</span>" +
          '<span class="ct-message__meta">' +
            escapeHtml(typeLabel) + " \u00b7 " +
            escapeHtml(formatTime(item.ts)) +
            escapeHtml(sizeLabel) +
            escapeHtml(statusLabel) +
          "</span>" +
          progressHtml +
        "</div>" +
      "</div>"
    );
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
      if (!item) continue;

      if (item.meta && item.meta.mediaType) {
        html += renderMediaEntryHtml(item);
      } else {
        if (!item.text) continue;
        var isTech = item.role === "tech";
        if (isTech) {
          html +=
            '<div class="ct-message ct-message--tech">' +
              '<span class="ct-message__body">' + escapeHtml(item.text) + "</span>" +
              '<span class="ct-message__meta">Technician \u00b7 ' +
                escapeHtml(formatTime(item.ts)) +
              "</span>" +
            "</div>";
        } else {
          /* System bubble — "V" monogram icon beside message content */
          html +=
            '<div class="ct-message ct-message--system">' +
              '<div class="ct-vertex-icon" aria-hidden="true">V</div>' +
              '<div class="ct-msg-content">' +
                '<span class="ct-message__body">' + escapeHtml(item.text) + "</span>" +
                '<span class="ct-message__meta">' + escapeHtml(formatTime(item.ts)) + "</span>" +
              "</div>" +
            "</div>";
        }
      }
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
    /* Vertex system response fires only for tech-authored entries */
    if (entry.role === "tech") {
      processEntry(entry, id);
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

  /* ── Media capture (Slice 41c) ────────────────────────────────── */

  var _mediaRecorder = null;
  var _mediaChunks = [];
  var _isVideoRecording = false;

  function getTechnicianName() {
    try {
      if (window.firebase && window.firebase.auth) {
        var u = window.firebase.auth().currentUser;
        if (u) return u.displayName || u.email || "Technician";
      }
    } catch (e) { /* no-op */ }
    try {
      if (typeof window.currentUser !== "undefined" && window.currentUser) {
        return window.currentUser.displayName || window.currentUser.email || "Technician";
      }
    } catch (e) { /* no-op */ }
    try {
      if (typeof window.technicianName !== "undefined" && window.technicianName) {
        return String(window.technicianName);
      }
    } catch (e) { /* no-op */ }
    return "Technician";
  }

  function createImageThumbnail(file, callback) {
    try {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          try {
            var canvas = document.createElement("canvas");
            var maxW = 160;
            var ratio = Math.min(maxW / img.width, maxW / img.height, 1);
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL("image/jpeg", 0.72));
          } catch (ex) { callback(null); }
        };
        img.onerror = function () { callback(null); };
        img.src = e.target.result;
      };
      reader.onerror = function () { callback(null); };
      reader.readAsDataURL(file);
    } catch (e) { callback(null); }
  }

  function createVideoThumbnail(blob, callback) {
    try {
      var url = URL.createObjectURL(blob);
      var video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.onseeked = function () {
        try {
          var canvas = document.createElement("canvas");
          var maxW = 160;
          var vw = video.videoWidth || 160;
          var vh = video.videoHeight || 90;
          var ratio = Math.min(maxW / vw, maxW / vh, 1);
          canvas.width = Math.round(vw * ratio);
          canvas.height = Math.round(vh * ratio);
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          callback(canvas.toDataURL("image/jpeg", 0.72));
        } catch (ex) { URL.revokeObjectURL(url); callback(null); }
      };
      video.onloadedmetadata = function () {
        video.currentTime = 0.1;
      };
      video.onerror = function () { URL.revokeObjectURL(url); callback(null); };
      video.src = url;
      video.load();
    } catch (e) { callback(null); }
  }

  function uploadMediaToStorage(file, ticketId, entryId, onProgress) {
    try {
      if (!window.firebase || !window.firebase.storage) {
        onProgress(null, null, new Error("Firebase Storage unavailable"));
        return;
      }
      var ts = Date.now();
      var safeName = (file.name || "capture").replace(/[^a-zA-Z0-9._-]/g, "_");
      var path = "field_evidence/" + (ticketId || "draft") + "/" + ts + "_" + safeName;
      var storageRef = window.firebase.storage().ref().child(path);
      var task = storageRef.put(file);
      task.on(
        "state_changed",
        function (snapshot) {
          var pct = snapshot.totalBytes > 0
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0;
          onProgress(pct, null, null);
        },
        function (err) {
          onProgress(null, null, err);
        },
        function () {
          task.snapshot.ref.getDownloadURL().then(function (url) {
            onProgress(100, url, null);
          }).catch(function (err) {
            onProgress(100, null, err);
          });
        }
      );
    } catch (e) {
      onProgress(null, null, e);
    }
  }

  function updateMediaEntryStatus(ticketId, entryId, status, storageUrl) {
    var entries = loadEntries(ticketId);
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].id === entryId) {
        entries[i].meta.uploadStatus = status;
        if (storageUrl) entries[i].meta.storageUrl = storageUrl;
        saveEntries(ticketId, entries);
        break;
      }
    }
    if (ticketId === currentTicketId) renderTimeline(ticketId);
  }

  function addMediaEntry(file, mediaType, thumbnailDataUrl, ticketId) {
    var id = normalizeTicketId(ticketId);
    var entryId = createId();
    var entry = {
      id: entryId,
      ts: new Date().toISOString(),
      role: "tech",
      text: file.name || (mediaType === "video" ? "video_capture" : "photo_capture"),
      meta: {
        mediaType: mediaType,
        fileName: file.name || (mediaType === "video" ? "video.webm" : "photo.jpg"),
        fileSize: file.size || 0,
        thumbnailDataUrl: thumbnailDataUrl || null,
        storageUrl: null,
        uploadStatus: "uploading",
        activeTicketId: id,
        technicianName: getTechnicianName(),
        activeEquipment: (window.VCJobContext && window.VCJobContext.activeEquipment) || null
      }
    };

    var entries = loadEntries(id);
    entries.push(entry);
    saveEntries(id, entries);
    if (id === currentTicketId) renderTimeline(id);

    /* Vertex system response for media entries */
    processEntry(entry, id);

    uploadMediaToStorage(file, id, entryId, function (pct, url, err) {
      if (err) {
        updateMediaEntryStatus(id, entryId, "error", null);
        return;
      }
      if (url !== null) {
        /* Upload complete — persist URL and re-render cleanly */
        updateMediaEntryStatus(id, entryId, "done", url);
      } else if (pct !== null) {
        /* Progress tick — update progress bar in-place without full re-render */
        var fill = document.querySelector(
          '.ct-upload-bar__fill[data-entry-id="' + entryId + '"]'
        );
        if (fill) fill.style.width = pct + "%";
      }
    });

    return entry;
  }

  function setMediaBtnVideoState(active) {
    var btn = document.getElementById("ct-media-btn");
    if (!btn) return;
    if (active) {
      btn.classList.add("ct-recording");
      btn.setAttribute("aria-pressed", "true");
      btn.textContent = "⏹️";
      btn.title = "Release to stop recording";
    } else {
      btn.classList.remove("ct-recording");
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = "📷";
      btn.title = "Tap for photo · Hold for video";
    }
  }

  function stopVideoCapture() {
    if (!_isVideoRecording && !_mediaRecorder) return;
    _isVideoRecording = false;
    setMediaBtnVideoState(false);
    if (_mediaRecorder) {
      try { _mediaRecorder.stop(); } catch (e) { _mediaRecorder = null; }
    }
  }

  /**
   * capturePhoto — exported.
   * Opens the native media picker (no capture attribute → iOS shows full picker).
   */
  function capturePhoto() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    /* intentionally no capture attribute — full picker on iOS */
    input.style.cssText = "position:fixed;left:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(input);

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      try { document.body.removeChild(input); } catch (e) { /* no-op */ }
      if (!file) return;
      createImageThumbnail(file, function (thumbDataUrl) {
        addMediaEntry(file, "photo", thumbDataUrl, currentTicketId);
      });
    });

    /* Remove orphaned input if user cancels (blur fires after picker dismissed) */
    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (!input.files || !input.files.length) {
          try { document.body.removeChild(input); } catch (e) { /* no-op */ }
        }
      }, 1000);
    });

    input.click();
  }

  /**
   * captureVideo — exported.
   * Starts MediaRecorder video capture. Release hold → stopVideoCapture() finishes.
   * Falls back to file picker if getUserMedia is unavailable.
   */
  function captureVideo() {
    if (_isVideoRecording) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      /* Fallback: video file picker */
      var input = document.createElement("input");
      input.type = "file";
      input.accept = "video/*";
      input.style.cssText = "position:fixed;left:-9999px;opacity:0;pointer-events:none;";
      document.body.appendChild(input);
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        try { document.body.removeChild(input); } catch (e) { /* no-op */ }
        if (!file) return;
        createVideoThumbnail(file, function (thumbDataUrl) {
          addMediaEntry(file, "video", thumbDataUrl, currentTicketId);
        });
      });
      input.click();
      return;
    }

    _isVideoRecording = true;
    _mediaChunks = [];
    setMediaBtnVideoState(true);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(function (stream) {
      var mimeType = "";
      var candidates = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
      for (var ci = 0; ci < candidates.length; ci++) {
        if (MediaRecorder.isTypeSupported(candidates[ci])) {
          mimeType = candidates[ci];
          break;
        }
      }

      try {
        _mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType: mimeType } : {});
      } catch (e) {
        _mediaRecorder = new MediaRecorder(stream);
      }

      _mediaRecorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) _mediaChunks.push(e.data);
      };

      _mediaRecorder.onstop = function () {
        stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* no-op */ } });
        _isVideoRecording = false;
        setMediaBtnVideoState(false);

        if (!_mediaChunks.length) { _mediaRecorder = null; return; }

        var recorderMime = (_mediaRecorder && _mediaRecorder.mimeType) || "video/webm";
        var blob = new Blob(_mediaChunks, { type: recorderMime });
        _mediaChunks = [];
        _mediaRecorder = null;

        var ext = recorderMime.indexOf("mp4") !== -1 ? "mp4" : "webm";
        var tsStr = new Date().toISOString().replace(/[:.]/g, "-");
        var fileName = "video_" + tsStr + "." + ext;

        var file;
        try {
          file = new File([blob], fileName, { type: blob.type });
        } catch (e) {
          /* Safari < 14.1 doesn't support File constructor with options */
          file = blob;
          file.name = fileName;
        }

        createVideoThumbnail(blob, function (thumbDataUrl) {
          addMediaEntry(file, "video", thumbDataUrl, currentTicketId);
        });
      };

      _mediaRecorder.onerror = function () {
        stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* no-op */ } });
        _isVideoRecording = false;
        setMediaBtnVideoState(false);
        _mediaRecorder = null;
      };

      _mediaRecorder.start();

    }).catch(function () {
      _isVideoRecording = false;
      setMediaBtnVideoState(false);
      _mediaRecorder = null;
      var list = getListElement();
      if (list) {
        var hint = document.createElement("p");
        hint.className = "ct-empty";
        hint.textContent = "Camera access denied — cannot record video.";
        list.appendChild(hint);
        scrollToBottom();
      }
    });
  }

  /* ── Vertex system responses (Slice 41d + 43b) ────────────────── */

  /**
   * generateResponse — exported.
   * Pure function: given a tech entry, returns the Vertex confirmation text.
   * Slice 43b confidence tiers:
   *   High (≥0.8) → "Got it."
   *   Medium (0.6–0.8) → short clarification bubble
   *   Low (<0.6) → handled async by processEntry (cloud escalation)
   */
  function generateResponse(entry, opts) {
    if (!entry) return null;
    var options = opts || {};

    /* Media entries ------------------------------------------------ */
    if (entry.meta && entry.meta.mediaType) {
      return entry.meta.mediaType === "video" ? "\uD83C\uDFA5 Saved." : "\uD83D\uDCF7 Saved.";
    }

    var text = safeText(entry.text);
    if (!text) return null;

    var confidence = (entry.meta && typeof entry.meta.intentConfidence === "number")
      ? entry.meta.intentConfidence
      : 1;

    /* Low confidence — skip sync response (async escalation handles it) */
    if (confidence < 0.6 && !options.fromEscalation) {
      return null;
    }

    /* Equipment reference ------------------------------------------ */
    var match = text.match(EQUIPMENT_REGEX);

    /* High confidence (≥0.8) ─────────────────────────────────────── */
    if (confidence >= 0.8) {
      if (match) return "Got it. " + match[0] + ".";
      return "Got it.";
    }

    /* Medium confidence (0.6–0.8) — short clarification ─────────── */
    var entities = (entry.meta && Array.isArray(entry.meta.entities)) ? entry.meta.entities : [];
    var hasEquipment = entities.some(function (e) { return e.type === "equipment"; });
    var hasTemp = entities.some(function (e) { return e.type === "temperature"; });
    var hasAmps = entities.some(function (e) { return e.type === "amp_draw"; });
    var hasPart = entities.some(function (e) { return e.type === "part"; });

    if (!hasEquipment && match) {
      return "Got it. " + match[0] + ".";
    }
    if (!hasEquipment) return "Which unit?";
    if (hasPart && !hasAmps && !hasTemp) return "Reading?";
    if (match) return "Got it. " + match[0] + ".";
    return "Got it.";
  }

  /* ── follow-up response parsing (Slice 44a) ──────────────────── */

  /**
   * parseFollowUpResponse — classifies a spoken or typed follow-up answer.
   * Returns { type, value? } where type is one of:
   *   "yes" | "no" | "skip" | "correction" | "number" | "equipment" | "text"
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

  /**
   * handleFollowUpResponse — exported.
   * Processes a spoken or quick-reply follow-up answer:
   *   - Dismisses the active follow-up prompt.
   *   - "skip" → dismisses silently (no entry created).
   *   - All other types → adds a tech entry and lets processEntry handle Vertex reply.
   */
  function handleFollowUpResponse(responseText) {
    var text = String(responseText || "").trim();
    if (!text) return;

    var parsed = parseFollowUpResponse(text);

    _followUpDismissed = true;
    hideFollowUpPrompt();
    stopFollowUpListening();

    if (parsed.type === "skip") {
      return;
    }

    addEntry(text, "tech", currentTicketId);
  }

  /* ── follow-up auto-listen (Slice 44a) ───────────────────────── */

  var _followUpRecognition = null;
  var _followUpListenTimer = null;

  function stopFollowUpListening() {
    if (_followUpListenTimer) {
      clearTimeout(_followUpListenTimer);
      _followUpListenTimer = null;
    }
    if (_followUpRecognition) {
      try { _followUpRecognition.stop(); } catch (e) { /* no-op */ }
      _followUpRecognition = null;
    }
  }

  function startFollowUpListening() {
    if (!isSTTSupported()) return;
    if (_isRecording) return; /* hold-to-talk already active */
    if (_followUpRecognition) return;

    var SRClass = getSpeechRecognitionClass();
    if (!SRClass) return;

    var r = new SRClass();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";
    r.maxAlternatives = 1;

    _followUpRecognition = r;

    /* 3-second hard ceiling — stop recognition if no result yet */
    _followUpListenTimer = setTimeout(function () {
      stopFollowUpListening();
    }, 3000);

    r.onresult = function (e) {
      clearTimeout(_followUpListenTimer);
      _followUpListenTimer = null;
      var transcript = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          transcript += e.results[i][0].transcript;
        }
      }
      transcript = transcript.trim();
      _followUpRecognition = null;
      if (transcript) {
        handleFollowUpResponse(transcript);
      }
    };

    r.onerror = function () {
      clearTimeout(_followUpListenTimer);
      _followUpListenTimer = null;
      _followUpRecognition = null;
    };

    r.onend = function () {
      clearTimeout(_followUpListenTimer);
      _followUpListenTimer = null;
      _followUpRecognition = null;
    };

    try {
      r.start();
    } catch (e) {
      _followUpRecognition = null;
      clearTimeout(_followUpListenTimer);
      _followUpListenTimer = null;
    }
  }

  /* ── follow-up prompt helpers ─────────────────────────────────── */

  var _followUpDismissed = false;

  function getFollowUpEl() {
    return document.getElementById("ct-followup-prompt");
  }

  function createFollowUpEl() {
    var bar = document.getElementById("ct-action-bar");
    if (!bar || !bar.parentNode) return null;
    var el = document.createElement("div");
    el.id = "ct-followup-prompt";
    el.className = "ct-followup-prompt";
    el.style.display = "none";
    el.innerHTML =
      '<div class="ct-followup-prompt__top">' +
        '<span class="ct-followup-prompt__text">Which unit?</span>' +
        '<button class="ct-followup-prompt__dismiss" aria-label="Dismiss follow-up">\u2715</button>' +
      '</div>' +
      '<div class="ct-followup-prompt__replies" role="group" aria-label="Quick replies">' +
        '<button class="ct-followup-reply" data-reply="yes" type="button">Yes</button>' +
        '<button class="ct-followup-reply" data-reply="no" type="button">No</button>' +
        '<button class="ct-followup-reply ct-followup-reply--skip" data-reply="skip" type="button">Skip</button>' +
      '</div>';

    el.querySelector(".ct-followup-prompt__dismiss").addEventListener("click", function () {
      _followUpDismissed = true;
      stopFollowUpListening();
      hideFollowUpPrompt();
    });

    var replyBtns = el.querySelectorAll(".ct-followup-reply");
    for (var ri = 0; ri < replyBtns.length; ri++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          handleFollowUpResponse(btn.getAttribute("data-reply"));
        });
      })(replyBtns[ri]);
    }

    bar.parentNode.insertBefore(el, bar);
    return el;
  }

  function showFollowUpPrompt(promptText) {
    if (_followUpDismissed) return;
    var el = getFollowUpEl() || createFollowUpEl();
    if (!el) return;

    if (promptText) {
      var textEl = el.querySelector(".ct-followup-prompt__text");
      if (textEl) textEl.textContent = promptText;
    }

    el.style.display = "flex";
    triggerFollowUpNotification();

    /* voice_text: start 3-second auto-listen window */
    if (getMode() === "voice_text") {
      setTimeout(function () {
        /* Delay slightly so recognition doesn't capture the prompt display moment */
        if (!_followUpDismissed) startFollowUpListening();
      }, 400);
    }
  }

  function hideFollowUpPrompt() {
    var el = getFollowUpEl();
    if (el) el.style.display = "none";
    stopFollowUpListening();
  }

  function checkFollowUpPrompt(ticketId) {
    var entries = loadEntries(ticketId);
    /* Only consider tech text entries (not media, not seed context) */
    var techText = entries.filter(function (e) {
      return e && e.role === "tech" && !(e.meta && (e.meta.seed || e.meta.mediaType));
    });
    var last3 = techText.slice(-3);
    if (!last3.length) {
      hideFollowUpPrompt();
      return;
    }
    var anyEquipment = last3.some(function (e) {
      return EQUIPMENT_REGEX.test(safeText(e.text));
    });
    if (anyEquipment) {
      hideFollowUpPrompt();
    } else {
      showFollowUpPrompt();
    }
  }

  /* ── active equipment chip (Slice 42b) ───────────────────────── */

  function getEquipmentChipEl() {
    return document.getElementById("ct-active-equipment");
  }

  function updateEquipmentChip(ref) {
    var el = getEquipmentChipEl();
    if (!el) return;
    if (ref) {
      el.textContent = "\uD83D\uDD27 " + ref;
      el.removeAttribute("hidden");
    } else {
      el.hidden = true;
    }
  }

  function wireEquipmentChip() {
    var el = getEquipmentChipEl();
    if (!el) return;
    el.addEventListener("click", function () {
      if (window.JobContextEngine && typeof JobContextEngine.setActiveEquipment === "function") {
        JobContextEngine.setActiveEquipment(null);
      }
    });
    /* Sync chip if activeEquipment is already set (e.g. page reload) */
    updateEquipmentChip(
      window.VCJobContext && window.VCJobContext.activeEquipment
        ? window.VCJobContext.activeEquipment
        : null
    );
  }

  /* ── settings gear + bottom-sheet (Slice 44a) ────────────────── */

  function updateSettingsSheetUI(mode) {
    var sheet = document.getElementById("ct-settings-voice");
    if (!sheet) return;
    var radios = sheet.querySelectorAll("input[type=radio][name=ct-mode]");
    for (var i = 0; i < radios.length; i++) {
      radios[i].checked = (radios[i].value === mode);
    }
  }

  function openSettingsSheet() {
    var sheet = document.getElementById("ct-settings-voice");
    var overlay = document.getElementById("ct-settings-overlay");
    if (sheet) {
      updateSettingsSheetUI(getMode());
      sheet.classList.add("ct-settings-sheet--open");
      sheet.setAttribute("aria-hidden", "false");
    }
    if (overlay) {
      overlay.style.display = "block";
    }
  }

  function closeSettingsSheet() {
    var sheet = document.getElementById("ct-settings-voice");
    var overlay = document.getElementById("ct-settings-overlay");
    if (sheet) {
      sheet.classList.remove("ct-settings-sheet--open");
      sheet.setAttribute("aria-hidden", "true");
    }
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  function wireSettingsGear() {
    var gearBtn = document.getElementById("ct-settings-gear");
    if (gearBtn) {
      gearBtn.addEventListener("click", function () {
        openSettingsSheet();
      });
    }

    var closeBtn = document.getElementById("ct-settings-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        closeSettingsSheet();
      });
    }

    var overlay = document.getElementById("ct-settings-overlay");
    if (overlay) {
      overlay.addEventListener("click", function () {
        closeSettingsSheet();
      });
    }

    var sheet = document.getElementById("ct-settings-voice");
    if (sheet) {
      var radios = sheet.querySelectorAll("input[type=radio][name=ct-mode]");
      for (var i = 0; i < radios.length; i++) {
        (function (radio) {
          radio.addEventListener("change", function () {
            if (radio.checked) {
              setMode(radio.value);
            }
          });
        })(radios[i]);
      }
    }
  }

  /* ── checklist reminder helpers (Slice 45a) ──────────────────── */

  /**
   * scheduleChecklistReminders — fires gentle system-bubble reminders for
   * checklist items not yet mentioned on the given equipment unit.
   * Delayed slightly so the primary "Got it. RTU7." response appears first.
   * At most ChecklistReminderEngine.MAX_REMINDERS_PER_SWITCH reminders are
   * surfaced — never blocks the tech or forces form completion.
   */
  function scheduleChecklistReminders(equipment, ticketId) {
    if (
      !window.ChecklistReminderEngine ||
      typeof window.ChecklistReminderEngine.getReminders !== "function"
    ) return;
    /* 800 ms head start for the primary confirmation bubble */
    setTimeout(function () {
      var reminders = window.ChecklistReminderEngine.getReminders(equipment, ticketId);
      if (!reminders || !reminders.length) return;
      for (var i = 0; i < reminders.length; i++) {
        (function (reminder, idx) {
          setTimeout(function () {
            addEntry(reminder, "system", ticketId);
          }, idx * 700);
        })(reminders[i], i);
      }
    }, 800);
  }

  /**
   * processEntry — exported.
   * Called after a tech entry is saved; schedules the Vertex system response
   * with a 300 ms delay, then re-evaluates the follow-up prompt.
   * Slice 42b: also detects equipment references and calls
   * JobContextEngine.setActiveEquipment() so all subsequent entries are tagged.
   */
  function processEntry(entry, ticketId) {
    if (!entry || entry.role !== "tech") return;
    var id = normalizeTicketId(ticketId);

    var rawText = safeText(entry.text);
    var parsed = null;
    var parsedText = rawText;
    var parsedEntities = [];

    if (
      typeof window.EdgeIntentEngine !== "undefined" &&
      window.EdgeIntentEngine &&
      typeof window.EdgeIntentEngine.parse === "function"
    ) {
      try {
        parsed = window.EdgeIntentEngine.parse(rawText);
      } catch (e) {
        parsed = null;
      }
    }

    if (parsed && typeof parsed.text === "string" && parsed.text.trim()) {
      parsedText = parsed.text.trim();
    }
    if (parsed && Array.isArray(parsed.entities)) {
      parsedEntities = parsed.entities;
    }

    var responseTextForIntent = parsedText;
    var metaForResponse = {};
    var metaKey;
    if (entry.meta) {
      for (metaKey in entry.meta) {
        if (Object.prototype.hasOwnProperty.call(entry.meta, metaKey)) {
          metaForResponse[metaKey] = entry.meta[metaKey];
        }
      }
    }

    if (parsed && parsed.confidence != null) {
      metaForResponse.intentConfidence = parsed.confidence;
    }
    if (parsed && parsed.corrections && parsed.corrections.length) {
      metaForResponse.intentCorrections = parsed.corrections;
    }
    if (parsedEntities.length) {
      metaForResponse.entities = parsedEntities;
      metaForResponse.extractorVersion = "edge-intent-v1";
    }
    if (parsedText !== rawText) {
      metaForResponse.correctedText = parsedText;
    }
    entry.meta = metaForResponse;

    /* Detect equipment reference → update active equipment context */
    var eqRef = "";
    var i;
    var equipMatch = null;
    for (i = 0; i < parsedEntities.length; i++) {
      if (parsedEntities[i] && parsedEntities[i].type === "equipment" && parsedEntities[i].value) {
        eqRef = String(parsedEntities[i].value).replace(/\s+/g, " ").trim();
        break;
      }
    }
    if (!eqRef) {
      equipMatch = responseTextForIntent.match(EQUIPMENT_REGEX);
      if (equipMatch) eqRef = equipMatch[0].replace(/\s+/g, " ").trim();
    }

    /* Capture previous equipment before context switch (Slice 45a) */
    var previousEquipment = (window.VCJobContext && window.VCJobContext.activeEquipment)
      ? String(window.VCJobContext.activeEquipment)
      : null;

    if (eqRef && window.JobContextEngine && typeof JobContextEngine.setActiveEquipment === "function") {
      JobContextEngine.setActiveEquipment(eqRef);
      /* Equipment switched — remind tech about any missed items on the previous unit */
      if (previousEquipment && previousEquipment !== eqRef) {
        scheduleChecklistReminders(previousEquipment, id);
      }
    }

    /* Track entry mentions against active workflow checklist (Slice 45a) */
    var effectiveEquipment = eqRef || previousEquipment;
    if (
      effectiveEquipment &&
      window.ChecklistReminderEngine &&
      typeof window.ChecklistReminderEngine.updateFromEntry === "function"
    ) {
      window.ChecklistReminderEngine.updateFromEntry(entry, id, effectiveEquipment);
    }

    var confidence = (parsed && typeof parsed.confidence === "number") ? parsed.confidence : 1;

    /* Low confidence (<0.6) → cloud escalation (Slice 43b) */
    if (
      confidence < 0.6 &&
      typeof window.EdgeIntentEngine !== "undefined" &&
      window.EdgeIntentEngine &&
      typeof window.EdgeIntentEngine.escalateToCloud === "function"
    ) {
      var escalationText = rawText;
      window.EdgeIntentEngine.escalateToCloud(escalationText).then(function (geminiResult) {
        var escalationResponse;
        if (geminiResult && typeof geminiResult === "object") {
          var hasData = (
            (geminiResult.equipment && geminiResult.equipment.length) ||
            (geminiResult.temperatures && geminiResult.temperatures.length) ||
            (geminiResult.ampDraws && geminiResult.ampDraws.length) ||
            (geminiResult.parts && geminiResult.parts.length) ||
            (geminiResult.actions && geminiResult.actions.length)
          );
          if (hasData) {
            escalationResponse = "Got it.";
          } else {
            escalationResponse = "What were you working on?";
          }
        } else {
          escalationResponse = "What were you working on?";
        }
        setTimeout(function () {
          addEntry(escalationResponse, "system", id);
          checkFollowUpPrompt(id);
        }, 300);
      });
      return;
    }

    var responseText = generateResponse({
      role: entry.role,
      text: responseTextForIntent,
      meta: metaForResponse
    });
    if (!responseText) return;
    setTimeout(function () {
      addEntry(responseText, "system", id);
      checkFollowUpPrompt(id);
    }, 300);
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

    /* ── Media button wiring ──────────────────────────────────────── */

    var mediaBtn = document.getElementById("ct-media-btn");
    if (mediaBtn) {
      var _mediaBtnDownTime = 0;
      var _mediaBtnHoldTimer = null;

      function onMediaBtnDown(e) {
        if (e && e.cancelable) e.preventDefault();
        _mediaBtnDownTime = Date.now();
        _mediaBtnHoldTimer = setTimeout(function () {
          _mediaBtnHoldTimer = null;
          captureVideo();
        }, 500);
      }

      function onMediaBtnUp(e) {
        if (e && e.cancelable) e.preventDefault();
        var elapsed = Date.now() - _mediaBtnDownTime;
        if (_mediaBtnHoldTimer) {
          clearTimeout(_mediaBtnHoldTimer);
          _mediaBtnHoldTimer = null;
        }
        if (_isVideoRecording) {
          stopVideoCapture();
        } else if (elapsed < 500) {
          capturePhoto();
        }
      }

      function onMediaBtnCancel() {
        if (_mediaBtnHoldTimer) { clearTimeout(_mediaBtnHoldTimer); _mediaBtnHoldTimer = null; }
        if (_isVideoRecording) stopVideoCapture();
      }

      var hasPointerEventsMedia = (typeof window.PointerEvent !== "undefined");
      if (hasPointerEventsMedia) {
        mediaBtn.addEventListener("pointerdown", onMediaBtnDown);
        mediaBtn.addEventListener("pointerup", onMediaBtnUp);
        mediaBtn.addEventListener("pointercancel", onMediaBtnCancel);
        mediaBtn.addEventListener("pointerleave", function () {
          if (_isVideoRecording) stopVideoCapture();
        });
      } else {
        mediaBtn.addEventListener("touchstart", onMediaBtnDown, { passive: false });
        mediaBtn.addEventListener("touchend", onMediaBtnUp, { passive: false });
        mediaBtn.addEventListener("touchcancel", onMediaBtnCancel);
      }
    }
  }

  /* ── workspace integration ────────────────────────────────────── */

  function onWorkspaceOpen(ticketId) {
    currentTicketId = normalizeTicketId(ticketId || resolveTicketIdFromObject(getActiveTicket()));
    /* Reset follow-up dismiss state per ticket open */
    _followUpDismissed = false;
    hideFollowUpPrompt();
    seedFromTicket(currentTicketId);
    renderTimeline(currentTicketId);
    /* Load workflow checklist from form_templates for this ticket type (Slice 45a) */
    try {
      var ticket = getActiveTicket();
      if (
        ticket &&
        window.ChecklistReminderEngine &&
        typeof window.ChecklistReminderEngine.onJobCheckin === "function"
      ) {
        window.ChecklistReminderEngine.onJobCheckin(ticket);
      }
    } catch (e) { /* degrade silently */ }
  }

  /* ── init ─────────────────────────────────────────────────────── */

  function init() {
    if (initialized) return;
    initialized = true;

    wireActionBar();
    wireEquipmentChip();
    wireSettingsGear();

    try {
      window.addEventListener("vc:workspaceOpened", function () {
        onWorkspaceOpen();
      });
    } catch (e) {
      /* older browsers: no-op */
    }

    try {
      window.addEventListener("vc:activeEquipmentChanged", function (e) {
        updateEquipmentChip(e.detail && e.detail.activeEquipment ? e.detail.activeEquipment : null);
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
    stopListening: stopListening,
    capturePhoto: capturePhoto,
    captureVideo: captureVideo,
    processEntry: processEntry,
    generateResponse: generateResponse,
    handleFollowUpResponse: handleFollowUpResponse
  };
})();
