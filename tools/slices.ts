/**
 * Slice definitions for the New Field Tech UX phased build.
 * Each slice has scope, files, patterns (for model lookup), validation checks,
 * and push safety level.
 */

import { ARCHIVED_SLICES } from "./slices_archive";

export interface Slice {
  id: string;
  phase: number;
  title: string;
  dependsOn: string[];
  patterns: string[];       // match against MODEL_LOOKUP.md Pattern column
  riskLevel: "safe" | "review";  // safe = auto-push, review = commit only
  reviewChecklist?: string[];   // required for review slices — specific steps for human to verify before push
  filesToCreate: string[];
  filesToModify: string[];
  expectedIds: string[];    // HTML element IDs to verify after build
  expectedExports: Record<string, string[]>;  // file → exported function names
  scope: string;            // detailed scope description for the agent prompt
  outOfScope: string;
  cacheBusts: string[];     // e.g. "conversational_timeline.js?v=1"
  htmlTarget?: string;      // which HTML file to validate IDs/scripts against (default: "technician/index.html")
  uiChange?: boolean;       // if true, build runner takes before/after Playwright screenshots and verifies with a cheap model
  playwrightSteps?: string[]; // optional JS lines injected into the generated Playwright script after login and before the final screenshot; used with uiChange:true to test a specific click flow
}

// Slices 41a–57a have been moved to slices_archive.ts (all passed).
// Add new slices here; they will be auto-archived once they pass and
// SLICES.length exceeds MAX_ACTIVE_SLICES in build_runner.ts.

const PHASE_64_ACTIVE = ["64a", "64b", "64c", "64e"].map((id) => {
  const slice = ARCHIVED_SLICES.find((entry) => entry.id === id);
  if (!slice) {
    throw new Error(`Missing archived slice ${id}`);
  }
  return slice;
});

