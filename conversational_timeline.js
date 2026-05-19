/**
 * Conversational Timeline — Slice 63f + Agent Architecture Separation.
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
 *   - Follow-up stub (equipment nudge UI) permanently disabled — no dashed prompt.
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
 * Slice 46a: Editable timeline entries + voice corrections.
 *   - Tap a tech timeline bubble → inline edit mode (contenteditable + Save/Cancel).
 *   - editEntry(entryId): exported — activates inline edit on a given entry.
 *   - handleCorrection(text): exported — parses voice corrections that start with
 *     "correction" or "actually"; updates the most recent relevant entry
 *     (equipment-ref match first, then recency fallback).
 *   - Example: "correction, that was RTU6" → replaces last entry's RTU ref with RTU6.
 *   - Entry object gains: originalText, correctedText, correctedAt.
 *   - Corrected entries render a small "edited" badge.
 *   - processEntry routes correction-prefix entries to handleCorrection (no
 *     standard Vertex response generated for the correction command itself).
 *   - Vocabulary feedback: word-level substitutions are stored in
 *     localStorage (vc_ct_vocab_corrections) and forwarded to
 *     EdgeIntentEngine.learnCorrection() for session-level STT remapping.
 *
 * Slice 47a: Auto-tag media with equipment context + visibility.
 *   - tagMedia(entryId, ticketId): exported — writes media metadata to Firestore
 *     at Customers/{custId}/Equipment/{equipId}/media/{autoId} when equipment
 *     context is available; falls back to field_evidence/{ticketId}/media/{autoId}.
 *   - Metadata: jobId, equipmentRef, technicianName, timestamp,
 *     visibility:"internal" (default — office sees, customer does not).
 *   - addMediaEntry enhanced: sets visibility on meta, calls tagMedia after
 *     Storage upload completes.
 *   - renderMediaEntryHtml: equipment tag badge shown on media bubbles when
 *     activeEquipment was set at capture time.
 *
 * Slice 48a: Compile Notes — unified structured output.
 *   - #ct-compile-btn: button below timeline, visible after ≥3 tech entries.
 *   - compileNotes(): exported — gathers timeline + equipment + checklist context,
 *     sends to Gemini for structured extraction (per-equipment findings, quote
 *     recommendations, unresolved issues, equipment history updates).
 *   - #ct-compile-modal: editable modal showing formatted result.
 *   - Copy Summary button for clipboard. Submit to Office writes to Firestore:
 *     completed_reports/{autoId}, equipment work_history subcollection,
 *     site_intelligence unresolved issues flag.
 *
 * Slice 50a: Post-job learning upload.
 *   - submitCompileToOffice success path calls LearningSync.uploadLearningData()
 *     to silently upload session learning data (vocab corrections, confidence
 *     scores, escalation results, dispatcher edits) to Firestore.
 *
 * Slice 51a: Extended site notes + operational memory.
 *   - #ct-site-memory: collapsible panel at the top of the timeline showing:
 *       ⚠️ Unresolved from last visit (unresolvedIssues from site_intelligence)
 *       🔄 Recurring (equipment with ≥2 completed_report entries at this site)
 *       📝 Site notes (access codes, parking, ladder info, inter-office notes)
 *       💬 Previous quotes (open quotes from the active ticket)
 *   - renderSiteMemory(ticketId): reads getSiteMemory() from JobContextEngine
 *     — fully local, no additional Firestore reads beyond the 42a preload.
 *   - Panel is hidden when all sections are empty (fresh site with no history).
 *   - Tap the panel header to collapse / expand; state persists per session.
 *   - onWorkspaceOpen calls renderSiteMemory() after renderTimeline().
 *
 * Slice 53a: Hierarchical knowledge retrieval.
 *   - #ct-ask-btn: "❓ Ask" button in the action bar.
 *   - Tech types or speaks a question; lookup ladder runs (6 levels):
 *       1. Current job timeline entries  2. Site notes
 *       3. Equipment history             4. Company-wide knowledge
 *       5. Uploaded manuals (stub)       6. Cloud Gemini lookup
 *   - Cloud answer offers save prompt: company knowledge or site note.
 *   - System bubble displays answer with source badge.
 *
 * Slice 63f: Post-compile classification + equipment history write.
 *   - classifyEquipmentFindings(): scans entries for unique equipmentRef values,
 *     sends each to Gemini for structured extraction (measurements, parts, outcome).
 *   - Green confirmation card at bottom of compile modal per equipment unit.
 *   - "Save to Equipment History" writes to site_intelligence via VCFirestore.
 *   - "Skip" dismisses without writing. Never auto-writes.
 *
 * Exports: startListening, stopListening, capturePhoto, captureVideo,
 *          processEntry, generateResponse, handleFollowUpResponse,
 *          editEntry, handleCorrection, tagMedia, compileNotes.
 */
