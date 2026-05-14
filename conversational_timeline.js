/**
 * Conversational Timeline — Slice 42b.
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
 *
 * Exports: startListening, stopListening, capturePhoto, captureVideo,
 *          processEntry, generateResponse.
 */
(function () {
  "use strict";

  /* ── localStorage helpers ─────────────────────────────────────── */

  var LS_PREFIX = "vc_conversational_timeline_";
  var currentTicketId = "draft";
  var initialized = false;

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

  /* ── Vertex system responses (Slice 41d) ─────────────────────── */

  /**
   * generateResponse — exported.
   * Pure function: given a tech entry, returns the Vertex confirmation text.
   * v1 is rule-based (no AI).
   */
  function generateResponse(entry) {
    if (!entry) return null;

    /* Media entries ------------------------------------------------ */
    if (entry.meta && entry.meta.mediaType) {
      return entry.meta.mediaType === "video" ? "\uD83C\uDFA5 Saved." : "\uD83D\uDCF7 Saved.";
    }

    var text = safeText(entry.text);
    if (!text) return null;

    /* Equipment reference ------------------------------------------ */
    var match = text.match(EQUIPMENT_REGEX);
    if (match) {
      return "Got it. " + match[0] + ".";
    }

    /* Default (short or plain text) -------------------------------- */
    return "Got it.";
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
      '<span class="ct-followup-prompt__text">Which unit?</span>' +
      '<button class="ct-followup-prompt__dismiss" aria-label="Dismiss follow-up">\u2715</button>';
    el.querySelector(".ct-followup-prompt__dismiss").addEventListener("click", function () {
      _followUpDismissed = true;
      hideFollowUpPrompt();
    });
    bar.parentNode.insertBefore(el, bar);
    return el;
  }

  function showFollowUpPrompt() {
    if (_followUpDismissed) return;
    var el = getFollowUpEl() || createFollowUpEl();
    if (el) el.style.display = "flex";
  }

  function hideFollowUpPrompt() {
    var el = getFollowUpEl();
    if (el) el.style.display = "none";
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
    if (eqRef && window.JobContextEngine && typeof JobContextEngine.setActiveEquipment === "function") {
      JobContextEngine.setActiveEquipment(eqRef);
    }

    var responseText = generateResponse({
      role: entry.role,
      text: responseTextForIntent,
      meta: metaForResponse
    });
    if (!responseText) return;
    setTimeout(function () {
      /* addEntry with role "system" → will NOT re-trigger processEntry */
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
  }

  /* ── init ─────────────────────────────────────────────────────── */

  function init() {
    if (initialized) return;
    initialized = true;

    wireActionBar();
    wireEquipmentChip();

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
    generateResponse: generateResponse
  };
})();
