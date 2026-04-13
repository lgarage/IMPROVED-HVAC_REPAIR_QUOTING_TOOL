/**
 * Shadow Mode — dispatcher live-mirrored Field App preview (Phase 19).
 * Requires: firebase, VCFirestore.livePresence, tenant users for dropdown.
 */
(function (global) {
  "use strict";

  var currentShadowPresenceKey = "";

  function payrollKeyFromName(name) {
    return (
      String(name || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 64) || "USER"
    );
  }

  function presenceKeyFromUserDoc(docId, data) {
    var d = data || {};
    if (d.presenceKey) return String(d.presenceKey);
    var full = String(d.payrollFullName || "").trim();
    if (full) return payrollKeyFromName(full);
    return payrollKeyFromName(
      (String(d.firstName || "").trim() + " " + String(d.lastName || "").trim()).trim() || docId
    );
  }

  function loadTenantUsersIntoSelect() {
    var sel = document.getElementById("vcShadowUserSelect");
    if (!sel || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    if (typeof VCFirestore === "undefined" || !VCFirestore.tenantUsers) return;
    var db = firebase.firestore();
    VCFirestore.tenantUsers(db)
      .get()
      .then(function (snap) {
        sel.innerHTML = '<option value="">Shadow a user…</option>';
        var rows = [];
        snap.forEach(function (doc) {
          rows.push({ id: doc.id, data: doc.data() || {} });
        });
        rows.sort(function (a, b) {
          var la = String(a.data.payrollFullName || a.data.email || a.id).toLowerCase();
          var lb = String(b.data.payrollFullName || b.data.email || b.id).toLowerCase();
          return la.localeCompare(lb);
        });
        rows.forEach(function (row) {
          var pk = presenceKeyFromUserDoc(row.id, row.data);
          var opt = document.createElement("option");
          opt.value = pk;
          opt.textContent =
            row.data.payrollFullName ||
            (String(row.data.firstName || "") + " " + String(row.data.lastName || "")).trim() ||
            row.data.email ||
            row.id;
          opt.dataset.presenceKey = pk;
          sel.appendChild(opt);
        });
      })
      .catch(function (e) {
        console.warn("[ShadowMode] tenant users:", e);
      });
  }

  function openShadowModal(presenceKey, label) {
    currentShadowPresenceKey = String(presenceKey || "");
    var modal = document.getElementById("vcShadowModal");
    var iframe = document.getElementById("vcShadowIframe");
    var title = document.getElementById("vcShadowModalTitle");
    if (!modal || !iframe) return;
    if (title) title.textContent = label ? "Shadow — " + label : "Shadow viewer";
    var base = new URL("technician/index.html", global.location.href);
    base.searchParams.set("vc_shadow_viewer", "1");
    base.searchParams.set("vc_presence_key", currentShadowPresenceKey);
    if (label) base.searchParams.set("vc_display_name", label);
    iframe.src = base.toString();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeShadowModal() {
    var modal = document.getElementById("vcShadowModal");
    var iframe = document.getElementById("vcShadowIframe");
    if (iframe) iframe.src = "about:blank";
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    currentShadowPresenceKey = "";
    var sel = document.getElementById("vcShadowUserSelect");
    if (sel) sel.value = "";
  }

  function sendCoachPrompt() {
    var input = document.getElementById("vcShadowCoachInput");
    var text = input && input.value ? String(input.value).trim() : "";
    if (!text || !currentShadowPresenceKey) return;
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    if (typeof VCFirestore === "undefined" || !VCFirestore.livePresence) return;
    var db = firebase.firestore();
    var ref = VCFirestore.livePresence(db).doc(currentShadowPresenceKey);
    ref
      .set(
        {
          coachPrompt: text,
          coachPromptAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .then(function () {
        if (input) input.value = "";
      })
      .catch(function (e) {
        console.warn("[ShadowMode] coach prompt:", e);
      });
  }

  function initShadowMode() {
    loadTenantUsersIntoSelect();
    var sel = document.getElementById("vcShadowUserSelect");
    if (sel && !sel.dataset.vcShadowWired) {
      sel.dataset.vcShadowWired = "1";
      sel.addEventListener("change", function () {
        var v = sel.value;
        if (!v) return;
        var opt = sel.options[sel.selectedIndex];
        var label = opt ? opt.textContent : "";
        openShadowModal(v, label);
        sel.value = "";
      });
    }
    var sendBtn = document.getElementById("vcShadowCoachSend");
    if (sendBtn && !sendBtn.dataset.vcShadowWired) {
      sendBtn.dataset.vcShadowWired = "1";
      sendBtn.addEventListener("click", sendCoachPrompt);
    }
    var coachInp = document.getElementById("vcShadowCoachInput");
    if (coachInp && !coachInp.dataset.vcShadowWired) {
      coachInp.dataset.vcShadowWired = "1";
      coachInp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          sendCoachPrompt();
        }
      });
    }
  }

  global.VcShadowMode = {
    initShadowMode: initShadowMode,
    openShadowModal: openShadowModal,
    closeShadowModal: closeShadowModal,
    sendCoachPrompt: sendCoachPrompt,
    payrollKeyFromName: payrollKeyFromName,
  };
})(typeof window !== "undefined" ? window : this);