(function () {
  "use strict";

  /* ── localStorage helpers ─────────────────────────────────────── */

  var LS_PREFIX = "vc_conversational_timeline_";
  var LS_SETTINGS_KEY = "vc_ct_settings";
  var LS_VOCAB_KEY = "vc_ct_vocab_corrections";
  var currentTicketId = "draft";
  var initialized = false;

  /* ── checklist reminder debounce state (Slice 63c) ───────────── */
  var _lastReminderEquipment = null;
  var _lastReminderTime = 0;

  /* ── transient nameplate confirmation cards (Slice 63g) ───────── */
  var _nameplateCardsByEntryId = {};

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

  /* ── vocabulary correction store (Slice 46a) ─────────────────── */

  function loadVocabCorrections() {
    try {
      var raw = localStorage.getItem(LS_VOCAB_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (e) { return {}; }
  }

  function saveVocabCorrections(map) {
    try {
      localStorage.setItem(LS_VOCAB_KEY, JSON.stringify(map));
    } catch (e) { /* quota exceeded */ }
  }

  /**
   * Persist a single word/phrase substitution and notify EdgeIntentEngine.
   */
  function learnVocabCorrection(original, corrected) {
    if (!original || !corrected) return;
    var normOrig = String(original).toLowerCase().trim();
    var normCorr = String(corrected).trim();
    if (!normOrig || !normCorr || normOrig === normCorr.toLowerCase()) return;
    var map = loadVocabCorrections();
    map[normOrig] = normCorr;
    saveVocabCorrections(map);
    if (
      typeof window.EdgeIntentEngine !== "undefined" &&
      window.EdgeIntentEngine &&
      typeof window.EdgeIntentEngine.learnCorrection === "function"
    ) {
      try { window.EdgeIntentEngine.learnCorrection(normOrig, normCorr); } catch (e) { /* no-op */ }
    }
  }

  /**
   * Compare originalText and newText to extract word-level substitutions
   * and store them in the vocab correction map for future STT remapping.
   */
  function learnVocabFromCorrection(originalText, newText) {
    if (!originalText || !newText || originalText === newText) return;
    var origWords = String(originalText).trim().split(/\s+/);
    var newWords = String(newText).trim().split(/\s+/);
    if (origWords.length === newWords.length) {
      for (var i = 0; i < origWords.length; i++) {
        var ow = origWords[i].replace(/[^a-zA-Z0-9]/g, "");
        var nw = newWords[i].replace(/[^a-zA-Z0-9]/g, "");
        if (ow && nw && ow.toLowerCase() !== nw.toLowerCase()) {
          learnVocabCorrection(ow, nw);
        }
      }
    } else {
      /* Differing word counts — store full phrase substitution */
      learnVocabCorrection(originalText, newText);
    }
  }

  /**
   * Persist a corrected version of an entry in localStorage.
   * Stores originalText (first ever original), correctedText, correctedAt.
   */
  function saveEntryCorrection(ticketId, entryId, originalText, newText) {
    var entries = loadEntries(ticketId);
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].id === entryId) {
        /* Preserve the first-ever original if already corrected once */
        entries[i].originalText = entries[i].originalText || originalText;
        entries[i].text = newText;
        entries[i].correctedText = newText;
        entries[i].correctedAt = new Date().toISOString();
        break;
      }
    }
    saveEntries(ticketId, entries);
    if (ticketId === currentTicketId) renderTimeline(ticketId);
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
  var CORRECTION_PREFIX_RE = /^(correction[,\s]+|actually[,\s]+|correct that[,\s]+|i meant[,\s]+)/i;

  /* Spoken-number → digit map for voice-dictated equipment names.
     Covers "RTU seven", "AHU two", "Unit twelve", etc.
     Only replaces number words immediately following a known equipment prefix. */
  var SPOKEN_UNIT_NUMBERS = {
    'one':'1','two':'2','three':'3','four':'4','five':'5',
    'six':'6','seven':'7','eight':'8','nine':'9','ten':'10',
    'eleven':'11','twelve':'12','thirteen':'13','fourteen':'14','fifteen':'15'
  };
  var SPOKEN_UNIT_RE = /\b(RTU|AHU|FCU|MAU|CU|HP|Unit|Chiller|Boiler)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\b/gi;

  function normalizeEquipmentNumbers(text) {
    return text.replace(SPOKEN_UNIT_RE, function (match, prefix, word) {
      return prefix + (SPOKEN_UNIT_NUMBERS[word.toLowerCase()] || word);
    });
  }

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

  /** Bubbles-only region; Compile/Sync remain siblings inside #ct-message-list. */
  function getMessageStreamEl() {
    return document.getElementById("ct-message-stream");
  }

  function getTimelineHeaderElement() {
    var root = document.getElementById("conversational-timeline");
    return root ? root.querySelector(".ct-header") : null;
  }

  function setTimelineOfflineState() {
    var header = getTimelineHeaderElement();
    if (!header) return;
    var isOffline = (typeof navigator !== "undefined" && navigator.onLine === false);
    header.classList.toggle("ct-header--offline", isOffline);
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
    function run() {
      try {
        list.scrollTop = list.scrollHeight;
      } catch (e) { /* no-op */ }
      /* Fallback: if scrollTop didn't move the last bubble into view (e.g. old WebKit), use scrollIntoView.
         block:"nearest" only scrolls the closest scrollable ancestor, so it won't jump the whole page. */
      try {
        var stream = getMessageStreamEl();
        var last = stream && stream.lastElementChild;
        if (last && typeof last.scrollIntoView === "function") {
          last.scrollIntoView({ block: "nearest" });
        }
      } catch (e) { /* no-op */ }
    }
    run();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () {
        requestAnimationFrame(run);
      });
    } else {
      setTimeout(run, 0);
    }
    /* Third tick for iOS / deferred layout flush after innerHTML or images */
    setTimeout(run, 80);
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
    } else if (meta.mediaType === "file") {
      thumbHtml = '<div class="ct-media-thumb ct-media-thumb--icon">&#128196;</div>';
    } else {
      thumbHtml = '<div class="ct-media-thumb ct-media-thumb--icon">&#128247;</div>';
    }

    var sizeLabel = meta.fileSize ? " \u00b7 " + formatFileSize(meta.fileSize) : "";
    var statusLabel = isError
      ? " \u00b7 \u26a0\ufe0f Upload failed"
      : (isUploading ? " \u00b7 Uploading\u2026" : "");
    var typeLabel = meta.mediaType === "video" ? "Video" : meta.mediaType === "file" ? "File" : "Photo";
    var equipBadge = meta.activeEquipment
      ? '<span class="ct-equip-badge">\uD83D\uDD27 ' + escapeHtml(meta.activeEquipment) + '</span>'
      : "";

    var entryClass = "ct-message ct-message--tech ct-media-entry" +
      (isUploading ? " ct-media-uploading" : "") +
      (isError ? " ct-media-error" : "");

    var progressHtml = isUploading
      ? '<div class="ct-upload-bar"><div class="ct-upload-bar__fill" data-entry-id="' +
        escapeHtml(item.id) + '" style="width:0%"></div></div>'
      : "";

    return (
      '<div class="ct-media-swipe-wrap">' +
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
              equipBadge +
            "</span>" +
            progressHtml +
          "</div>" +
        "</div>" +
        '<button class="ct-media-delete-reveal" type="button" ' +
          'data-delete-id="' + escapeHtml(item.id) + '" aria-label="Delete media">' +
          '\uD83D\uDDD1<br>Delete' +
        '</button>' +
      '</div>'
    );
  }

  function renderTimeline(ticketId) {
    var id = normalizeTicketId(ticketId);
    var list = getListElement();
    var stream = getMessageStreamEl();
    if (!list || !stream) return;
    currentTicketId = id;
    var entries = loadEntries(id);

    if (!entries.length) {
      /* Never set list.innerHTML — #ct-post-chat-actions is a sibling of this stream. */
      stream.innerHTML = '<p class="ct-empty">No messages yet. Additions are persisted per ticket.</p>';
      scrollToBottom();
      updateCompileBtnVisibility();
      return;
    }

    var html = "";
    for (var i = 0; i < entries.length; i++) {
      var item = entries[i];
      if (!item) continue;

      if (item.meta && item.meta.mediaType) {
        html += renderMediaEntryHtml(item);
        if (_nameplateCardsByEntryId[item.id]) {
          html += buildNameplateConfirmCard(
            _nameplateCardsByEntryId[item.id].result,
            _nameplateCardsByEntryId[item.id].equipmentRef,
            item.id
          );
        }
      } else {
        if (!item.text) continue;
        var isTech = item.role === "tech";
        if (isTech) {
          var editedBadge = item.correctedText
            ? '<span class="ct-edited-badge" aria-label="edited">edited</span>'
            : "";
          html +=
            '<div class="ct-message ct-message--tech" data-entry-id="' + escapeHtml(item.id) + '" data-tappable-entry="true">' +
              '<span class="ct-message__body">' + escapeHtml(item.text) + "</span>" +
              '<span class="ct-message__meta">Technician \u00b7 ' +
                escapeHtml(formatTime(item.ts)) +
                editedBadge +
              "</span>" +
            "</div>";
        } else {
          /* System bubble — "V" monogram icon beside message content.
             isHtml entries (e.g. checklist reminder cards) bypass escaping. */
          var bodyHtml = (item.meta && item.meta.isHtml)
            ? item.text
            : escapeHtml(item.text);
          html +=
            '<div class="ct-message ct-message--system">' +
              '<div class="ct-vertex-icon" aria-hidden="true">V</div>' +
              '<div class="ct-msg-content">' +
                '<span class="ct-message__body">' + bodyHtml + "</span>" +
                '<span class="ct-message__meta">' + escapeHtml(formatTime(item.ts)) + "</span>" +
              "</div>" +
            "</div>";
        }
      }
    }
    /* Bubbles only — preserves #ct-compile-btn / #ct-sync-btn outside this node (Mobile UI v7). */
    stream.innerHTML = html;
    scrollToBottom();
    updateCompileBtnVisibility();
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
      /* Schedule a background compile 45 s after the last entry burst */
      if (id === currentTicketId) scheduleDebounceCompile();
    }
    return entry;
  }

  /* ── STT / Hold-to-Talk ───────────────────────────────────────── */

  var _recognition = null;
  var _isRecording = false;
  var _draftEl = null;
  var _finalTranscript = "";
  var _interimTranscript = "";
  var _sendOnStop = false; /* true when send btn tapped while recording → auto-send on onend */

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
    var stream = getMessageStreamEl();
    if (!list || !stream) return;

    /* Remove "no messages" placeholder if present */
    var placeholder = stream.querySelector(".ct-empty");
    if (placeholder) placeholder.remove();

    if (!_draftEl) {
      _draftEl = document.createElement("div");
      _draftEl.className = "ct-message ct-message--tech ct-message--draft";
      stream.appendChild(_draftEl);
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
    var inputRow = document.querySelector(".ct-input-row");
    if (btn) {
      if (active) {
        btn.classList.add("ct-recording");
        btn.setAttribute("aria-pressed", "true");
      } else {
        btn.classList.remove("ct-recording");
        btn.setAttribute("aria-pressed", "false");
      }
    }
    if (inputRow) {
      inputRow.classList.toggle("ct-recording", active);
    }
  }

  function showPermissionDeniedHint() {
    var stream = getMessageStreamEl();
    if (!stream) return;
    var hint = document.createElement("p");
    hint.className = "ct-empty";
    hint.textContent = "Microphone access denied — use the text field to add notes.";
    stream.appendChild(hint);
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
      var wasSendTriggered = _sendOnStop;
      _sendOnStop = false;
      setRecordingState(false);
      removeDraftBubble();
      _recognition = null;
      var finalText = (_finalTranscript + _interimTranscript).trim();
      if (finalText) {
        if (wasSendTriggered) {
          /* ↑ send tapped while recording → transcribe + send immediately */
          addEntry(finalText, "tech", currentTicketId);
        } else {
          /* STT ended naturally (silence/timeout) → populate input for review */
          var input = document.getElementById("ct-type-input");
          if (input) { input.value = finalText; input.focus(); }
        }
      } else if (loadEntries(currentTicketId).length === 0) {
        /* restore placeholder if no entries and nothing captured */
        var stream = getMessageStreamEl();
        if (stream && !stream.querySelector(".ct-message")) {
          stream.innerHTML = '<p class="ct-empty">No messages yet. Additions are persisted per ticket.</p>';
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
      var isGenericFile = !file.type.startsWith("image/") && !file.type.startsWith("video/") && !file.type.startsWith("audio/");
      var storageBucket = isGenericFile ? "service_call_files" : "field_evidence";
      var path = storageBucket + "/" + (ticketId || "draft") + "/" + ts + "_" + safeName;
      var storageRef = window.firebase.storage().ref().child(path);
      var uploadMeta = { contentType: file.type || "application/octet-stream" };
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
          if (typeof VCStorageOutbox !== "undefined") {
            VCStorageOutbox.enqueue(storageRef.fullPath, file, uploadMeta);
          }
          console.warn("[ConvTimeline] media upload failed — queued for retry", err);
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

  /**
   * tagMedia — exported (Slice 47a).
   * Writes media metadata to Firestore with full equipment context + visibility.
   * Path: Customers/{custId}/Equipment/{equipId}/media/{autoId} when equipment
   * context resolves; otherwise field_evidence/{ticketId}/media/{autoId}.
   * Degrades silently if Firestore is unavailable (offline-safe).
   */
  function tagMedia(entryId, ticketId) {
    var id = normalizeTicketId(ticketId);
    var entries = loadEntries(id);
    var entry = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].id === entryId) {
        entry = entries[i];
        break;
      }
    }
    if (!entry || !entry.meta) return;

    try {
      if (!window.firebase || !window.firebase.firestore) return;
      var db = window.firebase.firestore();
      if (!db) return;
    } catch (e) { return; }

    var meta = entry.meta;
    var equipmentRef = meta.activeEquipment || null;
    var mediaDoc = {
      jobId: id,
      equipmentRef: equipmentRef,
      technicianName: meta.technicianName || getTechnicianName(),
      timestamp: entry.ts || new Date().toISOString(),
      visibility: meta.visibility || "internal",
      mediaType: meta.mediaType || "photo",
      fileName: meta.fileName || "",
      fileSize: meta.fileSize || 0,
      storageUrl: meta.storageUrl || null,
      entryId: entryId,
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };

    var ticket = getActiveTicket();
    var custId = "";
    if (ticket && ticket.customerName) {
      custId = String(ticket.customerName).trim()
        .replace(/[/\\]+/g, "_").replace(/\s+/g, " ").slice(0, 200);
    }
    var equipId = null;
    if (equipmentRef && window.JobContextEngine &&
        typeof window.JobContextEngine.resolveEquipmentDocId === "function") {
      equipId = window.JobContextEngine.resolveEquipmentDocId(equipmentRef);
    }

    var collRef;
    if (custId && equipId) {
      collRef = db.collection("Customers").doc(custId)
                  .collection("Equipment").doc(equipId)
                  .collection("media");
    } else {
      collRef = db.collection("field_evidence").doc(id)
                  .collection("media");
    }

    collRef.add(mediaDoc).then(function (docRef) {
      var fresh = loadEntries(id);
      for (var j = 0; j < fresh.length; j++) {
        if (fresh[j] && fresh[j].id === entryId) {
          fresh[j].meta.firestoreMediaRef = docRef.path;
          saveEntries(id, fresh);
          break;
        }
      }
    }).catch(function () {
      /* Firestore write failed — media is still in Storage, degrade silently */
    });
  }

  function addMediaEntry(file, mediaType, thumbnailDataUrl, ticketId) {
    var id = normalizeTicketId(ticketId);
    var entryId = createId();
    var entry = {
      id: entryId,
      ts: new Date().toISOString(),
      role: "tech",
      text: file.name || (mediaType === "video" ? "video_capture" : mediaType === "file" ? "file_upload" : "photo_capture"),
      meta: {
        mediaType: mediaType,
        fileName: file.name || (mediaType === "video" ? "video.webm" : mediaType === "file" ? "file" : "photo.jpg"),
        fileSize: file.size || 0,
        thumbnailDataUrl: thumbnailDataUrl || null,
        storageUrl: null,
        uploadStatus: "uploading",
        activeTicketId: id,
        technicianName: getTechnicianName(),
        activeEquipment: (window.VCJobContext && window.VCJobContext.activeEquipment) || null,
        equipmentRef: (window.JobContextEngine && typeof window.JobContextEngine.getActiveEquipment === "function"
          ? window.JobContextEngine.getActiveEquipment()
          : null) || null,
        visibility: "internal"
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
        /* Slice 47a: write tagged metadata doc to Firestore */
        tagMedia(entryId, id);
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

  /* ── Media action sheet + native capture ──────────────────────── */

  function openMediaActionSheet() {
    var overlay = document.getElementById("ct-media-action-sheet-overlay");
    if (overlay) overlay.hidden = false;
  }

  function dismissMediaActionSheet() {
    var overlay = document.getElementById("ct-media-action-sheet-overlay");
    if (overlay) overlay.hidden = true;
  }

  /**
   * capturePhotoNative — "Take a Photo" action.
   * Opens the device native camera (rear-lens preferred) via file input.
   * Native Retake / Use Photo UI is the only confirmation step.
   */
  function capturePhotoNative() {
    dismissMediaActionSheet();
    var input = document.createElement("input");
    input.type    = "file";
    input.accept  = "image/*";
    input.capture = "environment";
    input.style.cssText = "position:fixed;left:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(input);

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      try { document.body.removeChild(input); } catch (e) {}
      if (!file) return;
      createImageThumbnail(file, function (thumb) {
        var entry = addMediaEntry(file, "photo", thumb, currentTicketId);
        var eqRef = (window.JobContextEngine && typeof window.JobContextEngine.getActiveEquipment === "function")
          ? window.JobContextEngine.getActiveEquipment() : null;
        runNameplateClassification(file, eqRef || null, entry && entry.id);
      });
    });

    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (!input.files || !input.files.length) {
          try { document.body.removeChild(input); } catch (e) {}
        }
      }, 1000);
    });

    input.click();
  }

  /**
   * captureVideoNative — "Take a Video" action.
   * Opens the device native video camera via file input.
   * Saved directly to the timeline on return (no preview step).
   */
  function captureVideoNative() {
    dismissMediaActionSheet();
    var input = document.createElement("input");
    input.type    = "file";
    input.accept  = "video/*";
    input.capture = "environment";
    input.style.cssText = "position:fixed;left:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(input);

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      try { document.body.removeChild(input); } catch (e) {}
      if (!file) return;
      createVideoThumbnail(file, function (thumbDataUrl) {
        addMediaEntry(file, "video", thumbDataUrl, currentTicketId);
      });
    });

    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (!input.files || !input.files.length) {
          try { document.body.removeChild(input); } catch (e) {}
        }
      }, 1000);
    });

    input.click();
  }

  /**
   * captureFromGallery — "Pick from Photos" action.
   * Opens the device photo gallery / file picker (no camera).
   */
  function captureFromGallery() {
    dismissMediaActionSheet();
    var input = document.createElement("input");
    input.type   = "file";
    input.accept = "image/*,video/*";
    /* No capture attribute — shows full photo+video library on iOS/Android */
    input.style.cssText = "position:fixed;left:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(input);

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      try { document.body.removeChild(input); } catch (e) {}
      if (!file) return;
      if (file.type.startsWith("video/")) {
        createVideoThumbnail(file, function (thumbDataUrl) {
          addMediaEntry(file, "video", thumbDataUrl, currentTicketId);
        });
      } else {
        createImageThumbnail(file, function (thumbDataUrl) {
          var entry = addMediaEntry(file, "photo", thumbDataUrl, currentTicketId);
          var eqRef = (window.JobContextEngine && typeof window.JobContextEngine.getActiveEquipment === "function")
            ? window.JobContextEngine.getActiveEquipment() : null;
          runNameplateClassification(file, eqRef || null, entry && entry.id);
        });
      }
    });

    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (!input.files || !input.files.length) {
          try { document.body.removeChild(input); } catch (e) {}
        }
      }, 1000);
    });

    input.click();
  }

  function captureFromFiles() {
    dismissMediaActionSheet();
    var input = document.createElement("input");
    input.type   = "file";
    /* Exclude image/* and video/* so iOS skips the camera/photos sheet
       and goes straight to the Files app (iCloud Drive, On My iPhone, etc.) */
    input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.heic";
    input.style.cssText = "position:fixed;left:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(input);

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      try { document.body.removeChild(input); } catch (e) {}
      if (!file) return;
      if (file.type.startsWith("video/")) {
        createVideoThumbnail(file, function (thumbDataUrl) {
          addMediaEntry(file, "video", thumbDataUrl, currentTicketId);
        });
      } else if (file.type.startsWith("image/")) {
        createImageThumbnail(file, function (thumbDataUrl) {
          var entry = addMediaEntry(file, "photo", thumbDataUrl, currentTicketId);
          var eqRef = (window.JobContextEngine && typeof window.JobContextEngine.getActiveEquipment === "function")
            ? window.JobContextEngine.getActiveEquipment() : null;
          runNameplateClassification(file, eqRef || null, entry && entry.id);
        });
      } else {
        /* Generic file (PDF, doc, etc.) — no thumbnail, use a placeholder */
        addMediaEntry(file, "file", null, currentTicketId);
      }
    });

    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (!input.files || !input.files.length) {
          try { document.body.removeChild(input); } catch (e) {}
        }
      }, 1000);
    });

    input.click();
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
    return window.VCAgents.Conversation.generateResponse(entry, opts);
  }

  /* ── follow-up response parsing (Slice 44a) ──────────────────── */

  /**
   * parseFollowUpResponse — classifies a spoken or typed follow-up answer.
   * Returns { type, value? } where type is one of:
   *   "yes" | "no" | "skip" | "correction" | "number" | "equipment" | "text"
   */
  function parseFollowUpResponse(text) {
    return window.VCAgents.Conversation.parseFollowUpResponse(text);
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

  function checkFollowUpPrompt(/* ticketId */) {
    /* Product: never show "Which unit?" dashed prompt or auto-nudge UI. */
    hideFollowUpPrompt();
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
    /* Debounce: suppress re-fire for the same equipment within 30 s (Slice 63c) */
    if (equipment === _lastReminderEquipment && (Date.now() - _lastReminderTime) < 30000) return;
    /* Mark immediately (before async delay) to block concurrent rapid mentions */
    _lastReminderEquipment = equipment;
    _lastReminderTime = Date.now();
    /* 800 ms head start so the primary "Got it." confirmation bubble appears first */
    setTimeout(function () {
      var eng = window.ChecklistReminderEngine;
      /* First show: tech hasn't addressed any items yet — show full checklist so nothing is hidden.
         Follow-up nudges (after items are marked): use the capped getReminders() instead. */
      var isFirstShow = typeof eng.hasAnyMentioned === "function"
        ? !eng.hasAnyMentioned(equipment, ticketId)
        : false;
      var items;
      if (isFirstShow && typeof eng.getFullChecklist === "function") {
        items = eng.getFullChecklist(equipment, ticketId).map(function (item) {
          return String(equipment).trim() + " " + item.label.toLowerCase() + "?";
        });
      } else {
        items = eng.getReminders(equipment, ticketId);
      }
      if (!items || !items.length) return;
      /* Render all reminder items as one lightweight grouped card (Slice 63c) */
      var html = '<div class="ct-checklist-remind" style="background:#fef9c3;border-radius:10px;padding:10px 14px;font-size:13px;color:#713f12;">';
      html += '<div style="font-weight:600;margin-bottom:6px;">\uD83D\uDCCB ' + escapeHtml(equipment) + ' \u2014 items to check:</div>';
      html += '<ul style="margin:0;padding-left:18px;line-height:1.6;">';
      for (var i = 0; i < items.length; i++) {
        html += '<li>' + escapeHtml(items[i]) + '</li>';
      }
      html += '</ul></div>';
      addEntry(html, "system", ticketId, { isHtml: true });
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
    /* Media entries render their own card — skip intent pipeline entirely. */
    if (entry.meta && entry.meta.mediaType) return;
    var id = normalizeTicketId(ticketId);

    var rawText = safeText(entry.text);
    var textForIntent = normalizeEquipmentNumbers(rawText);

    /* Voice correction intercept (Slice 46a) — route to handleCorrection,
       skip the standard Vertex confirmation response for the command itself. */
    if (CORRECTION_PREFIX_RE.test(rawText)) {
      handleCorrection(rawText);
      return;
    }
    var parsed = null;
    var parsedText = textForIntent;
    var parsedEntities = [];

    if (
      typeof window.EdgeIntentEngine !== "undefined" &&
      window.EdgeIntentEngine &&
      typeof window.EdgeIntentEngine.parse === "function"
    ) {
      try {
        parsed = window.EdgeIntentEngine.parse(textForIntent);
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
      equipMatch = normalizeEquipmentNumbers(responseTextForIntent).match(EQUIPMENT_REGEX);
      if (equipMatch) eqRef = equipMatch[0].replace(/\s+/g, " ").trim();
    }

    /* Capture previous equipment before context switch (Slice 45a) */
    var previousEquipment = (window.VCJobContext && window.VCJobContext.activeEquipment)
      ? String(window.VCJobContext.activeEquipment)
      : null;

    if (eqRef && window.JobContextEngine && typeof JobContextEngine.setActiveEquipment === "function") {
      JobContextEngine.setActiveEquipment(eqRef);
      /* Fire reminders immediately on equipment switch ONLY when a workflow is
         already loaded (Slice 63c). The trigger-word scan block below handles
         the no-workflow case for both switch and same-equipment entries. */
      if (eqRef && (!previousEquipment || eqRef !== previousEquipment)) {
        if (window.ChecklistReminderEngine &&
            typeof window.ChecklistReminderEngine.getActiveWorkflow === "function" &&
            window.ChecklistReminderEngine.getActiveWorkflow()) {
          scheduleChecklistReminders(eqRef, id);
        }
      }
    }

    /* Trigger-word scan on EVERY entry when no workflow is loaded yet.
       No equipment context is required to scan — the workflow loads from
       form_templates based solely on trigger words in the text. Reminders
       fire in the callback using whatever equipment context is available at
       that point (eqRef from this entry OR activeEquipment already set).
       Covers all dictation patterns:
         (a) "RTU7 needs a new supply fan motor" — equipment + trigger same msg
         (b) "RTU seven needs a new supply fan motor" — spoken number now
             normalized to RTU7 before regex, so eqRef is set correctly
         (c) Same equipment already active + repair type mentioned ("supply
             fan motor is seized") — uses activeEquipment at callback time
         (d) Trigger word only, no equipment in text — callback resolves
             activeEquipment from VCJobContext
       scheduleChecklistReminders debounce (30 s) prevents double-fires. */
    if (
      rawText.trim() &&
      window.ChecklistReminderEngine &&
      typeof window.ChecklistReminderEngine.getActiveWorkflow === "function" &&
      !window.ChecklistReminderEngine.getActiveWorkflow() &&
      typeof window.ChecklistReminderEngine.scanEntryForWorkflow === "function"
    ) {
      (function (capturedEq, capturedId) {
        window.ChecklistReminderEngine.scanEntryForWorkflow(rawText, function () {
          /* Resolve equipment: prefer the eq from this entry, then fall back
             to whatever is active in VCJobContext at callback time. */
          var resolvedEq = capturedEq ||
            (window.VCJobContext && window.VCJobContext.activeEquipment
              ? String(window.VCJobContext.activeEquipment) : "");
          if (resolvedEq) {
            scheduleChecklistReminders(resolvedEq, capturedId);
          }
        });
      }(eqRef || previousEquipment, id));
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
            escalationResponse = generateResponse({
              role: entry.role,
              text: responseTextForIntent,
              meta: metaForResponse
            }, { fromEscalation: true }) || "Got it.";
          }
        } else {
          escalationResponse = generateResponse({
            role: entry.role,
            text: responseTextForIntent,
            meta: metaForResponse
          }, { fromEscalation: true }) || "Got it.";
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

  /* ── edit mode styles (Slice 46a) ────────────────────────────── */

  var _editStylesInjected = false;

  function injectEditStyles() {
    if (_editStylesInjected) return;
    _editStylesInjected = true;
    var style = document.createElement("style");
    style.id = "ct-edit-styles";
    style.textContent = [
      /* Tappable tech bubbles */
      ".ct-message--tech[data-tappable-entry]{cursor:pointer;}",
      ".ct-message--tech[data-tappable-entry]:active{opacity:.75;}",
      /* Edit mode */
      ".ct-message--tech.ct-editing{border:1.5px solid #00d4ff;border-radius:10px;}",
      ".ct-message--tech.ct-editing .ct-message__body{outline:none;min-width:60px;white-space:pre-wrap;word-break:break-word;}",
      /* Save / Cancel action row */
      ".ct-edit-actions{display:flex;gap:8px;margin-top:6px;}",
      ".ct-edit-actions button{min-height:36px;padding:0 14px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;}",
      ".ct-edit-save{background:#00d4ff;color:#0d0d1a;}",
      ".ct-edit-cancel{background:rgba(255,255,255,.12);color:#fff;}",
      /* Edited badge */
      ".ct-edited-badge{font-size:10px;font-weight:500;color:#00d4ff;opacity:.8;",
      "  background:rgba(0,212,255,.1);border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:middle;}",
      ".ct-equip-badge{display:inline-block;font-size:10px;font-weight:600;color:#00d4ff;",
      "  background:rgba(0,212,255,.12);border-radius:4px;padding:1px 6px;margin-left:4px;vertical-align:middle;",
      "  white-space:nowrap;}"
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  /* ── editable timeline entries (Slice 46a) ───────────────────── */

  /**
   * editEntry — exported.
   * Activates contenteditable inline edit mode on a tech timeline bubble.
   * Save commits the change to localStorage; Cancel restores original display.
   */
  function editEntry(entryId) {
    if (!entryId) return;
    var list = getListElement();
    if (!list) return;

    var bubble = list.querySelector('[data-entry-id="' + entryId + '"]');
    if (!bubble) return;
    if (bubble.classList.contains("ct-editing")) return;

    /* Locate the stored entry */
    var entries = loadEntries(currentTicketId);
    var entry = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].id === entryId) {
        entry = entries[i];
        break;
      }
    }
    if (!entry) return;

    var currentText = entry.text;
    bubble.classList.add("ct-editing");

    var bodyEl = bubble.querySelector(".ct-message__body");
    if (!bodyEl) { bubble.classList.remove("ct-editing"); return; }

    bodyEl.setAttribute("contenteditable", "true");
    bodyEl.focus();

    /* Move cursor to end of text */
    try {
      var range = document.createRange();
      range.selectNodeContents(bodyEl);
      range.collapse(false);
      var sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    } catch (e) { /* no-op — older browsers */ }

    var actionsEl = document.createElement("div");
    actionsEl.className = "ct-edit-actions";
    actionsEl.innerHTML =
      '<button class="ct-edit-save" type="button">Save</button>' +
      '<button class="ct-edit-cancel" type="button">Cancel</button>';
    bubble.appendChild(actionsEl);

    function exitEditMode() {
      bodyEl.removeAttribute("contenteditable");
      bubble.classList.remove("ct-editing");
      if (actionsEl && actionsEl.parentNode) {
        actionsEl.parentNode.removeChild(actionsEl);
      }
    }

    actionsEl.querySelector(".ct-edit-save").addEventListener("click", function () {
      var newText = (bodyEl.textContent || "").trim();
      exitEditMode();
      if (newText && newText !== currentText) {
        learnVocabFromCorrection(currentText, newText);
        saveEntryCorrection(currentTicketId, entryId, currentText, newText);
      } else {
        renderTimeline(currentTicketId);
      }
    });

    actionsEl.querySelector(".ct-edit-cancel").addEventListener("click", function () {
      exitEditMode();
      renderTimeline(currentTicketId);
    });
  }

  /**
  /* ── Media viewer: photo lightbox + video player ──────────────── */

  function openMediaViewer(entryId) {
    var entries = loadEntries(currentTicketId);
    var entry = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].id === entryId) { entry = entries[i]; break; }
    }
    if (!entry || !entry.meta) return;

    if (entry.meta.mediaType === "photo") {
      /* Prefer full-res Storage URL; fall back to thumbnail data URL */
      openPhotoLightbox(entry.meta.storageUrl || entry.meta.thumbnailDataUrl);
    } else if (entry.meta.mediaType === "video") {
      openVideoPlayer(entry.meta.storageUrl, entry.meta.uploadStatus === "error");
    } else if (entry.meta.mediaType === "file" && entry.meta.storageUrl) {
      window.open(entry.meta.storageUrl, "_blank");
    }
  }

  function openPhotoLightbox(src) {
    var overlay = document.getElementById("ct-photo-lightbox");
    var img     = document.getElementById("ct-lightbox-img");
    if (!overlay || !img) return;
    img.src = src || "";
    overlay.hidden = false;
  }

  function closePhotoLightbox() {
    var overlay = document.getElementById("ct-photo-lightbox");
    var img     = document.getElementById("ct-lightbox-img");
    if (img) img.src = "";
    if (overlay) overlay.hidden = true;
  }

  function openVideoPlayer(src, isError) {
    var overlay = document.getElementById("ct-video-player-modal");
    var video   = document.getElementById("ct-video-player-el");
    var msg     = document.getElementById("ct-video-player-msg");
    if (!overlay) return;
    if (!src) {
      if (video) { video.src = ""; video.style.display = "none"; }
      if (msg)   {
        msg.style.display = "block";
        msg.textContent = isError ? "Video upload failed." : "Video is still uploading \u2014 check back in a moment.";
      }
    } else {
      if (video) { video.src = src; video.style.display = "block"; video.load(); }
      if (msg)   msg.style.display = "none";
    }
    overlay.hidden = false;
  }

  function closeVideoPlayer() {
    var overlay = document.getElementById("ct-video-player-modal");
    var video   = document.getElementById("ct-video-player-el");
    if (video) { try { video.pause(); } catch (e) {} video.src = ""; }
    if (overlay) overlay.hidden = true;
  }

  /* ── Swipe-to-delete: delete + confirm ────────────────────────── */

  function deleteMediaEntry(entryId) {
    var entries = loadEntries(currentTicketId);
    var filtered = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].id !== entryId) filtered.push(entries[i]);
    }
    saveEntries(currentTicketId, filtered);
    renderTimeline(currentTicketId);

    var confirmOv = document.getElementById("ct-delete-confirm-overlay");
    if (confirmOv) {
      confirmOv.hidden = true;
      confirmOv.removeAttribute("data-deleting-id");
    }
  }

  function confirmDeleteMediaEntry(entryId) {
    var overlay = document.getElementById("ct-delete-confirm-overlay");
    if (!overlay) {
      if (window.confirm("Delete this media? This cannot be undone.")) {
        deleteMediaEntry(entryId);
      }
      return;
    }
    overlay.setAttribute("data-deleting-id", entryId);
    overlay.hidden = false;
  }

  function dismissDeleteConfirm() {
    var overlay = document.getElementById("ct-delete-confirm-overlay");
    if (!overlay) return;
    var entryId = overlay.getAttribute("data-deleting-id") || "";
    overlay.hidden = true;
    overlay.removeAttribute("data-deleting-id");

    /* Snap swiped entry back */
    var swipedEls = document.querySelectorAll(".ct-media-swipe-wrap.ct-swiped");
    for (var i = 0; i < swipedEls.length; i++) {
      var ent = swipedEls[i].querySelector(".ct-media-entry");
      if (ent) {
        ent.style.transition = "transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)";
        ent.style.transform  = "translateX(0)";
      }
      swipedEls[i].classList.remove("ct-swiped");
    }
    void entryId;
  }

   /**
   * wireTimelineEditing — attaches event-delegated tap listener to #ct-message-list
   * so tapping any tech bubble enters inline edit mode.
   * Called once from init(); survives innerHTML re-renders because the listener
   * is on the container, not on individual bubbles.
   */
  function wireTimelineEditing() {
    var list = getListElement();
    if (!list) return;
    list.addEventListener("click", function (e) {
      /* Ignore clicks inside an active edit (contenteditable / action buttons) */
      if (e.target.closest && e.target.closest(".ct-editing")) return;
      var bubble = e.target.closest && e.target.closest("[data-tappable-entry]");
      if (!bubble) return;
      var entryId = bubble.getAttribute("data-entry-id");
      if (entryId) editEntry(entryId);
    });
  }

  /* ── voice correction handler (Slice 46a) ────────────────────── */

  /**
   * handleCorrection — exported.
   * Parses a voice (or typed) correction that starts with "correction" / "actually".
   * Strips the prefix, then:
   *   1. If the correction contains an equipment ref, finds the most recent tech
   *      entry that also has an equipment ref and replaces the ref in that entry.
   *   2. Otherwise replaces the full text of the most recent non-correction entry.
   * Stores originalText + correctedText + correctedAt on the entry.
   * Learns word-level vocabulary substitutions for the session.
   * Returns the updated entry object, or null if nothing to correct.
   */
  function handleCorrection(rawCorrectionText) {
    var raw = String(rawCorrectionText || "").trim();
    if (!raw) return null;

    /* Strip correction prefix */
    var prefixMatch = raw.match(CORRECTION_PREFIX_RE);
    var correctionText = prefixMatch ? raw.slice(prefixMatch[0].length).trim() : raw;
    if (!correctionText) return null;

    var entries = loadEntries(currentTicketId);
    var techEntries = entries.filter(function (e) {
      return (
        e &&
        e.role === "tech" &&
        !(e.meta && (e.meta.seed || e.meta.mediaType)) &&
        !CORRECTION_PREFIX_RE.test(safeText(e.text))
      );
    });

    if (!techEntries.length) return null;

    var corrEqMatch = correctionText.match(EQUIPMENT_REGEX);
    var targetEntry = null;

    if (corrEqMatch) {
      /* Prefer the most recent entry that itself has an equipment ref */
      for (var i = techEntries.length - 1; i >= 0; i--) {
        if (EQUIPMENT_REGEX.test(techEntries[i].text)) {
          targetEntry = techEntries[i];
          break;
        }
      }
    }

    /* Recency fallback */
    if (!targetEntry) {
      targetEntry = techEntries[techEntries.length - 1];
    }

    if (!targetEntry) return null;

    var originalText = targetEntry.originalText || targetEntry.text;
    var newText;

    if (corrEqMatch) {
      /* Replace the equipment ref in the original entry text */
      var replaced = originalText.replace(EQUIPMENT_REGEX, corrEqMatch[0]);
      newText = (replaced !== originalText) ? replaced : correctionText;
    } else {
      newText = correctionText;
    }

    learnVocabFromCorrection(originalText, newText);
    saveEntryCorrection(currentTicketId, targetEntry.id, originalText, newText);

    setTimeout(function () {
      addEntry("Correction noted. Updated.", "system", currentTicketId);
    }, 300);

    return targetEntry;
  }

  /* ── Slice 53a: Hierarchical knowledge retrieval ────────────────── */

  /**
   * searchTimelineEntries — Level 1 of the lookup ladder.
   * Searches the current ticket's timeline entries for keywords.
   */
  function searchTimelineEntries(question, ticketId) {
    var id = normalizeTicketId(ticketId);
    var entries = loadEntries(id);
    if (!entries.length) return null;
    var q = String(question || "").toLowerCase();
    var words = q.split(/\s+/).filter(function (w) { return w.length > 2; });
    if (!words.length) return null;

    var bestEntry = null;
    var bestScore = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e || !e.text) continue;
      var txt = e.text.toLowerCase();
      var score = 0;
      for (var j = 0; j < words.length; j++) {
        if (txt.indexOf(words[j]) !== -1) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestEntry = e;
      }
    }
    return bestScore > 0 ? bestEntry : null;
  }

  /**
   * askCloudGemini — Level 6 of the lookup ladder.
   * Sends the question + job context to Gemini for a free-form answer.
   */
  function askCloudGemini(question) {
    var ticket = getActiveTicket();
    var activeEquip = "";
    try {
      if (window.JobContextEngine && typeof window.JobContextEngine.getActiveEquipment === "function") {
        activeEquip = window.JobContextEngine.getActiveEquipment() || "";
      }
    } catch (e) {}
    return window.VCAgents.Conversation.askCloudGemini(question, {
      customerName: ticket && ticket.customerName,
      address: ticket && (ticket.locationAddress || ticket.address),
      issue: ticket && ticket.issue,
      activeEquipment: activeEquip
    });
  }

  /**
   * runLookupLadder — executes the 6-level hierarchical search.
   * Returns Promise<{ answer, source, sourceBadge }>.
   */
  function runLookupLadder(question) {
    var q = String(question || "").trim();
    if (!q) return Promise.resolve({ answer: "", source: "none", sourceBadge: "" });

    /* Level 1: Current job timeline entries */
    var timelineHit = searchTimelineEntries(q, currentTicketId);
    if (timelineHit) {
      return Promise.resolve({
        answer: timelineHit.text,
        source: "timeline",
        sourceBadge: "\uD83D\uDCDD Job notes"
      });
    }

    /* Level 2: Site notes */
    try {
      if (window.JobContextEngine && typeof window.JobContextEngine.searchSiteNotes === "function") {
        var siteResult = window.JobContextEngine.searchSiteNotes(q, currentTicketId);
        if (siteResult && siteResult.found) {
          return Promise.resolve({
            answer: siteResult.text,
            source: "site_notes",
            sourceBadge: "\uD83D\uDCD6 Site notes"
          });
        }
      }
    } catch (e) {}

    /* Level 3: Equipment history */
    try {
      if (window.JobContextEngine && typeof window.JobContextEngine.searchEquipmentHistory === "function") {
        var equipResult = window.JobContextEngine.searchEquipmentHistory(q, currentTicketId);
        if (equipResult && equipResult.found) {
          return Promise.resolve({
            answer: equipResult.text,
            source: "equipment_history",
            sourceBadge: "\uD83D\uDD27 Equipment"
          });
        }
      }
    } catch (e) {}

    /* Level 4: Company-wide knowledge (TeachingLayer) */
    var companyPromise;
    try {
      if (window.TeachingLayer && typeof window.TeachingLayer.lookupKnowledge === "function") {
        companyPromise = window.TeachingLayer.lookupKnowledge(q, { scope: "company" });
      } else {
        companyPromise = Promise.resolve(null);
      }
    } catch (e) {
      companyPromise = Promise.resolve(null);
    }

    return companyPromise.then(function (companyDoc) {
      if (companyDoc && companyDoc.text) {
        return {
          answer: companyDoc.text,
          source: "company",
          sourceBadge: "\uD83C\uDFE2 Company"
        };
      }

      /* Level 5: Uploaded manuals — stub */
      /* Future: search uploaded manuals here */

      /* Level 6: Cloud lookup via Gemini */
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return {
          answer: "No answer found offline. Try again when connected.",
          source: "offline",
          sourceBadge: "\u26A0\uFE0F Offline"
        };
      }

      return askCloudGemini(q).then(function (cloudAnswer) {
        if (cloudAnswer) {
          return {
            answer: cloudAnswer,
            source: "cloud",
            sourceBadge: "\u2601\uFE0F Cloud"
          };
        }
        return { answer: "No answer found.", source: "none", sourceBadge: "" };
      }).catch(function () {
        return { answer: "Cloud lookup failed. Try again later.", source: "error", sourceBadge: "\u26A0\uFE0F Error" };
      });
    });
  }

  /**
   * saveAnswerAsKnowledge — writes a cloud-sourced answer to the knowledge
   * collection as company-wide knowledge.
   */
  function saveAnswerAsKnowledge(question, answer) {
    if (!window.TeachingLayer || typeof window.TeachingLayer.saveTeaching !== "function") {
      return Promise.resolve(null);
    }
    return window.TeachingLayer.saveTeaching({
      scope: "company",
      scopeRef: "",
      text: "Q: " + question + "\nA: " + answer,
      tags: ["auto-saved", "cloud-answer"],
      mediaUrls: []
    });
  }

  /**
   * saveAnswerAsSiteNote — writes a cloud-sourced answer to site_intelligence.
   */
  function saveAnswerAsSiteNote(question, answer) {
    try {
      if (!window.firebase || !window.firebase.firestore) return Promise.resolve(null);
      var db = window.firebase.firestore();
      if (!db) return Promise.resolve(null);

      var ticket = getActiveTicket();
      if (!ticket || !ticket.customerName) return Promise.resolve(null);

      var custName = String(ticket.customerName || "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      var addr = String(ticket.address || ticket.locationAddress || "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      var siteDocId = custName && addr ? custName + "__" + addr : "";
      if (!siteDocId) return Promise.resolve(null);

      var siCol = (typeof VCFirestore !== "undefined" && VCFirestore.siteIntelligence)
        ? VCFirestore.siteIntelligence(db)
        : db.collection("site_intelligence");

      return siCol.doc(siteDocId).set({
        notes: "Q: " + question + "\nA: " + answer,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: getTechnicianName()
      }, { merge: true });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /**
   * showSavePrompt — after a cloud answer, offers to save it.
   */
  function showSavePrompt(question, answer) {
    var stream = getMessageStreamEl();
    if (!stream) return;

    var promptEl = document.createElement("div");
    promptEl.className = "ct-message ct-message--system ct-ask-save-prompt";
    promptEl.innerHTML =
      '<div class="ct-vertex-icon" aria-hidden="true">V</div>' +
      '<div class="ct-msg-content">' +
        '<span class="ct-message__body">Save this answer for future reference?</span>' +
        '<div class="ct-ask-save-btns">' +
          '<button type="button" class="ct-ask-save-btn ct-ask-save-btn--company" data-save="company">\uD83C\uDFE2 Company knowledge</button>' +
          '<button type="button" class="ct-ask-save-btn ct-ask-save-btn--site" data-save="site">\uD83D\uDCD6 Site note</button>' +
          '<button type="button" class="ct-ask-save-btn ct-ask-save-btn--dismiss" data-save="dismiss">\u2715 Skip</button>' +
        '</div>' +
      '</div>';

    stream.appendChild(promptEl);
    scrollToBottom();

    var btns = promptEl.querySelectorAll(".ct-ask-save-btn");
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var action = btn.getAttribute("data-save");
          if (promptEl.parentNode) promptEl.parentNode.removeChild(promptEl);

          if (action === "company") {
            saveAnswerAsKnowledge(question, answer).then(function () {
              addEntry("\uD83C\uDFE2 Saved as company knowledge.", "system", currentTicketId);
            }).catch(function () {
              addEntry("\u26A0\uFE0F Failed to save. Queued offline.", "system", currentTicketId);
            });
          } else if (action === "site") {
            saveAnswerAsSiteNote(question, answer).then(function () {
              addEntry("\uD83D\uDCD6 Saved as site note.", "system", currentTicketId);
            }).catch(function () {
              addEntry("\u26A0\uFE0F Failed to save. Try again later.", "system", currentTicketId);
            });
          }
        });
      })(btns[i]);
    }
  }

  /**
   * handleAskQuestion — wired to the Ask button.
   * Reads from the text input, runs the lookup ladder, displays result.
   */
  function handleAskQuestion() {
    var input = document.getElementById("ct-type-input");
    var question = input ? input.value.trim() : "";
    if (!question) {
      if (input) {
        input.placeholder = "Type your question first…";
        input.focus();
      }
      return;
    }

    input.value = "";
    addEntry("\u2753 " + question, "tech", currentTicketId, { askQuestion: true });

    var askBtn = document.getElementById("ct-ask-btn");
    if (askBtn) {
      askBtn.disabled = true;
      askBtn.textContent = "\u23F3";
    }

    runLookupLadder(question).then(function (result) {
      if (askBtn) {
        askBtn.disabled = false;
        askBtn.textContent = "\u2753";
      }

      if (!result || !result.answer) {
        addEntry("No answer found.", "system", currentTicketId);
        return;
      }

      var badge = result.sourceBadge ? result.sourceBadge + " " : "";
      addEntry(badge + result.answer, "system", currentTicketId, {
        askSource: result.source,
        askSourceBadge: result.sourceBadge
      });

      if (result.source === "cloud") {
        showSavePrompt(question, result.answer);
      }
    }).catch(function () {
      if (askBtn) {
        askBtn.disabled = false;
        askBtn.textContent = "\u2753";
      }
      addEntry("\u26A0\uFE0F Lookup failed. Try again.", "system", currentTicketId);
    });
  }

  /**
   * wireAskBtn — binds the #ct-ask-btn click handler.
   */
  function wireAskBtn() {
    var btn = document.getElementById("ct-ask-btn");
    if (!btn) return;
    if (btn.dataset.vcWired === "1") return;
    btn.dataset.vcWired = "1";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      handleAskQuestion();
    });
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
      /* Click-to-toggle: tap mic to start; tap send ↑ to stop+transcribe+send */
      talkBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (_isRecording) {
          stopListening();
        } else {
          startListening();
        }
      });
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
      mediaBtn.addEventListener("click", function () {
        openMediaActionSheet();
      });
    }

    /* ── Action sheet option buttons ─────────────────────────────────── */
    var actionPhoto   = document.getElementById("ct-action-photo");
    var actionVideo   = document.getElementById("ct-action-video");
    var actionGallery = document.getElementById("ct-action-gallery");
    var actionFile    = document.getElementById("ct-action-file");
    var actionCancel  = document.getElementById("ct-action-cancel");

    if (actionPhoto)   actionPhoto.addEventListener("click",   capturePhotoNative);
    if (actionVideo)   actionVideo.addEventListener("click",   captureVideoNative);
    if (actionGallery) actionGallery.addEventListener("click", captureFromGallery);
    if (actionFile)    actionFile.addEventListener("click",    captureFromFiles);
    if (actionCancel)  actionCancel.addEventListener("click",  dismissMediaActionSheet);

    /* Tap backdrop to cancel */
    var actionSheetOverlay = document.getElementById("ct-media-action-sheet-overlay");
    if (actionSheetOverlay) {
      actionSheetOverlay.addEventListener("click", function (e) {
        if (e.target === actionSheetOverlay) dismissMediaActionSheet();
      });
    }
  }

  /* ── workspace integration ────────────────────────────────────── */

  /* ── Site Memory Panel (Slice 51a) ────────────────────────────── */

  var _siteMemoryCollapsed = false;

  function escapeHtmlAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }

  function renderSiteMemory(ticketId) {
    var panel = document.getElementById("ct-site-memory");
    if (!panel) return;

    var memory = null;
    try {
      if (
        window.JobContextEngine &&
        typeof window.JobContextEngine.getSiteMemory === "function"
      ) {
        memory = window.JobContextEngine.getSiteMemory(ticketId || currentTicketId);
      }
    } catch (e) { /* degrade silently */ }

    if (!memory) {
      panel.hidden = true;
      return;
    }

    var unresolved = memory.unresolvedIssues || [];
    var recurring = memory.recurringFailures || [];
    var siteNotes = memory.siteNotes || "";
    var quotes = memory.quotes || [];

    var hasContent = unresolved.length > 0 || recurring.length > 0 || siteNotes || quotes.length > 0;
    if (!hasContent) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;

    var bodyHtml = "";

    if (unresolved.length) {
      bodyHtml += '<div class="ct-sm-section">';
      bodyHtml += '<p class="ct-sm-section-label">⚠️ Unresolved from last visit</p>';
      bodyHtml += '<ul class="ct-sm-list">';
      for (var i = 0; i < unresolved.length; i++) {
        var ui = unresolved[i];
        var sev = ui.severity ? ' <span class="ct-sm-sev ct-sm-sev--' + escapeHtmlAttr(ui.severity) + '">' + escapeHtml(ui.severity.toUpperCase()) + "</span>" : "";
        bodyHtml += "<li>" + escapeHtml(ui.issue || "") + sev;
        if (ui.notes) bodyHtml += ' <span class="ct-sm-note">' + escapeHtml(ui.notes) + "</span>";
        bodyHtml += "</li>";
      }
      bodyHtml += "</ul></div>";
    }

    if (recurring.length) {
      bodyHtml += '<div class="ct-sm-section">';
      bodyHtml += '<p class="ct-sm-section-label">🔄 Recurring</p>';
      bodyHtml += '<ul class="ct-sm-list">';
      for (var j = 0; j < recurring.length; j++) {
        var rf = recurring[j];
        bodyHtml += "<li><strong>" + escapeHtml(rf.equipment || "") + "</strong>";
        bodyHtml += ' <span class="ct-sm-count">×' + (rf.count || 2) + " visits</span>";
        if (rf.sample) bodyHtml += ' <span class="ct-sm-note">' + escapeHtml(rf.sample) + "</span>";
        bodyHtml += "</li>";
      }
      bodyHtml += "</ul></div>";
    }

    if (siteNotes) {
      bodyHtml += '<div class="ct-sm-section">';
      bodyHtml += '<p class="ct-sm-section-label">📝 Site notes</p>';
      bodyHtml += '<p class="ct-sm-notes">' + escapeHtml(siteNotes) + "</p>";
      bodyHtml += "</div>";
    }

    if (quotes.length) {
      bodyHtml += '<div class="ct-sm-section">';
      bodyHtml += '<p class="ct-sm-section-label">💬 Previous quotes</p>';
      bodyHtml += '<ul class="ct-sm-list">';
      for (var k = 0; k < quotes.length; k++) {
        var q = quotes[k];
        if (!q) continue;
        var qLabel = q.quoteNum ? "Quote #" + q.quoteNum : (q.id ? q.id : "Quote");
        var qStatus = q.status ? ' <span class="ct-sm-status">' + escapeHtml(q.status) + "</span>" : "";
        bodyHtml += "<li><strong>" + escapeHtml(qLabel) + "</strong>" + qStatus;
        if (q.text) bodyHtml += " — " + escapeHtml(q.text.slice(0, 120) + (q.text.length > 120 ? "…" : ""));
        if (q.total != null) bodyHtml += ' <span class="ct-sm-total">$' + escapeHtml(String(q.total)) + "</span>";
        bodyHtml += "</li>";
      }
      bodyHtml += "</ul></div>";
    }

    var collapseClass = _siteMemoryCollapsed ? " ct-sm--collapsed" : "";
    var chevron = _siteMemoryCollapsed ? "›" : "⌄";
    panel.className = "ct-site-memory" + collapseClass;
    panel.innerHTML =
      '<button class="ct-sm-header" type="button" aria-expanded="' + (!_siteMemoryCollapsed) + '" aria-controls="ct-sm-body">' +
        '<span class="ct-sm-title">Site Memory</span>' +
        '<span class="ct-sm-chevron" aria-hidden="true">' + chevron + "</span>" +
      "</button>" +
      '<div id="ct-sm-body" class="ct-sm-body">' + bodyHtml + "</div>";

    var headerBtn = panel.querySelector(".ct-sm-header");
    if (headerBtn) {
      headerBtn.addEventListener("click", function () {
        _siteMemoryCollapsed = !_siteMemoryCollapsed;
        renderSiteMemory(ticketId || currentTicketId);
      });
    }
  }

  /**
   * Query the most recent completed_report for this ticket from the cloud and restore
   * compile state so the next workspace open is instant (or delta-only).
   * @param {string} ticketId
   * @param {function(boolean)} onDone  called with true if state was restored, false otherwise
   */
  /* ── Compile result localStorage cache ──────────────────────────── */
  var VC_COMPILE_CACHE_PREFIX = "vc_compile_cache_";

  function saveCompileCache(ticketId, result, displayText, compiledEntryCount) {
    if (!ticketId || ticketId === "draft") return;
    try {
      localStorage.setItem(
        VC_COMPILE_CACHE_PREFIX + ticketId,
        JSON.stringify({
          result: result,
          displayText: displayText,
          compiledEntryCount: compiledEntryCount || 0,
          submittedAt: new Date().toISOString()
        })
      );
    } catch (e) { /* quota or private-mode — degrade silently */ }
  }

  function loadCompileCache(ticketId) {
    if (!ticketId || ticketId === "draft") return null;
    try {
      var raw = localStorage.getItem(VC_COMPILE_CACHE_PREFIX + ticketId);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      return (cached && cached.result) ? cached : null;
    } catch (e) { return null; }
  }

  function tryRestoreCompiledResultFromCloud(ticketId, onDone) {
    if (!ticketId || ticketId === "draft") { if (onDone) onDone(false); return; }
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      if (onDone) onDone(false); return;
    }
    var db;
    try { db = firebase.firestore(); } catch (e) { if (onDone) onDone(false); return; }
    var crCol;
    try {
      crCol = (typeof VCFirestore !== "undefined" && VCFirestore.completedReports)
        ? VCFirestore.completedReports(db)
        : db.collection("completed_reports");
    } catch (e) { if (onDone) onDone(false); return; }

    crCol.where("ticketId", "==", ticketId)
      .orderBy("compiledAt", "desc")
      .limit(1)
      .get()
      .then(function (snap) {
        if (snap.empty) { if (onDone) onDone(false); return; }
        var docData = snap.docs[0].data();
        if (!docData || !docData.compiledResult) { if (onDone) onDone(false); return; }
        /* Guard: discard if tech already switched to another ticket */
        if (currentTicketId !== ticketId) { if (onDone) onDone(false); return; }
        _compiledResult = docData.compiledResult;
        _compiledDisplayText = docData.editedDisplayText
          || formatCompileResultForDisplay(docData.compiledResult);
        _lastCompiledIndex = docData.compiledEntryCount || 0;
        _lastCompileResult = _compiledResult;
        /* Treat as already submitted — suppress close prompt for this recall */
        _compileSubmittedForTicket = ticketId;
        if (onDone) onDone(true);
      })
      .catch(function () { if (onDone) onDone(false); });
  }

  /**
   * If entries were added after the last cloud submit, run a delta compile in the
   * background and update the compile modal textarea in-place (no re-open needed).
   */
  function runDeltaUpdateInPlace(ticketId) {
    var entries = loadEntries(ticketId);
    var newEntries = entries.slice(_lastCompiledIndex);
    if (!newEntries.length || _isCompiling) return;

    var modal = document.getElementById("ct-compile-modal");
    var statusEl = modal ? modal.querySelector(".ct-compile-status") : null;
    if (statusEl) {
      statusEl.textContent = "Adding recent entries…";
      statusEl.style.color = "#64748b";
    }

    var context = gatherCompileContext();
    var prompt = buildDeltaCompilePrompt(newEntries, _compiledResult, context);
    _isCompiling = true;
    var myToken = ++_compileToken;
    var snapshotIndex = entries.length;
    var capturedTicketId = ticketId;

    callGeminiCompile(prompt, COMPILE_DELTA_MAX_TOKENS).then(function (result) {
      if (currentTicketId !== capturedTicketId || _compileToken !== myToken) return;
      _compiledResult = mergeCompileResults(_compiledResult, result);
      _compiledDisplayText = formatCompileResultForDisplay(_compiledResult);
      _lastCompiledIndex = snapshotIndex;
      _lastCompileResult = _compiledResult;
      /* Update textarea in-place if modal still open */
      var m = document.getElementById("ct-compile-modal");
      if (m && !m.classList.contains("hidden")) {
        var ta = m.querySelector(".ct-compile-textarea");
        if (ta) ta.value = _compiledDisplayText;
        var sEl = m.querySelector(".ct-compile-status");
        if (sEl && !sEl.querySelector(".ct-close-prompt-row")) {
          sEl.textContent = "Updated with new entries ✓";
          sEl.style.color = "#16a34a";
          setTimeout(function () { if (sEl) sEl.textContent = ""; }, 3000);
        }
      }
      /* After delta, this is no longer fully "submitted" — new content not yet synced */
      _compileSubmittedForTicket = null;
    }).catch(function () {
      if (statusEl && !statusEl.querySelector(".ct-close-prompt-row")) statusEl.textContent = "";
    }).finally(function () {
      if (_compileToken === myToken) _isCompiling = false;
    });
  }

  function onWorkspaceOpen(ticketId) {
    var newTicketId = normalizeTicketId(ticketId || resolveTicketIdFromObject(getActiveTicket()));
    /* Reset compile state when switching to a different ticket */
    var isTicketSwitch = (newTicketId !== currentTicketId);
    if (isTicketSwitch) {
      resetCompileState();
    }
    currentTicketId = newTicketId;
    /* Reset follow-up dismiss state per ticket open */
    _followUpDismissed = false;
    _siteMemoryCollapsed = false;
    /* Reset checklist reminder debounce so a new ticket always gets fresh reminders,
     * even if opened within 30 s of the previous workspace close (Slice 63c fix). */
    _lastReminderEquipment = null;
    _lastReminderTime = 0;
    hideFollowUpPrompt();
    seedFromTicket(currentTicketId);
    renderTimeline(currentTicketId);
    setTimelineOfflineState();
    renderSiteMemory(currentTicketId);
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

    /* Slice 52a: Teaching Layer — surface contextual knowledge tips */
    try {
      if (window.TeachingLayer && typeof window.TeachingLayer.onWorkspaceOpen === "function") {
        window.TeachingLayer.onWorkspaceOpen();
      }
    } catch (e) { /* degrade silently */ }

    /* Start background compile timer */
    startBgCompileTimer();

    /* Stop timer immediately if tech marks job inactive */
    try {
      var statusEl = document.getElementById("finalJobStatus");
      if (statusEl && !statusEl._bgCompileWired) {
        statusEl._bgCompileWired = true;
        statusEl.addEventListener("change", function () {
          if (!isJobActiveForCompile()) stopBgCompileTimer();
        });
      }
    } catch (e) { /* degrade silently */ }

    /* Auto-show compiled report on workspace entry so the summary is the first thing seen */
    var capturedOpenTicketId = currentTicketId;

    function autoOpenAfterPaint(cb) {
      /* Wait for the workspace to finish painting (rAF + rAF = one full
         frame cycle) then add a small delay for iOS Safari layout settle. */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setTimeout(function () {
            if (currentTicketId === capturedOpenTicketId) cb();
          }, 150);
        });
      });
    }

    if (capturedOpenTicketId && capturedOpenTicketId !== "draft") {
      if (!isTicketSwitch && _compiledResult) {
        /* Same ticket, result already in memory — open after paint */
        _lastCompileResult = _compiledResult;
        autoOpenAfterPaint(function () {
          openCompileModal(_compiledDisplayText);
        });
      } else {
        /* Ticket switch OR same ticket with no in-memory result — check cache then cloud */
        var cached = loadCompileCache(capturedOpenTicketId);
        if (cached) {
          _compiledResult        = cached.result;
          _compiledDisplayText   = cached.displayText || formatCompileResultForDisplay(cached.result);
          _lastCompiledIndex     = cached.compiledEntryCount || 0;
          _lastCompileResult     = _compiledResult;
          _compileSubmittedForTicket = capturedOpenTicketId;
          autoOpenAfterPaint(function () {
            openCompileModal(_compiledDisplayText);
            runDeltaUpdateInPlace(capturedOpenTicketId);
          });
        } else {
          /* No local cache — fall back to cloud query */
          tryRestoreCompiledResultFromCloud(capturedOpenTicketId, function (restored) {
            if (restored && currentTicketId === capturedOpenTicketId) {
              autoOpenAfterPaint(function () {
                openCompileModal(_compiledDisplayText);
                runDeltaUpdateInPlace(capturedOpenTicketId);
              });
            }
          });
        }
      }
    }
  }

  function onWorkspaceClose() {
    stopBgCompileTimer();
  }

  /* ── Compile Notes (Slice 48a) ─────────────────────────────────── */

  var COMPILE_MIN_ENTRIES = 3;
  var COMPILE_BG_INTERVAL_MS = 5 * 60 * 1000; /* 5 minutes — safety-net sweep */
  var COMPILE_DEBOUNCE_MS    = 45 * 1000;      /* 45 s quiet period after last entry */
  var COMPILE_DELTA_MAX_TOKENS = (window.VCAgents && window.VCAgents.NotesParser) ? window.VCAgents.NotesParser.COMPILE_DELTA_MAX_TOKENS : 2048;
  var COMPILE_FULL_MAX_TOKENS  = (window.VCAgents && window.VCAgents.NotesParser) ? window.VCAgents.NotesParser.COMPILE_FULL_MAX_TOKENS : 8192;

  /* Rolling background compile state */
  var _bgCompileTimer = null;
  var _bgDebounceTimer = null;
  var _lastCompiledIndex = 0;   /* number of entries already compiled */
  var _compiledResult = null;   /* merged JSON result so far */
  var _compiledDisplayText = null; /* formatted display string */
  var _isCompiling = false;     /* prevents overlapping compiles */
  var _compileToken = 0;        /* increments each compile start; .finally() guards against stale clears */
  var _compileSubmittedForTicket = null; /* ticketId of last successful cloud submit — used by close prompt */
  var _submitSuccessCallback = null;    /* optional one-shot callback fired after successful submit (nav guard) */

  function resetCompileState() {
    _lastCompiledIndex = 0;
    _compiledResult = null;
    _compiledDisplayText = null;
    _isCompiling = false;
    _compileSubmittedForTicket = null;
    if (_bgDebounceTimer) { clearTimeout(_bgDebounceTimer); _bgDebounceTimer = null; }
  }

  function scheduleDebounceCompile() {
    if (!isJobActiveForCompile()) return;
    if (_bgDebounceTimer) clearTimeout(_bgDebounceTimer);
    _bgDebounceTimer = setTimeout(function () {
      _bgDebounceTimer = null;
      try { backgroundCompile(); } catch (e) { /* degrade silently */ }
    }, COMPILE_DEBOUNCE_MS);
  }

  var COMPILE_INACTIVE_STATUSES = ["Completed", "Needs Repair Quote", "Parts on Order"];

  function isJobActiveForCompile() {
    var el = document.getElementById("finalJobStatus");
    if (!el) return true; /* can't tell — allow compile */
    return COMPILE_INACTIVE_STATUSES.indexOf(el.value) === -1;
  }

  function startBgCompileTimer() {
    stopBgCompileTimer();
    if (!isJobActiveForCompile()) return; /* don't start on an already-inactive job */
    _bgCompileTimer = setInterval(function () {
      try { backgroundCompile(); } catch (e) { /* degrade silently */ }
    }, COMPILE_BG_INTERVAL_MS);
  }

  function stopBgCompileTimer() {
    if (_bgCompileTimer) {
      clearInterval(_bgCompileTimer);
      _bgCompileTimer = null;
    }
    if (_bgDebounceTimer) {
      clearTimeout(_bgDebounceTimer);
      _bgDebounceTimer = null;
    }
  }

  function getCompileBtn() {
    return document.getElementById("ct-compile-btn");
  }

  function updateCompileBtnVisibility() {
    var btn = getCompileBtn();
    if (!btn) return;
    var wsEl = document.getElementById("screen-workspace");
    if (wsEl && wsEl.classList.contains("is-historical-job")) {
      btn.classList.remove("hidden");
      return;
    }
    var entries = loadEntries(currentTicketId);
    var techEntries = entries.filter(function (e) {
      return e && e.role === "tech" && !(e.meta && e.meta.seed);
    });
    if (techEntries.length >= COMPILE_MIN_ENTRIES) {
      btn.classList.remove("hidden");
    } else {
      btn.classList.add("hidden");
    }
  }

  function gatherCompileContext() {
    var entries = loadEntries(currentTicketId);
    var ticket = getActiveTicket();
    var equipmentContext = "";
    try {
      if (window.JobContextEngine && typeof window.JobContextEngine.getActiveEquipment === "function") {
        equipmentContext = window.JobContextEngine.getActiveEquipment() || "";
      }
    } catch (e) {}

    var checklistState = null;
    try {
      if (window.ChecklistReminderEngine && typeof window.ChecklistReminderEngine.getChecklistState === "function") {
        checklistState = window.ChecklistReminderEngine.getChecklistState();
      }
    } catch (e) {}

    return {
      entries: entries,
      ticket: ticket,
      equipmentContext: equipmentContext,
      checklistState: checklistState
    };
  }

  function mergeCompileResults(existing, delta) {
    return window.VCAgents.NotesParser.mergeCompileResults(existing, delta);
  }

  function buildDeltaCompilePrompt(newEntries, existingResult, context) {
    return window.VCAgents.NotesParser.buildDeltaCompilePrompt(newEntries, existingResult, context);
  }

  function backgroundCompile() {
    if (_isCompiling) return;
    if (!currentTicketId) return;
    /* Stop timer if job is no longer active */
    if (!isJobActiveForCompile()) {
      stopBgCompileTimer();
      return;
    }
    var entries = loadEntries(currentTicketId);
    var techEntries = entries.filter(function (e) {
      return e && e.role === "tech" && !(e.meta && e.meta.seed);
    });
    if (techEntries.length < COMPILE_MIN_ENTRIES) return;
    if (entries.length <= _lastCompiledIndex) return; /* no new entries */

    _isCompiling = true;
    var myToken = ++_compileToken;
    var compileTicketId = currentTicketId; /* capture — ticket may switch before promise resolves */
    var newEntries = entries.slice(_lastCompiledIndex);
    var snapshotIndex = entries.length;
    var context = gatherCompileContext();

    var prompt = _compiledResult
      ? buildDeltaCompilePrompt(newEntries, _compiledResult, context)
      : buildCompilePrompt(context);

    var tokenBudget = _compiledResult ? COMPILE_DELTA_MAX_TOKENS : COMPILE_FULL_MAX_TOKENS;
    callGeminiCompile(prompt, tokenBudget).then(function (result) {
      if (currentTicketId !== compileTicketId) return; /* ticket switched — discard stale result */
      _compiledResult = mergeCompileResults(_compiledResult, result);
      _compiledDisplayText = formatCompileResultForDisplay(_compiledResult);
      _lastCompiledIndex = snapshotIndex;
    }).catch(function () {
      /* Background compile failed silently — full compile will run on tap */
    }).finally(function () {
      if (_compileToken === myToken) _isCompiling = false; /* only clear if still the active compile */
    });
  }

  function buildCompilePrompt(context) {
    return window.VCAgents.NotesParser.buildCompilePrompt(context);
  }

  /* ── Gemini helpers — delegated to shared GeminiClient + VCAgents ── */

  function callGeminiCompile(prompt, maxTokens) {
    return window.VCAgents.NotesParser.callCompile(prompt, maxTokens);
  }

  function formatCompileResultForDisplay(result) {
    return window.VCAgents.NotesParser.formatCompileResultForDisplay(result);
  }


  var _lastCompileResult = null;

  function openCompileModal(displayText) {
    var modal = document.getElementById("ct-compile-modal");
    if (!modal) return;
    var ws = document.getElementById("screen-workspace");
    if (!ws || !ws.classList.contains("active")) return;
    var textarea = modal.querySelector(".ct-compile-textarea");
    var statusEl = modal.querySelector(".ct-compile-status");
    if (textarea) {
      textarea.value = displayText || "";
      textarea.readOnly = false;
    }
    if (statusEl) statusEl.textContent = "";
    modal.classList.remove("hidden");
    /* Force layout recalculation — iOS Safari doesn't reliably compute
       fixed-position geometry on first show during a screen transition. */
    void modal.offsetHeight;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(0, 0);
    }
  }

  function closeCompileModal() {
    var modal = document.getElementById("ct-compile-modal");
    if (modal) modal.classList.add("hidden");
    removeEquipmentSavePrompt();
  }

  /**
   * User-facing close — prompts "Submit to office?" if there's an unsubmitted result.
   * Direct internal calls (auto-close after submit success) bypass this and call
   * closeCompileModal() directly so no second prompt appears.
   */
  function maybeCloseCompileModal() {
    if (_lastCompileResult && _compileSubmittedForTicket !== currentTicketId) {
      showCompileClosePrompt();
    } else {
      closeCompileModal();
    }
  }

  function showCompileClosePrompt() {
    var modal = document.getElementById("ct-compile-modal");
    if (!modal) { closeCompileModal(); return; }
    var statusEl = modal.querySelector(".ct-compile-status");
    if (!statusEl) { closeCompileModal(); return; }

    /* Remove any existing prompt so re-tapping X doesn't stack rows */
    var prev = statusEl.querySelector(".ct-close-prompt-row");
    if (prev) { prev.remove(); return; } /* second tap = dismiss prompt, keep modal open */
    statusEl.textContent = "";

    var row = document.createElement("div");
    row.className = "ct-close-prompt-row";
    row.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px;";

    var label = document.createElement("span");
    label.textContent = "Submit to office first?";
    label.style.cssText = "color:#1e40af;font-size:12px;font-weight:600;flex-shrink:0;";
    row.appendChild(label);

    var submitBtn = document.createElement("button");
    submitBtn.textContent = "Submit";
    submitBtn.style.cssText = "background:#2563eb;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;min-height:30px;";
    submitBtn.addEventListener("click", function () { submitCompileToOffice(); });
    row.appendChild(submitBtn);

    var skipBtn = document.createElement("button");
    skipBtn.textContent = "Not yet";
    skipBtn.style.cssText = "background:none;border:1px solid #cbd5e1;border-radius:6px;padding:4px 10px;font-size:12px;color:#64748b;cursor:pointer;min-height:30px;";
    skipBtn.addEventListener("click", function () { closeCompileModal(); });
    row.appendChild(skipBtn);

    statusEl.appendChild(row);
  }

  function compileNotes() {
    if (_isCompiling) return; /* background compile in progress — ignore tap */

    var entries = loadEntries(currentTicketId);
    var newEntries = entries.slice(_lastCompiledIndex);

    /* Case 1: report fully up to date — open instantly */
    if (_compiledResult && newEntries.length === 0) {
      _lastCompileResult = _compiledResult;
      openCompileModal(_compiledDisplayText);
      return;
    }

    /* Historical ticket with no restored report — nothing to compile */
    var wsEl = document.getElementById("screen-workspace");
    if (wsEl && wsEl.classList.contains("is-historical-job") && !_compiledResult && entries.length === 0) {
      openCompileModal("No compiled report found for this past visit.\n\nIf a report was submitted, it may not have synced. Use the addendum section to add supplemental notes.");
      return;
    }

    /* Case 2: report exists with a small delta, OR no report yet (full compile) */
    var btn = getCompileBtn();
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Compiling…";
    }

    _isCompiling = true;
    var myToken = ++_compileToken;
    var compileTicketId = currentTicketId; /* capture — ticket may switch before promise resolves */
    var snapshotIndex = entries.length;
    var context = gatherCompileContext();
    var isDelta = (_compiledResult && newEntries.length > 0);
    var prompt = isDelta
      ? buildDeltaCompilePrompt(newEntries, _compiledResult, context)
      : buildCompilePrompt(context);
    var tokenBudget = isDelta ? COMPILE_DELTA_MAX_TOKENS : COMPILE_FULL_MAX_TOKENS;

    callGeminiCompile(prompt, tokenBudget).then(function (result) {
      if (currentTicketId !== compileTicketId) return; /* ticket switched — discard stale result */
      _compiledResult = mergeCompileResults(_compiledResult, result);
      _compiledDisplayText = formatCompileResultForDisplay(_compiledResult);
      _lastCompiledIndex = snapshotIndex;
      _lastCompileResult = _compiledResult;
      openCompileModal(_compiledDisplayText);
      /* Slice 63f: post-compile equipment classification */
      classifyEquipmentFindings(_compiledResult, entries, compileTicketId);
      /* Slice 64g: quote data generation.
         getActiveFormTemplates is async — chain with .then() instead of calling
         synchronously. Calling it synchronously and chaining .filter() on the
         returned Promise throws a TypeError that is silently caught, leaving
         _quoteMatchedTemplates always empty and the quote card never showing. */
      try {
        if (typeof window.getActiveFormTemplates === "function" &&
            window.VCAgents && window.VCAgents.QuoteDataBuilder) {
          var _quoteEquipCtx = {
            activeEquipment: (window.VCJobContext && window.VCJobContext.activeEquipment) || "",
            nameplateFields: window._lastNameplateFields || null
          };
          var _quoteTicketId = compileTicketId;
          window.getActiveFormTemplates().then(function (allTemplates) {
            var _quoteMatchedTemplates = (allTemplates || []).filter(function (t) {
              return t && t.data && t.data.quoteRelevant;
            });
            if (!_quoteMatchedTemplates.length) return Promise.resolve(null);
            return typeof getGeminiApiKey === "function"
              ? getGeminiApiKey().then(function (apiKey) {
                  if (!apiKey) return null;
                  return window.VCAgents.QuoteDataBuilder.buildQuoteData(
                    _compiledDisplayText, _quoteMatchedTemplates, _quoteEquipCtx, apiKey
                  );
                })
              : Promise.resolve(null);
          }).then(function (quoteData) {
            if (!quoteData || !quoteData.repairs || !quoteData.repairs.length) return;
            showQuoteDataCard(quoteData, _quoteTicketId);
          }).catch(function () {});
        }
      } catch (_qe) {}
    }).catch(function (err) {
      var fallbackText = "── Compile Error ──\n" +
        (err && err.message ? err.message : "Unknown error") +
        "\n\nFallback: Raw timeline entries\n\n";
      var allEntries = loadEntries(currentTicketId);
      for (var i = 0; i < allEntries.length; i++) {
        var e = allEntries[i];
        if (e && e.text) fallbackText += (e.ts || "") + " [" + (e.role || "") + "] " + e.text + "\n";
      }
      _lastCompileResult = null;
      openCompileModal(fallbackText);
    }).finally(function () {
      if (_compileToken === myToken) { /* only act if still the active compile */
        _isCompiling = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = "📋 Compile Notes";
        }
      }
    });
  }

  /* ── Slice 63f: Post-compile equipment classification ──────── */

  function classifyEquipmentFindings(compiledReport, entries, capturedTicketId) {
    if (!compiledReport || !entries || !entries.length) return;
    var classifyTicketId = capturedTicketId || currentTicketId;
    window.VCAgents.EquipmentClassifier.classifyAll(compiledReport, entries).then(function (valid) {
      if (currentTicketId !== classifyTicketId) return;
      if (!valid.length) return;
      showEquipmentSavePrompt(valid, classifyTicketId);
    });
  }

  function showEquipmentSavePrompt(classifiedItems, ticketId) {
    removeEquipmentSavePrompt();
    var modal = document.getElementById("ct-compile-modal");
    if (!modal) return;

    var container = document.createElement("div");
    container.id = "ct-equip-save-container";
    container.style.cssText = "padding:0 16px 16px 16px;";

    for (var i = 0; i < classifiedItems.length; i++) {
      (function (item, idx) {
        var findings = item.findings;
        var previewParts = [];
        if (findings.summary) previewParts.push(findings.summary);
        if (!previewParts.length) {
          if (findings.measurements && findings.measurements.length) previewParts.push(findings.measurements.join(", "));
          if (findings.partsReplaced && findings.partsReplaced.length) previewParts.push("replaced " + findings.partsReplaced.join(", "));
          if (findings.repairOutcome) previewParts.push(findings.repairOutcome);
        }
        var previewText = previewParts.join(" · ") || "Equipment findings captured";

        var card = document.createElement("div");
        card.className = "ct-equip-save-card";
        card.setAttribute("data-equip-idx", idx);
        /* Stamp ticket ID at creation time so the write handler uses the correct
           source ticket even if currentTicketId changes before the user taps Save. */
        card.setAttribute("data-ticket-id", ticketId || "");
        card.style.cssText = "background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 16px;margin-bottom:8px;";

        var title = document.createElement("div");
        title.style.cssText = "font-weight:600;color:#166534;font-size:14px;";
        title.textContent = "Save to " + item.equipmentRef + " equipment history?";
        card.appendChild(title);

        var preview = document.createElement("div");
        preview.style.cssText = "font-size:13px;color:#15803d;margin:6px 0;line-height:1.4;";
        preview.textContent = previewText;
        card.appendChild(preview);

        var btnRow = document.createElement("div");
        btnRow.style.cssText = "display:flex;gap:8px;margin-top:8px;";

        var saveBtn = document.createElement("button");
        saveBtn.className = "ct-equip-save-btn";
        saveBtn.style.cssText = "background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600;min-height:44px;";
        saveBtn.textContent = "Save to Equipment History";
        saveBtn.addEventListener("click", function () {
          var cardTicketId = card.getAttribute("data-ticket-id") || currentTicketId;
          writeEquipmentToSiteIntelligence(item, saveBtn, card, cardTicketId);
        });
        btnRow.appendChild(saveBtn);

        var skipBtn = document.createElement("button");
        skipBtn.className = "ct-equip-skip-btn";
        skipBtn.style.cssText = "background:none;border:1px solid #cbd5e1;border-radius:8px;padding:8px 16px;cursor:pointer;color:#64748b;font-size:13px;min-height:44px;";
        skipBtn.textContent = "Skip";
        skipBtn.addEventListener("click", function () {
          card.style.transition = "opacity 0.3s ease";
          card.style.opacity = "0";
          setTimeout(function () { card.remove(); cleanupEquipContainer(); }, 300);
        });
        btnRow.appendChild(skipBtn);

        card.appendChild(btnRow);
        container.appendChild(card);
      })(classifiedItems[i], i);
    }

    var modalContent = modal.querySelector(".ct-compile-content") || modal;
    modalContent.appendChild(container);
  }

  function removeEquipmentSavePrompt() {
    var existing = document.getElementById("ct-equip-save-container");
    if (existing) existing.remove();
  }

  function cleanupEquipContainer() {
    var container = document.getElementById("ct-equip-save-container");
    if (container && !container.querySelector(".ct-equip-save-card")) {
      container.remove();
    }
  }

  /* ── Slice 64g: Quote data card ────────────────────────────── */

  function showQuoteDataCard(quoteData, ticketId) {
    var existing = document.getElementById("ct-quote-data-card");
    if (existing) existing.remove();

    window._pendingQuoteData = quoteData;
    var repairs = quoteData.repairs;

    var html = '<div id="ct-quote-data-card" style="background:#fefce8;border:1px solid #fde047;' +
      'border-radius:10px;padding:14px 16px;margin-top:12px;">';
    html += '<div style="font-weight:700;color:#713f12;margin-bottom:8px;">\uD83D\uDD16 Repair quote detected</div>';

    for (var i = 0; i < repairs.length; i++) {
      var r = repairs[i];
      html += '<div style="font-size:13px;color:#422006;margin-bottom:6px;">' +
        '<strong>' + (r.repairType || "Repair") + '</strong>' +
        (r.equipmentRef ? ' \u2014 ' + r.equipmentRef : '') + '</div>';

      if (r.confirmedParts && r.confirmedParts.length) {
        for (var cp = 0; cp < r.confirmedParts.length; cp++) {
          var p = r.confirmedParts[cp];
          html += '<div style="font-size:12px;color:#78350f;padding-left:12px;">\u2713 ' + p.description +
            (p.specs ? ' <span style="color:#a16207;">(' + p.specs + ')</span>' : '') + '</div>';
        }
      }
      if (r.suggestedParts && r.suggestedParts.length) {
        for (var sp = 0; sp < r.suggestedParts.length; sp++) {
          var s = r.suggestedParts[sp];
          html += '<div style="font-size:12px;color:#a16207;padding-left:12px;">\u25e6 ' + s.description +
            (s.specs ? ' <span style="color:#ca8a04;">(' + s.specs + ')</span>' : '') +
            ' <span style="font-size:10px;background:#fef08a;border-radius:3px;padding:1px 4px;">suggested</span></div>';
        }
      }

      html += '<div style="margin-top:6px;display:flex;align-items:center;gap:8px;">' +
        '<label style="font-size:12px;color:#713f12;font-weight:600;">Labor hours:</label>' +
        '<input type="number" class="ct-quote-labor-input" data-repair-idx="' + i + '"' +
        ' min="0.25" step="0.25" value="' + (r.laborHours !== null && r.laborHours !== undefined ? r.laborHours : '') + '"' +
        ' placeholder="e.g. 2"' +
        ' style="width:70px;padding:4px 8px;border:1px solid #fcd34d;border-radius:6px;font-size:13px;">' +
        '</div>';
    }

    html += '<div style="display:flex;gap:8px;margin-top:12px;">' +
      '<button id="ct-quote-include-btn" data-ticket-id="' + (ticketId || "") + '"' +
      ' style="background:#ca8a04;color:#fff;border:none;border-radius:8px;padding:9px 18px;' +
      'cursor:pointer;font-size:13px;font-weight:600;">Include in Quote</button>' +
      '<button id="ct-quote-skip-btn"' +
      ' style="background:none;border:1px solid #d97706;border-radius:8px;padding:9px 14px;' +
      'cursor:pointer;font-size:13px;color:#92400e;">Skip</button>' +
      '</div></div>';

    var modal = document.getElementById("ct-compile-modal");
    if (!modal) return;
    var modalContent = modal.querySelector(".ct-compile-content") || modal;
    modalContent.insertAdjacentHTML("beforeend", html);
  }

  /**
   * saveQuoteDataToTicket — write quote_data to the service call Firestore doc (Slice 64h).
   * Uses merge:true so existing fields are never overwritten.
   * Fire-and-forget — the confirmation UI updates immediately; Firestore write is background.
   */
  function saveQuoteDataToTicket(quoteData, ticketId) {
    if (!quoteData || !ticketId) {
      console.warn('[QuotePipeline] saveQuoteDataToTicket called without quoteData or ticketId — skipping.');
      return;
    }

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      console.warn('[QuotePipeline] Firebase unavailable — quote_data not written.');
      return;
    }

    var payload = {
      quote_data: quoteData,
      quotePending: true,
      quotePendingAt: firebase.firestore.FieldValue.serverTimestamp(),
      quoteDataUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    var db;
    try {
      db = firebase.firestore();
    } catch (e) {
      console.warn('[QuotePipeline] Firestore unavailable:', e);
      return;
    }

    var scRef;
    if (window.VCFirestore && typeof window.VCFirestore.serviceCall === 'function') {
      scRef = window.VCFirestore.serviceCall(db, ticketId);
    } else if (window.VCFirestore && typeof window.VCFirestore.tenantCollection === 'function') {
      scRef = window.VCFirestore.tenantCollection(db, 'service_calls').doc(ticketId);
    } else {
      scRef = db.collection('service_calls').doc(ticketId);
    }

    scRef.set(payload, { merge: true })
      .then(function() {
        console.log('[QuotePipeline] quote_data written to ticket', ticketId);
      })
      .catch(function(err) {
        console.warn('[QuotePipeline] Failed to write quote_data:', err);
      });
  }

  /**
   * wireQuoteCardHandlers — delegated click handlers for the quote data confirmation card.
   * Attached to document once from init(); fires for dynamically injected card buttons.
   */
  function wireQuoteCardHandlers() {
    document.addEventListener("click", function (e) {
      var includeBtn = e.target.closest ? e.target.closest("#ct-quote-include-btn") : null;
      if (includeBtn) {
        e.stopPropagation();
        var ticketId = includeBtn.getAttribute("data-ticket-id") || currentTicketId;
        var card = document.getElementById("ct-quote-data-card");
        if (!card || !window._pendingQuoteData) return;

        var inputs = card.querySelectorAll(".ct-quote-labor-input");
        var totalLabor = 0;
        for (var i = 0; i < inputs.length; i++) {
          var idx = parseInt(inputs[i].getAttribute("data-repair-idx"), 10);
          var val = parseFloat(inputs[i].value) || null;
          if (window._pendingQuoteData.repairs && window._pendingQuoteData.repairs[idx] !== undefined) {
            window._pendingQuoteData.repairs[idx].laborHours = val;
          }
          if (val) totalLabor += val;
        }
        window._pendingQuoteData.totalLaborHours = totalLabor || null;

        saveQuoteDataToTicket(window._pendingQuoteData, ticketId);

        var successHtml = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;' +
          'padding:12px 16px;margin-top:12px;color:#166534;font-size:13px;">' +
          '\u2705 Quote data saved \u2014 dispatcher will see a Draft Quote.</div>';
        card.outerHTML = successHtml;
        return;
      }

      var skipBtn = e.target.closest ? e.target.closest("#ct-quote-skip-btn") : null;
      if (skipBtn) {
        e.stopPropagation();
        var card2 = document.getElementById("ct-quote-data-card");
        if (card2) card2.remove();
      }
    }, false);
  }

  function writeEquipmentToSiteIntelligence(item, btn, card, capturedTicketId) {
    if (!item || !item.findings || !item.equipmentRef) return;

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      markEquipCardError(card, "Firebase unavailable");
      return;
    }

    var db;
    try {
      db = firebase.firestore();
    } catch (e) {
      markEquipCardError(card, "Firestore unavailable");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving…";

    /* Use the ticket ID captured at classification time, not the live value — ensures
       site_intelligence.sourceTicketId matches the job that produced the findings. */
    var ticketId = capturedTicketId || currentTicketId || "draft";
    var techName = "";
    try { techName = localStorage.getItem("tp_saved_tech") || ""; } catch (e) {}

    var findings = item.findings;
    var ref;
    try {
      ref = (typeof VCFirestore !== "undefined" && VCFirestore.siteIntelligence)
        ? VCFirestore.siteIntelligence(db)
        : db.collection("site_intelligence");
    } catch (e) {
      markEquipCardError(card, "Firestore unavailable");
      btn.disabled = false;
      btn.textContent = "Save to Equipment History";
      return;
    }

    ref.add({
      equipmentRef: item.equipmentRef,
      type: "service_findings",
      summary: findings.summary || "",
      measurements: findings.measurements || [],
      partsReplaced: findings.partsReplaced || [],
      repairOutcome: findings.repairOutcome || "",
      followUp: findings.followUp || "",
      sourceTicketId: ticketId,
      techName: techName,
      date: new Date().toISOString(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      btn.textContent = "Saved ✓";
      btn.style.background = "#bbf7d0";
      btn.style.color = "#166534";
      card.style.borderColor = "#4ade80";
      var skipBtn = card.querySelector(".ct-equip-skip-btn");
      if (skipBtn) skipBtn.style.display = "none";
    }).catch(function (err) {
      markEquipCardError(card, (err && err.message) || "Write failed");
      btn.disabled = false;
      btn.textContent = "Save to Equipment History";
    });
  }

  function markEquipCardError(card, msg) {
    if (!card) return;
    var errEl = card.querySelector(".ct-equip-error");
    if (!errEl) {
      errEl = document.createElement("div");
      errEl.className = "ct-equip-error";
      errEl.style.cssText = "font-size:12px;color:#dc2626;margin-top:4px;";
      card.appendChild(errEl);
    }
    errEl.textContent = msg;
  }

  /* ── end Slice 63f ──────────────────────────────────────────── */

  function copyCompileSummary() {
    var modal = document.getElementById("ct-compile-modal");
    if (!modal) return;
    var textarea = modal.querySelector(".ct-compile-textarea");
    if (!textarea) return;
    var text = textarea.value;
    var statusEl = modal.querySelector(".ct-compile-status");

    function showCopyStatus(msg, ok) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.style.color = ok ? "#16a34a" : "#dc2626";
      setTimeout(function () { statusEl.textContent = ""; }, 2500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { showCopyStatus("Copied!", true); },
        function () { compileFallbackCopy(text, showCopyStatus); }
      );
    } else {
      compileFallbackCopy(text, showCopyStatus);
    }
  }

  function compileFallbackCopy(text, showStatus) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showStatus("Copied!", true);
    } catch (e) {
      showStatus("Copy failed — select text manually.", false);
    }
  }

  /**
   * Flatten the structured compile result into service-call-level text fields.
   * Returns a merge-safe patch object for setServiceCallMerged.
   */
  function buildServiceCallPatchFromCompile(result, editedDisplayText, isoNow, tech) {
    var patch = {
      fieldReportSyncedAt: isoNow,
      fieldReportSyncedBy: tech || ""
    };

    var diagParts = [];
    var repairParts = [];
    if (result.equipmentFindings && result.equipmentFindings.length) {
      for (var i = 0; i < result.equipmentFindings.length; i++) {
        var ef = result.equipmentFindings[i];
        var label = ef.equipment || ("Unit " + (i + 1));
        if (ef.diagnosis) diagParts.push(label + ": " + ef.diagnosis);
        if (ef.actionsTaken) repairParts.push(label + ": " + ef.actionsTaken);
      }
    }
    if (diagParts.length) patch.diagnosis = diagParts.join("\n");

    if (repairParts.length) patch.repairsMade = repairParts.join("\n");

    var recParts = [];
    if (result.quoteRecommendations && result.quoteRecommendations.length) {
      for (var j = 0; j < result.quoteRecommendations.length; j++) {
        var qr = result.quoteRecommendations[j];
        var line = qr.part || "Item";
        if (qr.description) line += " — " + qr.description;
        if (qr.laborEstimate) line += " (labor: " + qr.laborEstimate + ")";
        recParts.push(line);
      }
    }
    if (recParts.length) patch.recommendations = recParts.join("\n");

    if (result.summary) patch.fieldReportSummary = result.summary;
    if (editedDisplayText) patch.fieldReportFullText = editedDisplayText;

    return patch;
  }

  function submitCompileToOffice() {
    if (!_lastCompileResult) {
      alert("No compiled data to submit. Please compile notes first.");
      return;
    }

    var modal = document.getElementById("ct-compile-modal");
    var statusEl = modal ? modal.querySelector(".ct-compile-status") : null;
    var submitBtn = modal ? modal.querySelector(".ct-compile-submit-btn") : null;

    function showSubmitStatus(msg, ok) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.style.color = ok ? "#16a34a" : "#dc2626";
    }

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      showSubmitStatus("Firebase unavailable — saved locally only.", false);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";
    }
    showSubmitStatus("Uploading…", true);

    var db = null;
    try {
      db = firebase.firestore();
    } catch (e) {
      showSubmitStatus("Firestore unavailable — saved locally only.", false);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit to Office";
      }
      return;
    }
    var ticket = getActiveTicket();
    var ticketId = currentTicketId || "draft";
    var techName = "";
    try { techName = localStorage.getItem("tp_saved_tech") || ""; } catch (e) {}
    var now = new Date().toISOString();

    var textarea = modal ? modal.querySelector(".ct-compile-textarea") : null;
    var editedText = textarea ? textarea.value : "";

    var reportPayload = {
      ticketId: ticketId,
      techName: techName,
      customerName: (ticket && ticket.customerName) || "",
      location: (ticket && (ticket.address || ticket.locationAddress)) || "",
      compiledAt: now,
      compiledResult: _lastCompileResult,
      compiledEntryCount: _lastCompiledIndex,
      editedDisplayText: editedText,
      source: "conversational_timeline_compile",
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    var crCol;
    try {
      crCol = (typeof VCFirestore !== "undefined" && VCFirestore.completedReports)
        ? VCFirestore.completedReports(db)
        : db.collection("completed_reports");
    } catch (e) {
      showSubmitStatus("Firestore unavailable — saved locally only.", false);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit to Office";
      }
      return;
    }

    var writes = [];
    writes.push(crCol.add(reportPayload));

    if (_lastCompileResult.equipmentHistoryUpdates && _lastCompileResult.equipmentHistoryUpdates.length) {
      var linkedEquipEl = document.getElementById("linkedEquipmentSelect");
      var linkedEquipId = (linkedEquipEl && linkedEquipEl.value) ? String(linkedEquipEl.value).trim() : "";
      if (linkedEquipId) {
        var eqParts = linkedEquipId.split("/");
        if (eqParts.length >= 3) {
          var custId = eqParts[0];
          var locId = eqParts[1];
          var unitDocId = eqParts.slice(2).join("/");
          for (var i = 0; i < _lastCompileResult.equipmentHistoryUpdates.length; i++) {
            var upd = _lastCompileResult.equipmentHistoryUpdates[i];
            var histDoc = {
              ticketId: ticketId,
              techName: techName,
              date: now.slice(0, 10),
              equipment: upd.equipment || "",
              dataPoints: upd.dataPoints || "",
              source: "compile_notes",
              savedAt: now,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            writes.push(
              db.collection("Customers").doc(custId)
                .collection("Locations").doc(locId)
                .collection("Equipment").doc(unitDocId)
                .collection("work_history").add(histDoc)
            );
          }
        }
      }
    }

    if (_lastCompileResult.unresolvedIssues && _lastCompileResult.unresolvedIssues.length && ticket) {
      var custName = (ticket.customerName || "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      var addr = (ticket.address || ticket.locationAddress || "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      var siteDocId = custName && addr ? custName + "__" + addr : "";
      if (siteDocId) {
        var siCol = (typeof VCFirestore !== "undefined" && VCFirestore.siteIntelligence)
          ? VCFirestore.siteIntelligence(db)
          : db.collection("site_intelligence");
        var unresolvedPayload = {
          unresolvedIssues: _lastCompileResult.unresolvedIssues,
          lastUpdated: now,
          lastUpdatedBy: techName,
          ticketId: ticketId
        };
        writes.push(siCol.doc(siteDocId).set(unresolvedPayload, { merge: true }));
      }
    }

    /* ── Wire compiled report into service call ticket fields ──── */
    if (ticketId && ticketId !== "draft") {
      var scPatch = buildServiceCallPatchFromCompile(_lastCompileResult, editedText, now, techName);
      var ticketStatus = (ticket && ticket.status) || "";
      if (ticketStatus === "Dispatched" || ticketStatus === "" || !ticketStatus) {
        scPatch.status = "In Progress";
      }
      if (typeof VCFirestore !== "undefined" && VCFirestore.setServiceCallMerged) {
        writes.push(VCFirestore.setServiceCallMerged(db, ticketId, scPatch, true));
      } else {
        writes.push(db.collection("service_calls").doc(ticketId).set(scPatch, { merge: true }));
      }
    }

    Promise.all(writes).then(function (results) {
      showSubmitStatus("Submitted to office ✓", true);
      if (submitBtn) {
        submitBtn.textContent = "Submitted ✓";
        submitBtn.disabled = true;
      }
      /* Mark this ticket as submitted so the close-modal prompt is suppressed */
      _compileSubmittedForTicket = ticketId;
      /* Cache compile result locally for instant restore on next workspace entry */
      saveCompileCache(ticketId, _lastCompileResult, editedText, _lastCompiledIndex);
      /* Fire nav-guard callback if set (e.g. "submit then switch to schedule") */
      if (_submitSuccessCallback) {
        var cb = _submitSuccessCallback;
        _submitSuccessCallback = null;
        try { cb(true); } catch (e) {}
      }
      /* Slice 50a: passive learning upload after successful submission */
      try {
        if (window.LearningSync && typeof window.LearningSync.uploadLearningData === "function") {
          var reportId = (results && results[0] && results[0].id) ? results[0].id : "";
          window.LearningSync.uploadLearningData({
            ticketId: ticketId,
            reportDocId: reportId,
            compileResult: _lastCompileResult
          });
        }
      } catch (lsErr) { /* degrade silently — learning sync is non-critical */ }

      /* Auto-close modal after successful submission so tech doesn't have to tap X */
      setTimeout(closeCompileModal, 1500);
    }).catch(function (err) {
      showSubmitStatus("Submit failed: " + (err && err.message ? err.message : "Unknown error"), false);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit to Office";
      }
      if (_submitSuccessCallback) {
        var cb = _submitSuccessCallback;
        _submitSuccessCallback = null;
        try { cb(false); } catch (e) {}
      }
    });
  }

  function wireCompileModal() {
    var modal = document.getElementById("ct-compile-modal");
    if (!modal) return;

    var closeBtn = modal.querySelector(".ct-compile-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", maybeCloseCompileModal);

    var backdrop = modal.querySelector(".ct-compile-backdrop");
    if (backdrop) backdrop.addEventListener("click", maybeCloseCompileModal);

    var copyBtn = modal.querySelector(".ct-compile-copy-btn");
    if (copyBtn) copyBtn.addEventListener("click", copyCompileSummary);

    var submitBtn = modal.querySelector(".ct-compile-submit-btn");
    if (submitBtn) submitBtn.addEventListener("click", submitCompileToOffice);
  }

  function wireMediaViewer() {
    /* Event delegation — catches clicks on media entries even after timeline re-render */
    var list = document.getElementById("ct-message-list");
    if (list) {
      list.addEventListener("click", function (e) {
        var entryEl = e.target.closest ? e.target.closest(".ct-media-entry") : null;
        if (!entryEl) return;
        var entryId = entryEl.getAttribute("data-entry-id");
        if (entryId) openMediaViewer(entryId);
      });
    }

    /* Photo lightbox — backdrop click or × closes */
    var lightbox = document.getElementById("ct-photo-lightbox");
    if (lightbox) {
      lightbox.addEventListener("click", function (e) {
        if (e.target === lightbox) closePhotoLightbox();
      });
      var lbClose = document.getElementById("ct-lightbox-close");
      if (lbClose) lbClose.addEventListener("click", closePhotoLightbox);
    }

    /* Video player — backdrop click or × closes */
    var videoModal = document.getElementById("ct-video-player-modal");
    if (videoModal) {
      videoModal.addEventListener("click", function (e) {
        if (e.target === videoModal) closeVideoPlayer();
      });
      var vpClose = document.getElementById("ct-video-player-close");
      if (vpClose) vpClose.addEventListener("click", closeVideoPlayer);
    }
  }

  function wireMediaSwipeDelete() {
    var list = document.getElementById("ct-message-list");
    if (!list) return;

    var _startX      = 0;
    var _startY      = 0;
    var _swipeWrap   = null;
    var _tracking    = false;
    var REVEAL_W     = 80;
    var THRESHOLD    = 55;

    list.addEventListener("touchstart", function (e) {
      var mediaEl = e.target.closest ? e.target.closest(".ct-media-entry") : null;
      if (!mediaEl) return;
      var wrap = mediaEl.parentElement;
      /* Only activate on properly-wrapped entries (photo/video), not text bubbles */
      if (!wrap || !wrap.classList.contains("ct-media-swipe-wrap")) return;
      _swipeWrap = wrap;
      _startX    = e.touches[0].clientX;
      _startY    = e.touches[0].clientY;
      _tracking  = true;
    }, { passive: true });

    list.addEventListener("touchmove", function (e) {
      if (!_tracking || !_swipeWrap) return;
      var dx = e.touches[0].clientX - _startX;
      var dy = e.touches[0].clientY - _startY;

      /* Predominantly vertical → cancel swipe */
      if (Math.abs(dy) > Math.abs(dx) + 8) { _tracking = false; return; }
      if (dx > 0) return; /* ignore rightward */

      var clamped = Math.max(dx, -REVEAL_W);
      var ent = _swipeWrap.querySelector(".ct-media-entry");
      if (ent) {
        ent.style.transition = "none";
        ent.style.transform  = "translateX(" + clamped + "px)";
      }
    }, { passive: true });

    list.addEventListener("touchend", function (e) {
      if (!_tracking || !_swipeWrap) return;
      _tracking = false;

      var endX = e.changedTouches && e.changedTouches[0]
        ? e.changedTouches[0].clientX : _startX;
      var dx  = endX - _startX;
      var ent = _swipeWrap.querySelector(".ct-media-entry");

      if (dx <= -THRESHOLD) {
        /* Enough — reveal delete button */
        if (ent) {
          ent.style.transition = "transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)";
          ent.style.transform  = "translateX(-" + REVEAL_W + "px)";
        }
        _swipeWrap.classList.add("ct-swiped");
      } else {
        /* Not enough — snap back */
        if (ent) {
          ent.style.transition = "transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)";
          ent.style.transform  = "translateX(0)";
        }
        _swipeWrap.classList.remove("ct-swiped");
      }
      _swipeWrap = null;
    }, { passive: true });

    /* Tap delete reveal button → confirm dialog */
    list.addEventListener("click", function (e) {
      var delBtn = e.target.closest ? e.target.closest(".ct-media-delete-reveal") : null;
      if (delBtn) {
        e.stopPropagation();
        var id = delBtn.getAttribute("data-delete-id");
        if (id) confirmDeleteMediaEntry(id);
        return;
      }

      /* Tap anywhere else → snap any swiped entry back */
      var clickedWrap = e.target.closest ? e.target.closest(".ct-media-swipe-wrap") : null;
      var swiped = list.querySelectorAll(".ct-media-swipe-wrap.ct-swiped");
      for (var i = 0; i < swiped.length; i++) {
        if (swiped[i] === clickedWrap) continue;
        var ent = swiped[i].querySelector(".ct-media-entry");
        if (ent) {
          ent.style.transition = "transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)";
          ent.style.transform  = "translateX(0)";
        }
        swiped[i].classList.remove("ct-swiped");
      }
    });

    /* Delete confirm overlay wiring */
    var confirmOv = document.getElementById("ct-delete-confirm-overlay");
    if (confirmOv) {
      /* Backdrop tap → cancel */
      confirmOv.addEventListener("click", function (e) {
        if (e.target === confirmOv) dismissDeleteConfirm();
      });
    }

    var yesBtn = document.getElementById("ct-delete-confirm-yes");
    if (yesBtn) {
      yesBtn.addEventListener("click", function () {
        var ov  = document.getElementById("ct-delete-confirm-overlay");
        var id  = ov ? ov.getAttribute("data-deleting-id") : null;
        if (id) deleteMediaEntry(id);
      });
    }

    var noBtn = document.getElementById("ct-delete-confirm-no");
    if (noBtn) noBtn.addEventListener("click", dismissDeleteConfirm);
  }

  function wireCompileBtn() {
    var btn = getCompileBtn();
    if (!btn) return;
    btn.addEventListener("click", function () {
      compileNotes();
    });
  }

  /* ── Slice 63g: Nameplate OCR classification ─────────────────── */

  /**
   * classifyNameplate — send a photo to Gemini Vision and attempt to extract
   * manufacturer, model, serial, voltage, tonnage from a unit nameplate.
   * Returns Promise<object|null>.  Null means "not a nameplate" or unreadable.
   * Uses getGeminiApiKey() + fetch directly so the timeline is self-contained.
   */
  function classifyNameplate(dataUrl, equipmentRef) {
    if (window.VCAgents && window.VCAgents.NameplateOCR &&
        typeof window.VCAgents.NameplateOCR.classifyNameplate === "function") {
      return window.VCAgents.NameplateOCR.classifyNameplate(dataUrl);
    }

    if (typeof getGeminiApiKey !== "function") return Promise.resolve(null);

    var base64 = dataUrl;
    var mimeType = "image/jpeg";
    var prefixMatch = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (prefixMatch) {
      mimeType = prefixMatch[1];
      base64 = dataUrl.slice(prefixMatch[0].length);
    }

    var classifyPrompt = "Look at this image. If it shows a manufacturer nameplate, data plate, "
      + "or model label for an HVAC unit (RTU, AHU, chiller, boiler, etc.), extract the following fields.\n"
      + "If the image is NOT a nameplate, return all fields as null.\n"
      + 'Return ONLY valid JSON:\n'
      + '{ "manufacturer": string|null, "modelNumber": string|null, "serialNumber": string|null, '
      + '"voltage": string|null, "tonnage": string|null }';

    return getGeminiApiKey().then(function (apiKey) {
      if (!apiKey) return null;
      var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key="
        + encodeURIComponent(apiKey);
      var body = {
        systemInstruction: { parts: [{ text: "You are an HVAC unit data extraction assistant." }] },
        contents: [{ role: "user", parts: [
          { text: classifyPrompt },
          { inlineData: { mimeType: mimeType, data: base64 } }
        ]}],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: "application/json" }
      };
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }).then(function (resp) {
      if (!resp || typeof resp.ok === "undefined") return null;
      if (!resp.ok) return null;
      return resp.json();
    }).then(function (data) {
      if (!data) return null;
      var cand = data.candidates && data.candidates[0];
      var text = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
      if (!text) return null;
      text = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { return null; }
      if (!parsed.modelNumber && !parsed.serialNumber) return null;
      return parsed;
    }).catch(function () { return null; });
  }

  /**
   * Read an image File into a base64 data URL, down-scaled to max 1280px
   * on the longest side to keep the Gemini Vision payload reasonable.
   */
  function fileToClassificationDataUrl(file) {
    if (window.VCAgents && window.VCAgents.NameplateOCR &&
        typeof window.VCAgents.NameplateOCR.fileToClassificationDataUrl === "function") {
      return window.VCAgents.NameplateOCR.fileToClassificationDataUrl(file);
    }
    return new Promise(function (resolve) {
      try {
        var reader = new FileReader();
        reader.onload = function (e) {
          var img = new Image();
          img.onload = function () {
            try {
              var maxDim = 1280;
              var w = img.width, h = img.height;
              if (w > maxDim || h > maxDim) {
                var ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
              }
              var canvas = document.createElement("canvas");
              canvas.width = w;
              canvas.height = h;
              canvas.getContext("2d").drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL("image/jpeg", 0.85));
            } catch (ex) { resolve(null); }
          };
          img.onerror = function () { resolve(null); };
          img.src = e.target.result;
        };
        reader.onerror = function () { resolve(null); };
        reader.readAsDataURL(file);
      } catch (e) { resolve(null); }
    });
  }

  /**
   * Build the nameplate confirmation card HTML.
   */
  function buildNameplateConfirmCard(result, equipmentRef, entryId) {
    var resultJson = JSON.stringify(result).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
    var eqDisplay = equipmentRef ? escapeHtml(equipmentRef) : "";
    var entryAttr = entryId ? ' data-media-entry-id="' + escapeHtmlAttr(entryId) + '"' : "";

    var html = '<div id="ct-nameplate-confirm-card"' + entryAttr + ' style="background:#f0f9ff;border:1px solid #7dd3fc;'
      + 'border-radius:10px;padding:12px 16px;font-size:13px;margin:4px 0;">'
      + '<div style="font-weight:600;color:#0369a1;margin-bottom:6px;">\uD83C\uDFF7\uFE0F Nameplate detected'
      + (eqDisplay ? ' \u2014 ' + eqDisplay : '') + '</div>'
      + '<div style="color:#0c4a6e;line-height:1.7;">'
      + (result.manufacturer ? '<div><strong>Manufacturer:</strong> ' + escapeHtml(result.manufacturer) + '</div>' : '')
      + (result.modelNumber ? '<div><strong>Model:</strong> ' + escapeHtml(result.modelNumber) + '</div>' : '')
      + (result.serialNumber ? '<div><strong>Serial:</strong> ' + escapeHtml(result.serialNumber) + '</div>' : '')
      + (result.voltage ? '<div><strong>Voltage:</strong> ' + escapeHtml(result.voltage) + '</div>' : '')
      + (result.tonnage ? '<div><strong>Tonnage:</strong> ' + escapeHtml(result.tonnage) + '</div>' : '')
      + '</div>';

    if (!equipmentRef) {
      html += '<div style="margin-top:8px;">'
        + '<label style="font-size:12px;color:#475569;display:block;margin-bottom:4px;">Unit name (e.g. RTU 3):</label>'
        + '<input type="text" class="ct-nameplate-unit-input" placeholder="Enter unit name…" '
        + 'style="width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid #94a3b8;border-radius:6px;font-size:13px;'
        + 'background:#fff;color:#0c4a6e;" />'
        + '</div>';
    }

    html += '<div style="display:flex;gap:8px;margin-top:10px;">'
      + '<button class="ct-nameplate-save-btn" data-eq="' + escapeHtmlAttr(equipmentRef || '') + '"'
      + " data-result='" + resultJson + "'"
      + ' style="background:#0284c7;color:#fff;border:none;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:12px;">'
      + 'Save to Equipment Record</button>'
      + '<button class="ct-nameplate-dismiss-btn"'
      + ' style="background:none;border:1px solid #cbd5e1;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:12px;color:#64748b;">'
      + 'Dismiss</button></div></div>';

    return html;
  }

  /**
   * Inject the nameplate confirmation card into the timeline stream,
   * immediately after the most recent photo entry.
   */
  function injectNameplateCard(result, equipmentRef, entryId) {
    var existing = document.getElementById("ct-nameplate-confirm-card");
    if (existing) existing.parentNode.removeChild(existing);
    _nameplateCardsByEntryId = {};

    if (entryId) {
      _nameplateCardsByEntryId[entryId] = {
        result: result,
        equipmentRef: equipmentRef || null
      };
      renderTimeline(currentTicketId);
      scrollToBottom();
      return;
    }

    var cardHtml = buildNameplateConfirmCard(result, equipmentRef, "");
    var stream = getMessageStreamEl();
    if (!stream) return;
    var wrapper = document.createElement("div");
    wrapper.innerHTML = cardHtml;
    stream.appendChild(wrapper.firstChild);
    scrollToBottom();
  }

  /**
   * saveNameplateToEquipment — delegates to VCEquipmentManager.saveNameplateFields.
   */
  function saveNameplateToEquipment(equipmentRef, result) {
    if (window.VCEquipmentManager && typeof window.VCEquipmentManager.saveNameplateFields === "function") {
      window.VCEquipmentManager.saveNameplateFields(equipmentRef, result);
    } else {
      console.warn("[CT] VCEquipmentManager not loaded — skipping nameplate save.");
    }
  }

  /**
   * wireNameplateHandlers — delegated click handlers for nameplate card buttons.
   */
  function wireNameplateHandlers() {
    var list = getListElement();
    if (!list) return;
    list.addEventListener("click", function (e) {
      var saveBtn = e.target.closest ? e.target.closest(".ct-nameplate-save-btn") : null;
      if (saveBtn) {
        e.stopPropagation();
        var card = document.getElementById("ct-nameplate-confirm-card");
        var resultStr = saveBtn.getAttribute("data-result");
        var eqRef = saveBtn.getAttribute("data-eq") || "";
        var result;
        try { result = JSON.parse(resultStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'")); } catch (ex) { return; }

        if (!eqRef) {
          var unitInput = card ? card.querySelector(".ct-nameplate-unit-input") : null;
          eqRef = unitInput ? String(unitInput.value).trim() : "";
          if (!eqRef) {
            if (unitInput) unitInput.style.borderColor = "#dc2626";
            return;
          }
        }

        saveNameplateToEquipment(eqRef, result);
        _nameplateCardsByEntryId = {};
        if (card) card.parentNode.removeChild(card);
        return;
      }

      var dismissBtn = e.target.closest ? e.target.closest(".ct-nameplate-dismiss-btn") : null;
      if (dismissBtn) {
        e.stopPropagation();
        var card3 = document.getElementById("ct-nameplate-confirm-card");
        _nameplateCardsByEntryId = {};
        if (card3) card3.parentNode.removeChild(card3);
      }
    });
  }

  /**
   * runNameplateClassification — background pipeline: read file → classify → inject card.
   */
  function runNameplateClassification(file, equipmentRef, entryId) {
    if (!file || !file.type || !file.type.startsWith("image/")) return;
    try {
      fileToClassificationDataUrl(file).then(function (dataUrl) {
        if (!dataUrl) return;
        return classifyNameplate(dataUrl, equipmentRef || null);
      }).then(function (result) {
        if (!result) return;
        injectNameplateCard(result, equipmentRef || null, entryId || "");
      }).catch(function () { /* swallow — best-effort enrichment */ });
    } catch (e) { /* swallow */ }
  }

  /* ── init ─────────────────────────────────────────────────────── */

  function init() {
    if (initialized) return;
    initialized = true;

    injectEditStyles();
    wireActionBar();
    wireAskBtn();
    wireEquipmentChip();
    wireSettingsGear();
    wireTimelineEditing();
    wireMediaViewer();
    wireMediaSwipeDelete();
    wireCompileBtn();
    wireCompileModal();
    wireNameplateHandlers();
    wireQuoteCardHandlers();

    try {
      window.addEventListener("vc:contextUpdated", function (e) {
        var updatedTid = e && e.detail && e.detail.ticketId ? e.detail.ticketId : "";
        if (!updatedTid || updatedTid === currentTicketId) {
          renderSiteMemory(currentTicketId);
        }
      });
    } catch (e) {
      /* older browsers: no-op */
    }

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

    try {
      window.addEventListener("online", setTimelineOfflineState);
      window.addEventListener("offline", setTimelineOfflineState);
    } catch (e) {
      /* older browsers: no-op */
    }

    setTimelineOfflineState();

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

  function stopAndSend() {
    if (!_isRecording) return;
    _sendOnStop = true;
    stopListening();
  }

  window.ConversationalTimeline = {
    init: init,
    addEntry: addEntry,
    renderTimeline: renderTimeline,
    scrollToBottom: scrollToBottom,
    onWorkspaceOpen: onWorkspaceOpen,
    onWorkspaceClose: onWorkspaceClose,
    startListening: startListening,
    stopListening: stopListening,
    stopAndSend: stopAndSend,
    openMediaActionSheet: openMediaActionSheet,
    capturePhotoNative: capturePhotoNative,
    captureVideoNative: captureVideoNative,
    captureFromGallery: captureFromGallery,
    processEntry: processEntry,
    generateResponse: generateResponse,
    handleFollowUpResponse: handleFollowUpResponse,
    editEntry: editEntry,
    handleCorrection: handleCorrection,
    tagMedia: tagMedia,
    compileNotes: compileNotes,
    hasUnsubmittedReport: function () {
      return !!(
        _lastCompileResult &&
        _compileSubmittedForTicket !== currentTicketId
      );
    },
    submitAndNavigate: function (onDone) {
      if (!_lastCompileResult) { if (onDone) onDone(false); return; }
      _submitSuccessCallback = onDone || null;
      submitCompileToOffice();
    }
  };
})();
