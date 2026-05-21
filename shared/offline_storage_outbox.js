/**
 * Offline Storage Outbox — IndexedDB-backed queue for Firebase Storage uploads
 * that fail while the device is offline or connectivity is poor.
 *
 * API:
 *   VCStorageOutbox.enqueue(storagePath, blob, metadata) → Promise<void>
 *   VCStorageOutbox.drain()                              → Promise<void>
 *   VCStorageOutbox.getPendingCount()                    → Promise<number>
 *
 * Auto-drains on window 'online' event and document 'visibilitychange' (foreground).
 * UI: #vcPendingSyncChip — pill showing pending count, pulses while draining, hides when empty.
 *
 * Uses its own IDB database (VCStorageOutboxDB v1) so it never conflicts with
 * equipment_manager.js TwinPillarsOfflineDB.
 *
 * ADR-012 reference: PROJECT_STATUS/DECISIONS.md
 */
(function () {
  "use strict";

  var DB_NAME    = "VCStorageOutboxDB";
  var DB_VERSION = 1;
  var STORE      = "storageOutbox";

  var _draining      = false;
  var _chipReady     = false;

  /* ── Context hooks ───────────────────────────────────────────────── */
  /* Modules register a callback here so drain() can patch the Firestore
     doc with the download URL after a queued upload succeeds.          */
  var _hooks = {};

  /* ── IndexedDB helpers ───────────────────────────────────────────── */

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror   = function () { reject(req.error); };
      req.onsuccess = function () { resolve(req.result); };
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
    });
  }

  function dbPut(record) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx    = db.transaction(STORE, "readwrite");
        tx.onerror    = function () { reject(tx.error); };
        tx.oncomplete = function () { resolve(); };
        tx.objectStore(STORE).put(record);
      });
    });
  }

  function dbGetAll() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror   = function () { reject(req.error); };
      });
    });
  }

  function dbDelete(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.onerror    = function () { reject(tx.error); };
        tx.oncomplete = function () { resolve(); };
        tx.objectStore(STORE).delete(id);
      });
    });
  }

  function dbCount() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).count();
        req.onsuccess = function () { resolve(req.result || 0); };
        req.onerror   = function () { reject(req.error); };
      });
    });
  }

  /* ── UI chip ─────────────────────────────────────────────────────── */

  function ensureChipStyles() {
    if (document.getElementById("vcPendingSyncChipCss")) return;
    var style      = document.createElement("style");
    style.id       = "vcPendingSyncChipCss";
    style.textContent = [
      "#vcPendingSyncChip {",
      "  position: fixed; bottom: 72px; right: 16px; z-index: 9100;",
      "  display: none; align-items: center; gap: 6px;",
      "  background: #b45309; color: #fff; border-radius: 20px;",
      "  padding: 6px 14px; font-size: 13px; font-weight: 600;",
      "  box-shadow: 0 2px 10px rgba(0,0,0,0.45); cursor: default;",
      "  user-select: none; -webkit-user-select: none;",
      "  transition: background 0.3s, opacity 0.3s;",
      "  min-height: 36px;",
      "}",
      "#vcPendingSyncChip.vc-chip-visible { display: flex; }",
      "#vcPendingSyncChip.vc-chip-draining {",
      "  animation: vcChipPulse 1s ease-in-out infinite;",
      "}",
      "#vcPendingSyncChip.vc-chip-done { background: #15803d; }",
      "@keyframes vcChipPulse {",
      "  0%,100% { opacity: 1; } 50% { opacity: 0.55; }",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensureChipElement() {
    if (document.getElementById("vcPendingSyncChip")) return;
    var chip = document.createElement("div");
    chip.id = "vcPendingSyncChip";
    chip.setAttribute("role", "status");
    chip.setAttribute("aria-live", "polite");
    document.body.appendChild(chip);
    _chipReady = true;
  }

  function ensureChip() {
    ensureChipStyles();
    ensureChipElement();
  }

  function updateChip(count, draining) {
    ensureChip();
    var chip = document.getElementById("vcPendingSyncChip");
    if (!chip) return;

    if (!draining && count <= 0) {
      chip.classList.remove("vc-chip-visible", "vc-chip-draining", "vc-chip-done");
      chip.style.display = "none";
      return;
    }

    chip.style.display = "";
    chip.classList.add("vc-chip-visible");

    if (draining) {
      chip.classList.add("vc-chip-draining");
      chip.classList.remove("vc-chip-done");
      chip.textContent = "\u23F3 Syncing " + count + " photo" + (count !== 1 ? "s" : "") + "\u2026";
    } else {
      chip.classList.remove("vc-chip-draining", "vc-chip-done");
      chip.textContent = "\u23F3 " + count + " photo" + (count !== 1 ? "s" : "") + " pending sync";
    }
  }

  function flashDone() {
    ensureChip();
    var chip = document.getElementById("vcPendingSyncChip");
    if (!chip) return;
    chip.style.display = "";
    chip.classList.add("vc-chip-visible", "vc-chip-done");
    chip.classList.remove("vc-chip-draining");
    chip.textContent = "\u2713 Photos synced";
    setTimeout(function () {
      if (!chip) return;
      chip.classList.remove("vc-chip-visible", "vc-chip-done");
      chip.style.display = "none";
    }, 1500);
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  /**
   * registerHook(hookName, callbackFn)
   * Registers a callback invoked after a queued upload successfully drains.
   * The callback receives (downloadUrl, payload) and should patch Firestore.
   * Must be called before drain() runs (i.e. at module load time).
   * @param {string}   hookName   Name matching hookContext.hook in enqueue()
   * @param {Function} callbackFn Called with (url: string, payload: Object)
   */
  function registerHook(hookName, callbackFn) {
    if (typeof hookName === "string" && typeof callbackFn === "function") {
      _hooks[hookName] = callbackFn;
    }
  }

  /**
   * enqueue(storagePath, blob, metadata, hookContext)
   * Stores a failed upload in IDB for retry when connectivity returns.
   * @param {string} storagePath  Firebase Storage path (ref.fullPath)
   * @param {Blob}   blob         The file/blob to upload
   * @param {Object} metadata     Upload metadata (e.g. { contentType: "image/jpeg" })
   * @param {Object} [hookContext] Optional: { hook: "hookName", payload: {...} }
   *                               After a successful drain, the named hook callback
   *                               is called with (downloadUrl, payload) so callers
   *                               can patch the Firestore doc with the URL.
   * @returns {Promise<void>}
   */
  function enqueue(storagePath, blob, metadata, hookContext) {
    var id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    var record = {
      id:          id,
      storagePath: storagePath,
      blob:        blob,
      metadata:    metadata || {},
      hookContext:  hookContext || null,
      addedAt:     new Date().toISOString(),
      status:      "pending",
      attempts:    0,
    };
    return dbPut(record)
      .then(function () {
        return getPendingCount();
      })
      .then(function (n) {
        updateChip(n, false);
        console.info("[VCStorageOutbox] queued:", storagePath, "(total pending:", n + ")");
      })
      .catch(function (err) {
        console.warn("[VCStorageOutbox] enqueue failed:", err);
      });
  }

  /**
   * drain()
   * Attempts to upload all pending items in the outbox.
   * Safe to call multiple times; re-entrant calls are no-ops.
   * @returns {Promise<void>}
   */
  function drain() {
    if (_draining) return Promise.resolve();
    if (typeof firebase === "undefined" || !firebase.storage) {
      return Promise.resolve();
    }

    _draining = true;

    return dbGetAll()
      .then(function (items) {
        var pending = items.filter(function (r) { return r.status === "pending"; });
        if (!pending.length) {
          _draining = false;
          return getPendingCount().then(function (n) { updateChip(n, false); });
        }

        updateChip(pending.length, true);

        // Upload serially — avoids hammering Storage on a weak signal.
        var chain = Promise.resolve();
        pending.forEach(function (rec) {
          chain = chain.then(function () {
            if (!navigator.onLine) return; // abort if went offline mid-drain
            var ref = firebase.storage().ref().child(rec.storagePath);
            return ref.put(rec.blob, rec.metadata || {})
              .then(function () {
                return ref.getDownloadURL();
              })
              .then(function (downloadUrl) {
                /* Invoke the registered hook so callers can patch Firestore. */
                if (rec.hookContext && rec.hookContext.hook && _hooks[rec.hookContext.hook]) {
                  try {
                    _hooks[rec.hookContext.hook](downloadUrl, rec.hookContext.payload || {});
                  } catch (hookErr) {
                    console.warn("[VCStorageOutbox] hook error:", rec.hookContext.hook, hookErr);
                  }
                }
                return dbDelete(rec.id);
              })
              .then(function () {
                console.info("[VCStorageOutbox] drained:", rec.storagePath);
              })
              .catch(function (err) {
                console.warn("[VCStorageOutbox] drain upload failed:", rec.storagePath, err);
              });
          });
        });
        return chain;
      })
      .then(function () {
        _draining = false;
        return getPendingCount().then(function (n) {
          if (n === 0) {
            flashDone();
          } else {
            updateChip(n, false);
          }
        });
      })
      .catch(function (err) {
        _draining = false;
        console.warn("[VCStorageOutbox] drain error:", err);
      });
  }

  /**
   * getPendingCount()
   * @returns {Promise<number>} number of items currently waiting to upload
   */
  function getPendingCount() {
    return dbCount().catch(function () { return 0; });
  }

  /* ── Auto-drain hooks ────────────────────────────────────────────── */

  window.addEventListener("online", function () {
    console.info("[VCStorageOutbox] online — draining outbox");
    drain();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && navigator.onLine) {
      drain();
    }
  });

  /* Boot: surface any leftover queue from a previous session */
  setTimeout(function () {
    ensureChip();
    getPendingCount().then(function (n) {
      if (n > 0) {
        updateChip(n, false);
        if (navigator.onLine) {
          drain();
        }
      }
    });
  }, 0);

  /* ── Module identity ─────────────────────────────────────────────── */

  console.info("[VC] offline_storage_outbox v=2 loaded");
  window.__VC_OFFLINE_OUTBOX_VERSION = 2;

  window.VCStorageOutbox = {
    enqueue:         enqueue,
    drain:           drain,
    getPendingCount: getPendingCount,
    registerHook:    registerHook,
  };
}());
