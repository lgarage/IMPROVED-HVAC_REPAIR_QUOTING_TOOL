/**
 * Vendor Directory — CRUD for parts supplier contacts.
 * Phase 64 / Slice 64d.
 *
 * Uses VCFirestore.vendors(db) when available (tenant-aware path),
 * falls back to db.collection("vendors") for local/legacy setups.
 *
 * Gate: none (always active once script is loaded).
 * Rollback: remove this file + its <script> tag + HTML block in index.html.
 */
(function () {
  "use strict";

  var VENDOR_CATEGORIES = [
    { id: "motors", label: "Motors" },
    { id: "capacitors", label: "Capacitors" },
    { id: "belts", label: "Belts & Pulleys" },
    { id: "coils", label: "Coils" },
    { id: "controls", label: "Controls & Boards" },
    { id: "refrigerant", label: "Refrigerant & Supplies" },
    { id: "sheet_metal", label: "Sheet Metal" },
    { id: "general_parts", label: "General Parts" }
  ];

  /* ── Firestore ref ────────────────────────────────────────────── */

  function getVendorsRef() {
    var db = firebase.firestore();
    return window.VCFirestore && typeof window.VCFirestore.vendors === "function"
      ? window.VCFirestore.vendors(db)
      : db.collection("vendors");
  }

  /* ── Load & render ────────────────────────────────────────────── */

  function loadVendors() {
    var target = document.getElementById("vendorListTarget");
    if (!target) return;
    target.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:24px;">Loading vendors…</p>';

    getVendorsRef()
      .orderBy("name")
      .get()
      .then(function (snapshot) {
        if (snapshot.empty) {
          target.innerHTML =
            '<div style="text-align:center;padding:40px 20px;color:#94a3b8;">' +
            '<p style="font-size:18px;margin-bottom:8px;">No vendors added yet.</p>' +
            '<p style="font-size:14px;">Click <strong>+ Add Vendor</strong> to get started.</p>' +
            "</div>";
          return;
        }

        var html = "";
        snapshot.forEach(function (doc) {
          var v = doc.data();
          var id = doc.id;
          var cats = Array.isArray(v.categories) ? v.categories : [];
          var catChips = cats
            .map(function (cid) {
              var match = VENDOR_CATEGORIES.filter(function (c) { return c.id === cid; })[0];
              var label = match ? match.label : cid;
              return (
                '<span style="display:inline-block;background:#e0f2fe;color:#0369a1;' +
                'padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;">' +
                escHtml(label) +
                "</span>"
              );
            })
            .join(" ");

          html +=
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;' +
            'padding:16px;margin-bottom:12px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">' +
            '<div style="flex:1;min-width:200px;">' +
            '<div style="font-weight:700;font-size:16px;color:#1e293b;margin-bottom:4px;">' +
            escHtml(v.name || "(unnamed)") +
            "</div>" +
            (v.email
              ? '<div style="font-size:13px;color:#475569;margin-bottom:2px;">📧 ' +
                escHtml(v.email) +
                "</div>"
              : "") +
            (v.phone
              ? '<div style="font-size:13px;color:#475569;margin-bottom:2px;">📞 ' +
                escHtml(v.phone) +
                "</div>"
              : "") +
            (cats.length
              ? '<div style="margin-top:6px;">' + catChips + "</div>"
              : "") +
            (v.notes
              ? '<div style="font-size:13px;color:#64748b;margin-top:6px;font-style:italic;">' +
                escHtml(v.notes) +
                "</div>"
              : "") +
            "</div>" +
            '<div style="display:flex;gap:6px;flex-shrink:0;">' +
            '<button onclick="openVendorForm(\'' +
            id +
            '\')" style="background:none;border:1px solid #cbd5e1;border-radius:6px;' +
            'padding:6px 12px;cursor:pointer;font-size:13px;color:#475569;">✏️ Edit</button>' +
            '<button onclick="deleteVendor(\'' +
            id +
            '\')" style="background:none;border:1px solid #fca5a5;border-radius:6px;' +
            'padding:6px 12px;cursor:pointer;font-size:13px;color:#dc2626;">🗑️ Delete</button>' +
            "</div>" +
            "</div>" +
            "</div>";
        });

        target.innerHTML = html;
      })
      .catch(function (err) {
        console.error("[VendorDirectory] loadVendors error:", err);
        target.innerHTML =
          '<p style="color:#ef4444;text-align:center;padding:24px;">Failed to load vendors. Check console.</p>';
      });
  }

  /* ── Form: open / close ───────────────────────────────────────── */

  function renderCategoryCheckboxes(selected) {
    var container = document.getElementById("vendorCategoriesContainer");
    if (!container) return;
    var sel = Array.isArray(selected) ? selected : [];
    container.innerHTML = VENDOR_CATEGORIES.map(function (cat) {
      var checked = sel.indexOf(cat.id) !== -1 ? " checked" : "";
      return (
        '<label style="display:inline-flex;align-items:center;gap:4px;font-size:13px;' +
        'color:#334155;background:#f1f5f9;padding:4px 10px;border-radius:16px;cursor:pointer;">' +
        '<input type="checkbox" class="vendor-cat-cb" value="' +
        cat.id +
        '"' +
        checked +
        ' style="accent-color:#0ea5e9;"> ' +
        escHtml(cat.label) +
        "</label>"
      );
    }).join("");
  }

  function openVendorForm(vendorId) {
    var modal = document.getElementById("vendorFormModal");
    var titleEl = document.getElementById("vendorFormTitle");
    var editIdEl = document.getElementById("vendorEditId");
    if (!modal) return;

    document.getElementById("vendorNameInput").value = "";
    document.getElementById("vendorEmailInput").value = "";
    document.getElementById("vendorPhoneInput").value = "";
    document.getElementById("vendorNotesInput").value = "";
    editIdEl.value = "";
    renderCategoryCheckboxes([]);

    if (vendorId) {
      titleEl.textContent = "Edit Vendor";
      editIdEl.value = vendorId;
      getVendorsRef()
        .doc(vendorId)
        .get()
        .then(function (snap) {
          if (!snap.exists) return;
          var v = snap.data();
          document.getElementById("vendorNameInput").value = v.name || "";
          document.getElementById("vendorEmailInput").value = v.email || "";
          document.getElementById("vendorPhoneInput").value = v.phone || "";
          document.getElementById("vendorNotesInput").value = v.notes || "";
          renderCategoryCheckboxes(v.categories || []);
        })
        .catch(function (err) {
          console.error("[VendorDirectory] load vendor for edit error:", err);
        });
    } else {
      titleEl.textContent = "Add Vendor";
    }

    modal.style.display = "flex";
  }

  function closeVendorForm() {
    var modal = document.getElementById("vendorFormModal");
    if (modal) modal.style.display = "none";
  }

  /* ── Save ─────────────────────────────────────────────────────── */

  function saveVendor() {
    var name = (document.getElementById("vendorNameInput").value || "").trim();
    if (!name) {
      alert("Vendor name is required.");
      return;
    }

    var email = (document.getElementById("vendorEmailInput").value || "").trim();
    var phone = (document.getElementById("vendorPhoneInput").value || "").trim();
    var notes = (document.getElementById("vendorNotesInput").value || "").trim();
    var editId = (document.getElementById("vendorEditId").value || "").trim();

    var checkboxes = document.querySelectorAll(".vendor-cat-cb");
    var categories = [];
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) categories.push(checkboxes[i].value);
    }

    var data = {
      name: name,
      email: email,
      phone: phone,
      categories: categories,
      notes: notes,
      active: true,
      updatedAt: new Date().toISOString()
    };

    var ref = getVendorsRef();
    var promise;

    if (editId) {
      promise = ref.doc(editId).set(data, { merge: true });
    } else {
      data.createdAt = new Date().toISOString();
      promise = ref.add(data);
    }

    promise
      .then(function () {
        closeVendorForm();
        loadVendors();
      })
      .catch(function (err) {
        console.error("[VendorDirectory] saveVendor error:", err);
        alert("Failed to save vendor. Check console for details.");
      });
  }

  /* ── Delete ───────────────────────────────────────────────────── */

  function deleteVendor(vendorId) {
    if (!confirm("Delete this vendor? This cannot be undone.")) return;

    getVendorsRef()
      .doc(vendorId)
      .delete()
      .then(function () {
        loadVendors();
      })
      .catch(function (err) {
        console.error("[VendorDirectory] deleteVendor error:", err);
        alert("Failed to delete vendor. Check console for details.");
      });
  }

  /* ── Util ─────────────────────────────────────────────────────── */

  function escHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ── Expose globally (vanilla JS, no module system) ───────────── */

  window.loadVendors = loadVendors;
  window.openVendorForm = openVendorForm;
  window.closeVendorForm = closeVendorForm;
  window.saveVendor = saveVendor;
  window.deleteVendor = deleteVendor;
})();