export const SLICES: Slice[] = [
  // ═══════════════════════════════════════════════════════════
  //  Phase 58: KI-002 Hygiene Leftovers
  //  All items from ROADMAP.md → Minor Tweaks & Polish
  // ═══════════════════════════════════════════════════════════

  
  
  
  
  
  

  // ═══════════════════════════════════════════════════════════
  //  Phase 59: Security Hardening
  // ═══════════════════════════════════════════════════════════

  
  
  

  // ═══════════════════════════════════════════════════════════
  //  Phase 61: Security Polish & Tooling Hygiene
  //  Overnight-safe hardening: no app logic changes, no auth
  //  rollout required. Pure rules / sender tightening / tooling.
  // ═══════════════════════════════════════════════════════════

  

  

  

  

  

  // ═══════════════════════════════════════════════════════════
  //  Phase 60: Memory & Archive Hygiene
  // ═══════════════════════════════════════════════════════════

  
  // ═══════════════════════════════════════════════════════════
  //  Phase 62: Hygiene & Regression Fixes
  // ═══════════════════════════════════════════════════════════
  
  
  
  // ═══════════════════════════════════════════════════════════
  //  Phase 63: Field Intelligence — Contextual Checklists
  //  Multi-trigger words, adaptive reminders during
  //  conversational capture, experience-based prompting,
  //  photo auto-tie to equipment, post-compile history write.
  // ═══════════════════════════════════════════════════════════

  

  

  

  

  

  

  

  // ═══════════════════════════════════════════════════════════
  //  Phase 64: AI Quote Pipeline — Foundation (Phase A)
  //  Migrate office quotes to Firestore, port standalone
  //  quoting tool features, add vendor directory.
  //  Full spec: PROJECT_STATUS/ai_quote_pipeline_spec.md
  //  Phase B slices (64f–64i) below.
  //  Phase C (email automation) sliced after Phase B confirmed.
  // ═══════════════════════════════════════════════════════════

  

  

  

  ...PHASE_64_ACTIVE,

  {
    id: "64d",
    phase: 64,
    title: "Vendor directory — Firestore collection + CRUD UI",
    dependsOn: ["64a"],
    patterns: ["Firestore write path (new collection/doc)", "Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Dispatcher app → sidebar → confirm 'Vendors' nav item appears (below Quoting Tool or in a logical position).",
      "Click Vendors → confirm the vendor directory view loads with '+ Add Vendor' button and an empty table (or seeded data).",
      "Click + Add Vendor → fill name, email, phone, select categories (e.g. 'Motors', 'Controls') → Save → confirm vendor appears in the list.",
      "Firebase Console → tenants/TWIN_PILLARS/vendors → confirm the vendor document exists with correct fields.",
      "Click Edit on a vendor → modify the email → Save → confirm Firestore document updated.",
      "Click Delete on a vendor → confirm → verify removed from Firestore and the list.",
      "Add 3 vendors with different categories → confirm the category filter/display works correctly on vendor cards.",
      "Verify vendor data does NOT appear in the Quoting Tool yet (that integration is Phase B/C).",
    ],
    htmlTarget: "index.html",
    filesToCreate: ["vendor_directory.js"],
    filesToModify: ["index.html", "firestore.rules"],
    expectedIds: ["view-vendors", "nav-vendors", "vendorListTarget", "vendorAddBtn"],
    expectedExports: {},
    scope: `Add a vendor directory to the dispatcher app for managing parts supplier contacts.
This is the foundation for the AI-driven vendor email flow in Phase C.

## Firestore setup

The collection helper (VCFirestore.vendors) and Firestore rules were already added in 64a.
This slice only needs to use them.

## index.html — sidebar nav entry

Find the sidebar nav section (~line 2660-2690). Add a Vendors entry after Quoting Tool:
  <a id="nav-vendors" class="sidebar-nav-item" onclick="switchTab('vendors')">
    <span class="sidebar-icon">🏢</span>
    <span class="sidebar-label">Vendors</span>
  </a>

Ensure switchTab() in the existing JS handles 'vendors' — it likely uses a generic
pattern that shows #view-{tabName} and hides others. Verify this works; if not,
add 'vendors' to the tab list.

## index.html — #view-vendors section

Add a new view section after #view-quoting (~line 4789), before #view-invoice:

<div id="view-vendors" class="app-view" style="display:none;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
    <h2 style="color:#0ea5e9;margin:0;">🏢 Vendor Directory</h2>
    <button id="vendorAddBtn" onclick="openVendorForm()"
      style="background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:10px 20px;
      font-size:14px;cursor:pointer;font-weight:600;">
      + Add Vendor
    </button>
  </div>
  <div id="vendorListTarget"></div>

  <!-- Add/Edit Vendor Modal -->
  <div id="vendorFormModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);
    z-index:9999;display:none;align-items:center;justify-content:center;">
    <div style="background:#fff;border-radius:12px;padding:24px;max-width:500px;width:90%;
      max-height:80vh;overflow-y:auto;">
      <h3 id="vendorFormTitle" style="margin:0 0 16px;color:#1e293b;">Add Vendor</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <input type="hidden" id="vendorEditId" value="">
        <div>
          <label style="font-size:13px;font-weight:600;color:#475569;">Vendor Name *</label>
          <input type="text" id="vendorNameInput" placeholder="e.g. Johnstone Supply"
            style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:#475569;">Email</label>
          <input type="email" id="vendorEmailInput" placeholder="orders@vendor.com"
            style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:#475569;">Phone</label>
          <input type="tel" id="vendorPhoneInput" placeholder="920-555-1234"
            style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:#475569;">Categories (select all that apply)</label>
          <div id="vendorCategoriesContainer" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
            <!-- Rendered by JS: checkboxes for motors, capacitors, belts, coils, controls, refrigerant, sheet_metal, general_parts -->
          </div>
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:#475569;">Notes</label>
          <textarea id="vendorNotesInput" rows="2" placeholder="Best pricing on motors. Usually responds same day."
            style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-top:4px;resize:vertical;"></textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
        <button onclick="closeVendorForm()"
          style="background:none;border:1px solid #cbd5e1;border-radius:8px;padding:10px 20px;cursor:pointer;color:#64748b;">
          Cancel
        </button>
        <button onclick="saveVendor()"
          style="background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:600;">
          Save Vendor
        </button>
      </div>
    </div>
  </div>
</div>

## vendor_directory.js (new file)

Create vendor_directory.js in the repo root. This is a simple CRUD module:

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

Functions needed:

getVendorsRef():
  var db = firebase.firestore();
  return window.VCFirestore ? window.VCFirestore.vendors(db) : db.collection("vendors");

loadVendors():
  Query getVendorsRef().orderBy("name").get(), render cards into #vendorListTarget.
  Each card: vendor name (bold), email, phone, category chips, notes, Edit + Delete buttons.
  Empty state: "No vendors added yet. Click '+ Add Vendor' to get started."

openVendorForm(vendorId):
  If vendorId provided, load vendor data into form (edit mode). Otherwise clear form (add mode).
  Show #vendorFormModal (set display to 'flex').
  Render category checkboxes into #vendorCategoriesContainer from VENDOR_CATEGORIES.

closeVendorForm():
  Hide #vendorFormModal, clear form fields.

saveVendor():
  Read form fields. Validate name is non-empty.
  Build vendor object: { name, email, phone, categories: [checked category ids],
    notes, active: true, updatedAt: new Date().toISOString() }
  If editing (vendorEditId has value): getVendorsRef().doc(id).set(data, {merge:true})
  If new: add createdAt, getVendorsRef().add(data)
  On success: closeVendorForm(), loadVendors().

deleteVendor(vendorId):
  Confirm dialog. getVendorsRef().doc(vendorId).delete(). On success: loadVendors().

## index.html — script include

Add before the closing </body> tag, near other script includes (~line 9737):
  <script src="vendor_directory.js?v=1"></script>

Call loadVendors() in the switchTab handler or on DOMContentLoaded if the vendors tab
is active. The simplest approach: call loadVendors() inside the switchTab function
when tabName === 'vendors'.

Bump VC_BUILD.`,
    outOfScope: "Vendor email integration (Phase C). Vendor selection in the quoting tool (Phase B/C). AI vendor recommendation. Parts pricing history. Modifying quoting.js to use vendor data.",
    cacheBusts: [],
  },

  

  // ═══════════════════════════════════════════════════════════
  //  Phase 64 — Phase B: AI Field Pipeline
  //  Connects field conversation → structured quote_data →
  //  auto-drafted office quote. No email yet (Phase C).
  // ═══════════════════════════════════════════════════════════

  

  

  

  

  

  // ═══════════════════════════════════════════════════════════
  //  Phase 66: Admin Conversational Checklist Builder
  //  Managers/dispatchers chat (voice or text) to create and
  //  update form_templates. Tech phone preview before save.
  //  Entry point: admin PIN at sign-in → "ADMIN" session flag.
  // ═══════════════════════════════════════════════════════════

  

  

  

  

];
