/**
 * Teaching Layer — Slice 52a: Knowledge capture + contextual surfacing.
 *
 * Senior techs save teaching notes (photo+voice, text procedure, video walkthrough)
 * via a "💡 Teach" button in the action bar.
 *
 * Scope levels:
 *   - site      (ladder access, thermostat location)
 *   - equipment (RTU6 black-box economizer quirk)
 *   - model     (Honeywell 8000 setup procedure)
 *   - company   (PM best practices, bearing identification)
 *
 * Firestore path: tenants/{tid}/knowledge/{autoId}
 * Document shape: { scope, scopeRef, mediaUrls[], text, createdBy, timestamp, tags[] }
 *
 * Contextual surfacing: on workspace open, queries knowledge collection for
 * matching site / equipment model / company-wide tips and shows a "💡 Tips available" chip.
 *
 * Gate: window.VC_TEACHING_LAYER_ENABLED (default true).
 * Rollback: remove this file + its <script> tag + HTML elements.
 */
(function () {
  "use strict";

  /* ── feature gate ─────────────────────────────────────────────── */

  function isEnabled() {
    if (typeof window.VC_TEACHING_LAYER_ENABLED !== "undefined") {
      return !!window.VC_TEACHING_LAYER_ENABLED;
    }
    return true;
  }

  /* ── helpers ──────────────────────────────────────────────────── */

  function getTenantId() {
    if (typeof VCFirestore !== "undefined" && VCFirestore.getTenantId) {
      return VCFirestore.getTenantId();
    }
    if (typeof APP_CONFIG !== "undefined" && APP_CONFIG.tenantId) {
      return String(APP_CONFIG.tenantId).trim();
    }
    return "";
  }

  function getTechnicianName() {
    try {
      if (window.firebase && window.firebase.auth) {
        var u = window.firebase.auth().currentUser;
        if (u) return u.displayName || u.email || "Technician";
      }
    } catch (e) {}
    try {
      if (typeof window.technicianName !== "undefined" && window.technicianName) {
        return String(window.technicianName);
      }
    } catch (e) {}
    try {
      var saved = localStorage.getItem("tp_saved_tech");
      if (saved) return saved;
    } catch (e) {}
    return "Technician";
  }

  function getActiveTicket() {
    return typeof activeTicket !== "undefined" ? activeTicket : null;
  }

  function getDb() {
    try {
      if (window.firebase && window.firebase.firestore) {
        return window.firebase.firestore();
      }
    } catch (e) {}
    return null;
  }

  function isOnline() {
    return typeof navigator !== "undefined" ? navigator.onLine !== false : true;
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ── offline queue ────────────────────────────────────────────── */

  var LS_QUEUE_KEY = "vc_teaching_offline_queue";
  var LS_KNOWLEDGE_CACHE_PREFIX = "vc_teaching_knowledge_cache_";

  function loadOfflineQueue() {
    try {
      var raw = localStorage.getItem(LS_QUEUE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function saveOfflineQueue(queue) {
    try {
      localStorage.setItem(LS_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) { /* quota exceeded */ }
  }

  function enqueueOffline(doc) {
    var queue = loadOfflineQueue();
    queue.push(doc);
    saveOfflineQueue(queue);
  }

  function knowledgeCacheKey(scope, keyObj) {
    var payload = "";
    try {
      payload = JSON.stringify(keyObj || {});
    } catch (e) {
      payload = String(keyObj || "");
    }
    return LS_KNOWLEDGE_CACHE_PREFIX + String(scope || "default") + "_" + payload;
  }

  function loadKnowledgeCache(scope, keyObj) {
    try {
      var raw = localStorage.getItem(knowledgeCacheKey(scope, keyObj));
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveKnowledgeCache(scope, keyObj, items) {
    try {
      localStorage.setItem(
        knowledgeCacheKey(scope, keyObj),
        JSON.stringify(Array.isArray(items) ? items : [])
      );
    } catch (e) { /* quota exceeded */ }
  }

  function flushOfflineQueue() {
    if (!isOnline()) return;
    var tid = getTenantId();
    if (!tid) return;
    var db = getDb();
    if (!db) return;

    var queue = loadOfflineQueue();
    if (!queue.length) return;

    var remaining = [];
    queue.forEach(function (doc) {
      try {
        db.collection("tenants").doc(tid).collection("knowledge").add(doc);
      } catch (e) {
        remaining.push(doc);
      }
    });
    saveOfflineQueue(remaining);
  }

  /* ── media upload ─────────────────────────────────────────────── */

  function uploadMedia(file, ticketId) {
    return new Promise(function (resolve, reject) {
      try {
        if (!window.firebase || !window.firebase.storage) {
          reject(new Error("Storage unavailable"));
          return;
        }
        var storageRef = window.firebase.storage().ref();
        var ts = Date.now();
        var safeName = (file.name || "media").replace(/[^a-zA-Z0-9._-]/g, "_");
        var path = "teaching_media/" + (ticketId || "general") + "/" + ts + "_" + safeName;
        var childRef = storageRef.child(path);
        var uploadMeta = { contentType: file.type || "application/octet-stream" };
        var uploadTask = childRef.put(file);

        uploadTask.then(function (snapshot) {
          snapshot.ref.getDownloadURL().then(function (url) {
            resolve(url);
          }).catch(reject);
        }).catch(function (err) {
          if (typeof VCStorageOutbox !== "undefined") {
            VCStorageOutbox.enqueue(childRef.fullPath, file, uploadMeta);
          }
          console.warn("[TeachingLayer] media upload failed — queued for retry", err);
          reject(err);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /* ── Firestore write ──────────────────────────────────────────── */

  /**
   * saveTeaching — exported.
   *
   * Writes a teaching note to Firestore: tenants/{tid}/knowledge/{autoId}.
   *
   * @param {Object} opts
   * @param {string} opts.scope - "site"|"equipment"|"model"|"company"
   * @param {string} opts.scopeRef - Reference key (e.g. customer+address, model name)
   * @param {string[]} opts.mediaUrls - Array of media download URLs
   * @param {string} opts.text - Teaching note text
   * @param {string[]} opts.tags - Tags for categorization
   * @param {File[]} [opts.files] - Raw files to upload first
   * @returns {Promise<Object>} The saved document data
   */
  function saveTeaching(opts) {
    opts = opts || {};
    var scope = String(opts.scope || "company").trim();
    var scopeRef = String(opts.scopeRef || "").trim();
    var mediaUrls = Array.isArray(opts.mediaUrls) ? opts.mediaUrls : [];
    var text = String(opts.text || "").trim();
    var tags = Array.isArray(opts.tags) ? opts.tags : [];
    var files = Array.isArray(opts.files) ? opts.files : [];

    var ticket = getActiveTicket();
    var ticketId = ticket ? (ticket.ticketId || ticket.id || ticket.ticket || "") : "";

    if (!scope) scope = "company";

    var uploadPromises = files.map(function (f) {
      return uploadMedia(f, ticketId).catch(function () { return null; });
    });

    return Promise.all(uploadPromises).then(function (urls) {
      var allUrls = mediaUrls.concat(urls.filter(Boolean));

      var doc = {
        scope: scope,
        scopeRef: scopeRef,
        mediaUrls: allUrls,
        text: text,
        createdBy: getTechnicianName(),
        timestamp: new Date().toISOString(),
        tags: tags
      };

      var tid = getTenantId();
      var db = getDb();

      if (!tid || !db || !isOnline()) {
        enqueueOffline(doc);
        return doc;
      }

      try {
        db.collection("tenants").doc(tid).collection("knowledge").add(doc);
      } catch (e) {
        enqueueOffline(doc);
      }

      return doc;
    });
  }

  /* ── Firestore query ──────────────────────────────────────────── */

  /**
   * findTeaching — exported.
   *
   * Query knowledge collection with filters.
   *
   * @param {Object} filters
   * @param {string} [filters.scope] - Filter by scope level
   * @param {string} [filters.scopeRef] - Filter by scope reference
   * @param {string[]} [filters.tags] - Filter by tags (any match)
   * @param {number} [filters.limit] - Max results (default 20)
   * @returns {Promise<Object[]>} Matching knowledge docs
   */
  function findTeaching(filters) {
    filters = filters || {};
    var tid = getTenantId();
    var db = getDb();
    var cacheKeyObj = {
      scope: filters.scope || "",
      scopeRef: filters.scopeRef || "",
      tags: Array.isArray(filters.tags) ? filters.tags.slice(0, 50) : [],
      limit: filters.limit || 20
    };
    var cached = loadKnowledgeCache("find", cacheKeyObj);

    if (!tid || !db) return Promise.resolve(isOnline() ? [] : cached);

    var ref;
    try {
      ref = db.collection("tenants").doc(tid).collection("knowledge");
    } catch (e) {
      return Promise.resolve(cached);
    }

    if (filters.scope) {
      ref = ref.where("scope", "==", filters.scope);
    }
    if (filters.scopeRef) {
      ref = ref.where("scopeRef", "==", filters.scopeRef);
    }

    var limit = filters.limit || 20;
    ref = ref.orderBy("timestamp", "desc").limit(limit);

    return ref.get().then(function (snapshot) {
      var results = [];
      snapshot.forEach(function (doc) {
        var d = doc.data();
        d._id = doc.id;
        results.push(d);
      });

      if (filters.tags && filters.tags.length) {
        results = results.filter(function (r) {
          if (!r.tags || !r.tags.length) return false;
          return filters.tags.some(function (t) {
            return r.tags.indexOf(t) !== -1;
          });
        });
      }

      saveKnowledgeCache("find", cacheKeyObj, results);
      return results;
    }).catch(function () {
      return isOnline() ? [] : cached;
    });
  }

  /* ── hierarchical knowledge lookup (Slice 53a) ────────────────── */

  /**
   * lookupKnowledge — exported.
   *
   * Searches the knowledge collection for entries whose text contains any
   * significant words from the question.  Scope can be narrowed to
   * "company", "site", "equipment", or "model".  Returns the best-matching
   * doc (if any) or null.
   *
   * @param {string} question - The tech's free-form question
   * @param {Object} [opts]
   * @param {string} [opts.scope] - Limit to a specific scope level
   * @param {string} [opts.scopeRef] - Limit to a specific scope reference
   * @param {number} [opts.limit] - Max candidates to evaluate (default 30)
   * @returns {Promise<Object|null>} Best matching knowledge doc, or null
   */
  function lookupKnowledge(question, opts) {
    opts = opts || {};
    var q = String(question || "").trim().toLowerCase();
    if (!q) return Promise.resolve(null);

    var filters = {};
    if (opts.scope) filters.scope = opts.scope;
    if (opts.scopeRef) filters.scopeRef = opts.scopeRef;
    filters.limit = opts.limit || 30;

    return findTeaching(filters).then(function (docs) {
      if (!docs || !docs.length) return null;

      var stopWords = ["the","a","an","is","are","was","were","it","i","we",
        "they","he","she","and","or","to","of","in","on","for","at","by",
        "how","do","does","did","can","what","where","when","why","this",
        "that","with","not","no","you","my","be","has","have","had"];
      var words = q.split(/\s+/).filter(function (w) {
        return w.length > 2 && stopWords.indexOf(w) === -1;
      });
      if (!words.length) return docs[0] || null;

      var best = null;
      var bestScore = 0;
      for (var i = 0; i < docs.length; i++) {
        var docText = String(docs[i].text || "").toLowerCase();
        var tagText = (docs[i].tags || []).join(" ").toLowerCase();
        var combined = docText + " " + tagText;
        var score = 0;
        for (var j = 0; j < words.length; j++) {
          if (combined.indexOf(words[j]) !== -1) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          best = docs[i];
        }
      }
      return bestScore > 0 ? best : null;
    }).catch(function () {
      return null;
    });
  }

  /* ── contextual surfacing ─────────────────────────────────────── */

  /**
   * getRelevantKnowledge — exported.
   *
   * Gathers knowledge relevant to the current workspace context:
   * site-specific, equipment-specific, model-specific, company-wide tips.
   *
   * @param {Object} [context] - Override context (defaults to active ticket)
   * @param {string} [context.customerName]
   * @param {string} [context.locationAddress]
   * @param {string} [context.equipmentModel]
   * @param {string} [context.equipmentBrand]
   * @param {string} [context.workType]
   * @returns {Promise<Object[]>} Relevant knowledge items
   */
  function getRelevantKnowledge(context) {
    context = context || {};
    var ticket = getActiveTicket();
    var customerName = context.customerName || (ticket && ticket.customerName ? String(ticket.customerName).trim() : "");
    var locationAddress = context.locationAddress || (ticket && ticket.locationAddress ? String(ticket.locationAddress).trim() : "");
    var equipModel = context.equipmentModel || "";
    var equipBrand = context.equipmentBrand || "";
    var workType = context.workType || (ticket && ticket.serviceType ? String(ticket.serviceType).trim() : "");

    if (!equipModel && !equipBrand) {
      try {
        if (window.JobContextEngine && typeof window.JobContextEngine.getActiveEquipment === "function") {
          var ae = window.JobContextEngine.getActiveEquipment();
          if (ae) {
            equipModel = ae.model || ae.modelNumber || "";
            equipBrand = ae.brand || ae.manufacturer || "";
          }
        }
      } catch (e) {}
    }

    var tid = getTenantId();
    var db = getDb();
    var relevantKey = {
      customerName: customerName,
      locationAddress: locationAddress,
      equipModel: equipModel,
      equipBrand: equipBrand,
      workType: workType
    };
    var cached = loadKnowledgeCache("relevant", relevantKey);
    if (!tid || !db) return Promise.resolve(cached);

    var queries = [];
    var knowledgeRef;
    try {
      knowledgeRef = db.collection("tenants").doc(tid).collection("knowledge");
    } catch (e) {
      return Promise.resolve(cached);
    }

    if (customerName && locationAddress) {
      var siteRef = customerName + "|" + locationAddress;
      queries.push(
        knowledgeRef
          .where("scope", "==", "site")
          .where("scopeRef", "==", siteRef)
          .orderBy("timestamp", "desc")
          .limit(10)
          .get()
          .catch(function () { return { forEach: function () {} }; })
      );
    }

    if (equipModel || equipBrand) {
      var modelRef = (equipBrand + " " + equipModel).trim();
      queries.push(
        knowledgeRef
          .where("scope", "==", "model")
          .where("scopeRef", "==", modelRef)
          .orderBy("timestamp", "desc")
          .limit(10)
          .get()
          .catch(function () { return { forEach: function () {} }; })
      );

      var equipRef = equipModel || equipBrand;
      queries.push(
        knowledgeRef
          .where("scope", "==", "equipment")
          .where("scopeRef", "==", equipRef)
          .orderBy("timestamp", "desc")
          .limit(5)
          .get()
          .catch(function () { return { forEach: function () {} }; })
      );
    }

    queries.push(
      knowledgeRef
        .where("scope", "==", "company")
        .orderBy("timestamp", "desc")
        .limit(10)
        .get()
        .catch(function () { return { forEach: function () {} }; })
    );

    return Promise.all(queries).then(function (snapshots) {
      var results = [];
      var seenIds = {};

      snapshots.forEach(function (snapshot) {
        snapshot.forEach(function (doc) {
          if (seenIds[doc.id]) return;
          seenIds[doc.id] = true;
          var d = doc.data();
          d._id = doc.id;
          results.push(d);
        });
      });

      if (workType) {
        var workTypeLower = workType.toLowerCase();
        results.sort(function (a, b) {
          var aMatch = (a.tags || []).some(function (t) { return t.toLowerCase().indexOf(workTypeLower) !== -1; });
          var bMatch = (b.tags || []).some(function (t) { return t.toLowerCase().indexOf(workTypeLower) !== -1; });
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return 0;
        });
      }

      if (results.length) {
        saveKnowledgeCache("relevant", relevantKey, results);
        return results;
      }
      return isOnline() ? results : cached;
    }).catch(function () {
      return cached;
    });
  }

  /* ── UI: Teaching button + capture modal ──────────────────────── */

  var _teachingModalOpen = false;

  function getTeachBtn() {
    return document.getElementById("ct-teaching-btn");
  }

  function getKnowledgePanel() {
    return document.getElementById("ct-knowledge-panel");
  }

  function wireTeachBtn() {
    var btn = getTeachBtn();
    if (!btn) return;
    if (btn.dataset.vcWired === "1") return;
    btn.dataset.vcWired = "1";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openTeachingModal();
    });
  }

  function openTeachingModal() {
    if (_teachingModalOpen) return;
    _teachingModalOpen = true;

    var ticket = getActiveTicket();
    var customerName = ticket ? String(ticket.customerName || "").trim() : "";
    var locationAddress = ticket ? String(ticket.locationAddress || "").trim() : "";

    var overlay = document.createElement("div");
    overlay.className = "ct-teaching-overlay";
    overlay.setAttribute("aria-hidden", "true");

    var modal = document.createElement("div");
    modal.className = "ct-teaching-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Save teaching note");

    modal.innerHTML =
      '<div class="ct-teaching-modal__header">' +
        '<p class="ct-teaching-modal__title">💡 Teach</p>' +
        '<button type="button" class="ct-teaching-modal__close" aria-label="Close">✕</button>' +
      '</div>' +
      '<div class="ct-teaching-modal__body">' +
        '<label class="ct-teaching-label">Scope</label>' +
        '<select class="ct-teaching-select" id="ct-teaching-scope">' +
          '<option value="site">Site-specific</option>' +
          '<option value="equipment">Equipment-specific</option>' +
          '<option value="model">Model-specific</option>' +
          '<option value="company">Company-wide</option>' +
        '</select>' +
        '<label class="ct-teaching-label">Reference</label>' +
        '<input type="text" class="ct-teaching-input" id="ct-teaching-ref" placeholder="e.g. RTU6, Honeywell 8000, site name…" />' +
        '<label class="ct-teaching-label">Teaching note</label>' +
        '<textarea class="ct-teaching-textarea" id="ct-teaching-text" rows="4" placeholder="Explain the procedure, tip, or quirk…"></textarea>' +
        '<label class="ct-teaching-label">Tags (comma-separated)</label>' +
        '<input type="text" class="ct-teaching-input" id="ct-teaching-tags" placeholder="PM, economizer, wiring…" />' +
        '<label class="ct-teaching-label">Media</label>' +
        '<div class="ct-teaching-media-row">' +
          '<button type="button" class="ct-teaching-media-btn" id="ct-teaching-photo-btn">📷 Photo</button>' +
          '<button type="button" class="ct-teaching-media-btn" id="ct-teaching-video-btn">🎥 Video</button>' +
          '<button type="button" class="ct-teaching-media-btn" id="ct-teaching-voice-btn">🎙️ Voice</button>' +
        '</div>' +
        '<div class="ct-teaching-media-preview" id="ct-teaching-media-preview"></div>' +
      '</div>' +
      '<div class="ct-teaching-modal__footer">' +
        '<button type="button" class="ct-teaching-save-btn" id="ct-teaching-save">Save Teaching Note</button>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    var scopeSelect = modal.querySelector("#ct-teaching-scope");
    var refInput = modal.querySelector("#ct-teaching-ref");

    if (customerName && locationAddress) {
      refInput.value = customerName + " | " + locationAddress;
    }

    try {
      if (window.JobContextEngine && typeof window.JobContextEngine.getActiveEquipment === "function") {
        var ae = window.JobContextEngine.getActiveEquipment();
        if (ae && (ae.model || ae.brand)) {
          scopeSelect.value = "equipment";
          refInput.value = ((ae.brand || "") + " " + (ae.model || ae.modelNumber || "")).trim();
        }
      }
    } catch (e) {}

    var selectedFiles = [];

    function addFileInput(accept, capture) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      if (capture) input.setAttribute("capture", capture);
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", function () {
        if (input.files && input.files.length) {
          for (var i = 0; i < input.files.length; i++) {
            selectedFiles.push(input.files[i]);
          }
          updateMediaPreview();
        }
        document.body.removeChild(input);
      });
      input.click();
    }

    function updateMediaPreview() {
      var preview = modal.querySelector("#ct-teaching-media-preview");
      if (!preview) return;
      if (!selectedFiles.length) {
        preview.innerHTML = "";
        return;
      }
      preview.innerHTML = selectedFiles.map(function (f, idx) {
        var icon = f.type.indexOf("video") !== -1 ? "🎥" :
                   f.type.indexOf("audio") !== -1 ? "🎙️" : "📷";
        return '<span class="ct-teaching-media-tag">' + icon + " " +
          f.name.slice(0, 20) +
          '<button type="button" data-idx="' + idx + '" class="ct-teaching-media-remove">✕</button></span>';
      }).join("");

      preview.querySelectorAll(".ct-teaching-media-remove").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.dataset.idx, 10);
          selectedFiles.splice(idx, 1);
          updateMediaPreview();
        });
      });
    }

    modal.querySelector("#ct-teaching-photo-btn").addEventListener("click", function () {
      addFileInput("image/*", null);
    });
    modal.querySelector("#ct-teaching-video-btn").addEventListener("click", function () {
      addFileInput("video/*", "environment");
    });
    modal.querySelector("#ct-teaching-voice-btn").addEventListener("click", function () {
      addFileInput("audio/*", null);
    });

    modal.querySelector("#ct-teaching-save").addEventListener("click", function () {
      var scope = scopeSelect.value;
      var scopeRef = refInput.value.trim();
      var text = modal.querySelector("#ct-teaching-text").value.trim();
      var tagsRaw = modal.querySelector("#ct-teaching-tags").value.trim();
      var tags = tagsRaw ? tagsRaw.split(",").map(function (t) { return t.trim(); }).filter(Boolean) : [];

      if (!text && !selectedFiles.length) {
        modal.querySelector("#ct-teaching-text").style.borderColor = "#f87171";
        return;
      }

      var saveBtn = modal.querySelector("#ct-teaching-save");
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      saveTeaching({
        scope: scope,
        scopeRef: scopeRef,
        text: text,
        tags: tags,
        files: selectedFiles,
        mediaUrls: []
      }).then(function () {
        closeTeachingModal(overlay, modal);
        showToast("💡 Teaching note saved!");
      }).catch(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Teaching Note";
        showToast("⚠️ Save failed — queued offline.");
      });
    });

    function closeHandler() {
      closeTeachingModal(overlay, modal);
    }

    modal.querySelector(".ct-teaching-modal__close").addEventListener("click", closeHandler);
    overlay.addEventListener("click", closeHandler);
  }

  function closeTeachingModal(overlay, modal) {
    _teachingModalOpen = false;
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
  }

  function showToast(msg) {
    var toast = document.createElement("div");
    toast.className = "ct-teaching-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.classList.add("ct-teaching-toast--visible");
    }, 30);
    setTimeout(function () {
      toast.classList.remove("ct-teaching-toast--visible");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2500);
  }

  /* ── UI: Knowledge panel (contextual surfacing) ───────────────── */

  var _knowledgePanelExpanded = false;

  function showKnowledgeChip(count) {
    var panel = getKnowledgePanel();
    if (!panel) return;
    panel.innerHTML = "";
    panel.removeAttribute("hidden");

    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ct-knowledge-chip";
    chip.textContent = "💡 " + count + " tip" + (count !== 1 ? "s" : "") + " available";
    chip.setAttribute("aria-label", count + " teaching tips available for this job");
    chip.addEventListener("click", function () {
      toggleKnowledgePanel();
    });
    panel.appendChild(chip);
  }

  function hideKnowledgePanel() {
    var panel = getKnowledgePanel();
    if (!panel) return;
    panel.innerHTML = "";
    panel.setAttribute("hidden", "");
    _knowledgePanelExpanded = false;
  }

  function toggleKnowledgePanel() {
    if (_knowledgePanelExpanded) {
      collapseKnowledgePanel();
    } else {
      expandKnowledgePanel();
    }
  }

  function expandKnowledgePanel() {
    _knowledgePanelExpanded = true;
    var panel = getKnowledgePanel();
    if (!panel) return;

    panel.innerHTML = '<div class="ct-knowledge-loading">Loading tips…</div>';

    getRelevantKnowledge({}).then(function (items) {
      renderKnowledgeItems(panel, items);
    }).catch(function () {
      panel.innerHTML = '<p class="ct-knowledge-empty">Unable to load tips.</p>';
    });
  }

  function collapseKnowledgePanel() {
    _knowledgePanelExpanded = false;
    var panel = getKnowledgePanel();
    if (!panel || !panel._lastCount) {
      hideKnowledgePanel();
      return;
    }
    showKnowledgeChip(panel._lastCount);
  }

  function renderKnowledgeItems(panel, items) {
    if (!items || !items.length) {
      panel.innerHTML = '<p class="ct-knowledge-empty">No tips found for this context.</p>';
      return;
    }

    var header = '<div class="ct-knowledge-header">' +
      '<span class="ct-knowledge-header__title">💡 Knowledge Tips</span>' +
      '<button type="button" class="ct-knowledge-header__close" aria-label="Collapse tips panel">▾</button>' +
      '</div>';

    var itemsHtml = items.map(function (item) {
      var scopeBadge = '<span class="ct-knowledge-scope ct-knowledge-scope--' + (item.scope || "company") + '">' +
        (item.scope || "company") + '</span>';
      var mediaCount = (item.mediaUrls && item.mediaUrls.length) ? ' <span class="ct-knowledge-media-count">📎 ' + item.mediaUrls.length + '</span>' : "";
      var tagsHtml = (item.tags && item.tags.length) ? '<div class="ct-knowledge-tags">' +
        item.tags.map(function (t) { return '<span class="ct-knowledge-tag">' + escapeHtml(t) + '</span>'; }).join("") +
        '</div>' : "";

      return '<div class="ct-knowledge-item">' +
        '<div class="ct-knowledge-item__head">' + scopeBadge + mediaCount + '</div>' +
        '<p class="ct-knowledge-item__text">' + escapeHtml(item.text || "(media only)") + '</p>' +
        tagsHtml +
        '<p class="ct-knowledge-item__meta">' + escapeHtml(item.createdBy || "") + ' · ' + formatRelativeTime(item.timestamp) + '</p>' +
        (item.mediaUrls && item.mediaUrls.length ? renderMediaThumbs(item.mediaUrls) : "") +
        '</div>';
    }).join("");

    panel.innerHTML = header + '<div class="ct-knowledge-list">' + itemsHtml + '</div>';

    var closeBtn = panel.querySelector(".ct-knowledge-header__close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        collapseKnowledgePanel();
      });
    }
  }

  function renderMediaThumbs(urls) {
    if (!urls || !urls.length) return "";
    var thumbs = urls.slice(0, 4).map(function (url) {
      if (/\.(mp4|webm|mov)/i.test(url)) {
        return '<span class="ct-knowledge-thumb ct-knowledge-thumb--video">🎥</span>';
      }
      if (/\.(mp3|ogg|wav|m4a|webm)/i.test(url)) {
        return '<span class="ct-knowledge-thumb ct-knowledge-thumb--audio">🎙️</span>';
      }
      return '<img class="ct-knowledge-thumb" src="' + escapeAttr(url) + '" alt="Teaching media" loading="lazy" />';
    }).join("");
    return '<div class="ct-knowledge-thumbs">' + thumbs + '</div>';
  }

  function escapeHtml(str) {
    var el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function formatRelativeTime(ts) {
    if (!ts) return "";
    try {
      var d = new Date(ts);
      var diff = Date.now() - d.getTime();
      var mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return mins + "m ago";
      var hours = Math.floor(mins / 60);
      if (hours < 24) return hours + "h ago";
      var days = Math.floor(hours / 24);
      if (days < 30) return days + "d ago";
      return d.toLocaleDateString();
    } catch (e) {
      return "";
    }
  }

  /* ── workspace open hook ──────────────────────────────────────── */

  function onWorkspaceOpen() {
    if (!isEnabled()) return;

    wireTeachBtn();
    flushOfflineQueue();

    if (!isOnline()) {
      hideKnowledgePanel();
      return;
    }

    var tid = getTenantId();
    if (!tid) return;

    getRelevantKnowledge({}).then(function (items) {
      var panel = getKnowledgePanel();
      if (!items || !items.length) {
        hideKnowledgePanel();
        return;
      }
      if (panel) panel._lastCount = items.length;
      showKnowledgeChip(items.length);
    }).catch(function () {
      hideKnowledgePanel();
    });
  }

  /* ── init ─────────────────────────────────────────────────────── */

  function init() {
    if (!isEnabled()) return;

    wireTeachBtn();

    try {
      window.addEventListener("vc:workspaceOpened", function () {
        onWorkspaceOpen();
      });
    } catch (e) {}

    window.addEventListener("online", function () {
      flushOfflineQueue();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ── exports ──────────────────────────────────────────────────── */

  window.TeachingLayer = {
    saveTeaching: saveTeaching,
    findTeaching: findTeaching,
    lookupKnowledge: lookupKnowledge,
    getRelevantKnowledge: getRelevantKnowledge,
    onWorkspaceOpen: onWorkspaceOpen
  };
})();
