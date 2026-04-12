/**
 * Equipment Profile & Grading — shared module (Dispatcher index.html + Field App technician/).
 * Requires firebase (initialized), getGeminiApiKey (async), GEMINI_GENERATE_MODEL from firebase-config.js.
 */
(function () {
  "use strict";

  function geminiModelId() {
    if (typeof GEMINI_GENERATE_MODEL !== "undefined" && GEMINI_GENERATE_MODEL) {
      return GEMINI_GENERATE_MODEL;
    }
    return "gemini-2.5-flash";
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(s);
    });
  }

  function ensureFirebaseStorage() {
    if (typeof firebase !== "undefined" && firebase.storage) {
      return Promise.resolve();
    }
    return loadScript(
      "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage-compat.js"
    );
  }

  /** Safe Storage / Firestore path segment (no slashes). */
  function sanitizePathSegment(s) {
    return String(s || "")
      .trim()
      .replace(/[/\\]+/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 200) || "unknown";
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var dataUrl = String(r.result || "");
        var i = dataUrl.indexOf("base64,");
        resolve(i >= 0 ? dataUrl.slice(i + 7) : dataUrl);
      };
      r.onerror = function () {
        reject(r.error);
      };
      r.readAsDataURL(file);
    });
  }

  var IDB_NAME = "TwinPillarsOfflineDB";
  var IDB_VERSION = 1;
  var IDB_STORE = "ocrQueue";

  function openOcrIndexedDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onerror = function () {
        reject(req.error);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onupgradeneeded = function (e) {
        var idb = e.target.result;
        if (!idb.objectStoreNames.contains(IDB_STORE)) {
          idb.createObjectStore(IDB_STORE, { keyPath: "id" });
        }
      };
    });
  }

  function ocrQueueAdd(record) {
    return openOcrIndexedDb().then(function (idb) {
      return new Promise(function (resolve, reject) {
        var tx = idb.transaction(IDB_STORE, "readwrite");
        var store = tx.objectStore(IDB_STORE);
        var r = store.add(record);
        r.onsuccess = function () {
          resolve();
        };
        r.onerror = function () {
          reject(r.error);
        };
        tx.oncomplete = function () {
          idb.close();
        };
        tx.onabort = function () {
          idb.close();
        };
      });
    });
  }

  function ocrQueueGetAllPending() {
    return openOcrIndexedDb().then(function (idb) {
      return new Promise(function (resolve, reject) {
        var tx = idb.transaction(IDB_STORE, "readonly");
        var store = tx.objectStore(IDB_STORE);
        var req = store.getAll();
        req.onsuccess = function () {
          var rows = req.result || [];
          resolve(rows.filter(function (x) {
            return x && x.status === "pending";
          }));
        };
        req.onerror = function () {
          reject(req.error);
        };
        tx.oncomplete = function () {
          idb.close();
        };
      });
    });
  }

  function ocrQueueDelete(id) {
    return openOcrIndexedDb().then(function (idb) {
      return new Promise(function (resolve, reject) {
        var tx = idb.transaction(IDB_STORE, "readwrite");
        var store = tx.objectStore(IDB_STORE);
        var r = store.delete(id);
        r.onsuccess = function () {
          resolve();
        };
        r.onerror = function () {
          reject(r.error);
        };
        tx.oncomplete = function () {
          idb.close();
        };
      });
    });
  }

  function base64ToBlob(base64, mimeType) {
    var bin = atob(base64);
    var n = bin.length;
    var u8 = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      u8[i] = bin.charCodeAt(i);
    }
    return new Blob([u8], { type: mimeType || "image/jpeg" });
  }

  function ensureOfflineQueuedMessageEl() {
    var el = $("emOcrOfflineMsg");
    if (el) return el;
    el = document.createElement("div");
    el.id = "emOcrOfflineMsg";
    el.setAttribute("role", "status");
    el.style.display = "none";
    el.style.marginTop = "8px";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "6px";
    el.style.background = "#ecfdf5";
    el.style.border = "1px solid #6ee7b7";
    el.style.color = "#065f46";
    el.style.fontSize = "13px";
    el.style.lineHeight = "1.45";
    var spin = $("emOcrSpinner");
    if (spin && spin.parentNode) {
      spin.parentNode.insertBefore(el, spin.nextSibling);
    } else {
      document.body.appendChild(el);
    }
    return el;
  }

  function showOfflinePlateQueuedMessage() {
    var el = ensureOfflineQueuedMessageEl();
    el.textContent =
      "✅ Photo Saved Offline. The AI will extract the data plate information in the background once cell service is restored.";
    el.style.display = "block";
  }

  function hideOfflinePlateQueuedMessage() {
    var el = $("emOcrOfflineMsg");
    if (el) el.style.display = "none";
  }

  /**
   * Apply parsed plate JSON to the equipment form (shared by live OCR and optional UI refresh).
   */
  function applyPlateDataToForm(data) {
    if (!data) return;
    if ($("emBrand") && data.brand != null) $("emBrand").value = String(data.brand);
    if ($("emModel") && data.model != null) $("emModel").value = String(data.model);
    if ($("emSerialJob") && data.serial != null) $("emSerialJob").value = String(data.serial);
    if ($("emVoltage") && data.voltage != null) $("emVoltage").value = String(data.voltage);
    if ($("emPhase") && data.phase != null) $("emPhase").value = String(data.phase);
    if ($("emRefrigerant") && data.refrigerant != null)
      $("emRefrigerant").value = String(data.refrigerant);
    if ($("emUnitTag") && data.unitTag != null) $("emUnitTag").value = String(data.unitTag);

    var ton = data.tonnageNumeric != null ? Number(data.tonnageNumeric) : NaN;
    if ($("emTonnage") && isFinite(ton) && ton > 0) {
      $("emTonnage").value = String(ton);
      var crvEst = estimateCRV(ton);
      if ($("emCRV") && crvEst > 0) $("emCRV").value = String(crvEst);
    }

    if (data.manufactureYear != null && $("emMfgYear")) {
      $("emMfgYear").value = String(data.manufactureYear);
    }
    if (data.ageYears != null && $("emAgeYears") && isFinite(Number(data.ageYears))) {
      $("emAgeYears").value = String(Math.round(Number(data.ageYears)));
    } else if (data.manufactureYear != null && $("emAgeYears")) {
      var y = Number(data.manufactureYear);
      if (isFinite(y) && y > 1900) {
        var cy = new Date().getFullYear();
        $("emAgeYears").value = String(Math.max(0, cy - y));
      }
    }

    refreshHealthUi();
  }

  /**
   * Build Firestore profile + health from Gemini JSON (no DOM required). Used by background queue sync.
   */
  function buildEquipmentProfileFromPlateData(data, context, platePhotoUrl) {
    var ctx = context || {};
    var unitTag =
      data && data.unitTag != null && String(data.unitTag).trim()
        ? String(data.unitTag).trim()
        : "unit";

    var ton = data.tonnageNumeric != null ? Number(data.tonnageNumeric) : NaN;
    var crvVal = 0;
    if (isFinite(ton) && ton > 0) crvVal = estimateCRV(ton);

    var ageY = 0;
    if (data.ageYears != null && isFinite(Number(data.ageYears))) {
      ageY = Math.round(Number(data.ageYears));
    } else if (data.manufactureYear != null) {
      var y = Number(data.manufactureYear);
      if (isFinite(y) && y > 1900) {
        ageY = Math.max(0, new Date().getFullYear() - y);
      }
    }

    var prevRep = 0;
    var propCost = 0;
    var health = calculateHealthScore(ageY, prevRep, propCost, crvVal);

    return {
      brand: data.brand != null ? String(data.brand) : "",
      model: data.model != null ? String(data.model) : "",
      serialJob: data.serial != null ? String(data.serial) : "",
      unitTag: unitTag,
      voltage: data.voltage != null ? String(data.voltage) : "",
      phase: data.phase != null ? String(data.phase) : "",
      refrigerant: data.refrigerant != null ? String(data.refrigerant) : "",
      tonnage: isFinite(ton) && ton > 0 ? String(ton) : "",
      manufactureYear: data.manufactureYear != null ? String(data.manufactureYear) : "",
      ageYears: String(ageY),
      estimatedCRV: crvVal > 0 ? String(crvVal) : "",
      totalPreviousRepairs: "0",
      proposedRepairCost: "0",
      overallPhotoUrl: "",
      dataPlatePhotoUrl: platePhotoUrl || "",
      parentCompany: ctx.parentCompany != null ? String(ctx.parentCompany) : "—",
      customer: ctx.customer != null ? String(ctx.customer) : "—",
      location: ctx.location != null ? String(ctx.location) : "—",
      healthScore: health.score,
      healthGrade: health.grade,
      savedAt: new Date().toISOString(),
      syncedFromOfflineQueue: true,
    };
  }

  /**
   * Process pending IndexedDB plate OCR jobs when online: Gemini → Storage → Firestore → delete queue row.
   */
  async function processOcrQueue() {
    if (!navigator.onLine) return;
    var pending;
    try {
      pending = await ocrQueueGetAllPending();
    } catch (e) {
      console.error("[EquipmentManager] processOcrQueue", e);
      return;
    }
    for (var i = 0; i < pending.length; i++) {
      try {
        await processOneOcrQueueRecord(pending[i]);
      } catch (err) {
        console.error("[EquipmentManager] queue item " + pending[i].id, err);
      }
    }
  }

  async function processOneOcrQueueRecord(rec) {
    var mime = rec.mimeType || "image/jpeg";
    var text = await callGeminiVision(rec.imageBase64, mime, buildPlatePrompt());
    var data = parseGeminiJson(text);
    if (!data) {
      throw new Error("Gemini parse failed for queued plate");
    }
    var ctx = rec.context || {};
    var profile = buildEquipmentProfileFromPlateData(data, ctx, "");
    var parent = sanitizePathSegment(ctx.parentCompany || "—");
    var cust = sanitizePathSegment(ctx.customer || "—");
    var loc = sanitizePathSegment(ctx.location || "—");
    var ut = sanitizePathSegment(profile.unitTag);

    await ensureFirebaseStorage();
    var storage = firebase.storage();
    var base = ["equipment_photos", parent, cust, loc, ut].join("/");
    var ts = Date.now();
    var plateRef = storage.ref().child(base + "/dataplate_queue_" + ts + ".jpg");
    var blob = base64ToBlob(rec.imageBase64, mime);
    await plateRef.put(blob, { contentType: mime });
    var plateUrl = await plateRef.getDownloadURL();
    profile.dataPlatePhotoUrl = plateUrl;
    if (typeof db === "undefined") {
      throw new Error("Firestore (db) not available.");
    }
    var custId = sanitizePathSegment(ctx.customer || "—");
    var locId =
      rec.locationId != null && String(rec.locationId).trim()
        ? String(rec.locationId).trim()
        : sanitizePathSegment(ctx.location || "—");
    var unitId = sanitizePathSegment(profile.unitTag);
    await db
      .collection("Customers")
      .doc(custId)
      .collection("Locations")
      .doc(locId)
      .collection("Equipment")
      .doc(unitId)
      .set(profile, { merge: true });
    await ocrQueueDelete(rec.id);
    dispatchEquipmentManagerSaved({
      customerId: custId,
      locationId: locId,
      unitId: unitId,
      equipmentId: custId + "/" + locId + "/" + unitId,
    });
  }

  function dispatchEquipmentManagerSaved(detail) {
    try {
      document.dispatchEvent(
        new CustomEvent("equipmentManagerSaved", { detail: detail })
      );
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Replacement cost estimate from tonnage (piecewise linear).
   * 5-Ton ≈ $10k, 10-Ton ≈ $15k, 20-Ton ≈ $25k
   */
  function estimateCRV(tonnage) {
    var t = Number(tonnage);
    if (!isFinite(t) || t <= 0) return 0;
    var pts = [
      [0, 0],
      [5, 10000],
      [10, 15000],
      [20, 25000],
    ];
    if (t <= 5) {
      return Math.round((t / 5) * 10000);
    }
    if (t <= 10) {
      return Math.round(10000 + ((t - 5) / 5) * (15000 - 10000));
    }
    if (t <= 20) {
      return Math.round(15000 + ((t - 10) / 10) * (25000 - 15000));
    }
    var slope = 1000;
    return Math.round(25000 + (t - 20) * slope);
  }

  /**
   * Health score: start 100, -2.5 per year of age,
   * subtract (repairSpend/CRV)*50 (50% weight on cumulative spend vs replacement value).
   */
  function calculateHealthScore(ageYears, totalPrevRepairs, proposedRepairCost, estimatedCRV) {
    var age = Math.max(0, Number(ageYears) || 0);
    var prev = Math.max(0, Number(totalPrevRepairs) || 0);
    var prop = Math.max(0, Number(proposedRepairCost) || 0);
    var crv = Math.max(0, Number(estimatedCRV) || 0);

    var score = 100;
    score -= 2.5 * age;
    var spendRatio = crv > 0 ? (prev + prop) / crv : 0;
    score -= spendRatio * 50;
    score = Math.floor(Math.max(0, Math.min(100, score)));

    var grade = "F";
    if (score >= 90) grade = "A";
    else if (score >= 80) grade = "B";
    else if (score >= 70) grade = "C";
    else if (score >= 60) grade = "D";

    return { score: score, grade: grade };
  }

  function parseGeminiJson(text) {
    if (!text) return null;
    var t = String(text).trim();
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    try {
      return JSON.parse(t);
    } catch (e) {
      var o = t.indexOf("{");
      var c = t.lastIndexOf("}");
      if (o >= 0 && c > o) {
        try {
          return JSON.parse(t.slice(o, c + 1));
        } catch (e2) {}
      }
      return null;
    }
  }

  function callGeminiVision(base64Data, mimeType, promptText) {
    if (typeof getGeminiApiKey !== "function") {
      return Promise.reject(
        new Error("No Gemini API key (configure app_config/api_keys in Firestore or Settings).")
      );
    }
    return getGeminiApiKey().then(function (key) {
      if (!key) {
        return Promise.reject(
          new Error("No Gemini API key (configure app_config/api_keys in Firestore or Settings).")
        );
      }
      var url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        geminiModelId() +
        ":generateContent?key=" +
        encodeURIComponent(key);

      var body = {
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType || "image/jpeg",
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      };

      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) {
              var msg =
                (data && data.error && data.error.message) ||
                res.statusText ||
                "Gemini request failed";
              throw new Error(msg);
            }
            return data;
          });
        })
        .then(function (data) {
          var parts =
            data &&
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts;
          if (!parts || !parts.length) return "";
          return parts
            .map(function (p) {
              return p.text || "";
            })
            .join("\n");
        });
    });
  }

  function buildPlatePrompt() {
    return [
      "You are an expert HVAC equipment data-plate OCR assistant.",
      "Analyze the image and extract ONLY what is visible. Return a single JSON object (no markdown) with these keys:",
      "brand (string), model (string), serial (string), voltage (string), phase (string), refrigerant (string), unitTag (string, e.g. RTU-2 or PRV-3 if shown),",
      "tonnageNumeric (number or null) — cooling/heating tonnage decoded from the model number if present,",
      "manufactureYear (number or null) — decode from serial number using the manufacturer's date code rules when possible; otherwise null,",
      "ageYears (number or null) — years since manufacture year to the current calendar year if manufactureYear is known, else null,",
      "serialDateNotes (string, brief explanation of how manufacture year was derived or why unknown).",
      "If a field is not on the plate, use empty string or null. Be conservative; do not invent model numbers from address text.",
    ].join(" ");
  }

  function readContextFromDom() {
    var parent = "—";
    var sel = document.getElementById("scParentSelect");
    var nw = document.getElementById("scParentNew");
    if (nw && nw.value && String(nw.value).trim()) {
      parent = String(nw.value).trim();
    } else if (sel && sel.selectedIndex >= 0) {
      var opt = sel.options[sel.selectedIndex];
      if (opt && opt.value) parent = String(opt.text || opt.value).trim();
    }

    var custEl = document.getElementById("scCustNameInput");
    var customer = custEl && custEl.value ? String(custEl.value).trim() : "—";

    var st = document.getElementById("scCustStreetInput");
    var cy = document.getElementById("scCustCityInput");
    var stt = document.getElementById("scCustStateInput");
    var zp = document.getElementById("scCustZipInput");
    var parts = [];
    if (st && st.value) parts.push(String(st.value).trim());
    var line2 = [];
    if (cy && cy.value) line2.push(String(cy.value).trim());
    if (stt && stt.value) line2.push(String(stt.value).trim());
    if (zp && zp.value) line2.push(String(zp.value).trim());
    if (line2.length) parts.push(line2.join(", "));
    var location = parts.length ? parts.join(" — ") : "—";

    return { parentCompany: parent, customer: customer, location: location };
  }

  var state = {
    context: { parentCompany: "—", customer: "—", location: "—" },
    overallFile: null,
    plateFile: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setModalVisible(visible) {
    var modal = $("equipmentManagerModal");
    if (!modal) return;
    if (visible) {
      modal.classList.remove("em-modal-hidden");
      modal.classList.add("em-modal-visible");
      modal.setAttribute("aria-hidden", "false");
    } else {
      modal.classList.add("em-modal-hidden");
      modal.classList.remove("em-modal-visible");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function applyContextToHeader() {
    var c = state.context;
    var hp = $("emHdrParent");
    var hc = $("emHdrCustomer");
    var hl = $("emHdrLocation");
    if (hp) hp.textContent = c.parentCompany || "—";
    if (hc) hc.textContent = c.customer || "—";
    if (hl) hl.textContent = c.location || "—";
  }

  function refreshHealthUi() {
    var age = $("emAgeYears") && $("emAgeYears").value;
    var prev = $("emPrevRepairs") && $("emPrevRepairs").value;
    var prop = $("emProposedCost") && $("emProposedCost").value;
    var crv = $("emCRV") && $("emCRV").value;
    var r = calculateHealthScore(age, prev, prop, crv);
    var sEl = $("emHealthScore");
    var gEl = $("emHealthGrade");
    if (sEl) sEl.textContent = String(r.score);
    if (gEl) gEl.textContent = r.grade;
    return r;
  }

  function wireInputs() {
    var ids = [
      "emAgeYears",
      "emPrevRepairs",
      "emProposedCost",
      "emCRV",
    ];
    ids.forEach(function (id) {
      var el = $(id);
      if (el) {
        el.addEventListener("input", refreshHealthUi);
        el.addEventListener("change", refreshHealthUi);
      }
    });
  }

  function onDataPlateSelected(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) return;
    state.plateFile = file;
    var spin = $("emOcrSpinner");
    if (spin) spin.classList.add("em-active");
    hideOfflinePlateQueuedMessage();

    var mime = file.type || "image/jpeg";
    fileToBase64(file)
      .then(function (b64) {
        if (!navigator.onLine) {
          var qid = Date.now();
          var locId =
            state.context && state.context.location
              ? sanitizePathSegment(state.context.location)
              : null;
          var record = {
            id: qid,
            imageBase64: b64,
            mimeType: mime,
            locationId: locId,
            context: {
              parentCompany: state.context.parentCompany,
              customer: state.context.customer,
              location: state.context.location,
            },
            status: "pending",
          };
          return ocrQueueAdd(record).then(function () {
            showOfflinePlateQueuedMessage();
          });
        }
        return callGeminiVision(b64, mime, buildPlatePrompt()).then(function (text) {
          var data = parseGeminiJson(text);
          if (!data) {
            console.warn("[EquipmentManager] Gemini parse failed", text);
            alert(
              "Could not parse Gemini response. Check console / enable Generative Language API for this key."
            );
            return;
          }
          applyPlateDataToForm(data);
        });
      })
      .catch(function (err) {
        console.error("[EquipmentManager] data plate", err);
        alert(
          (err && err.message ? err.message : String(err)) ||
            "Could not process data plate photo."
        );
      })
      .finally(function () {
        if (spin) spin.classList.remove("em-active");
      });
  }

  function onOverallSelected(file) {
    if (file && file.type && file.type.startsWith("image/")) {
      state.overallFile = file;
    } else if (file) {
      state.overallFile = file;
    }
  }

  function saveEquipment() {
    var unitTag = ($("emUnitTag") && $("emUnitTag").value.trim()) || "unit";
    var parent = sanitizePathSegment(state.context.parentCompany);
    var cust = sanitizePathSegment(state.context.customer);
    var loc = sanitizePathSegment(state.context.location);
    var ut = sanitizePathSegment(unitTag);

    if (!state.overallFile || !state.plateFile) {
      alert("Please attach both Overall Photo and Data Plate Photo before saving.");
      return;
    }

    ensureFirebaseStorage()
      .then(function () {
        var storage = firebase.storage();
        var base = ["equipment_photos", parent, cust, loc, ut].join("/");
        var ts = Date.now();
        var overallRef = storage.ref().child(base + "/overall_" + ts + ".jpg");
        var plateRef = storage.ref().child(base + "/dataplate_" + ts + ".jpg");

        var mOverall = state.overallFile.type || "image/jpeg";
        var mPlate = state.plateFile.type || "image/jpeg";

        return overallRef
          .put(state.overallFile, { contentType: mOverall })
          .then(function () {
            return overallRef.getDownloadURL();
          })
          .then(function (overallUrl) {
            return plateRef.put(state.plateFile, { contentType: mPlate }).then(function () {
              return plateRef.getDownloadURL().then(function (plateUrl) {
                return { overallUrl: overallUrl, plateUrl: plateUrl };
              });
            });
          });
      })
      .then(function (urls) {
        if (typeof db === "undefined") {
          throw new Error("Firestore (db) not available.");
        }
        var healthSnap = refreshHealthUi();
        var profile = {
          brand: $("emBrand") && $("emBrand").value,
          model: $("emModel") && $("emModel").value,
          serialJob: $("emSerialJob") && $("emSerialJob").value,
          unitTag: $("emUnitTag") && $("emUnitTag").value,
          voltage: $("emVoltage") && $("emVoltage").value,
          phase: $("emPhase") && $("emPhase").value,
          refrigerant: $("emRefrigerant") && $("emRefrigerant").value,
          tonnage: $("emTonnage") && $("emTonnage").value,
          manufactureYear: $("emMfgYear") && $("emMfgYear").value,
          ageYears: $("emAgeYears") && $("emAgeYears").value,
          estimatedCRV: $("emCRV") && $("emCRV").value,
          totalPreviousRepairs: $("emPrevRepairs") && $("emPrevRepairs").value,
          proposedRepairCost: $("emProposedCost") && $("emProposedCost").value,
          overallPhotoUrl: urls.overallUrl,
          dataPlatePhotoUrl: urls.plateUrl,
          parentCompany: state.context.parentCompany,
          customer: state.context.customer,
          location: state.context.location,
          healthScore: healthSnap.score,
          healthGrade: healthSnap.grade,
          savedAt: new Date().toISOString(),
        };

        var custId = sanitizePathSegment(state.context.customer);
        var locId = sanitizePathSegment(state.context.location);
        var unitId = sanitizePathSegment(unitTag);

        return db
          .collection("Customers")
          .doc(custId)
          .collection("Locations")
          .doc(locId)
          .collection("Equipment")
          .doc(unitId)
          .set(profile, { merge: true })
          .then(function () {
            alert("Equipment profile saved.");
            dispatchEquipmentManagerSaved({
              customerId: custId,
              locationId: locId,
              unitId: unitId,
              equipmentId: custId + "/" + locId + "/" + unitId,
            });
            return profile;
          });
      })
      .catch(function (e) {
        console.error("[EquipmentManager] Save", e);
        alert("Save failed: " + (e && e.message ? e.message : String(e)));
      });
  }

  function generateProposal() {
    var prop = Number(($("emProposedCost") && $("emProposedCost").value) || 0);
    var crv = Number(($("emCRV") && $("emCRV").value) || 0);
    var health = refreshHealthUi();

    var good = prop;
    var better = prop + 500;
    var best = crv;

    var sec = $("emProposalSection");
    if (sec) {
      sec.classList.add("em-visible");
    }

    var pg = $("emPriceGood");
    var pb = $("emPriceBetter");
    var pbest = $("emPriceBest");
    if (pg) pg.textContent = formatMoney(good);
    if (pb) pb.textContent = formatMoney(better);
    if (pbest) pbest.textContent = formatMoney(best);

    var wg = $("emWarnGood");
    var wb = $("emWarnBetter");
    var rl = $("emRecoLabel");
    var cardG = $("emPropGood");
    var cardB = $("emPropBetter");
    var cardBest = $("emPropBest");

    var low = health.score < 70;
    if (wg)
      wg.innerHTML = low
        ? '<span class="em-badge-warn">Not Recommended: Financial Liability</span>'
        : "";
    if (wb)
      wb.innerHTML = low
        ? '<span class="em-badge-warn">Not Recommended: Financial Liability</span>'
        : "";

    if (cardG) cardG.classList.toggle("em-reco", false);
    if (cardB) cardB.classList.toggle("em-reco", false);
    if (cardBest) {
      cardBest.classList.toggle("em-reco", low);
    }
    if (rl) rl.style.display = low ? "block" : "none";
  }

  function formatMoney(n) {
    if (!isFinite(n)) return "—";
    return (
      "$" +
      n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    );
  }

  function getFirestoreDb() {
    if (typeof db !== "undefined" && db) return db;
    if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
      return firebase.firestore();
    }
    return null;
  }

  function buildDictationPlateOcrPrompt() {
    return [
      "You are an expert HVAC data-plate OCR assistant.",
      "Analyze the image and extract ONLY visible text. Return a single JSON object (no markdown) with these keys:",
      "manufacturer (string), modelNumber (string), serialNumber (string), voltage (string), phase (string), refrigerant (string).",
      'Use empty string "" for any field not legible on the plate. Do not invent values.',
    ].join(" ");
  }

  /**
   * Dictation Hub: camera → Storage → optional plate OCR → merge Firestore asset.
   * @param {{ logicalId: string, customerId: string, siteId: string, kind?: string }} opts kind: "nameplate" | "overall" | "additional"
   * @param {File} file
   */
  function dictationPromoteAssetPhoto(opts, file) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      return Promise.reject(new Error("Choose a photo."));
    }
    var logicalId = sanitizePathSegment((opts && opts.logicalId) || "unit");
    var customerId = sanitizePathSegment((opts && opts.customerId) || "");
    var siteId = sanitizePathSegment((opts && opts.siteId) || "");
    var rawKind = opts && opts.kind ? String(opts.kind) : "nameplate";
    var kind =
      rawKind === "overall"
        ? "overall"
        : rawKind === "additional"
          ? "additional"
          : "nameplate";
    if (!customerId || !siteId) {
      return Promise.reject(new Error("Missing customer or site context."));
    }

    var fsdb = getFirestoreDb();
    if (!fsdb) {
      return Promise.reject(new Error("Firestore not available."));
    }

    var mime = file.type || "image/jpeg";
    var ext = /png/i.test(mime) ? "png" : "jpg";
    var ts = Date.now();
    var storagePath =
      "dictation_hub_assets/" +
      customerId +
      "/" +
      siteId +
      "/" +
      logicalId +
      "/" +
      kind +
      "_" +
      ts +
      "." +
      ext;

    return ensureFirebaseStorage()
      .then(function () {
        var storage = firebase.storage();
        var ref = storage.ref().child(storagePath);
        return ref.put(file, { contentType: mime }).then(function () {
          return ref.getDownloadURL();
        });
      })
      .then(function (downloadUrl) {
        var ocrPromise =
          kind === "nameplate"
            ? fileToBase64(file).then(function (b64) {
                return callGeminiVision(b64, mime, buildDictationPlateOcrPrompt()).then(
                  function (text) {
                    return parseGeminiJson(text);
                  }
                );
              })
            : Promise.resolve(null);

        return ocrPromise.then(function (ocr) {
          var assetRef = fsdb
            .collection("customers")
            .doc(customerId)
            .collection("sites")
            .doc(siteId)
            .collection("assets")
            .doc(logicalId);

          return assetRef.get().then(function (snap) {
            var prev = snap.exists ? snap.data() || {} : {};
            var FV = firebase.firestore.FieldValue;

            if (kind === "additional") {
              var add = Array.isArray(prev.additional_images)
                ? prev.additional_images.slice()
                : [];
              add.push({
                url: downloadUrl,
                addedAt: new Date().toISOString(),
              });
              var addPatch = {
                id: logicalId,
                additional_images: add,
                updatedAt: FV ? FV.serverTimestamp() : new Date().toISOString(),
              };
              return assetRef.set(addPatch, { merge: true }).then(function () {
                return addPatch;
              });
            }

            var images = Object.assign({}, prev.images || {});
            if (kind === "nameplate") {
              images.nameplate = Object.assign({}, images.nameplate || {}, {
                url: downloadUrl,
              });
            } else {
              images.overall = Object.assign({}, images.overall || {}, {
                url: downloadUrl,
              });
            }

            var patch = {
              id: logicalId,
              images: images,
              updatedAt: FV ? FV.serverTimestamp() : new Date().toISOString(),
            };

            if (prev.awaitingNewEquipment === true) {
              patch.awaitingNewEquipment = false;
            }

            if (ocr && typeof ocr === "object") {
              if (ocr.manufacturer != null && String(ocr.manufacturer).trim()) {
                patch.manufacturer = String(ocr.manufacturer).trim();
              }
              if (ocr.modelNumber != null && String(ocr.modelNumber).trim()) {
                patch.modelNumber = String(ocr.modelNumber).trim();
              } else if (ocr.model != null && String(ocr.model).trim()) {
                patch.modelNumber = String(ocr.model).trim();
              }
              if (ocr.serialNumber != null && String(ocr.serialNumber).trim()) {
                patch.serialNumber = String(ocr.serialNumber).trim();
              } else if (ocr.serial != null && String(ocr.serial).trim()) {
                patch.serialNumber = String(ocr.serial).trim();
              }
              if (ocr.voltage != null && String(ocr.voltage).trim()) {
                patch.voltage = String(ocr.voltage).trim();
              }
              if (ocr.phase != null && String(ocr.phase).trim()) {
                patch.phase = String(ocr.phase).trim();
              }
              if (ocr.refrigerant != null && String(ocr.refrigerant).trim()) {
                patch.refrigerant = String(ocr.refrigerant).trim();
              }
            }

            return assetRef.set(patch, { merge: true }).then(function () {
              return patch;
            });
          });
        });
      });
  }

  /**
   * Compat Firestore equivalent of modular deleteField() — removes fields in update().
   * @returns {*}
   */
  function deleteFieldCompat() {
    var FV = firebase.firestore.FieldValue;
    if (!FV || typeof FV.delete !== "function") {
      throw new Error("FieldValue.delete is not available.");
    }
    return FV.delete();
  }

  /**
   * Vertex-Core Phase 2: archive snapshot + atomic wipe of active asset (single batch commit).
   * @param {{ logicalId: string, customerId: string, siteId: string, currentData?: object }} opts
   */
  function dictationRetireCurrentAsset(opts) {
    var logicalId = sanitizePathSegment((opts && opts.logicalId) || "");
    var customerId = sanitizePathSegment((opts && opts.customerId) || "");
    var siteId = sanitizePathSegment((opts && opts.siteId) || "");
    if (!logicalId || !customerId || !siteId) {
      return Promise.reject(new Error("Missing asset context."));
    }
    var fsdb = getFirestoreDb();
    if (!fsdb) {
      return Promise.reject(new Error("Firestore not available."));
    }
    var FV = firebase.firestore.FieldValue;
    var assetRef = fsdb
      .collection("customers")
      .doc(customerId)
      .collection("sites")
      .doc(siteId)
      .collection("assets")
      .doc(logicalId);

    return assetRef
      .get()
      .then(function (snap) {
        if (!snap.exists) {
          throw new Error("Asset not found.");
        }
        var fromServer = snap.data() || {};
        var fromOpts = opts && opts.currentData && typeof opts.currentData === "object" ? opts.currentData : {};
        var currentData = Object.assign({}, fromServer, fromOpts);
        var histId = String(Date.now());
        var archiveRef = assetRef.collection("retired_history").doc(histId);
        var archivePayload = Object.assign({}, currentData, {
          archivedAt: FV ? FV.serverTimestamp() : new Date().toISOString(),
        });

        var batch = fsdb.batch();
        batch.set(archiveRef, archivePayload);
        batch.update(assetRef, {
          modelNumber: deleteFieldCompat(),
          serialNumber: deleteFieldCompat(),
          images: deleteFieldCompat(),
          awaitingNewEquipment: true,
          status: "vacant",
          updatedAt: FV ? FV.serverTimestamp() : new Date().toISOString(),
        });
        return batch.commit();
      })
      .catch(function (err) {
        console.error("dictationRetireCurrentAsset", err);
        return Promise.reject(err);
      });
  }

  /**
   * True if assets/{logicalId}/retired_history has at least one document (Vault UI gate).
   * @param {{ logicalId: string, customerId: string, siteId: string }} opts
   * @returns {Promise<boolean>}
   */
  function dictationAssetHasRetiredHistory(opts) {
    var logicalId = sanitizePathSegment((opts && opts.logicalId) || "");
    var customerId = sanitizePathSegment((opts && opts.customerId) || "");
    var siteId = sanitizePathSegment((opts && opts.siteId) || "");
    if (!logicalId || !customerId || !siteId) {
      return Promise.reject(new Error("Missing asset context."));
    }
    var fsdb = getFirestoreDb();
    if (!fsdb) {
      return Promise.reject(new Error("Firestore not available."));
    }
    return fsdb
      .collection("customers")
      .doc(customerId)
      .collection("sites")
      .doc(siteId)
      .collection("assets")
      .doc(logicalId)
      .collection("retired_history")
      .limit(1)
      .get()
      .then(function (snap) {
        return !snap.empty;
      })
      .catch(function (err) {
        console.error("dictationAssetHasRetiredHistory", err);
        return Promise.reject(err);
      });
  }

  function open(opts) {
    if (
      opts &&
      typeof opts === "object" &&
      (opts.customer != null ||
        opts.location != null ||
        opts.locationDisplay != null ||
        opts.locationId != null)
    ) {
      state.context = {
        parentCompany:
          opts.parentCompany != null ? String(opts.parentCompany) : "—",
        customer: opts.customer != null ? String(opts.customer) : "—",
        location:
          opts.locationDisplay != null
            ? String(opts.locationDisplay)
            : opts.location != null
              ? String(opts.location)
              : "—",
      };
    } else {
      state.context = readContextFromDom();
    }
    applyContextToHeader();
    setModalVisible(true);
    refreshHealthUi();
  }

  function close() {
    setModalVisible(false);
  }

  function init() {
    wireInputs();
    refreshHealthUi();

    var plateIn = $("emPhotoPlate");
    if (plateIn) {
      plateIn.addEventListener("change", function () {
        var f = plateIn.files && plateIn.files[0];
        if (f) onDataPlateSelected(f);
      });
    }
    var ovIn = $("emPhotoOverall");
    if (ovIn) {
      ovIn.addEventListener("change", function () {
        var f = ovIn.files && ovIn.files[0];
        if (f) onOverallSelected(f);
      });
    }

    var save = $("emSaveBtn");
    if (save) save.addEventListener("click", saveEquipment);

    var prop = $("emProposalBtn");
    if (prop) prop.addEventListener("click", generateProposal);

    var cl = $("emCloseBtn");
    if (cl) cl.addEventListener("click", close);

    var modal = $("equipmentManagerModal");
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) close();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal && modal.classList.contains("em-modal-visible")) {
        close();
      }
    });

    window.addEventListener("online", processOcrQueue);
    setTimeout(function () {
      void processOcrQueue();
    }, 0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.processOcrQueue = processOcrQueue;
  window.dictationPromoteAssetPhoto = dictationPromoteAssetPhoto;
  window.dictationRetireCurrentAsset = dictationRetireCurrentAsset;
  window.dictationAssetHasRetiredHistory = dictationAssetHasRetiredHistory;

  window.EquipmentManager = {
    open: open,
    close: close,
    readContextFromDom: readContextFromDom,
    estimateCRV: estimateCRV,
    calculateHealthScore: calculateHealthScore,
  };
})();
