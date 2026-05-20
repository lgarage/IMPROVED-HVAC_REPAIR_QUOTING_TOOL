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
  //  Phase 65: Issues-Found Fixes Batch (#15, #17, #18, #19, #21)
  //  Source: Slack #issues-found May 19 PM → tracker items 15–21.
  //  All field-app UX polish; no Firestore writes; no auth changes.
  // ═══════════════════════════════════════════════════════════

  {
    id: "65a",
    phase: 65,
    title: "Skip 'submit to office?' prompt when compiled result is empty or trivial",
    dependsOn: [],
    patterns: ["Single-file JS bugfix"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js", "technician/index.html"],
    expectedIds: [],
    expectedExports: {},
    scope: `Fix issues-found tracker #15: the "Submit to office first?" prompt (showCompileClosePrompt)
appears whenever the user closes the compile modal before submitting, even when the compiled
result contains no meaningful notes. Gate the prompt on non-empty content.

## File: conversational_timeline.js

### Change 1 — maybeCloseCompileModal (~line 3256)

Find the function maybeCloseCompileModal(). It currently reads:

  function maybeCloseCompileModal() {
    if (isHistoricalWorkspace()) {
      closeCompileModal({ enableAddendum: true });
      return;
    }
    if (_lastCompileResult && _compileSubmittedForTicket !== currentTicketId) {
      showCompileClosePrompt();
    } else {
      closeCompileModal();
    }
  }

Change the condition so the prompt only fires when the result has meaningful content
(more than 30 characters of trimmed text):

  function maybeCloseCompileModal() {
    if (isHistoricalWorkspace()) {
      closeCompileModal({ enableAddendum: true });
      return;
    }
    var hasContent = _lastCompileResult && _lastCompileResult.trim().length > 30;
    if (hasContent && _compileSubmittedForTicket !== currentTicketId) {
      showCompileClosePrompt();
    } else {
      closeCompileModal();
    }
  }

Also update window.ConversationalTimeline.hasUnsubmittedReport (~line 4529) to match:

  hasUnsubmittedReport: function () {
    return !!(
      _lastCompileResult &&
      _lastCompileResult.trim().length > 30 &&
      _compileSubmittedForTicket !== currentTicketId
    );
  },

## File: technician/index.html

Bump the conversational_timeline.js cache-bust version from ?v=77 to ?v=78 (~line 13705):
  <script src="../conversational_timeline.js?v=78"></script>

Update VC_BUILD (~line 7927):
  window.VC_BUILD = "IssuesFix65a-SkipSendPrompt-2026-05-19";`,
    outOfScope: "Changing when the compile modal auto-opens. Changing the submit flow itself. Adding parked-notes tracking beyond the existing _lastCompileResult variable.",
    cacheBusts: ["conversational_timeline.js?v=78"],
  },

  {
    id: "65b",
    phase: 65,
    title: "Compile modal — reduce top spacing so report content sits higher",
    dependsOn: ["65a"],
    patterns: ["CSS-only restyle / theme"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["technician/index.html"],
    expectedIds: ["ct-compile-modal"],
    expectedExports: {},
    uiChange: true,
    playwrightSteps: [
      `await page.locator('.job-card').first().click();`,
      `await page.waitForTimeout(3000);`,
      `// Try to open compile modal via the compile button if visible`,
      `const compileBtn = page.locator('#ct-compile-btn, .ct-compile-btn, [id*="compile"]').first();`,
      `if (await compileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {`,
      `  await compileBtn.click();`,
      `  await page.waitForTimeout(2000);`,
      `}`,
      `await page.screenshot({ path: '_ss_compile_modal.png' });`,
    ],
    scope: `Fix issues-found tracker #17: the compiled report content sits too low in the modal
on iPhone, leaving wasted space above the report text. Reduce top padding in the modal header
and body so content starts higher.

## File: technician/index.html — CSS changes only

### Change 1 — .ct-compile-header (~line 2704)

Current:
  .ct-compile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    background: linear-gradient(180deg, #13152a 0%, #151633 100%);
  }

Change padding from "14px 16px 10px" to "10px 16px 8px" (less top breathing room):
  padding: 10px 16px 8px;

### Change 2 — .ct-compile-body (~line 2736)

Current:
  .ct-compile-body {
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px;
  }

Change top padding from 14px to 8px:
  padding: 8px 16px 14px;

### Change 3 — .ct-compile-hint (~line 2741)

Current:
  .ct-compile-hint {
    margin: 0 0 10px;
    ...
  }

Change bottom margin from 10px to 6px:
  margin: 0 0 6px;

### Update VC_BUILD (~line 7927):
  window.VC_BUILD = "IssuesFix65b-CompileModalUp-2026-05-19";

Do NOT change any JavaScript, modal behavior, or button wiring. CSS padding changes only.`,
    outOfScope: "Changing modal height, border-radius, font sizes, button layout, or any JavaScript. Only the three CSS padding/margin values listed above.",
    cacheBusts: [],
  },

  {
    id: "65c",
    phase: 65,
    title: "Compile modal — add Schedule button for single-tap navigation to schedule",
    dependsOn: ["65a", "65b"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["technician/index.html", "conversational_timeline.js"],
    expectedIds: ["ct-compile-modal", "ct-compile-schedule-btn"],
    expectedExports: {},
    uiChange: true,
    playwrightSteps: [
      `await page.locator('.job-card').first().click();`,
      `await page.waitForTimeout(3000);`,
      `const compileBtn = page.locator('#ct-compile-btn, .ct-compile-btn, [id*="compile"]').first();`,
      `if (await compileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {`,
      `  await compileBtn.click();`,
      `  await page.waitForTimeout(2000);`,
      `}`,
      `await page.screenshot({ path: '_ss_compile_with_schedule.png' });`,
    ],
    scope: `Fix issues-found tracker #18: the user must tap × (close) then tap Schedule to return
to the schedule list. Add a "Schedule" button directly in the compile modal footer that closes
the modal and navigates to the schedule screen in one tap.

## File: technician/index.html — Part 1: HTML button

Find the compile modal actions div (~line 14184):
  <div class="ct-compile-actions">
    <button type="button" class="ct-compile-copy-btn">📋 Copy Summary</button>
    <button type="button" class="ct-compile-submit-btn">Submit to Office</button>
    <span class="ct-compile-status" aria-live="polite"></span>
  </div>

Add a Schedule button BEFORE the Copy button, and give it an id:
  <div class="ct-compile-actions">
    <button type="button" id="ct-compile-schedule-btn" class="ct-compile-schedule-btn">📅 Schedule</button>
    <button type="button" class="ct-compile-copy-btn">📋 Copy Summary</button>
    <button type="button" class="ct-compile-submit-btn">Submit to Office</button>
    <span class="ct-compile-status" aria-live="polite"></span>
  </div>

## File: technician/index.html — Part 2: CSS for Schedule button

Add a new CSS rule for .ct-compile-schedule-btn after .ct-compile-copy-btn styles (~line 2787).
Style it as a neutral outlined button (different from the blue submit and cyan copy):
  .ct-compile-schedule-btn {
    padding: 12px 18px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    border-radius: 10px;
    background: rgba(148, 163, 184, 0.08);
    color: #94a3b8;
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    min-height: 44px;
    -webkit-tap-highlight-color: transparent;
  }
  .ct-compile-schedule-btn:active {
    background: rgba(148, 163, 184, 0.18);
  }

## File: conversational_timeline.js — Part 3: Wire the button

Find the section where compile modal buttons are wired (~line 4028), where copyBtn and submitBtn
are wired via querySelector. It looks like:
  var copyBtn = modal.querySelector(".ct-compile-copy-btn");
  if (copyBtn) copyBtn.addEventListener("click", copyCompileSummary);

  var submitBtn = modal.querySelector(".ct-compile-submit-btn");
  if (submitBtn) submitBtn.addEventListener("click", submitCompileToOffice);

Add wiring for the schedule button immediately after the copyBtn wiring:
  var scheduleBtn = modal.querySelector(".ct-compile-schedule-btn");
  if (scheduleBtn) {
    scheduleBtn.addEventListener("click", function () {
      closeCompileModal();
      if (typeof switchScreen === "function") switchScreen("schedule");
    });
  }

## File: technician/index.html — Part 4: Version bumps

Bump conversational_timeline.js from ?v=78 to ?v=79 (~line 13705):
  <script src="../conversational_timeline.js?v=79"></script>

Update VC_BUILD (~line 7927):
  window.VC_BUILD = "IssuesFix65c-ScheduleBtn-2026-05-19";`,
    outOfScope: "Changing the × close button behavior. Changing the Submit to Office or Copy buttons. Adding a Schedule button anywhere other than the compile modal footer. Any Firestore writes or auth changes.",
    cacheBusts: ["conversational_timeline.js?v=79"],
  },

  {
    id: "65d",
    phase: 65,
    title: "Compile modal footer — fix z-index stacking so report text doesn't bleed through buttons",
    dependsOn: ["65b"],
    patterns: ["CSS-only restyle / theme"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["technician/index.html"],
    expectedIds: ["ct-compile-modal"],
    expectedExports: {},
    uiChange: true,
    playwrightSteps: [
      `await page.locator('.job-card').first().click();`,
      `await page.waitForTimeout(3000);`,
      `const compileBtn = page.locator('#ct-compile-btn, .ct-compile-btn, [id*="compile"]').first();`,
      `if (await compileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {`,
      `  await compileBtn.click();`,
      `  await page.waitForTimeout(2000);`,
      `}`,
      `// Scroll the textarea to the bottom to simulate content below the footer`,
      `await page.evaluate(() => {`,
      `  const ta = document.querySelector('.ct-compile-textarea');`,
      `  if (ta) ta.scrollTop = ta.scrollHeight;`,
      `});`,
      `await page.waitForTimeout(500);`,
      `await page.screenshot({ path: '_ss_compile_footer.png' });`,
    ],
    scope: `Fix issues-found tracker #19: scrollable compiled report text bleeds visually through
or behind the modal footer buttons (Schedule / Copy / Submit) due to stacking context issues.

## File: technician/index.html — CSS changes only

### Change 1 — .ct-compile-actions (~line 2765)

Current:
  .ct-compile-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    background: #13152a;
    flex-wrap: wrap;
  }

Add position: relative and z-index: 2 so the footer stacks above the scrollable body:
  .ct-compile-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    background: #13152a;
    flex-wrap: wrap;
    position: relative;
    z-index: 2;
  }

### Change 2 — .ct-compile-body (~line 2736) — ensure scrolling content clips to bounds

Add overflow-x: hidden to the existing .ct-compile-body rule so content does not
visually escape horizontally:
  .ct-compile-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 16px 14px;   /* NOTE: use the updated padding from 65b — 8px top, not 14px */
  }

IMPORTANT: The .ct-compile-body padding was already changed to "8px 16px 14px" by slice 65b.
Do NOT revert that; only add overflow-x: hidden to the existing rule.

### Update VC_BUILD (~line 7927):
  window.VC_BUILD = "IssuesFix65d-FooterStack-2026-05-19";

Do NOT change any JavaScript, button wiring, or modal open/close logic.`,
    outOfScope: "Changing button colors, padding, font size, or any JavaScript logic. CSS stacking and overflow changes only.",
    cacheBusts: [],
  },

  {
    id: "65e",
    phase: 65,
    title: "Document actual background sync intervals (answer to #21)",
    dependsOn: [],
    patterns: ["Governance / docs-only edits"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["PROJECT_STATUS/KNOWN_ISSUES.md"],
    expectedIds: [],
    expectedExports: {},
    scope: `Fix issues-found tracker #21: user asked whether background sync happens every ~45 seconds.
Document the actual sync cadences so the answer is findable in the project docs.

## Facts already confirmed in the codebase (do not re-grep — use these)

- **Live presence heartbeat**: technician/index.html ~line 13406 →
    window.setInterval(writeLivePresence, 15000) → fires every **15 seconds**.
- **Background compile safety-net sweep**: conversational_timeline.js ~line 3023 →
    COMPILE_BG_INTERVAL_MS = 5 * 60 * 1000 → fires every **5 minutes** as a safety net.
- **Background compile debounce**: conversational_timeline.js ~line 3024 →
    COMPILE_DEBOUNCE_MS = 45 * 1000 → waits **45 seconds** of quiet after the last
    chat entry before triggering the background compile. This is the "45 second" number
    the user was thinking of — it's the compile quiet-period, not a Firestore sync.
- **Firestore schedule/job listener**: real-time push via onSnapshot() — no polling interval.
    Updates arrive within 1–2 seconds of a write.

## Change to make

Open PROJECT_STATUS/KNOWN_ISSUES.md. Find or create a section "## Sync Cadences" near
the top of the active issues section. Add or update with the following content
(use exact markdown formatting):

---

## Sync Cadences (confirmed 2026-05-19)

| Signal | Mechanism | Interval |
|--------|-----------|----------|
| Live presence (tech screen + ticket) | setInterval → writeLivePresence | **15 s** |
| Firestore job/schedule updates | onSnapshot real-time listener | **< 2 s** (push) |
| Background auto-compile (quiet period) | COMPILE_DEBOUNCE_MS after last entry | **45 s** |
| Background compile safety-net sweep | COMPILE_BG_INTERVAL_MS setInterval | **5 min** |

> The "~45 seconds" the user noticed is the compile debounce quiet period —
> not a Firestore sync. Firestore job data is real-time.

---

If the section already exists, update it rather than duplicating it.
Do NOT modify technician/index.html or conversational_timeline.js.`,
    outOfScope: "Changing any sync intervals in code. Adding a UI 'last synced' indicator. Modifying any app logic.",
    cacheBusts: [],
  },

  {
    id: "65f",
    phase: 65,
    title: "Addendum chat — day separator dividers between different-day follow-up notes",
    dependsOn: ["65c", "65d"],
    patterns: ["Multi-file UI feature (no Firestore writes)", "CSS-only restyle / theme"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js", "technician/index.html"],
    expectedIds: ["ct-compile-modal"],
    expectedExports: {},
    uiChange: true,
    playwrightSteps: [
      `// Navigate to a past-day job if one exists to see addendum chat`,
      `const historicalCard = page.locator('.job-card--historical, .job-card[data-historical]').first();`,
      `const hasHistorical = await historicalCard.isVisible({ timeout: 2000 }).catch(() => false);`,
      `if (hasHistorical) {`,
      `  await historicalCard.click();`,
      `  await page.waitForTimeout(2000);`,
      `}`,
      `await page.screenshot({ path: '_ss_addendum_chat.png' });`,
    ],
    scope: `Fix issues-found tracker #16: when a technician adds follow-up notes on different
calendar days (addendum entries), all bubbles look identical except for the timestamp text.
Add a visual day separator divider between groups of addendum entries from different dates
so it's immediately obvious where a new day begins.

## File: conversational_timeline.js — renderTimeline (~line 649)

Find the renderTimeline function. Locate the loop that builds the html string.
It currently tracks addendumDividerShown. Add a lastAddendumDate tracker alongside it
and insert day separator dividers between addendum entries from different calendar days.

### Exact change in the loop setup (~line 667):

Current:
    var html = "";
    var addendumDividerShown = false;
    for (var i = 0; i < entries.length; i++) {
      var item = entries[i];
      if (!item) continue;

      if (item.meta && item.meta.addendum && !addendumDividerShown) {
        html += '<div class="ct-addendum-divider">Additional notes (follow-up visit)</div>';
        addendumDividerShown = true;
      }

Change to:
    var html = "";
    var addendumDividerShown = false;
    var lastAddendumDate = null;
    for (var i = 0; i < entries.length; i++) {
      var item = entries[i];
      if (!item) continue;

      if (item.meta && item.meta.addendum && !addendumDividerShown) {
        html += '<div class="ct-addendum-divider">Additional notes (follow-up visit)</div>';
        addendumDividerShown = true;
      }

      /* Day separator between addendum entries from different calendar days.
         Skip the separator for the very first addendum entry — the divider above handles it. */
      if (item.meta && item.meta.addendum && item.ts) {
        try {
          var entryDateLabel = new Date(item.ts).toLocaleDateString(undefined, {
            weekday: "long", month: "long", day: "numeric", year: "numeric"
          });
          if (lastAddendumDate !== null && entryDateLabel !== lastAddendumDate) {
            html += '<div class="ct-day-separator">' + escapeHtml(entryDateLabel) + '</div>';
          }
          lastAddendumDate = entryDateLabel;
        } catch (e) { /* degrade silently */ }
      }

IMPORTANT: The lastAddendumDate tracker block must be placed AFTER the addendumDividerShown block
but BEFORE the media/text rendering block.

## File: technician/index.html — CSS

Add a new CSS rule for .ct-day-separator after the .ct-addendum-divider rule (~line 1187):

  .ct-day-separator {
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #0ea5e9;
    margin: 14px 0 6px;
    padding: 4px 10px;
  }

## File: conversational_timeline.js — version bump

Bump conversational_timeline.js from ?v=79 to ?v=80 in technician/index.html (~line 13705):
  <script src="../conversational_timeline.js?v=80"></script>

Update VC_BUILD (~line 7927):
  window.VC_BUILD = "IssuesFix65f-DaySeparators-2026-05-19";`,
    outOfScope: "Day separators in non-addendum (today's active job) chat. Grouping original-day messages. Changing the compile behavior or bubble styling beyond the new separator divider.",
    cacheBusts: ["conversational_timeline.js?v=80"],
  },

  {
    id: "65g",
    phase: 65,
    title: "Compile Notes button — placement and label clarity in historical addendum mode",
    dependsOn: ["65f"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js", "technician/index.html"],
    expectedIds: ["ct-compile-btn", "ct-post-chat-actions"],
    expectedExports: {},
    uiChange: true,
    playwrightSteps: [
      `const historicalCard = page.locator('.job-card--historical, .job-card[data-historical]').first();`,
      `const hasHistorical = await historicalCard.isVisible({ timeout: 2000 }).catch(() => false);`,
      `if (hasHistorical) {`,
      `  await historicalCard.click();`,
      `  await page.waitForTimeout(2000);`,
      `  // Close compile modal if it auto-opens`,
      `  const closeBtn = page.locator('.ct-compile-close-btn');`,
      `  if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) await closeBtn.click();`,
      `  await page.waitForTimeout(1000);`,
      `}`,
      `await page.screenshot({ path: '_ss_compile_btn_addendum.png' });`,
    ],
    scope: `Fix issues-found tracker #14 (placement half only — skip incremental compile):
The Compile Notes button should appear visually connected to the addendum notes section,
and its label should make it obvious the button will compile/re-compile including the new notes.
Do NOT change the compile algorithm or add incremental compile logic.

## File: conversational_timeline.js — updateCompileBtnVisibility (~line 3093)

Find updateCompileBtnVisibility(). It currently handles is-historical-job like this:
  if (wsEl && wsEl.classList.contains("is-historical-job")) {
    btn.textContent = _compiledDisplayText ? "\\ud83d\\udcc4 View Compiled Notes" : "\\ud83d\\udcc4 Compiled Notes";
    btn.classList.remove("hidden");
    pinPostChatActions();
    return;
  }

Change so that in historical-addendum mode with addendum entries, the label reflects the action:
  if (wsEl && wsEl.classList.contains("is-historical-job")) {
    if (wsEl.classList.contains("is-historical-addendum-mode")) {
      var allEntries = loadEntries(currentTicketId);
      var hasAddendumEntries = allEntries.some(function (e) {
        return e && e.meta && e.meta.addendum;
      });
      if (hasAddendumEntries) {
        btn.textContent = _compiledDisplayText
          ? "\\ud83d\\udccb Re-Compile with New Notes"
          : "\\ud83d\\udccb Compile Notes";
        btn.classList.remove("hidden");
        pinPostChatActions();
        return;
      }
    }
    btn.textContent = _compiledDisplayText ? "\\ud83d\\udcc4 View Compiled Notes" : "\\ud83d\\udcc4 Compiled Notes";
    btn.classList.remove("hidden");
    pinPostChatActions();
    return;
  }

Note: \\ud83d\\udccb is the 📋 clipboard emoji; \\ud83d\\udcc4 is 📄 page emoji. Use those literal
unicode escapes inside the single-file JS (or use the actual emoji character directly).

## File: technician/index.html — CSS

Add a rule that visually connects the compile button to the addendum section when in addendum mode.
Add after the existing #screen-workspace.is-historical-job .ct-post-chat-actions rule (~line 1142):

  #screen-workspace.is-historical-job.is-historical-addendum-mode .ct-post-chat-actions {
    border-top: 1px dashed rgba(14, 165, 233, 0.35);
    margin-top: 8px;
    padding-top: 12px;
  }

## File: conversational_timeline.js + technician/index.html — version bumps

Bump conversational_timeline.js from ?v=80 to ?v=81 in technician/index.html (~line 13705):
  <script src="../conversational_timeline.js?v=81"></script>

Update VC_BUILD (~line 7927):
  window.VC_BUILD = "IssuesFix65g-CompileBtnPlacement-2026-05-19";`,
    outOfScope: "Incremental compile (merging only new addendum notes — that is #14 Phase B, deferred). Moving the compile button to a completely different DOM location. Changing compile behavior for active non-historical workspaces.",
    cacheBusts: ["conversational_timeline.js?v=81"],
  },

  // ═══════════════════════════════════════════════════════════
  //  Phase 66: Admin Conversational Checklist Builder
  //  Managers/dispatchers chat (voice or text) to create and
  //  update form_templates. Tech phone preview before save.
  //  Entry point: admin PIN at sign-in → "ADMIN" session flag.
  // ═══════════════════════════════════════════════════════════

  

  

  

  

];
