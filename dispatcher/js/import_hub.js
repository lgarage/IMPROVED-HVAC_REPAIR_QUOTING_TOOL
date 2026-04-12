/**
 * Enterprise Data Onboarding — CSV wizard (equipment + service history → tenant Firestore).
 * Phase 12: Universal Data Onboarding Engine.
 */
(function (global) {
  "use strict";

  var BATCH_SIZE = 500;
  var LEGACY_SOURCE_DEFAULT = "BuildOps";

  function normalizeLocationKey(locationLine) {
    return String(locationLine || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function siteIntelDocIdFromLocationLine(locationLine) {
    var key = normalizeLocationKey(locationLine);
    if (!key) return "";
    var h = 5381;
    for (var i = 0; i < key.length; i++) {
      h = (h * 33) ^ key.charCodeAt(i);
    }
    return "vc_site_" + (h >>> 0).toString(16);
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cur = "";
    var i = 0;
    var inQ = false;
    var t = String(text || "");
    while (i < t.length) {
      var c = t[i];
      if (inQ) {
        if (c === '"') {
          if (t[i + 1] === '"') {
            cur += '"';
            i += 2;
            continue;
          }
          inQ = false;
          i++;
          continue;
        }
        cur += c;
        i++;
        continue;
      }
      if (c === '"') {
        inQ = true;
        i++;
        continue;
      }
      if (c === ",") {
        row.push(cur);
        cur = "";
        i++;
        continue;
      }
      if (c === "\r") {
        i++;
        continue;
      }
      if (c === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
        i++;
        continue;
      }
      cur += c;
      i++;
    }
    row.push(cur);
    rows.push(row);
    while (rows.length && rows[rows.length - 1].every(function (x) { return String(x).trim() === ""; })) {
      rows.pop();
    }
    return rows;
  }

  function normHeader(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  var EQUIPMENT_FIELDS = [
    { id: "location_line", label: "Location line (combined)" },
    { id: "customer_name", label: "Customer / site name" },
    { id: "site_address", label: "Site address" },
    { id: "serial_number", label: "Serial number" },
    { id: "model_number", label: "Model" },
    { id: "manufacturer", label: "Manufacturer" },
    { id: "brand", label: "Brand" },
    { id: "unit_tag", label: "Unit tag / ID" },
    { id: "equipment_type", label: "Equipment type" },
    { id: "install_date", label: "Install date" },
    { id: "equipment_notes", label: "Equipment notes" },
    { id: "office_notes", label: "Office Notes → Site Intel" },
    { id: "internal_access", label: "Internal Access Instructions → Site Intel" },
  ];

  var HISTORY_FIELDS = [
    { id: "location_line", label: "Location line (combined)" },
    { id: "customer_name", label: "Customer / site name" },
    { id: "site_address", label: "Site address" },
    { id: "work_performed", label: "Work performed / notes" },
    { id: "service_date", label: "Service date" },
    { id: "technician", label: "Technician" },
    { id: "ticket_number", label: "Ticket / job #" },
    { id: "office_notes", label: "Office Notes → Site Intel" },
    { id: "internal_access", label: "Internal Access Instructions → Site Intel" },
  ];

  var GUESS_EQUIP = {
    location_line: ["location", "location line", "site", "customer location", "address line"],
    customer_name: ["customer", "customer name", "company", "account", "site name"],
    site_address: ["address", "street", "site address", "service address"],
    serial_number: ["serial", "serial_num", "serial number", "s/n", "sn"],
    model_number: ["model", "model #", "model number"],
    manufacturer: ["manufacturer", "mfg", "make"],
    brand: ["brand"],
    unit_tag: ["unit", "unit tag", "unit #", "asset tag", "equipment id"],
    equipment_type: ["type", "equipment type", "class"],
    install_date: ["install", "install date"],
    equipment_notes: ["notes", "equipment notes", "description"],
    office_notes: ["office notes", "office note", "dispatcher notes"],
    internal_access: ["internal access", "access instructions", "gate code", "lockbox"],
  };

  var GUESS_HISTORY = {
    location_line: ["location", "location line", "site", "customer location"],
    customer_name: ["customer", "customer name", "company"],
    site_address: ["address", "street", "site address"],
    work_performed: ["work performed", "work", "description", "notes", "summary", "diagnosis"],
    service_date: ["date", "service date", "completed", "completed date"],
    technician: ["tech", "technician", "resource"],
    ticket_number: ["ticket", "job", "wo", "work order", "invoice"],
    office_notes: ["office notes", "office note"],
    internal_access: ["internal access", "access instructions", "gate code"],
  };

  function guessMapping(headers, mode) {
    var guess = mode === "history" ? GUESS_HISTORY : GUESS_EQUIP;
    var map = {};
    var used = {};
    var hNorm = headers.map(normHeader);
    var ids = Object.keys(guess);
    for (var g = 0; g < ids.length; g++) {
      var fid = ids[g];
      var aliases = guess[fid];
      for (var a = 0; a < aliases.length; a++) {
        var al = aliases[a];
        for (var i = 0; i < hNorm.length; i++) {
          if (used[i]) continue;
          if (hNorm[i] === al || hNorm[i].indexOf(al) >= 0 || al.indexOf(hNorm[i]) >= 0) {
            map[fid] = headers[i];
            used[i] = true;
            break;
          }
        }
        if (map[fid]) break;
      }
    }
    return map;
  }

  function rowObject(row, headers, mapping) {
    var o = {};
    var ids = Object.keys(mapping);
    for (var i = 0; i < ids.length; i++) {
      var fid = ids[i];
      var hdr = mapping[fid];
      if (!hdr) continue;
      var hi = headers.indexOf(hdr);
      if (hi < 0) continue;
      o[fid] = row[hi] != null ? String(row[hi]).trim() : "";
    }
    return o;
  }

  function buildLocationLine(rowObj) {
    if (rowObj.location_line) return String(rowObj.location_line).trim();
    var cn = String(rowObj.customer_name || "").trim();
    var addr = String(rowObj.site_address || "").trim();
    if (cn && addr) return cn + " — " + addr;
    if (cn) return cn;
    return addr;
  }

  function equipDocId(nk, serial) {
    var raw = String(nk || "") + "|" + String(serial || "");
    var h = 5381;
    for (var i = 0; i < raw.length; i++) {
      h = (h * 33) ^ raw.charCodeAt(i);
    }
    return "vc_imp_eq_" + (h >>> 0).toString(16);
  }

  function historyDocId(nk, work, dateStr, idx) {
    var raw = String(nk || "") + "|" + String(work || "") + "|" + String(dateStr || "") + "|" + idx;
    var h = 5381;
    for (var i = 0; i < raw.length; i++) {
      h = (h * 33) ^ raw.charCodeAt(i);
    }
    return "vc_imp_hist_" + (h >>> 0).toString(16);
  }

  function pushSiteIntelFragment(mergeMap, locationLine, label, text) {
    if (!text || !String(text).trim()) return;
    var loc = String(locationLine || "").trim();
    if (!loc) return;
    var nk = normalizeLocationKey(loc);
    var docId = siteIntelDocIdFromLocationLine(loc);
    if (!docId) return;
    if (!mergeMap.has(docId)) {
      mergeMap.set(docId, { locationDisplay: loc, normalizedKey: nk, fragments: [] });
    }
    mergeMap.get(docId).fragments.push(String(label) + ": " + String(text).trim());
  }

  function runWriteBatches(db, writes, onProgress, totalOverride) {
    var total = totalOverride != null ? totalOverride : writes.length;
    var committed = 0;
    var i = 0;
    function chunk() {
      if (i >= writes.length) return Promise.resolve();
      var batch = db.batch();
      var end = Math.min(i + BATCH_SIZE, writes.length);
      for (; i < end; i++) {
        var w = writes[i];
        batch.set(w.ref, w.data, { merge: !!w.merge });
      }
      return batch.commit().then(function () {
        committed = i;
        if (onProgress) onProgress(committed, total);
        return chunk();
      });
    }
    return chunk();
  }

  function mergeSiteIntelMap(db, mergeMap, onProgress) {
    var entries = Array.from(mergeMap.entries());
    if (entries.length === 0) return Promise.resolve();
    var done = 0;
    function step(idx) {
      if (idx >= entries.length) return Promise.resolve();
      var docId = entries[idx][0];
      var payload = entries[idx][1];
      var frag = payload.fragments.join("\n\n");
      if (typeof VCFirestore === "undefined" || !VCFirestore.getSiteIntelDocOnceBridged) {
        return Promise.reject(new Error("VCFirestore not available"));
      }
      return VCFirestore.getSiteIntelDocOnceBridged(db, docId).then(function (got) {
        var prev = got.exists && got.data ? String(got.data.notes || "") : "";
        var next = prev ? prev + "\n\n--- Legacy import ---\n" + frag : frag;
        return VCFirestore.setSiteIntelMerged(
          db,
          docId,
          {
            notes: next,
            locationDisplay: payload.locationDisplay,
            normalizedKey: payload.normalizedKey,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedByTech: "Legacy Import",
          },
          true
        );
      }).then(function () {
        done++;
        if (onProgress) onProgress(done, entries.length);
        return step(idx + 1);
      });
    }
    return step(0);
  }

  /**
   * @param {firebase.firestore.Firestore} db
   * @param {string[][]} rows data rows (no header)
   * @param {string[]} headers
   * @param {Object.<string,string>} mapping vc field id -> csv header
   * @param {{ legacySource?: string }} options
   * @param {function(number,number)} onProgress
   */
  function processEquipmentImport(db, rows, headers, mapping, options, onProgress) {
    var legacySource = (options && options.legacySource) || LEGACY_SOURCE_DEFAULT;
    if (typeof VCFirestore === "undefined") {
      return Promise.reject(new Error("VCFirestore not available"));
    }
    var eqCol = VCFirestore.tenantImportedEquipment(db);
    var mergeMap = new global.Map();
    var writes = [];
    var r;
    for (r = 0; r < rows.length; r++) {
      var row = rows[r];
      var ro = rowObject(row, headers, mapping);
      var locationLine = buildLocationLine(ro);
      var nk = normalizeLocationKey(locationLine);
      if (!nk) continue;
      var serial = String(ro.serial_number || "").trim() || "unknown-" + r;
      var docId = equipDocId(nk, serial);
      pushSiteIntelFragment(mergeMap, locationLine, "Office Notes", ro.office_notes);
      pushSiteIntelFragment(mergeMap, locationLine, "Internal Access", ro.internal_access);
      writes.push({
        ref: eqCol.doc(docId),
        data: {
          normalizedLocationKey: nk,
          locationDisplay: locationLine,
          serialNumber: ro.serial_number || "",
          modelNumber: ro.model_number || "",
          manufacturer: ro.manufacturer || "",
          brand: ro.brand || "",
          unitTag: ro.unit_tag || "",
          equipmentType: ro.equipment_type || "",
          installDate: ro.install_date || "",
          notes: ro.equipment_notes || "",
          isLegacyImport: true,
          legacySource: legacySource,
          importedAt: firebase.firestore.FieldValue.serverTimestamp(),
          sourceRowIndex: r,
        },
        merge: true,
      });
    }
    var totalPhases = writes.length + mergeMap.size;
    if (totalPhases === 0 && onProgress) onProgress(0, 0);
    return runWriteBatches(db, writes, onProgress, totalPhases).then(function () {
      return mergeSiteIntelMap(db, mergeMap, function (d, t) {
        if (onProgress) onProgress(writes.length + d, totalPhases);
      });
    });
  }

  /**
   * @param {firebase.firestore.Firestore} db
   * @param {string[][]} rows
   * @param {string[]} headers
   * @param {Object.<string,string>} mapping
   * @param {{ legacySource?: string }} options
   * @param {function(number,number)} onProgress
   */
  function processHistoryImport(db, rows, headers, mapping, options, onProgress) {
    var legacySource = (options && options.legacySource) || LEGACY_SOURCE_DEFAULT;
    if (typeof VCFirestore === "undefined") {
      return Promise.reject(new Error("VCFirestore not available"));
    }
    var crCol = VCFirestore.completedReports(db);
    var mergeMap = new global.Map();
    var writes = [];
    var r;
    for (r = 0; r < rows.length; r++) {
      var row = rows[r];
      var ro = rowObject(row, headers, mapping);
      var locationLine = buildLocationLine(ro);
      var nk = normalizeLocationKey(locationLine);
      if (!nk) continue;
      var work = String(ro.work_performed || "").trim();
      if (!work) continue;
      var docId = historyDocId(nk, work, ro.service_date || "", r);
      pushSiteIntelFragment(mergeMap, locationLine, "Office Notes", ro.office_notes);
      pushSiteIntelFragment(mergeMap, locationLine, "Internal Access", ro.internal_access);
      var payload = {
        fullReportText: work,
        techName: ro.technician || "Legacy Import",
        linkedTicketId: ro.ticket_number ? String(ro.ticket_number) : "Legacy",
        status: "Completed",
        locationDisplay: locationLine,
        normalizedLocationKey: nk,
        legacyServiceDate: ro.service_date || "",
        legacyTicketNumber: ro.ticket_number || "",
        isLegacyImport: true,
        legacySource: legacySource,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        deviceSavedAt: new Date().toISOString(),
      };
      writes.push({
        ref: crCol.doc(docId),
        data: payload,
        merge: true,
      });
    }
    var totalPhases = writes.length + mergeMap.size;
    if (totalPhases === 0 && onProgress) onProgress(0, 0);
    return runWriteBatches(db, writes, onProgress, totalPhases).then(function () {
      return mergeSiteIntelMap(db, mergeMap, function (d, t) {
        if (onProgress) onProgress(writes.length + d, totalPhases);
      });
    });
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  var state = {
    step: 1,
    mode: "equipment",
    fileName: "",
    headers: [],
    dataRows: [],
    mapping: {},
    legacySource: LEGACY_SOURCE_DEFAULT,
  };

  function updateImportHubStepDots() {
    var overlay = document.getElementById("vcImportHubOverlay");
    if (!overlay) return;
    overlay.querySelectorAll(".vc-import-hub-step").forEach(function (el) {
      var n = parseInt(el.getAttribute("data-step"), 10);
      el.classList.toggle("active", n === state.step);
    });
  }

  function renderStepContent(root) {
    root.innerHTML = "";
    if (state.step === 1) {
      var dz = el("div", "vc-import-hub-dropzone", "");
      dz.innerHTML =
        '<p class="vc-import-hub-dropzone-title">Drop a CSV here or click to browse</p>' +
        '<p class="vc-import-hub-hint">Equipment inventory or service history export (UTF-8).</p>' +
        '<input type="file" accept=".csv,text/csv" class="vc-import-hub-file" />';
      var inp = dz.querySelector(".vc-import-hub-file");
      var pick = el("div", "vc-import-hub-mode", "");
      pick.innerHTML =
        '<label><input type="radio" name="vcImpMode" value="equipment" ' +
        (state.mode === "equipment" ? "checked" : "") +
        "/> Equipment</label>" +
        '<label><input type="radio" name="vcImpMode" value="history" ' +
        (state.mode === "history" ? "checked" : "") +
        "/> Service history</label>";
      pick.querySelectorAll('input[name="vcImpMode"]').forEach(function (radio) {
        radio.addEventListener("change", function () {
          state.mode = radio.value;
        });
      });
      dz.addEventListener("click", function () {
        inp.click();
      });
      dz.addEventListener("dragover", function (ev) {
        ev.preventDefault();
        dz.classList.add("vc-import-hub-dropzone-active");
      });
      dz.addEventListener("dragleave", function () {
        dz.classList.remove("vc-import-hub-dropzone-active");
      });
      dz.addEventListener("drop", function (ev) {
        ev.preventDefault();
        dz.classList.remove("vc-import-hub-dropzone-active");
        var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (f) loadFile(f);
      });
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0];
        if (f) loadFile(f);
      });
      function loadFile(file) {
        state.fileName = file.name;
        var reader = new FileReader();
        reader.onload = function () {
          var text = String(reader.result || "");
          var all = parseCsv(text);
          if (all.length < 2) {
            alert("CSV needs a header row and at least one data row.");
            return;
          }
          state.headers = all[0].map(function (h) {
            return String(h).trim();
          });
          state.dataRows = all.slice(1);
          state.mapping = guessMapping(state.headers, state.mode);
          state.step = 2;
          renderStepContent(root);
        };
        reader.readAsText(file, "UTF-8");
      }
      root.appendChild(pick);
      root.appendChild(dz);
      if (state.fileName) {
        root.appendChild(el("p", "vc-import-hub-meta", "Loaded: " + state.fileName + " (" + state.dataRows.length + " rows)"));
      }
      updateImportHubStepDots();
    } else if (state.step === 2) {
      var fields = state.mode === "history" ? HISTORY_FIELDS : EQUIPMENT_FIELDS;
      var table = el("table", "vc-import-hub-map-table", "");
      var thead = el("thead", "", "");
      thead.innerHTML = "<tr><th>Vertex-Core field</th><th>CSV column</th></tr>";
      var tbody = el("tbody", "", "");
      fields.forEach(function (f) {
        var tr = el("tr", "", "");
        var td1 = el("td", "", f.label);
        var td2 = el("td", "", "");
        var sel = document.createElement("select");
        sel.dataset.fid = f.id;
        var opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "— Skip —";
        sel.appendChild(opt0);
        state.headers.forEach(function (h) {
          var o = document.createElement("option");
          o.value = h;
          o.textContent = h;
          if (state.mapping[f.id] === h) o.selected = true;
          sel.appendChild(o);
        });
        td2.appendChild(sel);
        tr.appendChild(td1);
        tr.appendChild(td2);
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      root.appendChild(table);
      var nav2 = el("div", "vc-import-hub-nav", "");
      nav2.innerHTML =
        '<button type="button" class="vc-import-hub-btn secondary" id="vcImpBack">Back</button>' +
        '<button type="button" class="vc-import-hub-btn" id="vcImpNext">Continue</button>';
      root.appendChild(nav2);
      nav2.querySelector("#vcImpBack").addEventListener("click", function () {
        state.step = 1;
        renderStepContent(root);
      });
      nav2.querySelector("#vcImpNext").addEventListener("click", function () {
        var selList = root.querySelectorAll("select[data-fid]");
        var m = {};
        selList.forEach(function (s) {
          var fid = s.getAttribute("data-fid");
          if (s.value) m[fid] = s.value;
        });
        state.mapping = m;
        state.step = 3;
        renderStepContent(root);
      });
      updateImportHubStepDots();
    } else {
      var previewRows = state.dataRows.slice(0, 5);
      var prevTitle = el("h4", "", "Preview (first " + previewRows.length + " rows)");
      root.appendChild(prevTitle);
      var ptable = el("table", "vc-import-hub-preview-table", "");
      var ptr = el("tr", "", "");
      state.headers.forEach(function (h) {
        ptr.appendChild(el("th", "", h));
      });
      var pthead = el("thead", "", "");
      pthead.appendChild(ptr);
      ptable.appendChild(pthead);
      var ptbody = el("tbody", "", "");
      previewRows.forEach(function (row) {
        var tr = el("tr", "", "");
        row.forEach(function (cell) {
          tr.appendChild(el("td", "", String(cell)));
        });
        ptbody.appendChild(tr);
      });
      ptable.appendChild(ptbody);
      root.appendChild(ptable);
      var srcRow = el("label", "vc-import-hub-legacy-src", "");
      srcRow.appendChild(document.createTextNode("Legacy source label "));
      var srcInp = document.createElement("input");
      srcInp.type = "text";
      srcInp.id = "vcImpLegacySrc";
      srcInp.value = state.legacySource;
      srcRow.appendChild(srcInp);
      root.appendChild(srcRow);
      var progWrap = el("div", "vc-import-hub-progress-wrap hidden", "");
      progWrap.innerHTML =
        '<div class="vc-import-hub-progress-bar"><div class="vc-import-hub-progress-fill" style="width:0%"></div></div>' +
        '<p class="vc-import-hub-progress-text"></p>';
      root.appendChild(progWrap);
      var nav3 = el("div", "vc-import-hub-nav", "");
      nav3.innerHTML =
        '<button type="button" class="vc-import-hub-btn secondary" id="vcImpBack3">Back</button>' +
        '<button type="button" class="vc-import-hub-btn primary" id="vcImpCommit">Validate &amp; commit</button>';
      root.appendChild(nav3);
      nav3.querySelector("#vcImpBack3").addEventListener("click", function () {
        state.step = 2;
        renderStepContent(root);
      });
      nav3.querySelector("#vcImpCommit").addEventListener("click", function () {
        state.legacySource = (srcInp && srcInp.value.trim()) || LEGACY_SOURCE_DEFAULT;
        var db = firebase.firestore();
        var btn = nav3.querySelector("#vcImpCommit");
        btn.disabled = true;
        progWrap.classList.remove("hidden");
        var fill = progWrap.querySelector(".vc-import-hub-progress-fill");
        var ptext = progWrap.querySelector(".vc-import-hub-progress-text");
        var opts = { legacySource: state.legacySource };
        function onProg(done, total) {
          var pct = total > 0 ? Math.round((done / total) * 100) : 100;
          fill.style.width = pct + "%";
          ptext.textContent =
            "Successfully imported " +
            done.toLocaleString() +
            " / " +
            total.toLocaleString() +
            " records";
        }
        var run =
          state.mode === "history"
            ? processHistoryImport(db, state.dataRows, state.headers, state.mapping, opts, onProg)
            : processEquipmentImport(db, state.dataRows, state.headers, state.mapping, opts, onProg);
        run
          .then(function () {
            ptext.textContent = "Done. All records committed.";
            btn.disabled = false;
          })
          .catch(function (err) {
            console.error(err);
            alert("Import failed: " + (err && err.message ? err.message : String(err)));
            btn.disabled = false;
          });
      });
      updateImportHubStepDots();
    }
  }

  function openImportHub() {
    var overlay = document.getElementById("vcImportHubOverlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    state.step = 1;
    state.headers = [];
    state.dataRows = [];
    state.mapping = {};
    state.fileName = "";
    var body = document.getElementById("vcImportHubBody");
    if (body) renderStepContent(body);
  }

  function closeImportHub() {
    var overlay = document.getElementById("vcImportHubOverlay");
    if (!overlay) return;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  function initImportHub() {
    var btn = document.getElementById("vcOpenImportHubBtn");
    var overlay = document.getElementById("vcImportHubOverlay");
    if (!btn || !overlay || btn.dataset.vcBound) return;
    btn.dataset.vcBound = "1";
    btn.addEventListener("click", openImportHub);
    overlay.querySelector(".vc-import-hub-close").addEventListener("click", closeImportHub);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeImportHub();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImportHub);
  } else {
    initImportHub();
  }

  global.VCImportHub = {
    parseCsv: parseCsv,
    normalizeLocationKey: normalizeLocationKey,
    siteIntelDocIdFromLocationLine: siteIntelDocIdFromLocationLine,
    processEquipmentImport: processEquipmentImport,
    processHistoryImport: processHistoryImport,
    guessMapping: guessMapping,
    buildLocationLine: buildLocationLine,
  };
})(typeof window !== "undefined" ? window : this);
