/**
 * Enterprise User Import — Vertex-Core "Green Column" CSV (dispatcher).
 * Writes tenants/{tenantId}/users/{emailId}; optional training sandbox user + roster merge.
 */
(function (global) {
  "use strict";

  function normHeader(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  /** RFC-style CSV parse (handles quoted fields). */
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

  function mapHeaderIndex(headers) {
    var H = global.VC_USER_IMPORT_HEADERS || {};
    var idx = {};
    var keys = Object.keys(H);
    for (var r = 0; r < headers.length; r++) {
      var nh = normHeader(headers[r]);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var aliases = H[key] || [];
        for (var a = 0; a < aliases.length; a++) {
          if (normHeader(aliases[a]) === nh) {
            idx[key] = r;
            break;
          }
        }
      }
    }
    return idx;
  }

  function parseBool(v) {
    if (v == null || v === "") return false;
    var s = String(v).trim().toLowerCase();
    if (s === "true" || s === "yes" || s === "1" || s === "y") return true;
    if (s === "false" || s === "no" || s === "0" || s === "n") return false;
    return false;
  }

  function splitRoles(s) {
    return String(s || "")
      .split(/[,;|]/)
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  function emailDocId(email) {
    return String(email || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "unknown";
  }

  function payrollUpper(first, last) {
    return (String(first || "").trim() + " " + String(last || "").trim())
      .trim()
      .toUpperCase();
  }

  /** Same algorithm as Field `VcTimeTracker.payrollKeyFromName` / labor_logs doc ids (Shadow Mode presence). */
  function presenceKeyFromFullName(first, last) {
    var full = (String(first || "").trim() + " " + String(last || "").trim()).trim();
    return (
      String(full || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 64) || "USER"
    );
  }

  /**
   * @returns {{ rows: Array<object>, errors: string[], headerMap: object }}
   */
  function parseGreenColumnRows(csvText) {
    var errors = [];
    var rows = parseCsv(csvText);
    if (!rows.length) {
      errors.push("CSV is empty.");
      return { rows: [], errors: errors, headerMap: {} };
    }
    var headers = rows[0];
    var hm = mapHeaderIndex(headers);
    var req = ["firstName", "lastName", "email"];
    for (var i = 0; i < req.length; i++) {
      if (hm[req[i]] == null) {
        errors.push('Missing required column (Green Column): "' + req[i] + '" — check header spelling.');
      }
    }
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var cells = rows[r];
      function cell(key) {
        var ix = hm[key];
        if (ix == null) return "";
        return cells[ix] != null ? cells[ix] : "";
      }
      var first = cell("firstName");
      var last = cell("lastName");
      var email = String(cell("email") || "").trim().toLowerCase();
      if (!first.trim() && !last.trim() && !email) continue;
      var rowObj = {
        firstName: String(first).trim(),
        lastName: String(last).trim(),
        email: email,
        department: String(cell("department") || "").trim(),
        roles: splitRoles(cell("role")),
        isAdmin: parseBool(cell("isAdmin")),
        isTech: parseBool(cell("isTech")),
        isSales: parseBool(cell("isSales")),
        timeTrackingOnly: parseBool(cell("timeTrackingOnly")),
        password: String(cell("password") || "").trim(),
        payrollNameUpper: payrollUpper(first, last),
        _rowNum: r + 1,
      };
      if (!email || email.indexOf("@") < 1) {
        errors.push("Row " + rowObj._rowNum + ": invalid email.");
      }
      if (rowObj.password && typeof global.validateVcEnterprisePassword === "function") {
        var pv = global.validateVcEnterprisePassword(rowObj.password);
        if (!pv.ok) errors.push("Row " + rowObj._rowNum + ": " + pv.message);
      }
      out.push(rowObj);
    }
    return { rows: out, errors: errors, headerMap: hm };
  }

  /** Weekly service availability (dispatcher scheduling). Default all days on so imports do not restrict assignments. */
  function defaultUserAvailability() {
    return {
      mon: true,
      tue: true,
      wed: true,
      thu: true,
      fri: true,
      sat: true,
      sun: true,
    };
  }

  function buildUserPayload(row, opts) {
    var isTraining = !!opts.isTraining;
    var trainingEmail = opts.trainingEmail || "";
    return {
      firstName: row.firstName,
      lastName: row.lastName,
      email: isTraining ? trainingEmail : row.email,
      department: row.department,
      roles: row.roles,
      isAdmin: isTraining ? false : row.isAdmin,
      isTech: row.isTech,
      isSales: row.isSales,
      timeTrackingOnly: row.timeTrackingOnly,
      payrollFullName: (row.firstName + " " + row.lastName).trim(),
      payrollNameUpper: isTraining
        ? payrollUpper(row.firstName, row.lastName + " (TRAINING)")
        : row.payrollNameUpper,
      presenceKey: presenceKeyFromFullName(row.firstName, row.lastName),
      isTrainingAccount: isTraining,
      mirrorLiveEmail: isTraining ? row.email : null,
      availability: defaultUserAvailability(),
      importSource: "green_column_csv",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  function runImport(parsed, options) {
    var cb = options || {};
    var createTraining = !!cb.createTraining;
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      return Promise.reject(new Error("Firebase not initialized."));
    }
    if (typeof VCFirestore === "undefined" || !VCFirestore.tenantUsers) {
      return Promise.reject(new Error("VCFirestore.tenantUsers missing."));
    }
    var db = firebase.firestore();
    var users = VCFirestore.tenantUsers(db);
    var batch = db.batch();
    var techNames = [];
    var count = 0;
    parsed.rows.forEach(function (row) {
      var id = emailDocId(row.email);
      var ref = users.doc(id);
      batch.set(ref, buildUserPayload(row, { isTraining: false }), { merge: true });
      count++;
      if (row.isTech) {
        techNames.push(row.payrollNameUpper);
      }
      if (createTraining) {
        var te =
          typeof global.trainingEmailFromPrimary === "function"
            ? global.trainingEmailFromPrimary(row.email)
            : "";
        if (te) {
          var tid = emailDocId(te);
          batch.set(users.doc(tid), buildUserPayload(row, { isTraining: true, trainingEmail: te }), { merge: true });
          count++;
          techNames.push(payrollUpper(row.firstName, row.lastName + " (TRAINING)"));
        }
      }
    });
    return batch.commit().then(function () {
      if (typeof global.mergeImportedTechsIntoRoster === "function") {
        global.mergeImportedTechsIntoRoster(techNames);
      }
      return { written: count, techNames: techNames };
    });
  }

  function renderPreviewTable(parsed) {
    var esc = function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };
    var html =
      '<table class="vc-user-import-table" style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;">';
    html +=
      "<thead><tr style=\"background:#f1f5f9;text-align:left;\">" +
      "<th style=\"padding:8px;border:1px solid #e2e8f0;\">Name</th>" +
      "<th style=\"padding:8px;border:1px solid #e2e8f0;\">Email</th>" +
      "<th style=\"padding:8px;border:1px solid #e2e8f0;\">Dept</th>" +
      "<th style=\"padding:8px;border:1px solid #e2e8f0;\">Roles</th>" +
      "<th style=\"padding:8px;border:1px solid #e2e8f0;\">Flags</th>" +
      "</tr></thead><tbody>";
    parsed.rows.forEach(function (row) {
      var tt = row.timeTrackingOnly;
      var bg = tt ? "#fffbeb" : "#fff";
      var flags = [];
      if (row.isAdmin) flags.push("Admin");
      if (row.isTech) flags.push("Tech");
      if (row.isSales) flags.push("Sales");
      if (tt) flags.push("Time-only");
      html +=
        '<tr style="background:' +
        bg +
        ';">' +
        "<td style=\"padding:8px;border:1px solid #e2e8f0;\">" +
        esc(row.firstName + " " + row.lastName) +
        "</td>" +
        "<td style=\"padding:8px;border:1px solid #e2e8f0;\">" +
        esc(row.email) +
        "</td>" +
        "<td style=\"padding:8px;border:1px solid #e2e8f0;\">" +
        esc(row.department) +
        "</td>" +
        "<td style=\"padding:8px;border:1px solid #e2e8f0;\">" +
        esc(row.roles.join(", ")) +
        "</td>" +
        "<td style=\"padding:8px;border:1px solid #e2e8f0;\">" +
        esc(flags.join(", ") || "—") +
        "</td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function wireUi() {
    var file = document.getElementById("vcUserImportFile");
    var prev = document.getElementById("vcUserImportPreview");
    var errEl = document.getElementById("vcUserImportErrors");
    var btn = document.getElementById("vcUserImportRun");
    var trainCb = document.getElementById("vcUserImportCreateTraining");
    if (!file || !prev) return;

    var lastParsed = null;

    file.addEventListener("change", function () {
      lastParsed = null;
      prev.innerHTML = "";
      if (errEl) errEl.textContent = "";
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var parsed = parseGreenColumnRows(String(reader.result || ""));
        lastParsed = parsed;
        if (errEl) {
          errEl.innerHTML =
            parsed.errors.length
              ? '<span style="color:#c0392b;">' + parsed.errors.map(escHtml).join("<br/>") + "</span>"
              : "";
        }
        if (parsed.rows.length) {
          prev.innerHTML = renderPreviewTable(parsed);
        }
      };
      reader.readAsText(f);
    });

    if (btn) {
      btn.addEventListener("click", function () {
        if (!lastParsed || !lastParsed.rows.length) {
          if (typeof global.showSaveCue === "function") global.showSaveCue("⚠ Choose a valid CSV first.");
          return;
        }
        var blocking = lastParsed.errors.filter(function (e) {
          return /invalid email|Password must/i.test(e);
        });
        if (blocking.length) {
          if (typeof global.showSaveCue === "function") global.showSaveCue("⚠ Fix errors before import: " + blocking.join("; "));
          return;
        }
        btn.disabled = true;
        runImport(lastParsed, { createTraining: trainCb && trainCb.checked })
          .then(function (res) {
            if (typeof global.showSaveCue === "function") global.showSaveCue("✓ Imported " + res.written + " user document(s). Roster updated for tech names.");
          })
          .catch(function (e) {
            if (typeof global.showSaveCue === "function") global.showSaveCue("⚠ " + (e && e.message ? e.message : String(e)));
          })
          .finally(function () {
            btn.disabled = false;
          });
      });
    }
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  global.VcUserImport = {
    parseCsv: parseCsv,
    parseGreenColumnRows: parseGreenColumnRows,
    runImport: runImport,
    renderPreviewTable: renderPreviewTable,
    emailDocId: emailDocId,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUi);
  } else {
    wireUi();
  }
})(typeof window !== "undefined" ? window : this);
