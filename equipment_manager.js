/**
 * Equipment Profile & Grading — isolated module (Dispatcher Portal).
 * Does not modify core invoice / quoting logic; relies on global firebase + firebaseConfig.
 */
(function () {
  "use strict";

  var GEMINI_MODEL = "gemini-1.5-flash";

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

  function getApiKey() {
    if (typeof getGeminiApiKey === "function") {
      var k = getGeminiApiKey();
      if (k) return k;
    }
    if (typeof firebaseConfig !== "undefined" && firebaseConfig.apiKey) {
      return firebaseConfig.apiKey;
    }
    return "";
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
    var key = getApiKey();
    if (!key) {
      return Promise.reject(new Error("No Gemini API key (set geminiApiKey or apiKey in firebase-config.js)."));
    }
    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      GEMINI_MODEL +
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

    var mime = file.type || "image/jpeg";
    fileToBase64(file)
      .then(function (b64) {
        return callGeminiVision(b64, mime, buildPlatePrompt());
      })
      .then(function (text) {
        var data = parseGeminiJson(text);
        if (!data) {
          console.warn("[EquipmentManager] Gemini parse failed", text);
          alert(
            "Could not parse Gemini response. Check console / enable Generative Language API for this key."
          );
          return;
        }

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
      })
      .catch(function (err) {
        console.error("[EquipmentManager] Gemini", err);
        alert("Gemini OCR failed: " + (err && err.message ? err.message : String(err)));
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

  function open(opts) {
    state.context = opts || readContextFromDom();
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.EquipmentManager = {
    open: open,
    close: close,
    readContextFromDom: readContextFromDom,
    estimateCRV: estimateCRV,
    calculateHealthScore: calculateHealthScore,
  };
})();
