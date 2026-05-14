/**
 * Conversational Timeline — Slice 41a.
 *
 * Local timeline only. Messages are stored by ticketId in localStorage and
 * rendered in a right/left bubble layout on technician workspace.
 */
(function () {
  "use strict";

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
          '<span class="ct-message__meta">' + escapeHtml(senderLabel) + " · " + escapeHtml(formatTime(item.ts)) + "</span>" +
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

  function onWorkspaceOpen(ticketId) {
    currentTicketId = normalizeTicketId(ticketId || resolveTicketIdFromObject(getActiveTicket()));
    seedFromTicket(currentTicketId);
    renderTimeline(currentTicketId);
  }

  function init() {
    if (initialized) return;
    initialized = true;

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
    onWorkspaceOpen: onWorkspaceOpen
  };
})();
