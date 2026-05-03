/**
 * Active job workspace UI: Site Intel (Firebase site_intelligence), header affordances.
 * Inter-office site notes; does not depend on UFX.
 * Office Override iframe (?forceTicketId=&office_override=1): banner + routing live in technician/index.html; Shadow viewer uses ?vc_shadow_viewer=1 only.
 */
(function () {
  "use strict";

  var siteIntelUnsub = null;
  var lastIntelDocId = "";

  /**
   * Phase 34e — in-memory state for the open Site Intel modal session.
   * `_siteIntelCurrentPhotos` holds the live `accessPhotoUrls` array; mutated by add/delete/caption
   * flows then re-rendered. Cleared on every `openSiteIntelModal` so a stale session never leaks
   * across two different sites.
   */
  var _siteIntelCurrentPhotos = [];
  var _siteIntelCurrentDocId = "";

  function techName() {
    try {
      return String(localStorage.getItem("tp_saved_tech") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function locationLineFromDom() {
    var loc = document.getElementById("location");
    if (loc && String(loc.value || "").trim()) {
      return String(loc.value).trim();
    }
    if (typeof activeTicket !== "undefined" && activeTicket) {
      var cn = String(activeTicket.customerName || "").trim();
      var ad = String(activeTicket.locationAddress || "").trim();
      if (cn && ad) return cn + " - " + ad;
      return cn || ad || "";
    }
    return "";
  }

  /**
   * Phase 34e — lazy-inject CSS for the Access Photos grid + controls. Same pattern as the Phase 32a
   * consent button (`ensureConsentButtonInDom`): keep the styles next to the cache-busted JS so a
   * stale browser-cached `technician/index.html` cannot break the new UI.
   */
  function injectSiteIntelStyles() {
    if (document.getElementById("vcSiteIntelInjectedCss")) return;
    var st = document.createElement("style");
    st.id = "vcSiteIntelInjectedCss";
    st.textContent = [
      ".vc-site-intel-photos { margin-top: 16px; padding-top: 14px; border-top: 1px solid #e5e7eb; }",
      ".vc-site-intel-photos > label { display: block; font-size: 12px; font-weight: 700; color: #555; margin-bottom: 6px; }",
      ".vc-site-intel-photos-hint { font-size: 12px; color: #7f8c8d; margin: 0 0 10px 0; line-height: 1.4; }",
      ".vc-site-intel-photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; margin-bottom: 10px; }",
      ".vc-site-intel-photo-tile { position: relative; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; display: flex; flex-direction: column; gap: 6px; }",
      ".vc-site-intel-photo-tile img { width: 100%; height: 90px; object-fit: cover; border-radius: 6px; cursor: pointer; background: #f1f5f9; display: block; }",
      ".vc-site-intel-photo-caption { width: 100%; font-size: 12px; padding: 6px 8px; border: 1px solid #d1d9e0; border-radius: 4px; background: #fff; color: #2c3e50; box-sizing: border-box; font-family: inherit; }",
      ".vc-site-intel-photo-caption:focus { outline: none; border-color: #0ea5e9; box-shadow: 0 0 0 2px rgba(14,165,233,0.2); }",
      ".vc-site-intel-photo-delete { position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; border-radius: 50%; border: none; background: rgba(220,38,38,0.95); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; line-height: 1; padding: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; }",
      ".vc-site-intel-photo-delete:hover { background: #dc2626; }",
      ".vc-site-intel-photos__empty { color: #95a5a6; font-size: 12px; padding: 12px 4px; font-style: italic; text-align: center; }",
      ".vc-site-intel-add-photo-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 8px; border: 1px solid #0ea5e9; background: #fff; color: #0ea5e9; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; }",
      ".vc-site-intel-add-photo-btn:hover { background: #f0f9ff; }",
      ".vc-site-intel-add-photo-btn:disabled { opacity: 0.6; cursor: wait; }"
    ].join("\n");
    document.head.appendChild(st);
  }

  function ensureSiteIntelModal() {
    var existing = document.getElementById("vcSiteIntelModal");
    if (existing) return existing;
    injectSiteIntelStyles();
    var wrap = document.createElement("div");
    wrap.id = "vcSiteIntelModal";
    wrap.className = "vc-modal hidden";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "vcSiteIntelTitle");
    wrap.innerHTML =
      '<div class="vc-modal-backdrop" data-vc-site-intel-close="1"></div>' +
      '<div class="vc-modal-sheet">' +
      '<div class="vc-modal-head">' +
      '<h2 id="vcSiteIntelTitle">Site Intel</h2>' +
      '<button type="button" class="vc-modal-close" data-vc-site-intel-close="1" aria-label="Close">&times;</button>' +
      "</div>" +
      '<p class="vc-modal-hint">Persistent notes for this site (ladder access, roof hatch, lock codes the office should know). Add photos of access issues or processes for future technicians. Same notes apply to every ticket at this address.</p>' +
      '<p id="vcSiteIntelLocationLabel" class="vc-site-intel-location"></p>' +
      '<label for="vcSiteIntelBody">Field Access Notes</label>' +
      '<textarea id="vcSiteIntelBody" rows="8" placeholder="Roof access: east ladder. Lock code: 1234. Use west door after 6pm…"></textarea>' +
      '<label for="vcSiteIntelInterOfficeBody" style="margin-top:10px;">Technician Notes (Inter-Office)</label>' +
      '<textarea id="vcSiteIntelInterOfficeBody" rows="5" readonly style="background:#f8fafc;color:#334155;" placeholder="Latest technician inter-office notes for this customer/site appear here after Complete & Sync."></textarea>' +
      '<div class="vc-site-intel-photos">' +
        '<label>Access Photos</label>' +
        '<p class="vc-site-intel-photos-hint">Pictures of access issues or processes for future technicians (ladder placement, key locations, hatch routes, etc.)</p>' +
        '<div id="vcSiteIntelPhotosGrid" class="vc-site-intel-photos-grid"></div>' +
        '<input type="file" id="vcSiteIntelPhotoInput" accept="image/*" multiple style="display:none" />' +
        '<button type="button" id="vcSiteIntelAddPhotoBtn" class="vc-site-intel-add-photo-btn">📷 Add photo</button>' +
        '<p id="vcSiteIntelPhotoStatus" class="vc-modal-status" aria-live="polite"></p>' +
      "</div>" +
      '<div class="vc-modal-actions">' +
      '<button type="button" class="btn btn-primary" id="vcSiteIntelSaveBtn">Save</button>' +
      "</div>" +
      '<p id="vcSiteIntelStatus" class="vc-modal-status" aria-live="polite"></p>' +
      "</div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-vc-site-intel-close")) {
        wrap.classList.add("hidden");
      }
    });
    document.getElementById("vcSiteIntelSaveBtn").addEventListener("click", saveSiteIntelFromModal);
    var addBtn = document.getElementById("vcSiteIntelAddPhotoBtn");
    var fileInp = document.getElementById("vcSiteIntelPhotoInput");
    if (addBtn && fileInp) {
      addBtn.addEventListener("click", function () { fileInp.click(); });
      fileInp.addEventListener("change", function () {
        if (fileInp.files && fileInp.files.length) {
          handleSiteIntelPhotoFiles(fileInp.files);
          fileInp.value = "";
        }
      });
    }
    wireSiteIntelPhotoGridEvents();
    return wrap;
  }

  function siteIntelDocRef() {
    var line = locationLineFromDom();
    if (!line || !window.DataProvider || typeof DataProvider.siteIntelDocIdFromLocationLine !== "function") {
      return null;
    }
    var docId = DataProvider.siteIntelDocIdFromLocationLine(line);
    if (!docId || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return null;
    var _db = firebase.firestore();
    var _si =
      typeof VCFirestore !== "undefined"
        ? VCFirestore.siteIntelligence(_db)
        : _db.collection("site_intelligence");
    return { docId: docId, line: line, ref: _si.doc(docId) };
  }

  function setSiteIntelButtonState(hasNotes) {
    var btn = document.getElementById("wsSiteIntelBtn");
    if (!btn) return;
    btn.classList.toggle("site-intel--has-data", !!hasNotes);
  }

  function teardownSiteIntelListener() {
    if (typeof siteIntelUnsub === "function") {
      siteIntelUnsub();
      siteIntelUnsub = null;
    }
    lastIntelDocId = "";
  }

  function subscribeSiteIntelPulse() {
    teardownSiteIntelListener();
    var meta = siteIntelDocRef();
    if (!meta) {
      setSiteIntelButtonState(false);
      return;
    }
    lastIntelDocId = meta.docId;
    var _db = firebase.firestore();
    if (typeof VCFirestore !== "undefined" && VCFirestore.subscribeSiteIntelDocMerged) {
      siteIntelUnsub = VCFirestore.subscribeSiteIntelDocMerged(
        _db,
        meta.docId,
        function (notes) {
          setSiteIntelButtonState(String(notes || "").trim().length > 0);
        },
        function () {
          setSiteIntelButtonState(false);
        }
      );
    } else {
      siteIntelUnsub = meta.ref.onSnapshot(
        function (snap) {
          var notes = snap.exists && snap.data() ? String(snap.data().notes || "").trim() : "";
          setSiteIntelButtonState(notes.length > 0);
        },
        function () {
          setSiteIntelButtonState(false);
        }
      );
    }
  }

  function openSiteIntelModal(prefillLine) {
    var modal = ensureSiteIntelModal();
    var line = prefillLine != null ? String(prefillLine).trim() : locationLineFromDom();
    document.getElementById("vcSiteIntelLocationLabel").textContent = line || "—";
    document.getElementById("vcSiteIntelStatus").textContent = "";
    var photoStatus = document.getElementById("vcSiteIntelPhotoStatus");
    if (photoStatus) photoStatus.textContent = "";
    var body = document.getElementById("vcSiteIntelBody");
    var interOfficeBody = document.getElementById("vcSiteIntelInterOfficeBody");
    body.value = "";
    if (interOfficeBody) interOfficeBody.value = "";
    _siteIntelCurrentPhotos = [];
    _siteIntelCurrentDocId = "";
    renderSiteIntelPhotosGrid([]);

    if (!line || !window.DataProvider) {
      modal.classList.remove("hidden");
      return;
    }
    var docId = DataProvider.siteIntelDocIdFromLocationLine(line);
    if (!docId || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      modal.classList.remove("hidden");
      return;
    }
    _siteIntelCurrentDocId = docId;
    var _dbOpen = firebase.firestore();
    var load =
      typeof VCFirestore !== "undefined" && VCFirestore.getSiteIntelDocOnceBridged
        ? VCFirestore.getSiteIntelDocOnceBridged(_dbOpen, docId)
        : (typeof VCFirestore !== "undefined"
            ? VCFirestore.siteIntelligence(_dbOpen)
            : _dbOpen.collection("site_intelligence")
          )
            .doc(docId)
            .get()
            .then(function (snap) {
              return {
                exists: snap.exists,
                data: snap.exists ? snap.data() : null,
              };
            });
    load
      .then(function (got) {
        var d = got && got.exists && got.data ? got.data : {};
        body.value = String(d.notes || "");
        if (interOfficeBody) {
          interOfficeBody.value = String(d.technicianInterOfficeNotes || "");
        }
        var rawPhotos = Array.isArray(d.accessPhotoUrls) ? d.accessPhotoUrls : [];
        _siteIntelCurrentPhotos = rawPhotos
          .map(function (p) {
            return {
              url: String((p && p.url) || ""),
              storagePath: String((p && p.storagePath) || ""),
              caption: String((p && p.caption) || ""),
              addedBy: String((p && p.addedBy) || ""),
              addedAt: String((p && p.addedAt) || ""),
            };
          })
          .filter(function (p) {
            return p.url;
          });
        renderSiteIntelPhotosGrid(_siteIntelCurrentPhotos);
        modal.classList.remove("hidden");
      })
      .catch(function () {
        modal.classList.remove("hidden");
      });
  }

  function saveSiteIntelFromModal() {
    /* Flush any focused photo-caption input first so its `change` listener fires before we save.
       If we don't, a tech can type a caption and click Save without blurring the input — the typed
       value is lost. We blur, wait one tick, then continue. */
    var ae = document.activeElement;
    var needsCaptionFlush =
      ae && ae.classList && ae.classList.contains("vc-site-intel-photo-caption");
    if (needsCaptionFlush) {
      ae.blur();
    }
    var run = function () {
      var modal = document.getElementById("vcSiteIntelModal");
      var line = document.getElementById("vcSiteIntelLocationLabel").textContent.trim();
      if (line === "—") line = locationLineFromDom();
      var body = document.getElementById("vcSiteIntelBody");
      var status = document.getElementById("vcSiteIntelStatus");
      if (!line || !body) {
        if (status) status.textContent = "Set location first.";
        return;
      }
      if (!window.DataProvider || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
        if (status) status.textContent = "Firebase not available.";
        return;
      }
      var docId = DataProvider.siteIntelDocIdFromLocationLine(line);
      var nk = DataProvider.normalizeLocationKey(line);
      var payload = {
        locationDisplay: line,
        normalizedKey: nk,
        notes: body.value || "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedByTech: techName(),
      };
      status.textContent = "Saving…";
      var _dbSave = firebase.firestore();
      var savePromise =
        typeof VCFirestore !== "undefined" && VCFirestore.setSiteIntelMerged
          ? VCFirestore.setSiteIntelMerged(_dbSave, docId, payload, true)
          : (typeof VCFirestore !== "undefined"
              ? VCFirestore.siteIntelligence(_dbSave)
              : _dbSave.collection("site_intelligence")
            )
              .doc(docId)
              .set(payload, { merge: true });
      savePromise
        .then(function () {
          status.textContent = "Saved.";
          var hasNotes = String(body.value || "").trim().length > 0;
          var hasPhotos = Array.isArray(_siteIntelCurrentPhotos) && _siteIntelCurrentPhotos.length > 0;
          setSiteIntelButtonState(hasNotes || hasPhotos);
          if (modal) modal.classList.add("hidden");
        })
        .catch(function (err) {
          status.textContent = err && err.message ? err.message : "Save failed.";
          if (typeof window.VCSurfaceWriteFailure === "function") {
            window.VCSurfaceWriteFailure("siteIntel:notesSave", err);
          }
        });
    };
    if (needsCaptionFlush) {
      setTimeout(run, 60);
    } else {
      run();
    }
  }

  /**
   * Phase 34e — Site Access Photos.
   * Photos are stored in Firebase Storage at `site_access_photos/{tenantId}/{siteDocId}/{ts}_{name}`
   * and indexed on the `site_intelligence/{siteDocId}` doc as `accessPhotoUrls: Array<{
   *   url, storagePath, caption, addedBy, addedAt
   * }>`. ISO date strings (not serverTimestamp) so `arrayUnion` / `arrayRemove` structural-equality
   * matching works inside arrays. All failure paths funnel through `VCSurfaceWriteFailure` per
   * KI-002 Plan A so the iPhone debug overlay surfaces dropped writes.
   */
  function escapeSiteIntelHtmlAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getSiteIntelTenantId() {
    if (typeof VCFirestore !== "undefined" && typeof VCFirestore.getTenantId === "function") {
      var t = VCFirestore.getTenantId();
      if (t) return String(t);
    }
    if (typeof APP_CONFIG !== "undefined" && APP_CONFIG && APP_CONFIG.tenantId) {
      return String(APP_CONFIG.tenantId);
    }
    return "USA_HEATING_COOLING";
  }

  function siteAccessPhotoStorageBase(siteDocId) {
    return "site_access_photos/" + getSiteIntelTenantId() + "/" + siteDocId + "/";
  }

  function siteIntelDocRefForId(docId) {
    if (!docId || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return null;
    var _db = firebase.firestore();
    return typeof VCFirestore !== "undefined"
      ? VCFirestore.siteIntelligence(_db).doc(docId)
      : _db.collection("site_intelligence").doc(docId);
  }

  function renderSiteIntelPhotosGrid(photos) {
    var grid = document.getElementById("vcSiteIntelPhotosGrid");
    if (!grid) return;
    var arr = Array.isArray(photos) ? photos : [];
    if (!arr.length) {
      grid.innerHTML =
        '<div class="vc-site-intel-photos__empty">No access photos yet. Tap “Add photo” to capture roof access, key locations, hatch routes, etc.</div>';
      return;
    }
    var html = "";
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i] || {};
      var url = String(p.url || "");
      if (!url) continue;
      html +=
        '<div class="vc-site-intel-photo-tile" data-vc-photo-url="' +
        escapeSiteIntelHtmlAttr(url) +
        '">' +
          '<button type="button" class="vc-site-intel-photo-delete" aria-label="Delete photo" data-vc-action="delete" title="Delete photo">×</button>' +
          '<img src="' + escapeSiteIntelHtmlAttr(url) + '" alt="Site access photo" loading="lazy" />' +
          '<input type="text" class="vc-site-intel-photo-caption" maxlength="120" placeholder="Caption…" value="' +
          escapeSiteIntelHtmlAttr(p.caption || "") +
          '" />' +
        "</div>";
    }
    grid.innerHTML = html;
  }

  function uploadSiteIntelPhotoFile(file, siteDocId) {
    if (typeof firebase === "undefined" || !firebase.storage) {
      return Promise.reject(new Error("Cloud storage is not available."));
    }
    var ts = Date.now();
    var orig = String((file && file.name) || "photo.jpg");
    var dot = orig.lastIndexOf(".");
    var ext = dot >= 0 ? orig.slice(dot).toLowerCase().replace(/[^.\w]/g, "") : ".jpg";
    if (!ext || ext === ".") ext = ".jpg";
    var safeBase = orig.replace(/[^\w.\-]+/g, "_").slice(0, 60);
    if (!new RegExp(ext.replace(".", "\\.") + "$", "i").test(safeBase)) {
      safeBase = safeBase + ext;
    }
    var path = siteAccessPhotoStorageBase(siteDocId) + ts + "_" + safeBase;
    var ref = firebase.storage().ref().child(path);
    return ref.put(file, { contentType: (file && file.type) || "image/jpeg" }).then(function () {
      return ref.getDownloadURL().then(function (url) {
        return { url: url, storagePath: path };
      });
    });
  }

  function handleSiteIntelPhotoFiles(fileList) {
    var docId = _siteIntelCurrentDocId;
    var ps = document.getElementById("vcSiteIntelPhotoStatus");
    if (!docId || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      if (ps) ps.textContent = "Open a site first.";
      return;
    }
    var btn = document.getElementById("vcSiteIntelAddPhotoBtn");
    var files = [];
    var max = (fileList && fileList.length) || 0;
    for (var i = 0; i < max; i++) {
      var f = fileList[i];
      if (f && f.size > 0) files.push(f);
    }
    if (!files.length) return;
    if (btn) btn.disabled = true;

    var ref = siteIntelDocRefForId(docId);
    if (!ref) {
      if (ps) ps.textContent = "Firebase not available.";
      if (btn) btn.disabled = false;
      return;
    }

    var line = document.getElementById("vcSiteIntelLocationLabel").textContent.trim();
    if (line === "—") line = locationLineFromDom();
    var nk =
      window.DataProvider && typeof DataProvider.normalizeLocationKey === "function"
        ? DataProvider.normalizeLocationKey(line)
        : "";

    var ok = 0;
    var fail = 0;
    var idx = 0;
    function updateProgress() {
      if (ps) ps.textContent = "Uploading " + (idx + 1) + " of " + files.length + "…";
    }
    function finish() {
      if (btn) btn.disabled = false;
      if (ps) {
        ps.textContent =
          ok + (ok === 1 ? " photo" : " photos") + " uploaded" +
          (fail ? " — " + fail + " failed" : "") + ".";
        setTimeout(function () {
          if (ps && ps.textContent.indexOf("uploaded") !== -1) ps.textContent = "";
        }, 4000);
      }
    }
    function next() {
      if (idx >= files.length) {
        finish();
        return;
      }
      updateProgress();
      var file = files[idx];
      uploadSiteIntelPhotoFile(file, docId)
        .then(function (up) {
          var entry = {
            url: up.url,
            storagePath: up.storagePath,
            caption: "",
            addedBy: techName() || "",
            addedAt: new Date().toISOString(),
          };
          var FV = firebase.firestore.FieldValue;
          var patch = {
            accessPhotoUrls: FV.arrayUnion(entry),
            accessPhotoUpdatedAt: FV.serverTimestamp(),
            locationDisplay: line || "",
            normalizedKey: nk,
          };
          return ref.set(patch, { merge: true }).then(function () {
            _siteIntelCurrentPhotos.push(entry);
            renderSiteIntelPhotosGrid(_siteIntelCurrentPhotos);
            ok++;
          });
        })
        .catch(function (err) {
          fail++;
          if (typeof window.VCSurfaceWriteFailure === "function") {
            window.VCSurfaceWriteFailure("siteIntel:photoUpload", err);
          }
        })
        .then(function () {
          idx++;
          next();
        });
    }
    next();
  }

  function deleteSiteIntelPhoto(photoUrl) {
    var docId = _siteIntelCurrentDocId;
    if (!docId || !photoUrl) return;
    var entry = null;
    for (var i = 0; i < _siteIntelCurrentPhotos.length; i++) {
      if (_siteIntelCurrentPhotos[i].url === photoUrl) {
        entry = _siteIntelCurrentPhotos[i];
        break;
      }
    }
    if (!entry) return;
    if (!window.confirm("Delete this photo? This cannot be undone.")) return;
    var ps = document.getElementById("vcSiteIntelPhotoStatus");
    if (ps) ps.textContent = "Deleting…";
    var ref = siteIntelDocRefForId(docId);
    if (!ref) {
      if (ps) ps.textContent = "Firebase not available.";
      return;
    }
    var FV = firebase.firestore.FieldValue;
    ref
      .set(
        {
          accessPhotoUrls: FV.arrayRemove(entry),
          accessPhotoUpdatedAt: FV.serverTimestamp(),
        },
        { merge: true }
      )
      .then(function () {
        _siteIntelCurrentPhotos = _siteIntelCurrentPhotos.filter(function (p) {
          return p.url !== photoUrl;
        });
        renderSiteIntelPhotosGrid(_siteIntelCurrentPhotos);
        /* Best-effort delete the underlying Storage file. An orphan file is harmless
           (the doc no longer references it); a failed delete shouldn't block the user. */
        if (entry.storagePath && firebase.storage) {
          firebase.storage().ref().child(entry.storagePath).delete().catch(function () {});
        }
        if (ps) {
          ps.textContent = "Photo deleted.";
          setTimeout(function () { if (ps) ps.textContent = ""; }, 3000);
        }
      })
      .catch(function (err) {
        if (ps) ps.textContent = "Delete failed.";
        if (typeof window.VCSurfaceWriteFailure === "function") {
          window.VCSurfaceWriteFailure("siteIntel:photoDelete", err);
        }
      });
  }

  function updateSiteIntelPhotoCaption(photoUrl, newCaption) {
    var docId = _siteIntelCurrentDocId;
    if (!docId || !photoUrl) return;
    var idx = -1;
    for (var i = 0; i < _siteIntelCurrentPhotos.length; i++) {
      if (_siteIntelCurrentPhotos[i].url === photoUrl) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return;
    var current = _siteIntelCurrentPhotos[idx];
    var trimmed = String(newCaption || "").slice(0, 120);
    if (current.caption === trimmed) return;
    var ref = siteIntelDocRefForId(docId);
    if (!ref) return;
    /* arrayRemove(old) + arrayUnion(new) cannot share the same field in one set call (last write
       on the same field wins), so we do a full read-modify-write of `accessPhotoUrls`. The array is
       small (a handful of entries per site) so the extra read is negligible. */
    var newArr = _siteIntelCurrentPhotos.slice();
    newArr[idx] = {
      url: current.url,
      storagePath: current.storagePath,
      caption: trimmed,
      addedBy: current.addedBy,
      addedAt: current.addedAt,
    };
    var FV = firebase.firestore.FieldValue;
    ref
      .set(
        {
          accessPhotoUrls: newArr,
          accessPhotoUpdatedAt: FV.serverTimestamp(),
        },
        { merge: true }
      )
      .then(function () {
        _siteIntelCurrentPhotos = newArr;
      })
      .catch(function (err) {
        if (typeof window.VCSurfaceWriteFailure === "function") {
          window.VCSurfaceWriteFailure("siteIntel:captionUpdate", err);
        }
      });
  }

  function wireSiteIntelPhotoGridEvents() {
    var grid = document.getElementById("vcSiteIntelPhotosGrid");
    if (!grid || grid.dataset.vcWired === "1") return;
    grid.dataset.vcWired = "1";
    grid.addEventListener("click", function (e) {
      var t = e.target;
      var del = t && t.closest ? t.closest("[data-vc-action='delete']") : null;
      if (del) {
        var tile = del.closest(".vc-site-intel-photo-tile");
        var url = tile ? tile.getAttribute("data-vc-photo-url") : "";
        if (url) deleteSiteIntelPhoto(url);
        return;
      }
      var img = t && t.closest ? t.closest("img") : null;
      if (img && img.src) {
        try { window.open(img.src, "_blank", "noopener,noreferrer"); } catch (e2) {}
      }
    });
    grid.addEventListener("change", function (e) {
      var t = e.target;
      var inp = t && t.closest ? t.closest(".vc-site-intel-photo-caption") : null;
      if (!inp) return;
      var tile = inp.closest(".vc-site-intel-photo-tile");
      var url = tile ? tile.getAttribute("data-vc-photo-url") : "";
      if (url) updateSiteIntelPhotoCaption(url, inp.value);
    });
  }

  /**
   * Field evidence default visibility: technician Dictation Hub no longer has a public/internal toggle;
   * new photos default to internal; dispatcher can mark public before client send.
   */
  function getFieldEvidenceDefaultIsPublic() {
    return false;
  }

  /**
   * Reserved hook for imperative workspace locks; Office Override must remain editable.
   * Historical jobs use CSS (`#screen-workspace.is-historical-job .workspace-lock-scope`); bypass via
   * `vc-office-override-unlock` + `ensureOfficeOverrideWorkspaceUnlocked`.
   */
  function lockWorkspaceControls() {
    if (typeof window !== "undefined" && window.VC_OFFICE_OVERRIDE === true) {
      return;
    }
  }

  function ensureOfficeOverrideWorkspaceUnlocked() {
    if (typeof window === "undefined" || window.VC_OFFICE_OVERRIDE !== true) return;
    var ws = document.getElementById("screen-workspace");
    if (ws) ws.classList.add("vc-office-override-unlock");
    var notes = document.getElementById("dictationHubNotes");
    if (notes) {
      notes.removeAttribute("readonly");
      notes.removeAttribute("disabled");
    }
  }

  /** Snapshot from Dispatcher iframe: `postMessage({ type: 'VC_OFFICE_OVERRIDE', active })`. */
  var _vcPostMessageOverrideSnap = null;

  function snapshotInput(el) {
    if (!el) return null;
    return { readonly: el.readOnly, disabled: el.disabled };
  }

  function applyInputSnapshot(el, snap) {
    if (!el || !snap) return;
    if (snap.readonly) el.setAttribute("readonly", "readonly");
    else el.removeAttribute("readonly");
    el.disabled = !!snap.disabled;
  }

  function handleOfficeOverride(active) {
    var on = !!active;
    var notes = document.getElementById("dictationHubNotes");
    var siteIntel = document.getElementById("vcSiteIntelBody");
    var strip = document.getElementById("vcOfficeOverrideGlobalStrip");
    if (on) {
      if (!_vcPostMessageOverrideSnap) {
        _vcPostMessageOverrideSnap = {
          dictation: snapshotInput(notes),
          siteIntel: snapshotInput(siteIntel),
        };
      }
      if (document.body) document.body.classList.add("vc-override-active");
      if (strip) strip.setAttribute("aria-hidden", "false");
      if (notes) {
        notes.removeAttribute("readonly");
        notes.removeAttribute("disabled");
      }
      if (siteIntel) {
        siteIntel.removeAttribute("readonly");
        siteIntel.removeAttribute("disabled");
      }
    } else {
      if (document.body) document.body.classList.remove("vc-override-active");
      if (strip && typeof window !== "undefined" && window.VC_OFFICE_OVERRIDE !== true) {
        strip.setAttribute("aria-hidden", "true");
      }
      if (_vcPostMessageOverrideSnap) {
        applyInputSnapshot(notes, _vcPostMessageOverrideSnap.dictation);
        applyInputSnapshot(siteIntel, _vcPostMessageOverrideSnap.siteIntel);
        _vcPostMessageOverrideSnap = null;
      }
    }
  }

  window.addEventListener("message", function (event) {
    var d = event.data;
    if (!d || d.type !== "VC_OFFICE_OVERRIDE") return;
    handleOfficeOverride(!!d.active);
  });

  /**
   * Cross-device override (global): the tech's schedule listener already streams every ticket
   * assigned to them via `runScheduleMergeAndRender`; if any of those tickets has
   * `officeOverrideActive: true` (set by `service_call.js#toggleOfficeOverride`), reflect that
   * state on the tech's actual phone — regardless of which screen they're on and immediately
   * on page load.
   *
   * Phase 32 — Consent gate: this is now a 3-state path:
   *   - `off`     → no override flag → no chrome
   *   - `pending` → `officeOverrideActive: true` AND `officeOverrideAcknowledged !== true`
   *                 → show the orange consent button (CSS-driven via `body.vc-override-pending`),
   *                   but do NOT apply the KI-001 frame/strip and do NOT touch input snapshots
   *   - `active`  → `officeOverrideActive: true` AND `officeOverrideAcknowledged === true`
   *                 → apply the existing KI-001 chrome (frame + strip) via `handleOfficeOverride(true)`
   *
   * The consent button click handler in `technician/index.html` writes
   * `officeOverrideAcknowledged: true` to the ticket; the next snapshot from
   * `runScheduleMergeAndRender` calls `applyOfficeOverrideFromTickets` again and we transition
   * pending → active. The dispatcher's `service_call.js#toggleOfficeOverride(false)` clears all
   * override fields (including the ack ones) so any subsequent re-activation starts in `pending`
   * again, requiring a fresh tap.
   */
  var _vcOfficeOverrideRemoteState = "off"; // "off" | "pending" | "active"
  var _vcOfficeOverrideRemoteBy = "";
  var _vcOfficeOverrideRemoteTicketId = "";

  function updateOverrideStripLabel(byName, on) {
    var label = document.querySelector(
      "#vcOfficeOverrideGlobalStrip .vc-office-override-global-strip__label"
    );
    if (!label) return;
    if (on && byName) {
      label.textContent = "Office Override active — " + byName + " may be editing";
    } else {
      label.textContent = "Office Override active — dispatch may be editing";
    }
  }

  /**
   * Phase 32a — Lazy-inject the consent button + its CSS + body padding rules + click wiring if a
   * stale, browser-cached `technician/index.html` doesn't have them. This is the single most likely
   * failure mode on the iPhone: Safari serves a months-old cached HTML for the entry-point URL (which
   * has no ?v= cache-buster), so the inline `<button id="vcOfficeOverrideConsentBtn">` and its CSS
   * never reach the device. workspace_ui.js IS cache-busted (?v=N), so by lazy-injecting from here we
   * can guarantee the consent UI works on the next workspace_ui.js bump regardless of cached HTML.
   */
  function ensureConsentButtonInDom() {
    var btn = document.getElementById("vcOfficeOverrideConsentBtn");
    if (btn) return btn;
    if (!document.body) return null;
    /* Inject the CSS first so the button doesn't flash unstyled. */
    if (!document.getElementById("vcOfficeOverrideConsentInjectedCss")) {
      var st = document.createElement("style");
      st.id = "vcOfficeOverrideConsentInjectedCss";
      st.textContent = [
        "body.vc-override-pending { padding-top: 78px; }",
        "@supports (padding-top: env(safe-area-inset-top)) {",
        "  body.vc-override-pending { padding-top: calc(78px + env(safe-area-inset-top, 0px)); }",
        "}",
        ".vc-override-consent-btn {",
        "  display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 100003;",
        "  border: none; padding: 14px 18px;",
        "  padding-top: calc(14px + env(safe-area-inset-top, 0px));",
        "  background: linear-gradient(180deg, #f39c12 0%, #d97706 100%);",
        "  color: #0f172a; font-weight: 800; font-size: 15px; text-align: center;",
        "  line-height: 1.3; cursor: pointer;",
        "  box-shadow: 0 6px 24px rgba(217,119,6,0.55);",
        "  border-bottom: 2px solid rgba(15,23,42,0.18);",
        "  animation: vc-consent-pulse 1.4s ease-in-out infinite;",
        "  -webkit-tap-highlight-color: transparent; font-family: inherit;",
        "}",
        "body.vc-override-pending .vc-override-consent-btn { display: block; }",
        ".vc-override-consent-btn__title { display: block; font-size: 16px; }",
        ".vc-override-consent-btn__sub {",
        "  display: block; font-size: 12px; font-weight: 700; opacity: 0.85; margin-top: 2px;",
        "}",
        ".vc-override-consent-btn:disabled { opacity: 0.85; animation: none; cursor: default; }",
        "@keyframes vc-consent-pulse {",
        "  0%,100% { box-shadow: 0 6px 24px rgba(217,119,6,0.55); }",
        "  50%     { box-shadow: 0 6px 28px rgba(217,119,6,0.95); }",
        "}",
        "body.vc-override-pending #vcOfficeOverrideFrame,",
        "body.vc-override-pending .vc-office-override-global-strip { display: none !important; }"
      ].join("");
      document.head.appendChild(st);
    }
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "vcOfficeOverrideConsentBtn";
    btn.className = "vc-override-consent-btn";
    btn.dataset.vcLazy = "1";
    btn.innerHTML =
      '<span class="vc-override-consent-btn__title">🟠 Tap to acknowledge — Dispatch is editing this job</span>' +
      '<span class="vc-override-consent-btn__sub" id="vcOfficeOverrideConsentSub">Office Override is active. Tap to confirm you see this.</span>';
    document.body.appendChild(btn);
    /* Wire the click handler — mirrors the HTML-side `vcOfficeOverrideConsentBoot` IIFE in
       technician/index.html. We re-implement it here so a stale cached HTML (no IIFE present) still
       has working tap-to-ack. */
    if (btn.dataset.vcWired !== "1") {
      btn.dataset.vcWired = "1";
      btn.addEventListener("click", function () {
        var tid = btn.dataset.ticketId || "";
        if (!tid) return;
        if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
        var db = firebase.firestore();
        var byName = (typeof window.currentTechProfile !== "undefined" && window.currentTechProfile)
          ? String(window.currentTechProfile)
          : "Technician";
        var FV = firebase.firestore.FieldValue;
        var patch = {
          officeOverrideAcknowledged: true,
          officeOverrideAcknowledgedAt: FV.serverTimestamp(),
          officeOverrideAcknowledgedBy: byName,
        };
        var p = (typeof VCFirestore !== "undefined" && VCFirestore.setServiceCallMerged)
          ? VCFirestore.setServiceCallMerged(db, tid, patch, true)
          : db.collection("service_calls").doc(tid).set(patch, { merge: true });
        btn.disabled = true;
        var titleEl = btn.querySelector(".vc-override-consent-btn__title");
        if (titleEl) titleEl.textContent = "✓ Acknowledging…";
        p.catch(function (e) {
          /* KI-002 Plan A5 — same inline-error surface as the inline IIFE in technician/index.html. */
          if (typeof window.VCSurfaceWriteFailure === "function") {
            window.VCSurfaceWriteFailure("OfficeOverride:ackWrite(lazy)", e);
          }
          btn.disabled = false;
          if (titleEl) titleEl.textContent = "⚠ Sync failed — tap to retry acknowledgement";
        });
      });
    }
    return btn;
  }

  function setConsentButtonForState(state, ticketId, byName) {
    var btn = ensureConsentButtonInDom();
    if (!btn) return;
    var titleEl = btn.querySelector(".vc-override-consent-btn__title");
    var subEl = document.getElementById("vcOfficeOverrideConsentSub");
    if (state === "pending") {
      btn.dataset.ticketId = ticketId || "";
      btn.disabled = false;
      if (titleEl) titleEl.textContent = "🟠 Tap to acknowledge — Dispatch is editing this job";
      if (subEl) {
        subEl.textContent = byName
          ? "Office Override active — " + byName + " may be editing. Tap to confirm you see this."
          : "Office Override is active. Tap to confirm you see this.";
      }
    } else {
      /* off or active — clear the button's ticket binding so a stale tap can't write to the wrong doc. */
      btn.dataset.ticketId = "";
      btn.disabled = false;
      if (titleEl) titleEl.textContent = "🟠 Tap to acknowledge — Dispatch is editing this job";
    }
  }

  /**
   * Called by `runScheduleMergeAndRender` (technician/index.html) every time the tech's
   * ticket snapshots merge. Picks the first ticket with `officeOverrideActive === true`
   * and dispatches to `setRemoteOverrideState` with the computed 3-state.
   */
  function applyOfficeOverrideFromTickets(tickets) {
    var arr = Array.isArray(tickets) ? tickets : [];
    var hit = null;
    for (var i = 0; i < arr.length; i++) {
      var t = arr[i];
      if (t && t.officeOverrideActive === true) { hit = t; break; }
    }
    var by = hit && hit.officeOverrideBy ? String(hit.officeOverrideBy).trim() : "";
    var tid = hit && hit.id ? String(hit.id) : "";
    var ack = !!(hit && hit.officeOverrideAcknowledged === true);
    var state = !hit ? "off" : (ack ? "active" : "pending");
    /* Phase 32b — record the last decision for the on-device debug overlay so we can see in real time
       what `applyOfficeOverrideFromTickets` is concluding from each Firestore snapshot. The overlay
       reads `window._vcOverrideLastDecision` and renders it on a `last decision:` line. */
    try {
      window._vcOverrideLastDecision = state +
        " (n=" + arr.length + ", hit=" + (tid || "none") + ", by=" + (by || "?") + ", ack=" + ack + ")";
    } catch (e) {}
    setRemoteOverrideState(state, tid, by);
  }

  function setRemoteOverrideState(state, ticketId, byName) {
    var prev = _vcOfficeOverrideRemoteState;
    _vcOfficeOverrideRemoteBy = byName || "";
    _vcOfficeOverrideRemoteTicketId = ticketId || "";

    if (state === "off") {
      if (document.body) {
        document.body.classList.remove("vc-override-pending");
        /* `vc-override-active` is removed inside handleOfficeOverride(false) below. */
      }
      setConsentButtonForState("off");
      if (prev === "active") {
        handleOfficeOverride(false);
      } else if (document.body) {
        /* Defensive: if we were pending, the active class shouldn't be set, but make sure. */
        document.body.classList.remove("vc-override-active");
      }
      _vcOfficeOverrideRemoteState = "off";
      updateOverrideStripLabel("", false);
      return;
    }

    if (state === "pending") {
      if (document.body) {
        document.body.classList.add("vc-override-pending");
      }
      /* If we were `active` and the ack got cleared (e.g. dispatcher reset), tear down active chrome
         before showing the consent button again. */
      if (prev === "active") {
        handleOfficeOverride(false);
      } else if (document.body) {
        document.body.classList.remove("vc-override-active");
      }
      setConsentButtonForState("pending", ticketId, byName);
      _vcOfficeOverrideRemoteState = "pending";
      updateOverrideStripLabel(byName, false);
      return;
    }

    /* state === "active" */
    if (document.body) {
      document.body.classList.remove("vc-override-pending");
    }
    setConsentButtonForState("active");
    if (prev !== "active") {
      handleOfficeOverride(true);
    }
    _vcOfficeOverrideRemoteState = "active";
    updateOverrideStripLabel(byName, true);
  }

  function workspaceUiOnOpen() {
    ensureOfficeOverrideWorkspaceUnlocked();
    subscribeSiteIntelPulse();
    var btn = document.getElementById("wsSiteIntelBtn");
    if (btn && !btn.dataset.wired) {
      btn.dataset.wired = "1";
      btn.addEventListener("click", function () {
        openSiteIntelModal();
      });
    }
  }

  window.workspaceUiOnOpen = workspaceUiOnOpen;
  window.ensureOfficeOverrideWorkspaceUnlocked = ensureOfficeOverrideWorkspaceUnlocked;
  window.lockWorkspaceControls = lockWorkspaceControls;
  window.handleOfficeOverride = handleOfficeOverride;
  window.applyOfficeOverrideFromTickets = applyOfficeOverrideFromTickets;
  window.setRemoteOverrideState = setRemoteOverrideState;
  window.openSiteIntelForLocation = openSiteIntelModal;
  window.teardownWorkspaceSiteIntel = teardownSiteIntelListener;
  window.getFieldEvidenceDefaultIsPublic = getFieldEvidenceDefaultIsPublic;
})();
