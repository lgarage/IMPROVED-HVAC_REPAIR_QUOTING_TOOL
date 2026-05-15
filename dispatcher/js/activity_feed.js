/**
 * Live Pulse — real-time Firestore feed for dispatch managers.
 * Listens: service_calls (internal_comms, status), site_intelligence.
 */
(function (global) {
  "use strict";

  var unsubTickets = null;
  var unsubIntel = null;
  var firstTicketsSnap = true;
  var firstIntelSnap = true;
  /** @type {Object.<string, { status: string, internal: string }>} */
  var lastTicketState = {};
  var feedEl = null;
  var hintEl = null;
  var inputEl = null;
  var btnEl = null;
  /** @type {string|null} */
  var lastTicketIdForReply = null;

  function $(id) {
    return document.getElementById(id);
  }

  function formatTime(ts) {
    if (ts == null) return "";
    try {
      var d = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function getManagerLabel() {
    try {
      var n = localStorage.getItem("pulse_manager_name");
      if (n && String(n).trim()) return String(n).trim();
    } catch (e) {}
    return "Office";
  }

  var INTERNAL_COMMS_TYPE_VARIANTS = [
    "note", "notes", "internal", "inter-office", "interOffice"
  ];

  function normalizeInternalType(typeVal) {
    if (!typeVal) return "internal_comms";
    var t = String(typeVal).trim();
    if (t === "internal_comms") return "internal_comms";
    for (var i = 0; i < INTERNAL_COMMS_TYPE_VARIANTS.length; i++) {
      if (t === INTERNAL_COMMS_TYPE_VARIANTS[i]) return "internal_comms";
    }
    return t;
  }

  function normalizeInternal(data) {
    if (!data) return "";
    if (data.type && normalizeInternalType(data.type) === "internal_comms") {
      data.type = "internal_comms";
    }
    var ic = data.internal_comms;
    if (Array.isArray(ic)) {
      return ic
        .map(function (x) {
          return String(x != null ? x : "").trim();
        })
        .filter(Boolean)
        .join("\n");
    }
    return ic != null ? String(ic) : "";
  }

  function ticketLabel(data) {
    var tn = data.ticketNum != null ? String(data.ticketNum) : "";
    var cn = data.customerName != null ? String(data.customerName) : "";
    if (tn && cn) return tn + " · " + cn;
    return tn || cn || "Ticket";
  }

  function prependFeedItem(html) {
    if (!feedEl) return;
    var empty = feedEl.querySelector(".pulse-feed-list--empty");
    if (empty) empty.remove();
    feedEl.classList.remove("pulse-feed-list--empty");
    var wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    var node = wrap.firstElementChild;
    if (!node) return;
    feedEl.insertBefore(node, feedEl.firstChild);
    while (feedEl.children.length > 200) {
      feedEl.removeChild(feedEl.lastChild);
    }
  }

  function renderEmptyState() {
    if (!feedEl) return;
    if (!feedEl.querySelector(".pulse-feed-item")) {
      feedEl.innerHTML =
        '<div class="pulse-feed-list--empty">Listening for activity… Open a job in the field or add inter-office notes.</div>';
    }
  }

  function feedItemHtml(opts) {
    var type = opts.type;
    var icon = "💬";
    var cls = "pulse-feed-item";
    var who = opts.who || "";
    var line = opts.line || "";
    var time = opts.time || "";
    var ticketId = opts.ticketId || "";
    var intelId = opts.intelId || "";

    if (type === "intel") {
      icon = "📍";
      cls += " pulse-feed-item--intel";
    } else if (type === "status") {
      icon = "📋";
      cls += " pulse-feed-item--status";
    }

    var dataAttrs =
      ticketId ? ' data-ticket-id="' + escapeAttr(ticketId) + '" tabindex="0" role="button"' : "";
    if (intelId) dataAttrs += ' data-intel-id="' + escapeAttr(intelId) + '"';

    return (
      '<div class="' +
      cls +
      '"' +
      dataAttrs +
      ">" +
      '<div class="pulse-feed-item__icon" aria-hidden="true">' +
      icon +
      "</div>" +
      '<div class="pulse-feed-item__body">' +
      '<div class="pulse-feed-item__meta">' +
      escapeHtml(time) +
      (who ? " — <strong>" + escapeHtml(who) + "</strong>" : "") +
      "</div>" +
      '<div class="pulse-feed-item__text">' +
      escapeHtml(line) +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  function shouldPulseStatus(prev, next) {
    if (!next) return false;
    var n = String(next).trim();
    var p = prev != null ? String(prev).trim() : "";
    if (n === p) return false;
    var nl = n.toLowerCase();
    if (nl.indexOf("in progress") !== -1) return true;
    if (nl.indexOf("completed") !== -1 || nl.indexOf("complete") !== -1) return true;
    if (n === "Dispatched" && (p === "Unassigned" || !p)) return true;
    return false;
  }

  function onTicketSnapshot(snapshot) {
    if (firstTicketsSnap) {
      firstTicketsSnap = false;
      snapshot.forEach(function (doc) {
        var data = doc.data() || {};
        lastTicketState[doc.id] = {
          status: data.status != null ? String(data.status) : "",
          internal: normalizeInternal(data),
        };
      });
      renderEmptyState();
      return;
    }

    var seen = {};
    snapshot.forEach(function (doc) {
      var id = doc.id;
      seen[id] = true;
      var data = doc.data() || {};
      var prev = lastTicketState[id] || { status: "", internal: "" };
      var st = data.status != null ? String(data.status) : "";
      var internal = normalizeInternal(data);
      var tlabel = ticketLabel(data);
      var commTime = formatTime(data.internal_comms_updatedAt);
      var statusTime = formatTime(data.updatedAt) || commTime;

      if (internal && internal !== prev.internal) {
        var snippet = internal.length > 220 ? internal.slice(0, 217) + "…" : internal;
        prependFeedItem(
          feedItemHtml({
            type: "internal",
            who: tlabel + " (Inter-Office Comms)",
            line: '"' + snippet + '"',
            time: commTime || "—",
            ticketId: id,
          })
        );
      }

      if (shouldPulseStatus(prev.status, st)) {
        prependFeedItem(
          feedItemHtml({
            type: "status",
            who: tlabel + " (Status)",
            line: "Status → " + st + (prev.status ? " (was: " + prev.status + ")" : ""),
            time: statusTime || "—",
            ticketId: id,
          })
        );
      }

      lastTicketState[id] = { status: st, internal: internal };
    });
    Object.keys(lastTicketState).forEach(function (id) {
      if (!seen[id]) delete lastTicketState[id];
    });
  }

  var lastIntelNotes = {};

  function onIntelSnapshot(snapshot) {
    if (firstIntelSnap) {
      firstIntelSnap = false;
      snapshot.forEach(function (doc) {
        var data = doc.data() || {};
        lastIntelNotes[doc.id] = String(data.notes || "").trim();
      });
      return;
    }

    var seen = {};
    snapshot.forEach(function (doc) {
      var id = doc.id;
      seen[id] = true;
      var data = doc.data() || {};
      var notes = String(data.notes || "").trim();
      var prevNotes = lastIntelNotes[id] != null ? lastIntelNotes[id] : "";
      if (notes && notes !== prevNotes) {
        var loc = String(data.locationDisplay || data.normalizedKey || "Site").trim();
        var by = String(data.updatedByTech || "Field").trim();
        var snippet = notes.length > 200 ? notes.slice(0, 197) + "…" : notes;
        prependFeedItem(
          feedItemHtml({
            type: "intel",
            who: by + " (Site Intel)",
            line: loc + ": " + snippet,
            time: formatTime(data.updatedAt) || "—",
            intelId: id,
          })
        );
      }
      lastIntelNotes[id] = notes;
    });
    Object.keys(lastIntelNotes).forEach(function (id) {
      if (!seen[id]) delete lastIntelNotes[id];
    });
  }

  function wireFeedClicks() {
    if (!feedEl || feedEl.dataset.pulseWired === "1") return;
    feedEl.dataset.pulseWired = "1";
    feedEl.addEventListener("click", function (e) {
      var row = e.target.closest(".pulse-feed-item");
      if (!row) return;
      var tid = row.getAttribute("data-ticket-id");
      if (tid) {
        lastTicketIdForReply = tid;
        if (hintEl) {
          hintEl.textContent = "Quick reply targets ticket " + tid + ".";
        }
        deepLinkToTicket(tid);
      }
    });
    feedEl.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var row = e.target.closest(".pulse-feed-item");
      if (!row) return;
      e.preventDefault();
      row.click();
    });
  }

  function deepLinkToTicket(ticketId) {
    if (typeof global.switchTab === "function") {
      global.switchTab("service");
    }
    global.setTimeout(function () {
      if (typeof global.loadServiceCall === "function") {
        global.loadServiceCall(ticketId).then(function () {
          var el = document.getElementById("serviceFormContainer");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }, 80);
  }

  function sendQuickReply() {
    if (!inputEl || !firebase || !firebase.apps || !firebase.apps.length) return;
    var text = String(inputEl.value || "").trim();
    if (!text) return;
    var tid = lastTicketIdForReply;
    if (!tid) {
      if (hintEl) hintEl.textContent = "Click an inter-office message or status row first to pick a ticket.";
      return;
    }
    var mgr = getManagerLabel();
    var _db = firebase.firestore();
    var ref = (
      typeof VCFirestore !== "undefined"
        ? VCFirestore.serviceCalls(_db)
        : _db.collection("service_calls")
    ).doc(tid);
    btnEl.disabled = true;
    (typeof VCFirestore !== "undefined" && VCFirestore.getServiceCallOnceBridged
      ? VCFirestore.getServiceCallOnceBridged(_db, tid)
      : _db.collection("service_calls").doc(tid).get().then(function (snap) {
          return {
            exists: snap.exists,
            data: snap.exists ? snap.data() : null,
          };
        })
    )
      .then(function (got) {
        var prev =
          got && got.exists && got.data ? normalizeInternal(got.data) : "";
        var line = "[" + mgr + " @ Pulse]: " + text;
        var next = prev ? prev + "\n\n" + line : line;
        var payload = {
          internal_comms: next,
          internal_comms_updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          type: normalizeInternalType(got && got.data ? got.data.type : "internal_comms"),
        };
        if (typeof VCFirestore !== "undefined" && VCFirestore.setServiceCallMerged) {
          return VCFirestore.setServiceCallMerged(_db, tid, payload, true);
        }
        return ref.set(payload, { merge: true });
      })
      .then(function () {
        inputEl.value = "";
        if (hintEl) hintEl.textContent = "Sent via Inter-Office Comms on ticket " + tid + ".";
        if (typeof global.showSaveCue === "function") {
          global.showSaveCue("✓ Reply synced to Firestore");
        }
      })
      .catch(function (err) {
        if (hintEl) hintEl.textContent = err && err.message ? err.message : "Send failed.";
      })
      .finally(function () {
        btnEl.disabled = false;
      });
  }

  function start() {
    feedEl = $("pulseFeedList");
    hintEl = $("pulseQuickReplyHint");
    inputEl = $("pulseQuickReplyInput");
    btnEl = $("pulseQuickReplyBtn");
    if (!feedEl) return;

    wireFeedClicks();
    renderEmptyState();

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      feedEl.innerHTML =
        '<div class="pulse-feed-list--empty">Firebase not initialized — sign in or check config.</div>';
      return;
    }

    if (unsubTickets || unsubIntel) return;

    try {
      var db = firebase.firestore();
      var scSub =
        typeof VCFirestore !== "undefined" && VCFirestore.subscribeServiceCallsMerged
          ? VCFirestore.subscribeServiceCallsMerged
          : function (d, onNext, onErr) {
              var sc =
                typeof VCFirestore !== "undefined"
                  ? VCFirestore.serviceCalls(d)
                  : d.collection("service_calls");
              return sc.onSnapshot(onNext, onErr);
            };
      var siSub =
        typeof VCFirestore !== "undefined" && VCFirestore.subscribeSiteIntelligenceMerged
          ? VCFirestore.subscribeSiteIntelligenceMerged
          : function (d, onNext, onErr) {
              var si =
                typeof VCFirestore !== "undefined"
                  ? VCFirestore.siteIntelligence(d)
                  : d.collection("site_intelligence");
              return si.onSnapshot(onNext, onErr);
            };
      unsubTickets = scSub(db, onTicketSnapshot, function (err) {
        console.warn("[Pulse] service_calls", err);
      });
      unsubIntel = siSub(db, onIntelSnapshot, function (err) {
        console.warn("[Pulse] site_intelligence", err);
      });
    } catch (e) {
      console.warn("[Pulse] start", e);
    }
  }

  function stop() {
    if (typeof unsubTickets === "function") {
      unsubTickets();
      unsubTickets = null;
    }
    if (typeof unsubIntel === "function") {
      unsubIntel();
      unsubIntel = null;
    }
    firstTicketsSnap = true;
    firstIntelSnap = true;
    lastTicketState = {};
    lastIntelNotes = {};
  }

  function wireQuickReplyOnce() {
    if (document.body.dataset.pulseQrWired === "1") return;
    document.body.dataset.pulseQrWired = "1";
    document.addEventListener("click", function (e) {
      if (e.target && e.target.id === "pulseQuickReplyBtn") {
        sendQuickReply();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.target && e.target.id === "pulseQuickReplyInput" && e.key === "Enter") {
        e.preventDefault();
        sendQuickReply();
      }
    });
  }

  global.PulseActivityFeed = {
    start: start,
    stop: stop,
    wireQuickReplyOnce: wireQuickReplyOnce,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireQuickReplyOnce);
  } else {
    wireQuickReplyOnce();
  }
})(typeof window !== "undefined" ? window : this);
