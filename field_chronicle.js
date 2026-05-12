/**
 * Field Chronicle — experimental chronological field note capture.
 *
 * Phase 1: localStorage-only persistence, deterministic compile,
 * editable preview modal, copy-to-clipboard.
 *
 * Gate: window.VC_FIELD_CHRONICLE_ENABLED (default true).
 * Rollback: remove this file + its <script> tag + HTML/CSS block.
 *
 * Does NOT touch: Dictation Hub, report upload, Firestore, dispatcher flows.
 */
(function () {
  "use strict";

  /* ── feature gate ─────────────────────────────────────────────── */

  function isEnabled() {
    if (typeof window.VC_FIELD_CHRONICLE_ENABLED !== "undefined") {
      return !!window.VC_FIELD_CHRONICLE_ENABLED;
    }
    return true;
  }

  /* ── localStorage helpers ─────────────────────────────────────── */

  var LS_PREFIX = "vc_field_chronicle_";

  function storageKey(ticketId) {
    return LS_PREFIX + (ticketId || "draft");
  }

  function loadNotes(ticketId) {
    try {
      var raw = localStorage.getItem(storageKey(ticketId));
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveNotes(ticketId, notes) {
    try {
      localStorage.setItem(storageKey(ticketId), JSON.stringify(notes));
    } catch (e) { /* quota exceeded — degrade silently */ }
  }

  /* ── note model ───────────────────────────────────────────────── */

  function createNote(text) {
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(),
      text: String(text || "").trim()
    };
  }

  function appendNote(ticketId, text) {
    if (!text || !String(text).trim()) return null;
    var notes = loadNotes(ticketId);
    var note = createNote(text);
    notes.push(note);
    saveNotes(ticketId, notes);
    return note;
  }

  function deleteNote(ticketId, noteId) {
    var notes = loadNotes(ticketId);
    var filtered = notes.filter(function (n) { return n.id !== noteId; });
    saveNotes(ticketId, filtered);
    return filtered;
  }

  /* ── time formatting ──────────────────────────────────────────── */

  function formatTime(isoString) {
    try {
      var d = new Date(isoString);
      var h = d.getHours();
      var m = d.getMinutes();
      var ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return h + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
    } catch (e) {
      return "";
    }
  }

  function formatDate(isoString) {
    try {
      var d = new Date(isoString);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch (e) {
      return "";
    }
  }

  /* ── compile (deterministic Phase 1) ──────────────────────────── */

  function compileNotes(ticketId) {
    var notes = loadNotes(ticketId);
    if (!notes.length) return "";

    var ticket = (typeof activeTicket !== "undefined" && activeTicket) ? activeTicket : null;

    var lines = [];

    if (ticket) {
      var loc = "";
      if (ticket.customerName) loc += ticket.customerName;
      var addr = ticket.address || ticket.locationAddress || "";
      if (addr) loc += (loc ? "\n" : "") + addr;
      if (loc) {
        lines.push("Location:");
        lines.push(loc);
        lines.push("");
      }

      if (ticket.issue && String(ticket.issue).trim()) {
        lines.push("Customer Complaint:");
        lines.push(String(ticket.issue).trim());
        lines.push("");
      }
    }

    lines.push("Chronological Field Notes:");
    var prevDate = "";
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var noteDate = formatDate(n.ts);
      if (noteDate !== prevDate) {
        if (i > 0) lines.push("");
        lines.push("— " + noteDate + " —");
        prevDate = noteDate;
      }
      lines.push(formatTime(n.ts) + "  " + n.text);
    }

    lines.push("");
    lines.push("Diagnostic Process:");
    lines.push("[Review and edit the field notes above into a structured diagnostic narrative.]");
    lines.push("");
    lines.push("Findings:");
    lines.push("[Summarize key findings here.]");
    lines.push("");
    lines.push("Repairs Performed:");
    lines.push("[Describe repairs performed, including any temporary measures.]");
    lines.push("");
    lines.push("Recommendations:");
    lines.push("[List recommended next steps, parts, return visits.]");
    lines.push("");
    lines.push("Status:");
    lines.push("[Current status at departure.]");

    return lines.join("\n");
  }

  /* ── UI rendering ─────────────────────────────────────────────── */

  var currentTicketId = null;

  function getPanel()   { return document.getElementById("vcFieldChronicle"); }
  function getList()    { return document.getElementById("vcFcNotesList"); }
  function getInput()   { return document.getElementById("vcFcNoteInput"); }
  function getCount()   { return document.getElementById("vcFcNoteCount"); }
  function getCompileBtn() { return document.getElementById("vcFcCompileBtn"); }

  function renderNotesList() {
    var list = getList();
    if (!list) return;
    var notes = loadNotes(currentTicketId);
    var countEl = getCount();
    if (countEl) countEl.textContent = notes.length ? "(" + notes.length + ")" : "";

    var compileBtn = getCompileBtn();
    if (compileBtn) {
      compileBtn.disabled = !notes.length;
      compileBtn.style.opacity = notes.length ? "1" : "0.45";
    }

    if (!notes.length) {
      list.innerHTML = '<p class="vc-fc-empty">No field notes yet. Add your first note above.</p>';
      return;
    }

    var html = "";
    var prevDate = "";
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var noteDate = formatDate(n.ts);
      if (noteDate !== prevDate) {
        html += '<div class="vc-fc-date-sep">' + noteDate + '</div>';
        prevDate = noteDate;
      }
      html +=
        '<div class="vc-fc-note" data-fc-note-id="' + n.id + '">' +
          '<span class="vc-fc-note-time">' + formatTime(n.ts) + '</span>' +
          '<span class="vc-fc-note-text">' + escapeHtml(n.text) + '</span>' +
          '<button type="button" class="vc-fc-note-del" data-fc-del="' + n.id + '" aria-label="Delete note" title="Delete note">✕</button>' +
        '</div>';
    }
    list.innerHTML = html;
    list.scrollTop = list.scrollHeight;
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
  }

  /* ── event wiring ─────────────────────────────────────────────── */

  var wired = false;

  function wireEvents() {
    if (wired) return;
    wired = true;

    var addBtn = document.getElementById("vcFcAddNoteBtn");
    var input = getInput();

    if (addBtn && input) {
      addBtn.addEventListener("click", function () {
        var text = input.value.trim();
        if (!text) { input.focus(); return; }
        appendNote(currentTicketId, text);
        input.value = "";
        input.focus();
        renderNotesList();
      });

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          addBtn.click();
        }
      });
    }

    var list = getList();
    if (list) {
      list.addEventListener("click", function (e) {
        var delBtn = e.target.closest("[data-fc-del]");
        if (!delBtn) return;
        var noteId = delBtn.getAttribute("data-fc-del");
        if (noteId) {
          deleteNote(currentTicketId, noteId);
          renderNotesList();
        }
      });
    }

    var compileBtn = getCompileBtn();
    if (compileBtn) {
      compileBtn.addEventListener("click", function () {
        openCompileModal();
      });
    }

    var clearBtn = document.getElementById("vcFcClearAllBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!loadNotes(currentTicketId).length) return;
        if (!confirm("Clear all field notes for this job? This cannot be undone.")) return;
        saveNotes(currentTicketId, []);
        renderNotesList();
      });
    }

    var toggleBtn = document.getElementById("vcFcToggleBtn");
    var body = document.getElementById("vcFcBody");
    if (toggleBtn && body) {
      toggleBtn.addEventListener("click", function () {
        var collapsed = body.classList.toggle("vc-fc-collapsed");
        toggleBtn.textContent = collapsed ? "Show" : "Hide";
        toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
    }
  }

  /* ── compile modal ────────────────────────────────────────────── */

  function openCompileModal() {
    var modal = document.getElementById("vcFcCompileModal");
    var textarea = document.getElementById("vcFcCompileText");
    if (!modal || !textarea) return;

    var compiled = compileNotes(currentTicketId);
    textarea.value = compiled;
    modal.classList.remove("hidden");
    textarea.focus();
    textarea.setSelectionRange(0, 0);
  }

  function closeCompileModal() {
    var modal = document.getElementById("vcFcCompileModal");
    if (modal) modal.classList.add("hidden");
  }

  function copyCompiledSummary() {
    var textarea = document.getElementById("vcFcCompileText");
    if (!textarea) return;
    var text = textarea.value;

    var statusEl = document.getElementById("vcFcCopyStatus");
    function showStatus(msg, ok) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.style.color = ok ? "#16a34a" : "#dc2626";
      setTimeout(function () { statusEl.textContent = ""; }, 2500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { showStatus("Copied!", true); },
        function () { fallbackCopy(text, showStatus); }
      );
    } else {
      fallbackCopy(text, showStatus);
    }
  }

  function fallbackCopy(text, showStatus) {
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

  /* ── compile modal wiring (once) ──────────────────────────────── */

  var compileModalWired = false;

  function wireCompileModal() {
    if (compileModalWired) return;
    compileModalWired = true;

    var closeBtn = document.getElementById("vcFcCompileCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeCompileModal);

    var backdrop = document.getElementById("vcFcCompileBackdrop");
    if (backdrop) backdrop.addEventListener("click", closeCompileModal);

    var copyBtn = document.getElementById("vcFcCopyBtn");
    if (copyBtn) copyBtn.addEventListener("click", copyCompiledSummary);
  }

  /* ── public API (called from openWorkspace) ───────────────────── */

  function onWorkspaceOpen(ticketId) {
    if (!isEnabled()) {
      var panel = getPanel();
      if (panel) panel.style.display = "none";
      return;
    }

    currentTicketId = ticketId || null;

    var panel = getPanel();
    if (panel) panel.style.display = "";

    wireEvents();
    wireCompileModal();
    renderNotesList();

    var input = getInput();
    if (input) input.value = "";
  }

  /* ── hamburger menu entry wiring ──────────────────────────────── */

  function wireHamburgerEntry() {
    var menuItem = document.getElementById("wsSiteMenuChronicle");
    if (!menuItem) return;
    menuItem.addEventListener("click", function () {
      var panel = getPanel();
      if (!panel) return;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      var input = getInput();
      if (input) {
        setTimeout(function () { input.focus(); }, 350);
      }
      var dropdown = document.getElementById("wsSiteMenuDropdown");
      if (dropdown) dropdown.classList.remove("ws-site-menu-dropdown--open");
      var btn = document.getElementById("wsSiteMenuBtn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  /* ── init on DOM ready ────────────────────────────────────────── */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireHamburgerEntry);
  } else {
    wireHamburgerEntry();
  }

  /* ── expose ───────────────────────────────────────────────────── */

  window.FieldChronicle = {
    onWorkspaceOpen: onWorkspaceOpen,
    isEnabled: isEnabled
  };

})();
